import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, rm, access, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { buildChildProcessReport, childProcessLimits, parseChildProcessBaseline, readChildProcessReport, scanJavaScriptSource as scan, scanPythonSources } from '../../scripts/check-child-processes.mjs'

const baseline = exceptions => ({ schemaVersion: 1, fingerprintFormat: 'typescript-structure-v1+python-ast-v1', sourceRevision: '49a9efe345c815c2bead1cbbeb83204d31e64290', exceptions })
const js = source => scan({ path: 'scripts/fixture.mjs', source })
const py = source => scanPythonSources([{ path: 'scripts/fixture.py', source }])
const rules = findings => findings.flatMap(finding => finding.rules)
const exception = finding => ({ path: finding.path, kind: finding.kind, fingerprint: finding.fingerprint, count: 1, reason: 'Reviewed exact fictional test occurrence.' })

test('literal argv without a shell passes direct, aliased, namespace, require and promisified child bindings', () => {
  for (const source of [
    `import {execFile} from 'node:child_process'; execFile('git',['status','--porcelain']);`,
    `import {spawn as launch} from 'child_process'; launch('git',['status'],{shell:false});`,
    `import * as cp from 'node:child_process'; cp.spawnSync('node',['--version'],{shell:false});`,
    `const {execFile: launch}=require('child_process'); launch('git',['status']);`,
    `const cp=require('node:child_process'); const launch=cp.execFile; launch('git',['status']);`,
    `import {execFile} from 'node:child_process'; import {promisify as p} from 'node:util'; const run=p(execFile); run('git',['status'],{shell:false});`,
    `import {fork} from 'node:child_process'; fork('./worker.mjs',['--check'],{cwd:root,execArgv:[]});`,
  ]) assert.deepEqual(js(source), [])
})

test('implicit exec shells are detected through aliases and promisify; shadowed ordinary methods do not count', () => {
  assert.equal(js(`import {exec as launch} from 'node:child_process'; launch(command);`)[0].kind, 'javascript:exec')
  assert.ok(rules(js(`import cp from 'child_process'; cp.execSync('SECRET_PAYLOAD');`)).includes('implicit-shell'))
  assert.ok(rules(js(`import {exec} from 'child_process'; import {promisify} from 'util'; const go=promisify(exec); go('SECRET_PAYLOAD');`)).includes('implicit-shell'))
  assert.deepEqual(js(`import {exec} from 'child_process'; function harmless(exec){exec('plain');} const regex=/x/; regex.exec('plain');`), [])
})

test('shell options follow literal objects, spreads and aliases in override order; uncertain options refuse', () => {
  assert.deepEqual(js(`import {spawn} from 'child_process'; const opts=Object.freeze({shell:false,timeout:10}); spawn('git',[],opts);`), [])
  assert.ok(rules(js(`import {spawn} from 'child_process'; spawn('git',[],{shell:true});`)).includes('shell-enabled'))
  assert.ok(rules(js(`import {spawn} from 'child_process'; spawn('git',[],{shell:false,...options});`)).includes('options-indeterminate'))
  assert.deepEqual(js(`import {spawn} from 'child_process'; spawn('git',[],{...options,shell:false});`), [])
  assert.ok(rules(js(`import {spawn} from 'child_process'; const options={shell:false}; options.shell=true; spawn('git',[],options);`)).includes('options-indeterminate'))
  assert.ok(rules(js(`import {spawn} from 'child_process'; spawn('git',[],{get shell(){throw Error('TRAP')}});`)).includes('options-indeterminate'))
})

test('known spreads without shell preserve an earlier true value; option aliases share mutation identity', () => {
  const knownSpread = js(`import {spawn} from 'node:child_process'; spawn('git',[],{shell:true,...{timeout:1}});`)
  assert.ok(rules(knownSpread).includes('shell-enabled'))
  const aliasMutation = js(`import {spawn} from 'node:child_process'; const options={shell:false}; const alias=options; alias.shell=true; spawn('git',[],options);`)
  assert.ok(rules(aliasMutation).includes('options-indeterminate'))
  const chained = js(`import {spawn} from 'node:child_process'; const options={shell:false}; const first=options; const second=first; Object.assign(second,{shell:true}); spawn('git',[],options);`)
  assert.ok(rules(chained).includes('options-indeterminate'))
})

