import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const { createNavigationFocusCoordinator } = await loadMockModel(new URL('../../src/lib/navigation-focus.ts', import.meta.url))
const { createNavigationDriver, NAVIGATION_STATE_KEY } = await loadMockModel(new URL('../../src/lib/navigation.ts', import.meta.url))
const commit = (sequence, changes = {}) => Object.freeze({ sequence, location: '/cms/demo', kind: 'route', entry: Object.freeze({ id: `entry-${sequence}`, index: sequence }), restoreEntryId: null, focus: 'destination', ...changes })
const target = () => ({ workspace: 'cms', scope: 'author:instance1:epoch0', key: 'cms:entry:entry-original:title', context: '', fallbacks: ['cms:entries', 'cms:workspace'] })
function focusFixture(limit = 100) {
  let captured = target(), active = 'departure', priority = false
  const calls = [], remembered = []
  const coordinator = createNavigationFocusCoordinator({ capture: () => captured, active: () => active, hasPriorityFocus: value => priority || value !== active,
    candidates(request) { remembered.push(request.remembered); return ['record', 'list', 'workspace'] },
    focus(value) { calls.push(value); return value === 'list' },
  }, limit)
  return { coordinator, calls, remembered, setCaptured(value) { captured = value }, setActive(value) { active = value }, setPriority(value) { priority = value } }
}

test('capture is semantic defensive memory, acceptance alone never focuses, and actual failure continues the chain', () => {
  const fixture = focusFixture();const original = target();fixture.setCaptured(original)
  fixture.coordinator.captureDeparture({ id: 'remember', url: '/cms/demo', index: 0 })
  original.key = 'changed';original.fallbacks[0] = 'wrong'
  const accepted = commit(1, { kind: 'traverse', restoreEntryId: 'remember' })
  fixture.coordinator.accept(accepted);assert.deepEqual(fixture.calls, [])
  assert.equal(fixture.coordinator.flush(accepted), true)
  assert.deepEqual(fixture.calls, ['record', 'list'])
  assert.deepEqual(fixture.remembered, [target()])
  assert.ok(Object.isFrozen(fixture.remembered[0]) && Object.isFrozen(fixture.remembered[0].fallbacks))
  assert.equal(fixture.coordinator.flush(accepted), false)
})

test('stale and cloned accepted snapshots cannot focus; only the latest object may flush', () => {
  const fixture = focusFixture();const one=commit(1), two=commit(2)
  fixture.coordinator.accept(one);fixture.coordinator.accept(two)
  assert.equal(fixture.coordinator.flush(one), false)
  assert.equal(fixture.coordinator.flush({ ...two }), false)
  assert.equal(fixture.coordinator.flush(two), true)
  assert.equal(fixture.coordinator.flush(two), false)
})

test('a newer local focus or dialog decision wins, and that commit cannot replay later', () => {
  for (const mode of ['active', 'dialog']) {
    const fixture=focusFixture();const accepted=commit(1);fixture.coordinator.accept(accepted)
    if (mode==='active') fixture.setActive('validation field');else fixture.setPriority(true)
    assert.equal(fixture.coordinator.flush(accepted), false)
    fixture.setActive('departure');fixture.setPriority(false)
    assert.equal(fixture.coordinator.flush(accepted), false)
    assert.deepEqual(fixture.calls, [])
  }
})

test('scroll-spy hash and retained-owner commits preserve local focus; a later destination commit still works', () => {
  const fixture=focusFixture()
  for (const kind of ['hash', 'route']) { const accepted=commit(kind==='hash'?1:2,{kind,focus:'preserve'});fixture.coordinator.accept(accepted);assert.equal(fixture.coordinator.flush(accepted),false) }
  assert.deepEqual(fixture.calls,[])
  const route=commit(3);fixture.coordinator.accept(route);assert.equal(fixture.coordinator.flush(route),true)
})

test('an empty capture from an open modal cannot erase a departure captured before the guard', () => {
  const fixture=focusFixture();fixture.coordinator.captureDeparture({id:'old',url:'/cms/demo',index:0})
  fixture.setCaptured(null);fixture.coordinator.captureDeparture({id:'old',url:'/cms/demo',index:0})
  const accepted=commit(1,{kind:'traverse',restoreEntryId:'old'});fixture.coordinator.accept(accepted);fixture.coordinator.flush(accepted)
  assert.deepEqual(fixture.remembered,[target()])
})

test('memory is bounded and revisiting an entry refreshes its retention order', () => {
  const fixture=focusFixture(2)
  for (const id of ['a','b','a','c']) fixture.coordinator.captureDeparture({id,url:'/cms/demo',index:0})
  assert.equal(fixture.coordinator.size(),2)
  const b=commit(1,{kind:'traverse',restoreEntryId:'b'});fixture.coordinator.accept(b);fixture.coordinator.flush(b)
  const a=commit(2,{kind:'traverse',restoreEntryId:'a'});fixture.coordinator.accept(a);fixture.coordinator.flush(a)
  assert.deepEqual(fixture.remembered,[null,target()])
})

test('oversized/invalid semantic captures refuse without truncating identity or leaking into memory', () => {
  const fixture=focusFixture()
  for (const invalid of [{...target(),key:'x'.repeat(513)},{...target(),scope:''},{...target(),context:'x'.repeat(1025)},{...target(),fallbacks:Array(9).fill('cms:entries')}]) {
    fixture.setCaptured(invalid);fixture.coordinator.captureDeparture({id:'bad',url:'/cms/demo',index:0});assert.equal(fixture.coordinator.size(),0)
  }
  for (const invalid of [0,-1,501,1.5]) assert.throws(()=>focusFixture(invalid),/Invalid/)
})

