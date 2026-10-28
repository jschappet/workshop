import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
class Element {
  constructor(tag = '') { this.tag = tag; this.children = []; this.listeners = {}; this.textContent = ''; }
  set innerHTML(_) { throw Error('Untrusted HTML rendering is forbidden'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  querySelectorAll(tag) { return this.children.flatMap(n => [...(n.tag === tag ? [n] : []), ...n.querySelectorAll(tag)]); }
}
const source = readFileSync('src/assets/js/devices.js', 'utf8').replace(/load\(\);\s*$/, '');
test('approval renders hostile samples as text, explicitly replaces credentials and clears denied data', async () => {
  const nodes = new Map(), calls = [], confirmations = [];
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const hostile = '<img src=x onerror=alert(1)>';
  const row = {id:2, device_id:'device', status:'provisional', metadata:{name:hostile}, samples:[{reading:{data:{text:hostile}},received_at_unix:1}],events:[],created_at_unix:1,replaces_enrollment_id:1};
  let denied = false;
  const Alpine = {store:()=>({call:async (...args) => {
    calls.push(args);
    if (denied) throw Object.assign(Error('denied'), {status:403});
    return args[0] === 'iot_enrollments' ? {enrollments:[row],next_before_id:null} : {ok:true};
  }})};
  const context = vm.createContext({Alpine,window:{Alpine,confirm:p=>{confirmations.push(p);return true;}},document:{getElementById:get,createElement:tag=>new Element(tag)}});
  vm.runInContext(source, context);
  await vm.runInContext('load()', context);
  const card=get('enrollments').children[0];
  assert.match(card.children[0].textContent, /<img/);
  assert.ok(card.querySelectorAll('pre').some(el=>el.textContent.includes(hostile)));
  await card.querySelectorAll('button')[0].listeners.click();
  const decision=calls.find(c=>c[0]==='iot_enrollment_decide');
  assert.deepEqual(JSON.parse(JSON.stringify(decision[2])), {action:'approve',replaces:1});
  assert.equal(decision[3].headers['X-IoT-Admin'],'1');
  assert.match(confirmations[0], /replace credential #1/);
  denied=true;await vm.runInContext('load()',context);
  assert.equal(get('enrollments').children.length,0);
  assert.match(get('enrollment-status').textContent,/Administrator access/);
});
