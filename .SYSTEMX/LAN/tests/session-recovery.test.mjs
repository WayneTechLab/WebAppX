import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSessionArtifact, sessionWorkspaceId } from '../Builder/runtime/session-artifacts.mjs'
import { createSessionRecoveryPlan, recoverExitedSession } from '../session-recovery.mjs'
import { captureSessionProcessIdentity, inspectSessionProcess } from '../session-restart-preview.mjs'

const lanSource = fileURLToPath(new URL('../', import.meta.url))
const absent = pid => ({ pid, exists: false })
function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'webappx-recovery-')))
  t.after(() => rmSync(root,{recursive:true,force:true}))
  const lan=join(root,'.SYSTEMX','LAN'), state=join(root,'.SYSTEMX','state')
  mkdirSync(state,{recursive:true});mkdirSync(lan)
  for(const name of ['session-control.mjs','session-restart-preview.mjs','session-recovery.mjs','Builder/runtime']){
    const path=join(lan,name);mkdirSync(dirname(path),{recursive:true});cpSync(join(lanSource,name),path,{recursive:true})
  }
  const sessionId='systemx-'+randomUUID(), config=join(state,'firebase-'+sessionId+'.json')
  const record={schemaVersion:1, sessionId, workspaceId:sessionWorkspaceId(root),mode:'combined',ownerPid:900001,
    processes:{session:900001,lan:900002,vite:900003}, processIdentities:{}, ports:{app:60000,lan:60001,firebase:{auth:60002,firestore:60003,storage:60004}},
    runtime:{firebaseConfig:config}, artifactReceipts:{}}
  const own=(key,file,bytes)=>{record.artifactReceipts[key]=createSessionArtifact(file,bytes)}
  own('firebaseConfig',config,'{"emulators":{}}\n')
  own('lanPid',join(state,'local-lan-60001.pid'),'900002\n')
  own('vitePid',join(state,'local-vite-60000.pid'),'900003\n')
  const current=join(state,'local-session.json')
  const save=()=>writeFileSync(current,JSON.stringify(record))
  save()
  const deps={repoRoot:root,session:record,platform:'darwin',inspectProcess:absent,inspectListeners:()=>({complete:true,listeners:[]})}
  const read=()=>Object.fromEntries(readdirSync(state).filter(x=>x!=='local-session.json.lock').map(name=>[name,readFileSync(join(state,name),'utf8')]))
  function cli(args){return spawnSync(process.execPath,[join(lan,'session-control.mjs'),...args],{cwd:root,encoding:'utf8',timeout:8000})}
  return {root,lan,state,config,record,save,current,deps,read,cli}
}

test('recovery validates the exact generation, file identity and bytes before removing only owned runtime artifacts',t=>{
  const f=fixture(t)
  const other='firebase-systemx-'+randomUUID()+'.json'
  writeFileSync(join(f.state,other),'another generation\n')
  const bytes=f.read()
  const plan=createSessionRecoveryPlan(f.deps)
  assert.equal(plan.canRecover,true)
  assert.ok(plan.artifacts.every(x=>x.state==='verified'))
  assert.deepEqual(f.read(),bytes)
  assert.equal(recoverExitedSession(f.deps,'other').recovered,false)
  assert.deepEqual(f.read(),bytes)
  const old=f.config+'.saved';renameSync(f.config,old);writeFileSync(f.config,readFileSync(old))
  assert.equal(createSessionRecoveryPlan(f.deps).canRecover,false)
  assert.equal(recoverExitedSession(f.deps,f.record.sessionId).recovered,false)
  assert.ok(existsSync(f.current)&&existsSync(old)&&existsSync(join(f.state,other)))
  rmSync(f.config);renameSync(old,f.config)
  const recovered=recoverExitedSession(f.deps,f.record.sessionId)
  assert.equal(recovered.recovered,true)
  assert.deepEqual(f.read(),{[other]:'another generation\n'})
})

test('legacy missing artifact receipt, linked config, unknown listener, incomplete snapshot and replacement record each preserve all original files',t=>{
  const f=fixture(t)
  const bytes=f.read()
  const noReceipt={...f.record,artifactReceipts:{}}
  assert.equal(createSessionRecoveryPlan({...f.deps,session:noReceipt}).canRecover,false)
  const foreign={...f.record,workspaceId:'0'.repeat(64)}
  assert.equal(createSessionRecoveryPlan({...f.deps,session:foreign}).canRecover,false)
  const external=join(f.root,'external.json')
  linkSync(f.config,external)
  assert.equal(createSessionRecoveryPlan(f.deps).canRecover,false)
  rmSync(external)
  for(const snapshot of [{complete:false,listeners:[]},{complete:true,listeners:[{port:60001,pid:89122}]}]){
    const denied=recoverExitedSession({...f.deps,inspectListeners:()=>snapshot},f.record.sessionId)
    assert.equal(denied.recovered,false);assert.deepEqual(f.read(),bytes)
  }
  writeFileSync(f.current,JSON.stringify({...f.record,sessionId:'different-generation'}))
  const replaced=f.read()
  assert.equal(recoverExitedSession(f.deps,f.record.sessionId).recovered,false)
  assert.deepEqual(f.read(),replaced)
})