test('explicit interpreter strings, string argv and unresolved child namespace construction need review', () => {
  for (const [exe, flag] of [['sh','-c'],['bash','-c'],['cmd.exe','/C'],['powershell.exe','-Command'],['pwsh','-EncodedCommand'],['python3','-c'],['node','--eval']]) assert.ok(rules(js(`import{execFile}from'child_process';execFile('${exe}',['${flag}','SECRET_BODY']);`)).includes('interpreter-string'))
  assert.ok(rules(js(`import{spawn}from'child_process';spawn('git','status '+payload);`)).includes('argv-indeterminate'))
  assert.ok(rules(js(`import*as cp from'child_process'; cp[method]('git',[]);`)).includes('callee-indeterminate'))
  assert.ok(rules(js(`import{spawn}from'child_process'; function run(exe,args,options){spawn(exe,args,options);}`)).includes('options-indeterminate'))
})

test('default injected child bindings are checked; options and opaque argv remain explicit review findings', () => {
  const result = js(`import {spawnSync} from 'child_process'; function inspect({run=spawnSync}={}){return run(exe,args,options)}`)
  assert.equal(result.length, 1); assert.equal(result[0].kind, 'javascript:spawnSync')
  assert.deepEqual(result[0].rules, ['argv-indeterminate', 'executable-indeterminate', 'options-indeterminate'])
})

test('Python AST accepts argv forms and detects aliases, shells, strings, code channels and unknown options', () => {
  assert.deepEqual(py(`import subprocess as cp, sys\ncp.run([sys.executable,'-B','owned.py'],shell=False)`), [])
  assert.deepEqual(py(`from subprocess import check_output as run\nrun(['git','status'],text=True)`), [])
  assert.ok(rules(py(`from subprocess import run as go\ngo('echo '+payload,shell=True)`)).includes('shell-enabled'))
  assert.ok(rules(py(`import os as machine\nmachine.system('SECRET_PAYLOAD')`)).includes('implicit-shell'))
  assert.ok(rules(py(`from os import popen as launch\nlaunch('SECRET_PAYLOAD')`)).includes('implicit-shell'))
  assert.ok(rules(py(`import subprocess,sys\ncommand=[sys.executable,'-I','-B','-c',code,*args]\nsubprocess.Popen(command,**options)`)).includes('interpreter-string'))
  assert.ok(rules(py(`import subprocess\nsubprocess.run(['git','status'],shell=flag)`)).includes('options-indeterminate'))
})

test('Python aliased mutable argv cannot hide an interpreter command by mutating its other name', () => {
  const result = py(`import subprocess
command=['git']
alias=command
alias[0]='bash'
alias.extend(['-c','INERT_REVIEW_PAYLOAD'])
subprocess.run(command,shell=False)`)
  assert.equal(result.length,1); assert.ok(result[0].rules.includes('argv-indeterminate'))
  assert.doesNotMatch(JSON.stringify(result),/INERT_REVIEW_PAYLOAD/)
})

test('fingerprints ignore trivia but bind literals and exact occurrence counts; copied legacy unsafe calls fail', () => {
  const source = `import {exec} from 'child_process'; exec('fixture');`, finding = js(source)[0], accepted = baseline([exception(finding)])
  assert.equal(js(source.replace("exec('fixture')", "exec( /* trivia */ 'fixture' )"))[0].fingerprint, finding.fingerprint)
  assert.equal(buildChildProcessReport(js(source), accepted).ok, true)
  const duplicate = buildChildProcessReport(js(source + `exec('fixture');`), accepted)
  assert.equal(duplicate.ok, false); assert.ok(duplicate.diagnostics.some(item => item.status === 'baseline-count-exceeded'))
  assert.equal(buildChildProcessReport(js(source.replace('fixture', 'changed')), accepted).ok, false)
  assert.equal(buildChildProcessReport([], accepted).ok, false)
})

test('malformed, duplicate, broad-file and stale baseline entries refuse', () => {
  const finding = js(`import{exec}from'child_process';exec('fixture');`)[0]
  for (const value of [null, {...baseline([]),extra:true}, baseline([{...exception(finding),fingerprint:'*'}]), baseline([{...exception(finding),count:0}]), baseline([exception(finding),exception(finding)])]) assert.throws(() => buildChildProcessReport([], value), /baseline/)
  assert.throws(() => parseChildProcessBaseline('{"schemaVersion":1,"schemaVersion":1}'), /baseline/)
  assert.throws(() => parseChildProcessBaseline('{SECRET_BROKEN'), /baseline/)
  assert.throws(() => buildChildProcessReport([{...finding,rules:['SECRET_BODY']}], baseline([])), /findings/)
})