test('a reentrant newer commit stops the old fallback chain, and disposal revokes all future work', () => {
  const calls=[];let coordinator
  coordinator=createNavigationFocusCoordinator({capture:()=>null,active:()=>null,hasPriorityFocus:()=>false,candidates:()=>['old','must-not-focus'],focus(value){calls.push(value);coordinator.accept(commit(2));return false}})
  const first=commit(1);coordinator.accept(first);assert.equal(coordinator.flush(first),false);assert.deepEqual(calls,['old'])
  coordinator.dispose();coordinator.captureDeparture({id:'a',url:'/',index:0});coordinator.accept(commit(3));assert.equal(coordinator.flush(commit(3)),false);assert.equal(coordinator.size(),0)
})

function driverFixture() {
  const entries=[{url:'/cms/demo',state:{unrelated:'preserved'}}];let position=0,decision=null
  const events=[],accepted=[],captures=[],moves=[]
  const driver=createNavigationDriver({location:()=>entries[position].url,state:()=>entries[position].state,
    replace(state,url){entries[position]={state:structuredClone(state),url}},push(state,url){entries.splice(position+1,Infinity,{state:structuredClone(state),url});position++},go(delta){moves.push(delta)},
    captureDeparture(entry){captures.push(entry);events.push('capture')},accepted(value){accepted.push(value);events.push('accepted')},committed(url){events.push(`navigation:${url}`)},scroll(url){events.push(`scroll:${url}`)},
  },(request,finish)=>{events.push('guard');if(decision===false){decision={request,finish};return false}finish();return true},'focus-fixture')
  return {driver,entries,events,accepted,captures,moves,setDirty(){decision=false},getDecision:()=>decision,traverse(index){position=index;driver.onPopState()}}
}

test('accepted driver snapshots are immutable and sequenced; capture runs before a dirty guard and refusal emits no commit', () => {
  const f=driverFixture();f.setDirty();assert.equal(f.driver.navigate('/crm/demo'),false)
  assert.deepEqual(f.events,['capture','guard']);assert.deepEqual(f.accepted,[])
  f.getDecision().finish();assert.equal(f.accepted.length,1)
  const accepted=f.accepted[0];assert.equal(accepted.location,'/crm/demo');assert.equal(accepted.kind,'route');assert.equal(accepted.focus,'destination')
  assert.ok(Object.isFrozen(accepted)&&Object.isFrozen(accepted.entry))
  assert.throws(()=>{accepted.entry.id='wrong'},TypeError)
})

test('same-location, explicit hash and scroll-spy hash each get unique commits; only scroll-spy suppresses navigation event', () => {
  const f=driverFixture();f.driver.navigate('/cms/demo');f.driver.navigate('/cms/demo#editor');const before=f.events.filter(x=>x.startsWith('navigation:')).length
  f.driver.replaceHash('/cms/demo#list')
  assert.deepEqual(f.accepted.map(a=>[a.sequence,a.location,a.kind,a.focus]),[[1,'/cms/demo','route','destination'],[2,'/cms/demo#editor','route','destination'],[3,'/cms/demo#list','hash','preserve']])
  assert.equal(f.events.filter(x=>x.startsWith('navigation:')).length,before)
})

test('guarded traversal carries intended target identity across current-slot replacement without any history.go', () => {
  const f=driverFixture();const original=f.driver.current().id;f.driver.navigate('/crm/demo');f.setDirty();f.traverse(0)
  assert.equal(f.driver.current().url,'/crm/demo');assert.deepEqual(f.moves,[]);const before=f.accepted.length
  f.getDecision().finish();const accepted=f.accepted.at(-1)
  assert.equal(f.accepted.length,before+1);assert.equal(accepted.kind,'traverse');assert.equal(accepted.restoreEntryId,original);assert.notEqual(accepted.entry.id,original)
  assert.equal(f.entries[0].state[NAVIGATION_STATE_KEY].entry,accepted.entry.id);assert.deepEqual(f.moves,[])
})

test('retained-owner activation publishes a real route with focus preservation for the existing owner callback', () => {
  const f=driverFixture();let focuses=0;assert.equal(f.driver.activateRetainedOwner('/crm/demo',()=>focuses++),true)
  assert.equal(focuses,1);assert.equal(f.accepted.at(-1).focus,'preserve')
  assert.equal(f.driver.activateRetainedOwner('/outside',()=>assert.fail('unsupported owner')),false)
})


test('a local validation focus triggered during a refused focus attempt stops further fallback', () => {
  let active='initial';const calls=[]
  const coordinator=createNavigationFocusCoordinator({capture:()=>null,active:()=>active,hasPriorityFocus:previous=>previous!==active,candidates:()=>['record','must-not-focus'],focus(value){calls.push(value);active='local validation';return false}})
  const accepted=commit(1);coordinator.accept(accepted);assert.equal(coordinator.flush(accepted),false);assert.deepEqual(calls,['record'])
})


test('disposing a driver revokes pending guard callbacks and retained-owner actions without a new commit or history write', () => {
  const f=driverFixture();f.setDirty();f.driver.navigate('/crm/demo');const late=f.getDecision().finish;const before=structuredClone(f.entries);f.driver.dispose();late();
  assert.deepEqual(f.entries,before);assert.deepEqual(f.accepted,[]);assert.equal(f.driver.navigate('/docs'),false);assert.equal(f.driver.replaceHash('/cms/demo#x'),false);assert.equal(f.driver.replaceState({},'/docs'),false);assert.equal(f.driver.activateRetainedOwner('/crm/demo',()=>assert.fail('disposed owner')),false);assert.deepEqual(f.moves,[])
})
