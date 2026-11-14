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

test('pantry login returns to pantry and session failures clear stale signed-in state',async()=>{
 let factory,destination,fail=false;
 const context=vm.createContext({URLSearchParams,document:{addEventListener:(_,fn)=>fn()},
 window:{location:{search:'?next=%2Finventory%2Fpantry%2F',assign:url=>destination=url}},
 Alpine:{data:(_,fn)=>factory=fn,store:()=>({call:async()=>{if(fail)throw Error('offline');return {authenticated:true};}})}});
 vm.runInContext(login,context); const form=factory();
 await form.checkSession();assert.equal(form.signedIn,true);
 await form.login();assert.equal(destination,'/inventory/pantry/');
 fail=true;await form.checkSession();assert.equal(form.signedIn,false);assert.match(form.message,/Unable to check/);
 context.window.location.search='?next=https://example.com';assert.equal(factory().destination,'/metrics/');
});
