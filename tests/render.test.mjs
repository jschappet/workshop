import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { inRange, series, sensorUrl } from '../src/assets/js/metrics-data.mjs';
test('metrics renders API readings and clears them when session expires', async () => {
  class Element {
    constructor(tag) { this.tag=tag; this.children=[]; this.value=''; this.classList={toggle(){}}; }
    append(...nodes) { this.children.push(...nodes); if(!this.value && nodes[0]?.value)this.value=nodes[0].value; }
    replaceChildren(...nodes) { this.children=nodes; }
    setAttribute() {} removeAttribute() {} addEventListener() {}
  }
  const nodes = new Map();
  const get = id => { if(!nodes.has(id)) nodes.set(id,new Element()); return nodes.get(id); };
  get('range').value='24';
  let denied=false;
  const now = Math.floor(Date.now() / 1000);
  const meshReports = [2, 0, 1, 2, 2, 3, 1, 1].map((publicCount, index) => ({
    id: index + 2,
    received_at_unix: now,
    reading: {
      schema: 'meshcore_message_count',
      observed_at_unix: now - (index + 1) * 400,
      data: {
        public_count: publicCount,
        dm_count: 0,
        neighbor_count: 0,
        channel_counts: publicCount ? { 0: publicCount } : {},
        public_channel: 0,
        listening_ms: 300000,
      },
    },
  }));
  const calls=[];
  const api={call: async (name, params) => {
    calls.push({name,params});
    if(denied) throw Object.assign(Error('denied'),{status:401});
    if(name==='iot_devices')return {devices:[{device_id:'sensor',last_seen_unix:Date.now()/1000}]};
    return {metrics:[{id:1,received_at_unix:Date.now()/1000,reading:{schema:'temperature',observed_at_unix:Date.now()/1000,data:{temperature_c:22,humidity_percent:50}}}, ...meshReports],next_before_id:null};
  }};
  const Alpine={store:()=>api};
  const context=vm.createContext({inRange,series,sensorUrl,Alpine,window:{Alpine},AbortController,setTimeout,clearTimeout,setInterval(){},
    document:{querySelector:()=>get('root'),getElementById:get,createElement:()=>new Element(),createElementNS:(_, tag)=>new Element(tag)}});
  vm.runInContext(readFileSync('src/assets/js/metrics.js','utf8').replace(/^import .*;\n/, '').replace(/load\(\{ devices: true \}\);\s*$/, ''),context);
  await vm.runInContext('load({devices:true})',context);
  assert.equal(get('readings').children.length, 9);
  assert.match(get('readings').children[1].children[2].textContent, /Channel 0 \(public\): 2 · Listened for 300 s/);
  const charts = get('charts').children;
  assert.equal(charts.length, 5);
  const publicChart = charts[2].children[1];
  assert.equal(publicChart.children.filter(mark => mark.tag === 'circle').length, 1);
  assert.equal(charts[3].children[1].children.filter(mark => mark.tag === 'circle').length, 8);
  const summary = get('summary').children.map(card => card.children[1].textContent);
  assert.deepEqual(summary, ['22.0 °C', '50.0%', '12', '0', '0']);
  assert.equal(calls[1].name,'iot_device_metrics');
  denied=true; await vm.runInContext('load({devices:true})',context);
  assert.equal(get('readings').children.length,0);
  assert.match(get('status').textContent,/Please sign in/);
});