test('the operator CLI previews then recovers an exited disposable standalone generation while preserving another artifact', {skip:process.platform==='win32'},async t=>{
  const f=fixture(t)
  const child=spawn(process.execPath,['-e',''],{cwd:f.root,stdio:'ignore'})
  await once(child,'close')
  assert.equal(inspectSessionProcess(child.pid).exists,false)
  const socket=createServer()
  socket.listen(0,'127.0.0.1');await once(socket,'listening')
  const port=socket.address().port
  await new Promise(done=>socket.close(done))
  f.record.mode='lan-only';f.record.ownerPid=child.pid;f.record.processes={lan:child.pid};f.record.ports={lan:port}
  f.record.artifactReceipts={};delete f.record.runtime;f.save()
  const before=f.read()
  const r=f.cli(['recover','--preview'])
  assert.equal(r.status,0,r.stdout+r.stderr)
  assert.equal(JSON.parse(r.stdout).canRecover,true);assert.deepEqual(f.read(),before)
  const wrong=f.cli(['recover','--generation','wrong'])
  assert.equal(wrong.status,1);assert.deepEqual(f.read(),before)
  const receipt=f.cli(['recover','--generation',f.record.sessionId])
  assert.equal(receipt.status,0,receipt.stdout+receipt.stderr);assert.equal(JSON.parse(receipt.stdout).recovered,true)
  delete before['local-session.json'];assert.deepEqual(f.read(),before)
})

test('after a disposable supervisor exits the CLI distinguishes its surviving LAN child from an unknown listener without signaling either', {skip:process.platform!=='darwin',timeout:20000},async t=>{
  const f=fixture(t), marker=join(f.root,'fixture-release')
  const serverScript=join(f.lan,'server.mjs'), supervisorScript=join(f.lan,'dev-session.mjs')
  writeFileSync(serverScript,`import net from 'node:net';import {existsSync} from 'node:fs';const server=net.createServer();server.listen(0,'127.0.0.1',()=>process.send(server.address().port));const timer=setInterval(()=>{if(existsSync('fixture-release')){clearInterval(timer);server.close(()=>process.exit(0))}},25);`)
  writeFileSync(supervisorScript,`import {spawn} from 'node:child_process';const child=spawn(process.execPath,['.SYSTEMX/LAN/server.mjs'],{stdio:['ignore','ignore','ignore','ipc']}); child.on('message',port=>process.send({port,pid:child.pid}));process.once('message',()=>{child.disconnect();process.exit(0)});`)
  const owner=spawn(process.execPath,[supervisorScript],{cwd:f.root,stdio:['ignore','ignore','ignore','ipc']})
  let fixturePid
  const closed=once(owner,'close')
  const unrelated=createServer();unrelated.listen(0,'127.0.0.1');await once(unrelated,'listening')
  try {
    const [{port,pid}]=await once(owner,'message',{signal:AbortSignal.timeout(4500)})
    fixturePid=pid
    Object.assign(f.record,{ownerPid:owner.pid,processes:{session:owner.pid,lan:pid},processIdentities:{
      session:captureSessionProcessIdentity(owner.pid,{workingDirectory:f.root}),lan:captureSessionProcessIdentity(pid,{workingDirectory:f.root})}})
    f.record.ports.lan=port;f.record.ports.firebase.auth=unrelated.address().port;f.record.artifactReceipts={};delete f.record.runtime;f.save()
    assert.ok(f.record.processIdentities.lan && f.record.processIdentities.session)
    const before=f.read()
    owner.send('exit');await closed
    assert.equal(inspectSessionProcess(owner.pid).exists,false)
    const preview=f.cli(['recover','--preview']);assert.equal(preview.status,1,preview.stdout+preview.stderr)
    const plan=JSON.parse(preview.stdout)
    assert.equal(plan.processes.find(row=>row.role==='lan').state,'orphaned')
    assert.deepEqual(plan.listeners.find(row=>row.pid===pid),{component:'lan',port,pid,ownership:'recorded-orphan'})
    assert.equal(plan.listeners.find(row=>row.pid===process.pid).ownership,'unverified')
    assert.equal(f.cli(['recover','--generation',f.record.sessionId]).status,1)
    assert.deepEqual(f.read(),before);assert.equal(inspectSessionProcess(pid).exists,true);assert.equal(unrelated.listening,true)
    f.record.processIdentities.lan.startedAt='different birth';f.save()
    const changed=JSON.parse(f.cli(['recover','--preview']).stdout)
    assert.equal(changed.processes.find(row=>row.role==='lan').state,'unverified')
  } finally {
    writeFileSync(marker,'close');if(owner.exitCode===null && owner.signalCode===null) owner.kill()
    await closed;await new Promise(done=>unrelated.close(done))
    if (fixturePid) {
      const end=Date.now()+5000
      while(inspectSessionProcess(fixturePid).exists===true && Date.now()<end) await delay(25)
      assert.equal(inspectSessionProcess(fixturePid).exists,false,'disposable LAN child must exit through its own shutdown control')
    }
  }
})

test('a record replaced during final listener inspection preserves the replacement and all artifact bytes', t => {
  const work = fixture(t)
  const original = work.read()
  const replacement = JSON.stringify({ ...work.record, sessionId: 'subsequent-generation' })
  let reads = 0
  const result = recoverExitedSession({
    ...work.deps,
    inspectListeners() {
      if (++reads === 2) writeFileSync(work.current, replacement)
      return { complete: true, listeners: [] }
    },
  }, work.record.sessionId)
  assert.equal(result.recovered, false)
  assert.deepEqual(work.read(), { ...original, 'local-session.json': replacement })
})
