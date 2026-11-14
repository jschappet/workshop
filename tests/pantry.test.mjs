import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
class Element {
 constructor(tag='') { this.tag=tag; this.children=[]; this.listeners={}; this.textContent=''; this.value=''; this.elements={purchase_date:{value:''}}; this.classList={toggle(){}}; }
 set innerHTML(_) { throw Error('Untrusted HTML rendering'); }
 append(...nodes) { this.children.push(...nodes); }
 replaceChildren(...nodes) { this.children=nodes; }
 addEventListener(type,fn) { this.listeners[type]=fn; }
}
const source=readFileSync('src/assets/js/pantry.js','utf8').replace(/setPurchaseDate\(\); load\(\);\s*$/, '');
test('pantry renders untrusted names safely, saves once, and hides stale stock after failed refresh',async()=>{
 const nodes=new Map(),calls=[]; const get=id=>{if(!nodes.has(id)) nodes.set(id,new Element()); return nodes.get(id);};
 const hostile='<img src=x onerror=alert(1)>';
 const pantry={categories:[{id:1,name:'Grains',audit_month:3}],locations:[{id:1,name:'Shelf'}],items:[{id:1,name:hostile,current_stock_lbs:4,target_lbs:10,amount_to_buy_lbs:6,percent_stocked:40}],batches:[{id:1,item_name:hostile,quantity_lbs:4,location_name:'Shelf',location_id:1,container_type:'Glass Jar',is_opened:false,purchase_date:'2026-01-01',expiration_date:'2027-01-01',notes:hostile}],history:[]};
 let deny=false,failRefresh=false;
 const Alpine={store:()=>({refreshCapabilities:async()=>{},call:async(name,params,body)=>{calls.push({name,body}); if(deny) throw Object.assign(Error('denied'),{status:403}); if(name==='pantry_read'&&failRefresh) throw Error('offline'); return name==='profile_json'?{authenticated:true,roles:['member']}:name==='pantry_read'?pantry:{saved:true};}})};
 const context=vm.createContext({Alpine,window:{Alpine},document:{getElementById:get,createElement:t=>new Element(t),querySelectorAll:()=>[]}});
 vm.runInContext(source,context); await vm.runInContext('load()',context);
 assert.equal(get('pantry-content').hidden,false);
 assert.match(get('pantry-batches').children[0].children[0].textContent,/<img/);
 failRefresh=true;await vm.runInContext("save({action:'consume',batch_id:1,amount_lbs:1,action_type:'Cooking'})",context);
 assert.equal(calls.filter(c=>c.name==='pantry_execute').length,1);
 assert.equal(get('pantry-content').hidden,true);
 assert.match(get('pantry-status').textContent,/Saved, but/);
 failRefresh=false; await vm.runInContext('load()',context); deny=true;
 await vm.runInContext("save({action:'seed'})",context);
 assert.equal(get('pantry-content').hidden,true);
 assert.match(get('pantry-status').textContent,/membership/);
});

test('session distinguishes anonymous visitors from signed-in users without workshop access',async()=>{
 const nodes=new Map(),calls=[];
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 let profile={authenticated:false,roles:[]};
 const Alpine={store:()=>({call:async name=>{calls.push(name);assert.equal(name,'profile_json');return profile;},refreshCapabilities:async()=>{throw Error('Must not load protected capabilities');}})};
 const context=vm.createContext({Alpine,window:{Alpine},document:{getElementById:get,createElement:t=>new Element(t),querySelectorAll:()=>[]}});
 vm.runInContext(source,context);
 await vm.runInContext('load()',context);
 assert.match(get('pantry-status').textContent,/Sign in/);
 assert.equal(get('pantry-account').textContent,'Sign in');
 assert.equal(get('pantry-content').hidden,true);
 profile={authenticated:true,roles:[]};
 await vm.runInContext('load()',context);
 assert.match(get('pantry-status').textContent,/membership/);
 assert.equal(get('pantry-account').textContent,'Account / sign out');
 assert.deepEqual(calls,['profile_json','profile_json']);
});
