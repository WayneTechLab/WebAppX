/** Real browser DOM fixture tests for the actual coordinator. These do not claim app journeys. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { chromium } from '@playwright/test'

const sourceFiles = ['navigation-focus.ts', 'navigation-focus-dom.ts']
const source = (await Promise.all(sourceFiles.map(async name => ts.transpileModule(await readFile(new URL(`../../src/lib/${name}`, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .*$/gm, '').replace(/^export /gm, '')))).join('\n') + '\nwindow.createFixtureNavigationFocus = createBrowserNavigationFocus;'
const markup = `<nav aria-label="Global navigation"><a id="global-link" href="/docs" data-nav-focus="link:/docs">Docs</a></nav><main id="content" data-nav-main="true" tabindex="-1"><section data-nav-workspace="cms" data-nav-scope="author:lifetime1:epoch0" data-nav-active="true"><h1 data-nav-heading="workspace" data-nav-focus="cms:workspace" tabindex="-1">CMS portal</h1><h2 id="entries" data-nav-heading="list" data-nav-focus="cms:entries" tabindex="-1">Editorial entries</h2><div id="record"><label>Selected title<input id="edit-title" data-nav-focus="cms:entry:original:title" data-nav-fallback="cms:entries cms:workspace" value="Original fictional title"></label></div><input id="local-validation" aria-label="Local validation"><div id="mock-data-handling" data-nav-focus="portals:mock-data-handling" tabindex="-1">Mock data handling</div><span id="unsupported">Unsupported span</span></section></main>`

function setup() {
  window.coordinator = window.createFixtureNavigationFocus(document)
  window.makeCommit = (sequence, changes = {}) => Object.freeze({ sequence, location: '/cms/demo', kind: 'route', entry: Object.freeze({ id: `entry-${sequence}`, index: sequence }), restoreEntryId: null, focus: 'destination', ...changes })
  window.rememberField = () => { document.getElementById('edit-title').focus();window.coordinator.captureDeparture({ id: 'remembered', url: '/cms/demo', index: 0 });document.getElementById('entries').focus() }
  window.traverse = (sequence = 1) => { const commit=window.makeCommit(sequence,{kind:'traverse',restoreEntryId:'remembered'});window.coordinator.accept(commit);return window.coordinator.flush(commit) }
}

test('actual DOM coordinator excludes stale/hidden targets, honors local focus, and verifies final focus landing', async t => {
  const browser=await chromium.launch({headless:true});let context;const requests=[]
  async function fixture() { const page=await context.newPage();await page.setContent(markup);await page.addScriptTag({content:source});await page.evaluate(setup);return page }
  try {
    context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'})
    await context.route('**/*',route=>{requests.push(route.request().url());return route.abort()})
    await t.test('initial mount does not steal focus; accepted route focuses heading and explicit supported hash focuses its target',async()=>{
      const page=await fixture();assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BODY')
      assert.deepEqual(await page.evaluate(()=>{const c=window.makeCommit(1);window.coordinator.accept(c);const before=document.activeElement.tagName;window.coordinator.flush(c);const heading=document.activeElement.textContent;const h=window.makeCommit(2,{location:'/cms/demo#mock-data-handling'});window.coordinator.accept(h);window.coordinator.flush(h);return{before,heading,hash:document.activeElement.id}}),{before:'BODY',heading:'CMS portal',hash:'mock-data-handling'});await page.close()
    })
    await t.test('same scope restores the registered record target rather than its fallback',async()=>{
      const page=await fixture();assert.deepEqual(await page.evaluate(()=>{window.rememberField();window.traverse();return{id:document.activeElement.id,value:document.activeElement.value}}),{id:'edit-title',value:'Original fictional title'});await page.close()
    })
    for(const mutation of ['removed','reused-id','replacement','identity','lifetime','hidden','inert','aria-hidden','disabled','detached','obsolete-subsection','duplicate-key']) {
      await t.test(`${mutation} remembered target falls back to the actual list without changing record selection`,async()=>{
        const page=await fixture();const observed=await page.evaluate(mode=>{
          window.rememberField();const input=document.getElementById('edit-title'),owner=input.closest('[data-nav-workspace]'),record=document.getElementById('record')
          if(mode==='removed'||mode==='detached')input.remove()
          if(mode==='reused-id'){input.dataset.navFocus='cms:entry:replacement:title';input.value='Different record stays selected'}
          if(['replacement','identity','lifetime'].includes(mode))owner.dataset.navScope=mode==='replacement'?'author:lifetime1:epoch1':mode==='identity'?'reviewer:lifetime1:epoch0':'author:lifetime2:epoch0'
          if(mode==='hidden')record.hidden=true
          if(mode==='inert')record.inert=true
          if(mode==='aria-hidden')record.setAttribute('aria-hidden','true')
          if(mode==='disabled')input.disabled=true
          if(mode==='obsolete-subsection')record.dataset.navActive='false'
          if(mode==='duplicate-key'){const duplicate=input.cloneNode();duplicate.id='duplicate';record.append(duplicate)}
          window.traverse();return{focused:document.activeElement.id,scope:owner.dataset.navScope,value:input.value,key:input.dataset.navFocus}
        },mutation)
        assert.equal(observed.focused,'entries');if(mutation==='reused-id'){assert.equal(observed.value,'Different record stays selected');assert.equal(observed.key,'cms:entry:replacement:title')}
        if(['replacement','identity','lifetime'].includes(mutation))assert.notEqual(observed.scope,'author:lifetime1:epoch0');await page.close()
      })
    }
    await t.test('a remembered global navigation link remains valid on a portal route',async()=>{
      const page=await fixture();assert.equal(await page.evaluate(()=>{document.getElementById('global-link').focus();window.coordinator.captureDeparture({id:'remembered',url:'/cms/demo',index:0});document.getElementById('entries').focus();window.traverse();return document.activeElement.id}),'global-link');await page.close()
    })
    await t.test('unregistered native control records fallback-only context for its current list',async()=>{
      const page=await fixture();assert.equal(await page.evaluate(()=>{document.getElementById('local-validation').focus();window.coordinator.captureDeparture({id:'remembered',url:'/cms/demo',index:0});document.getElementById('edit-title').remove();window.traverse();return document.activeElement.id}),'entries');await page.close()
    })
    await t.test('missing, unsupported and inactive hash targets use the active workspace heading',async()=>{
      const page=await fixture();const ids=await page.evaluate(()=>['missing','unsupported','mock-data-handling'].map((id,index)=>{if(id==='mock-data-handling')document.getElementById(id).inert=true;const c=window.makeCommit(index+1,{location:`/cms/demo#${id}`});window.coordinator.accept(c);window.coordinator.flush(c);return document.activeElement.dataset.navFocus}));assert.deepEqual(ids,['cms:workspace','cms:workspace','cms:workspace']);await page.close()
    })
    await t.test('new local validation focus and open modal win permanently over pending route focus',async()=>{
      const page=await fixture();const result=await page.evaluate(()=>{const c=window.makeCommit(1);window.coordinator.accept(c);document.getElementById('local-validation').focus();const skipped=window.coordinator.flush(c);const local=document.activeElement.id;const dialog=document.createElement('dialog');dialog.innerHTML='<button>Keep editing</button>';document.body.append(dialog);const d=window.makeCommit(2);window.coordinator.accept(d);dialog.showModal();const modalSkip=window.coordinator.flush(d);dialog.close();const replay=window.coordinator.flush(d);return{skipped,local,modalSkip,replay}});assert.deepEqual(result,{skipped:false,local:'local-validation',modalSkip:false,replay:false});await page.close()
    })
    await t.test('a focus handler retaining local validation focus stops the old route fallback chain',async()=>{
      const page=await fixture();const result=await page.evaluate(()=>{window.rememberField();const field=document.getElementById('edit-title');field.addEventListener('focus',()=>document.getElementById('local-validation').focus(),{once:true});const moved=window.traverse();return{moved,id:document.activeElement.id}});assert.deepEqual(result,{moved:false,id:'local-validation'});await page.close()
    })
    await t.test('key/scope mutation during a failed focus attempt cannot authorize stale candidates',async()=>{
      const page=await fixture();const result=await page.evaluate(()=>{window.rememberField();const field=document.getElementById('edit-title');field.addEventListener('focus',()=>{field.dataset.navFocus='cms:entry:other:title';field.closest('[data-nav-workspace]').dataset.navScope='other:epoch99';field.blur()},{once:true});const moved=window.traverse();return{moved,id:document.activeElement.id,key:field.dataset.navFocus}});assert.deepEqual(result,{moved:true,id:'content',key:'cms:entry:other:title'});await page.close()
    })
    await t.test('ambiguous active workspaces cannot select an arbitrary private heading',async()=>{
      const page=await fixture();assert.equal(await page.evaluate(()=>{window.rememberField();const duplicate=document.querySelector('[data-nav-workspace]').cloneNode(true);duplicate.dataset.navWorkspace='crm';duplicate.dataset.navScope='other';document.querySelector('main').append(duplicate);window.traverse();return document.activeElement.id}),'content');await page.close()
    })
    assert.deepEqual(requests,[],'DOM fixture tests must not request any service or provider')
  } finally {try {await context?.close()} finally {await browser.close()}}
})
