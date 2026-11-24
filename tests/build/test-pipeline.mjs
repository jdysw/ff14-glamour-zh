// Exercise actual build/verifier commands. No assertions about source spelling.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {findPython} from '../../build/python.mjs';
import {repoRoot,distFile,dictionaryFile,cacheDir} from '../helpers/paths.mjs';

const run=(command,args)=>spawnSync(command,args,{cwd:repoRoot,encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
const node=args=>run(process.execPath,args);
if(!fs.existsSync(distFile))execFileSync(process.execPath,['build/userscript/build.mjs'],{cwd:repoRoot,stdio:'pipe'});
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before=[distFile,dictionaryFile].map(hash);
const rebuilt=node(['build/userscript/build.mjs']);
assert.equal(rebuilt.status,0,rebuilt.stderr+rebuilt.stdout);
assert.deepEqual([distFile,dictionaryFile].map(hash),before,'Repeated builds must produce the same script and dictionary');

fs.mkdirSync(cacheDir,{recursive:true});
const directory=fs.mkdtempSync(path.join(cacheDir,'pipeline-'));
try{
  const copy=path.join(directory,'dictionary.js');
  const runtimeDictionary=path.join(directory,'dict.json');
  const original=fs.readFileSync(dictionaryFile,'utf8');
  const packed=run(findPython(),['build/data/make_dict_json.py','--out',runtimeDictionary]);
  assert.equal(packed.status,0,packed.stderr+packed.stdout);
  const verify=(...args)=>node(['build/userscript/verify_dicts.js',copy,...args]);
  const modes=[[],['--dict-json',runtimeDictionary]];
  const entries=JSON.parse(fs.readFileSync(path.join(repoRoot,'data/dictionaries/dict-fc.json'),'utf8')).entries;
  const [key,value]=Object.entries(entries).find(([key,value])=>!/[\\'\r\n]/.test(key+value));
  const needle=`'${key}': '${value}'`;
  const corruptions=[
    ['a changed translation',original.replace(needle,`'${key}': '${value} incorrect translation'`)],
    ['a missing common layer',original.replace('const DICT_EC = { ...DICT_COMMON,','const DICT_EC = {')],
    ['an unverified spread',original.replace('const DICT_EC = { ...DICT_COMMON,','const DICT_EC = { ...DICT_COMMON, ...{},')],
  ];
  for(const [label,changed] of corruptions){
    assert.notEqual(changed,original,'The generated entry to corrupt must be present');
    fs.writeFileSync(copy,changed);
    for(const mode of modes)assert.equal(verify(...mode).status,1,'Reject '+label);
  }
  const restored=run(findPython(),['build/userscript/inject_dicts.py',copy]);
  assert.equal(restored.status,0,restored.stderr+restored.stdout);
  // The verifier must parse, not evaluate, the candidate program.
  fs.appendFileSync(copy,"\nthrow new Error('the verifier must not execute source');\n");
  for(const mode of modes){
    const checked=verify(...mode);
    assert.equal(checked.status,0,checked.stderr+checked.stdout);
  }
}finally{
  assert.ok(path.resolve(directory).startsWith(path.resolve(cacheDir)+path.sep));
  fs.rmSync(directory,{recursive:true,force:true});
}
console.log('PASS build behavior: reproducible output, corruption rejected, regeneration repairs it');
