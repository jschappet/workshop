import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { inRange, series, sensorUrl } from '../src/assets/js/metrics-data.mjs';
test('metrics renders recent readings promptly, loads the full selected week, and clears on session expiry', async () => {
  class Element {
    constructor(tag) { this.tag=tag; this.children=[]; this.value=''; this.classList={toggle(){}}; }
    append(...nodes) { this.children.push(...nodes); if(!this.value && nodes[0]?.value)this.value=nodes[0].value; }
    replaceChildren(...nodes) { this.children=nodes; }
    setAttribute() {} removeAttribute() {} addEventListener(name, listener) { this[name] = listener; }
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
  let releaseContinuation;
  let continuationRequested;
  const continuation = new Promise(resolve => { continuationRequested = resolve; });
  const pendingPage = new Promise(resolve => { releaseContinuation = resolve; });
  const emptyPage = { metrics: [], next_before_id: null, next_before_observed_at: null };
  const olderPages = new Map([2, 4, 6].map((daysAgo, index) => {
    const row = { ...meshReports.at(-1), id: index + 10, reading: {
      ...meshReports.at(-1).reading, observed_at_unix: now - daysAgo * 86400,
    } };
    return [index + 9, {
      ...emptyPage,
      metrics: [row],
      ...(daysAgo < 6 && { next_before_id: row.id, next_before_observed_at: row.reading.observed_at_unix }),
    }];
  }));
  const api={call: async (name, params) => {
    calls.push({name,params});
    if(denied) throw Object.assign(Error('denied'),{status:401});
    if(name==='iot_devices')return {devices:[{device_id:'sensor',last_seen_unix:Date.now()/1000}]};
    if (params.before_id === 9) {
      continuationRequested();
      return pendingPage;
    }
    if (params.before_id) return olderPages.get(params.before_id);
    if (params.until - params.since === 7 * 86400) {
      return { metrics: meshReports, next_before_id: 9, next_before_observed_at: now - 3200 };
    }
    return { ...emptyPage, metrics: [{ id: 1, received_at_unix: now, reading: {
      schema: 'temperature', observed_at_unix: now, data: { temperature_c: 22, humidity_percent: 50 },
    } }, ...meshReports] };
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
  const metricCalls = () => calls.filter(call => call.name === 'iot_device_metrics').map(call => call.params);
  assert.equal(metricCalls().length, 1);
  assert.equal(metricCalls()[0].until - metricCalls()[0].since, 86400);
  assert.equal(metricCalls()[0].before_id, undefined);

  get('range').value = '168';
  const rangeLoad = get('range').change();
  await continuation;
  assert.equal(get('readings').children.length, meshReports.length);
  assert.match(get('coverage').textContent, /Partial period loaded/);
  const [, week, next] = metricCalls();
  assert.equal(week.until - week.since, 7 * 86400);
  assert.equal(next.since, week.since);
  assert.equal(next.until, week.until);
  assert.equal(next.before_id, 9);
  assert.equal(next.before_observed_at, now - 3200);
  releaseContinuation(olderPages.get(9));
  await rangeLoad;
  const allWeekCalls = metricCalls().slice(1);
  assert.deepEqual(allWeekCalls.map(call => call.before_id), [undefined, 9, 10, 11]);
  assert.ok(allWeekCalls.every(call => call.since === week.since && call.until === week.until));
  assert.equal(get('readings').children.length, meshReports.length + 3);
  assert.equal(get('readings').children.at(-1).children[0].textContent, new Date((now - 6 * 86400) * 1000).toLocaleString());
  assert.equal(get('load-more').hidden, true);

  denied=true; await vm.runInContext('load({devices:true})',context);
  assert.equal(get('readings').children.length,0);
  assert.match(get('status').textContent,/Please sign in/);
});
