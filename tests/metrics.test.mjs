import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inRange, series, sensorUrl } from '../src/assets/js/metrics-data.mjs';
test('time filtering, zero counts and reboot-safe interval totals', () => {
 const now=1791563000000;
 const rows=[{id:1,reading:{observed_at_unix:1791562900,schema:'touch_count',data:{count:0,total_count:12}}},{id:2,reading:{observed_at_unix:1791562950,schema:'touch_count',data:{count:3,total_count:3}}},{id:3,reading:{observed_at_unix:1791000000,schema:'touch_count',data:{count:20}}}];
 const points=series(inRange(rows,1,now),'touch_count','count');
 assert.equal(points.length,2); assert.equal(points.reduce((sum,p)=>sum+p.value,0),3);
 assert.equal(series([{reading:{schema:'temperature',data:{temperature_c:null}}}],'temperature','temperature_c').length,0);
});
test('sensor links reject script URLs and credentials',()=>{
 assert.equal(sensorUrl('javascript:alert(1)'),null);
 assert.equal(sensorUrl('http://user:pass@host/sensor'),null);
 assert.equal(sensorUrl('http://192.168.1.152/sensor'),'http://192.168.1.152/sensor');
});
