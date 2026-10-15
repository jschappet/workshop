import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { inRange, series, sensorUrl } from '../src/assets/js/metrics-data.mjs';
test('metrics renders API readings and clears them when session expires', async () => {
  class Element {
    constructor() { this.children=[]; this.value=''; this.classList={toggle(){}}; }
    append(...nodes) { this.children.push(...nodes); if(!this.value && nodes[0]?.value)this.value=nodes[0].value; }
    replaceChildren(...nodes) { this.children=nodes; }
    setAttribute() {} removeAttribute() {} addEventListener() {}
  }
  const nodes = new Map();
  const get = id => { if(!nodes.has(id)) nodes.set(id,new Element()); return nodes.get(id); };
  get('range').value='24';
  let denied=false;
  const calls=[];
  const api={call: async (name, params) => {
    calls.push({name,params});
    if(denied) throw Object.assign(Error('denied'),{status:401});
    if(name==='iot_devices')return {devices:[{device_id:'sensor',last_seen_unix:Date.now()/1000}]};
    return {metrics:[{id:1,received_at_unix:Date.now()/1000,reading:{schema:'temperature',observed_at_unix:Date.now()/1000,data:{temperature_c:22,humidity_percent:50}}}],next_before_id:null};
  }};
  const Alpine={store:()=>api};
  const context=vm.createContext({inRange,series,sensorUrl,Alpine,window:{Alpine},AbortController,setTimeout,clearTimeout,setInterval(){},
    document:{querySelector:()=>get('root'),getElementById:get,createElement:()=>new Element(),createElementNS:()=>new Element()}});
  vm.runInContext(readFileSync('src/assets/js/metrics.js','utf8').replace(/^import .*;\n/, '').replace(/load\(\{ devices: true \}\);\s*$/, ''),context);
  await vm.runInContext('load({devices:true})',context);
  assert.equal(get('readings').children.length,1);
  assert.equal(get('charts').children.length,2);
  assert.equal(get('summary').children[0].children[1].textContent,'22.0 °C');
  assert.equal(calls[1].name,'iot_device_metrics');
  denied=true; await vm.runInContext('load({devices:true})',context);
  assert.equal(get('readings').children.length,0);
  assert.match(get('status').textContent,/Please sign in/);
});
