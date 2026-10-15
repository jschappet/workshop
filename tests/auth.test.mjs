import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const login = readFileSync('src/assets/js/login.js', 'utf8');
test('login redirects only after success and logout clears state', async () => {
  let factory, destination, fail = true;
  const context = vm.createContext({URLSearchParams,
    document:{addEventListener:(_,fn)=>fn()},
    window:{location:{assign:url=>{destination=url;}}},
    Alpine:{data:(_,fn)=>{factory=fn;},store:()=>({call:async()=>{if(fail)throw Error('denied');}})}
  });
  vm.runInContext(login, context);
  const form=factory(); form.username='viewer'; form.password='secret';
  await form.login(); assert.equal(destination,undefined); assert.match(form.message,/Unable/); assert.equal(form.busy,false);
  fail=false; await form.login(); assert.equal(destination,'/metrics/'); assert.equal(form.password,'');
  form.signedIn=true; await form.logout(); assert.equal(form.signedIn,false);
});