test('parser failures have fixed diagnostics without source, argument or secret payloads', () => {
  for (const findings of [js(`import{exec}from'child_process';exec('SECRET_FAKE_TOKEN`), py(`import subprocess\nsubprocess.run('SECRET_FAKE_TOKEN`), js(`import{exec}from'child_process';exec('SECRET_FAKE_TOKEN '+payload)`), py(`import subprocess\nsubprocess.run('SECRET_FAKE_TOKEN '+payload,shell=True)`)]) {
    const report = buildChildProcessReport(findings, baseline([]))
    assert.equal(report.ok, false); assert.doesNotMatch(JSON.stringify(report), /SECRET_FAKE_TOKEN|payload|command/)
  }
})

test('bounded Python parser launch uses only argument arrays and never reflects child errors', () => {
  let observed
  assert.throws(() => scanPythonSources([{path:'scripts/test.py',source:'pass'}], {run(executable,args,options){observed={executable,args,options}; return {status:1,stderr:'SECRET_CHILD_ERROR'}}}), /bounded Python/)
  assert.ok(Array.isArray(observed.args)); assert.deepEqual(observed.args.slice(0,2), ['-I','-B']); assert.equal(observed.options.shell, false)
  assert.equal(observed.options.timeout, childProcessLimits.timeout); assert.equal(observed.options.env.PYTHON_MANAGER_AUTOMATIC_INSTALL,'false')
  assert.throws(() => scanPythonSources([{path:'../private.py',source:'pass'}]), /public input/)
  assert.throws(() => js('x'.repeat(childProcessLimits.fileBytes + 1)), /public input/)
})

test('actual file scanner parses JS/Python execution traps inertly and rejects symlinks without touching inputs', async () => {
  const directory=await mkdtemp(join(tmpdir(),'webappx-child-source-')), trap=join(directory,'must-not-exist')
  try {
    await mkdir(join(directory,'scripts'))
    const unsafe=`import{exec}from'node:child_process';exec('SECRET_PAYLOAD');\nimport{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(trap)},'executed');`
    await writeFile(join(directory,'scripts/trap.mjs'),unsafe)
    await writeFile(join(directory,'scripts/trap.py'),`from pathlib import Path\nPath(${JSON.stringify(trap)}).write_text('executed')\nimport subprocess\nsubprocess.run('SECRET_PYTHON',shell=True)\n`)
    await writeFile(join(directory,'scripts/child-process-baseline.json'),JSON.stringify(baseline([])))
    const before=await readFile(join(directory,'scripts/trap.mjs'),'utf8'), result=await readChildProcessReport(directory)
    assert.equal(result.ok,false); assert.equal(result.counts.findings,2); assert.doesNotMatch(JSON.stringify(result),/SECRET_PAYLOAD|SECRET_PYTHON|executed/)
    await assert.rejects(access(trap)); assert.equal(await readFile(join(directory,'scripts/trap.mjs'),'utf8'),before)
    await symlink(join(directory,'scripts/trap.mjs'),join(directory,'scripts/linked.mjs'))
    await assert.rejects(readChildProcessReport(directory),/symbolic links/)
  } finally { await rm(directory,{recursive:true,force:true}) }
})

test('reviewed real source baseline is finite and the report is read-only', async () => {
  const url=new URL('../../scripts/child-process-baseline.json',import.meta.url), before=await readFile(url,'utf8'), report=await readChildProcessReport()
  assert.equal(report.ok,true); assert.equal(report.counts.reviewedOccurrences,7); assert.equal(report.counts.findings,7)
  const reviewed=JSON.parse(before).exceptions
  assert.equal(reviewed.filter(item=>item.path==='scripts/lan-source-identity-browser.mjs' && item.kind==='javascript:spawn').length,1)
  assert.deepEqual(report.diagnostics,[]); assert.equal(await readFile(url,'utf8'),before)
})

test('the scripts inventory root cannot redirect traversal through a symlink', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'webappx-child-root-'))
  try {
    await mkdir(join(directory, 'outside'))
    await symlink(join(directory, 'outside'), join(directory, 'scripts'), 'dir')
    await assert.rejects(readChildProcessReport(directory), /symbolic links/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
