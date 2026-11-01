const $ = id => document.getElementById(id);
const ready = new Promise((resolve, reject) => {
  if (window.Alpine?.store('api')) return resolve();
  const timer = setTimeout(() => reject(new Error('The pantry connection did not load. Refresh to try again.')), 15000);
  document.addEventListener('alpine:initialized', () => { clearTimeout(timer); resolve(); }, { once: true });
});
let data, busy = false;
const weight = n => Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
function node(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
function status(text, error = false) { $('pantry-status').textContent = text; $('pantry-status').classList.toggle('error', error); }
function setBusy(value) { busy = value; document.querySelectorAll('.pantry button').forEach(b => b.disabled = value); }
async function call(name, body = null) { await ready; return Alpine.store('api').call(name, {}, body); }
async function checkSession() {
 const profile = await call('profile_json');
 const signedIn = profile.authenticated === true;
 $('pantry-account').textContent = signedIn ? 'Account / sign out' : 'Sign in';
 if (!signedIn) throw Object.assign(new Error('Sign in required'), { status: 401 });
 if (!(profile.roles || []).some(role => ['member', 'admin'].includes(role.toLowerCase()))) {
  throw Object.assign(new Error('Workshop membership required'), { status: 403 });
 }
 // Membership or login may have changed since this page loaded.
 await Alpine.store('api').refreshCapabilities();
}
function errorMessage(error) {
 if (error.status === 401) return 'Sign in to view and manage the pantry.';
 if (error.status === 403) return 'Workshop membership is required to use this pantry.';
 if (error.status === 400) { try { return JSON.parse(error.message.slice(error.message.indexOf('{'))).message; } catch {} }
 return 'Unable to reach the pantry. Please refresh and try again.';
}
function options(select, list) {
 const selected = select.value;
 select.replaceChildren(...list.map(row => { const o = node('option', row.name); o.value = row.id; return o; }));
 if (list.some(row => String(row.id) === selected)) select.value = selected;
}
function field(form, text, control) { const label = node('label', text); label.append(control); form.append(label); return control; }
function select(values) { const e = node('select'); e.append(...values.map(value => { const o = node('option', value); o.value = value; return o; })); return e; }
function render() {
 $('pantry-content').hidden = false; $('pantry-setup').hidden = data.items.length > 0;
 const totals = [ ['On hand', `${weight(data.items.reduce((n,i) => n+i.current_stock_lbs,0))} lbs`], ['To buy', `${weight(data.items.reduce((n,i) => n+i.amount_to_buy_lbs,0))} lbs`], ['Containers in use', String(data.batches.length)] ];
 $('pantry-totals').replaceChildren(...totals.map(([title,value]) => { const card=node('article',undefined,'metric-card'); card.append(node('h2',title),node('strong',value)); return card; }));
 document.querySelectorAll('[data-options]').forEach(e => options(e,data[e.dataset.options]));
 $('pantry-items').replaceChildren(...data.items.map(i => { const tr=node('tr'); for (const value of [i.name+(i.is_sproutable ? ' · sproutable' : ''),weight(i.current_stock_lbs)+' lbs',weight(i.target_lbs)+' lbs',weight(i.amount_to_buy_lbs)+' lbs',weight(i.percent_stocked)+'%']) tr.append(node('td',value)); return tr; }));
 $('pantry-batches').replaceChildren(...data.batches.map(batchCard));
 if (!data.batches.length) $('pantry-batches').append(node('p','No containers on hand yet. Add a container below to start tracking stock.','empty'));
 const month = n => new Date(2026,n-1,1).toLocaleString(undefined,{month:'long'});
 $('pantry-audits').textContent = data.categories.map(c => `${c.name}: ${month(c.audit_month)} / ${month((c.audit_month+5)%12+1)}`).join(' · ');
 $('pantry-history').replaceChildren(...data.history.map(h => node('p',`${h.logged_at} UTC · ${h.item_name} · container #${h.batch_id} · ${weight(h.amount_lbs)} lbs · ${h.action_type}`)));
 if (!data.history.length) $('pantry-history').append(node('p','No usage recorded yet.','muted'));
}
function batchCard(b) {
 const card=node('article',undefined,'metric-card');
 card.append(node('h3',`${b.item_name} · #${b.id}`,'batch-title'),node('p',`${weight(b.quantity_lbs)} lbs · ${b.location_name} · ${b.container_type} · ${b.is_opened ? 'Opened' : 'Sealed'}`,'batch-info'),node('p',`Purchased ${b.purchase_date} · Expires ${b.expiration_date}`,b.expiration_date < today() ? 'expired' : 'batch-info'));
 if (b.expiration_date < today()) card.append(node('p','Expired — review before use.','expired'));
 if (b.notes) card.append(node('p',b.notes));
 const use=node('form',undefined,'pantry-form');
 const amount=field(use,'Amount to remove (lbs)',node('input')); amount.type='number'; amount.min='0.001'; amount.max=b.quantity_lbs; amount.step='any'; amount.required=true;
 const reason=field(use,'Use',select(['Cooking','Sprouting','Fermentation/Dosa','Expired/Discarded']));
 const submit=node('button','Record use'); submit.type='submit'; use.append(submit);
 use.addEventListener('submit',e => { e.preventDefault(); save({action:'consume',batch_id:b.id,amount_lbs:Number(amount.value),action_type:reason.value}); }); card.append(use);
 const detail=node('details'); detail.append(node('summary','Move or open this container'));
 const move=node('form',undefined,'pantry-form'); const location=field(move,'Storage location',node('select')); options(location,data.locations); location.value=b.location_id;
 const opened=field(move,'Opened',select(['Sealed','Opened'])); opened.value=b.is_opened ? 'Opened' : 'Sealed';
 const update=node('button','Save container'); update.type='submit'; move.append(update);
 move.addEventListener('submit',e => { e.preventDefault(); save({action:'move',batch_id:b.id,location_id:Number(location.value),is_opened:opened.value==='Opened'}); }); detail.append(move); card.append(detail); return card;
}
async function load() {
 if (busy) return; setBusy(true); status('Loading pantry…');
 try { await checkSession(); data=await call('pantry_read'); render(); status('Pantry is up to date.'); }
 catch(error) { data=null; $('pantry-content').hidden=true; status(errorMessage(error),true); }
 finally { setBusy(false); }
}
async function save(command, form) {
 if (busy) return; setBusy(true); status('Saving…'); let saved=false;
 try { await call('pantry_execute',command); saved=true; if(form) { form.reset(); setPurchaseDate(); } data=await call('pantry_read'); render(); status('Saved. Pantry is up to date.'); }
 catch(error) { if(saved) { $('pantry-content').hidden=true; status('Saved, but the updated stock could not be loaded. Refresh before making another change.',true); } else { if ([401,403].includes(error.status)) { data=null; $('pantry-content').hidden=true; } status(errorMessage(error),true); } }
 finally { setBusy(false); }
}
function setPurchaseDate() { $('batch-form').elements.purchase_date.value=today(); }
for (const action of ['batch','item','target','location','category']) {
 const form=$(action+'-form'); form.addEventListener('submit',e => {
  e.preventDefault(); const values=Object.fromEntries(new FormData(form));
  for (const key of ['item_id','category_id','location_id','quantity_lbs','target_lbs','audit_month']) if(key in values) values[key]=Number(values[key]);
  for (const key of ['is_opened','is_sproutable']) if(form.elements[key]) values[key]=form.elements[key].checked;
  save({action,...values},form);
 });
}
$('pantry-refresh').addEventListener('click',load);
$('pantry-seed').addEventListener('click',()=>save({action:'seed'}));
setPurchaseDate(); load();
