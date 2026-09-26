import { supabase, supabaseConfigured } from './supabase'
import { MENU, SHOP, TABLES } from './constants'

const KEY='shabu-aroi-jang-demo-v1'
const now=()=>new Date().toISOString()
const rid=(p='x')=>`${p}_${crypto.randomUUID().slice(0,8)}`
const clone=x=>JSON.parse(JSON.stringify(x))

function baseDemo(){
  return {
    settings:{id:1,open_time:'11:00',close_time:'22:00',force_open:false,force_closed:false,buffet_price:299,promptpay:'06-1564-0529'},
    tables:TABLES.map((t,i)=>({id:`t${i+1}`,...t,status:'available'})),
    menu:MENU,
    reservations:[],
    sessions:[],
    orders:[],
    service_calls:[],
    bills:[],
    reviews:[],
  }
}
function getDemo(){
  try { return {...baseDemo(),...JSON.parse(localStorage.getItem(KEY)||'{}')} } catch { return baseDemo() }
}
function saveDemo(db){ localStorage.setItem(KEY,JSON.stringify(db)); window.dispatchEvent(new Event('shabu-demo-change')); return db }
function mutate(fn){ const db=getDemo(); const out=fn(db); saveDemo(db); return out }
function noerr(error){ if(error) throw error }

export async function getSettings(){
  if(!supabaseConfigured) return getDemo().settings
  const {data,error}=await supabase.from('shop_settings').select('*').eq('id',1).single(); noerr(error); return data
}
export async function updateSettings(patch){
  if(!supabaseConfigured) return mutate(db=>(db.settings={...db.settings,...patch}))
  const {data,error}=await supabase.from('shop_settings').update(patch).eq('id',1).select().single(); noerr(error); return data
}
export function shopIsOpen(s){
  if(!s) return false
  if(s.force_open) return true
  if(s.force_closed) return false
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date())
  const hm=`${parts.find(x=>x.type==='hour')?.value}:${parts.find(x=>x.type==='minute')?.value}`
  return hm >= (s.open_time||'11:00').slice(0,5) && hm < (s.close_time||'22:00').slice(0,5)
}

export async function listTables(){
  if(!supabaseConfigured) return getDemo().tables
  const {data,error}=await supabase.from('restaurant_tables').select('*').order('sort_order'); noerr(error); return data||[]
}
export async function listMenu(){
  if(!supabaseConfigured) return getDemo().menu
  const {data,error}=await supabase.from('menu_items').select('*, menu_categories(name_th,name_en)').order('sort_order'); noerr(error)
  return (data||[]).map(x=>({...x,category:x.menu_categories?.name_th||'เมนู'}))
}
export async function createReservation(payload){
  if(!supabaseConfigured) return mutate(db=>{
    const r={id:rid('r'),code:Math.random().toString(36).slice(2,8).toUpperCase(),status:'pending',created_at:now(),...payload}
    db.reservations.unshift(r); return r
  })
  const {data,error}=await supabase.rpc('create_reservation',{p_payload:payload}); noerr(error); return data
}
export async function getReservation(code){
  if(!supabaseConfigured) return getDemo().reservations.find(r=>r.code===String(code).toUpperCase())||null
  const {data,error}=await supabase.rpc('get_reservation_by_code',{p_code:String(code).toUpperCase()}); noerr(error); return data
}
export async function listReservations(){
  if(!supabaseConfigured) return getDemo().reservations
  const {data,error}=await supabase.from('reservations').select('*, restaurant_tables(code,seats), table_sessions(token,status,created_at)').order('created_at',{ascending:false}); noerr(error)
  return (data||[]).map(r=>({
    ...r,
    table_code:r.restaurant_tables?.code,
    session_token:[...(r.table_sessions||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]?.token||null,
    session_status:[...(r.table_sessions||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]?.status||null,
  }))
}
export async function confirmReservation(reservationId,tableId){
  if(!supabaseConfigured) return mutate(db=>{
    const r=db.reservations.find(x=>x.id===reservationId); const t=db.tables.find(x=>x.id===tableId)
    if(!r||!t) throw new Error('ไม่พบข้อมูล')
    t.status='reserved'; r.status='confirmed'; r.table_id=t.id
    const token=crypto.randomUUID().replaceAll('-','').slice(0,16)
    const s={id:rid('s'),token,table_id:t.id,table_code:t.code,status:'reserved',guest_count:r.guest_count,reservation_id:r.id,created_at:now()}
    db.sessions.push(s); r.session_token=token; return {...r,session_token:token,table_code:t.code}
  })
  const {data,error}=await supabase.rpc('confirm_reservation',{p_reservation_id:reservationId,p_table_id:tableId}); noerr(error); return data
}
export async function rejectReservation(id){
  if(!supabaseConfigured) return mutate(db=>{const r=db.reservations.find(x=>x.id===id); if(r)r.status='rejected'; return r})
  const {data,error}=await supabase.from('reservations').update({status:'rejected'}).eq('id',id).select().single(); noerr(error); return data
}
export async function getSession(token){
  if(!supabaseConfigured) {
    const db=getDemo(); const s=db.sessions.find(x=>x.token===token); if(!s)return null
    return {...s,table:db.tables.find(t=>t.id===s.table_id)}
  }
  const {data,error}=await supabase.rpc('get_table_session',{p_token:token}); noerr(error); return data
}
export async function activateSession(token){
  if(!supabaseConfigured) return mutate(db=>{const s=db.sessions.find(x=>x.token===token); if(!s)throw new Error('QR หมดอายุ'); s.status='active'; const t=db.tables.find(x=>x.id===s.table_id); if(t)t.status='occupied'; return s})
  const {data,error}=await supabase.rpc('activate_table_session',{p_token:token}); noerr(error); return data
}
export async function createFoodOrder(token,items){
  if(!supabaseConfigured) return mutate(db=>{
    const s=db.sessions.find(x=>x.token===token&&x.status==='active'); if(!s)throw new Error('Session ไม่พร้อมใช้งาน')
    const o={id:rid('o'),order_number:`SH-${String(db.orders.length+1).padStart(5,'0')}`,session_id:s.id,table_code:s.table_code,status:'pending',created_at:now(),items:items.map(x=>({...x,id:rid('i')}))}
    db.orders.unshift(o); return o
  })
  const {data,error}=await supabase.rpc('create_food_order',{p_token:token,p_items:items}); noerr(error); return data
}
export async function listOrders(){
  if(!supabaseConfigured) return getDemo().orders
  const {data,error}=await supabase.from('food_orders').select('*, table_sessions(token, restaurant_tables(code)), food_order_items(*)').order('created_at',{ascending:false}); noerr(error)
  return (data||[]).map(o=>({...o,table_code:o.table_sessions?.restaurant_tables?.code,items:o.food_order_items||[]}))
}
export async function listSessionOrders(token){
  if(!supabaseConfigured){ const db=getDemo(); const s=db.sessions.find(x=>x.token===token); return s?db.orders.filter(o=>o.session_id===s.id):[] }
  const {data,error}=await supabase.rpc('get_session_orders',{p_token:token}); noerr(error); return data||[]
}
export async function updateOrderStatus(id,status){
  if(!supabaseConfigured) return mutate(db=>{const o=db.orders.find(x=>x.id===id); if(o)o.status=status; return o})
  const {data,error}=await supabase.from('food_orders').update({status}).eq('id',id).select().single(); noerr(error); return data
}
export async function createServiceCall(token,type,note=''){
  if(!supabaseConfigured) return mutate(db=>{
    const s=db.sessions.find(x=>x.token===token&&x.status==='active'); if(!s)throw new Error('Session ไม่พร้อมใช้งาน')
    const c={id:rid('c'),session_id:s.id,table_code:s.table_code,type,note,status:'pending',created_at:now()}; db.service_calls.unshift(c)
    const t=db.tables.find(x=>x.id===s.table_id); if(t)t.status=type==='bill'?'billing':'service'; return c
  })
  const {data,error}=await supabase.rpc('create_service_call',{p_token:token,p_type:type,p_note:note}); noerr(error); return data
}
export async function listServiceCalls(){
  if(!supabaseConfigured)return getDemo().service_calls
  const {data,error}=await supabase.from('service_calls').select('*, table_sessions(restaurant_tables(code))').order('created_at',{ascending:false}); noerr(error)
  return (data||[]).map(x=>({...x,table_code:x.table_sessions?.restaurant_tables?.code}))
}
export async function resolveServiceCall(id){
  if(!supabaseConfigured)return mutate(db=>{const c=db.service_calls.find(x=>x.id===id); if(c)c.status='done'; return c})
  const {data,error}=await supabase.from('service_calls').update({status:'done',resolved_at:now()}).eq('id',id).select().single(); noerr(error); return data
}
export async function requestBill(token){
  if(!supabaseConfigured)return mutate(db=>{
    const s=db.sessions.find(x=>x.token===token&&x.status==='active'); if(!s)throw new Error('Session ไม่พร้อมใช้งาน')
    s.status='billing'; const total=Number(s.guest_count||1)*Number(db.settings.buffet_price||SHOP.priceAdult)
    const b={id:rid('b'),session_id:s.id,table_code:s.table_code,guest_count:s.guest_count,total,status:'pending',created_at:now()}; db.bills.unshift(b)
    const t=db.tables.find(x=>x.id===s.table_id); if(t)t.status='billing'; return b
  })
  const {data,error}=await supabase.rpc('request_bill',{p_token:token}); noerr(error); return data
}
export async function listBills(){
  if(!supabaseConfigured)return getDemo().bills
  const {data,error}=await supabase.from('bills').select('*, table_sessions(restaurant_tables(code))').order('created_at',{ascending:false}); noerr(error)
  return (data||[]).map(x=>({...x,table_code:x.table_sessions?.restaurant_tables?.code}))
}
export async function closeBill(id,paymentMethod){
  if(!supabaseConfigured)return mutate(db=>{
    const b=db.bills.find(x=>x.id===id); if(!b)throw new Error('ไม่พบบิล'); b.status='paid'; b.payment_method=paymentMethod; b.paid_at=now()
    const s=db.sessions.find(x=>x.id===b.session_id); if(s){s.status='closed';s.closed_at=now();const t=db.tables.find(x=>x.id===s.table_id);if(t)t.status='cleaning'}
    return b
  })
  const {data,error}=await supabase.rpc('close_bill',{p_bill_id:id,p_payment_method:paymentMethod}); noerr(error); return data
}
export async function markTableReady(id){
  if(!supabaseConfigured)return mutate(db=>{const t=db.tables.find(x=>x.id===id);if(t)t.status='available';return t})
  const {data,error}=await supabase.from('restaurant_tables').update({status:'available'}).eq('id',id).select().single(); noerr(error); return data
}
export async function submitReview(token,payload){
  if(!supabaseConfigured)return mutate(db=>{const s=db.sessions.find(x=>x.token===token);const r={id:rid('rv'),session_id:s?.id||null,...payload,created_at:now()};db.reviews.unshift(r);return r})
  const {data,error}=await supabase.rpc('submit_review',{p_token:token,p_payload:payload}); noerr(error); return data
}
export async function listReviews(){
  if(!supabaseConfigured)return getDemo().reviews
  const {data,error}=await supabase.from('reviews').select('*').order('created_at',{ascending:false}); noerr(error); return data||[]
}
export async function login(email,password){
  if(!supabaseConfigured){ localStorage.setItem('shabu-demo-admin','1'); return {user:{email}} }
  const {data,error}=await supabase.auth.signInWithPassword({email,password}); noerr(error); return data
}
export async function logout(){ if(!supabaseConfigured){localStorage.removeItem('shabu-demo-admin');return} await supabase.auth.signOut() }
export async function getAdminSession(){
  if(!supabaseConfigured)return localStorage.getItem('shabu-demo-admin')?{user:{email:'demo@shabu.local'}}:null
  const {data}=await supabase.auth.getSession(); return data.session
}
export function subscribeAll(cb){
  if(!supabaseConfigured){const fn=()=>cb();window.addEventListener('shabu-demo-change',fn);return()=>window.removeEventListener('shabu-demo-change',fn)}
  const ch=supabase.channel('shabu-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'reservations'},cb)
    .on('postgres_changes',{event:'*',schema:'public',table:'food_orders'},cb)
    .on('postgres_changes',{event:'*',schema:'public',table:'service_calls'},cb)
    .on('postgres_changes',{event:'*',schema:'public',table:'bills'},cb)
    .on('postgres_changes',{event:'*',schema:'public',table:'restaurant_tables'},cb)
    .subscribe()
  return()=>supabase.removeChannel(ch)
}


export async function askAi(message){
  const fallback = () => {
    const q=String(message||'').toLowerCase()
    if(q.includes('ราคา')||q.includes('price')) return 'บุฟเฟ่ต์ผู้ใหญ่ 299 บาท/คน รวมน้ำและเป็นราคา NET ครับ'
    if(q.includes('เปิด')||q.includes('เวลา')||q.includes('hour')) return 'ร้านเปิด 11:00–22:00 น. ทุกวันครับ'
    if(q.includes('ที่อยู่')||q.includes('อยู่ไหน')||q.includes('location')) return 'ร้านอยู่ที่ 125/3 ม.5 ต.สามควายเผือก อ.เมือง จ.นครปฐม 73000 ครับ'
    if(q.includes('จอง')) return 'กดเมนู “จองโต๊ะ” กรอกชื่อ เบอร์ วันที่ เวลา และจำนวนคน จากนั้นรอร้านยืนยันโต๊ะครับ'
    if(q.includes('เด็ก')) return 'เด็กต่ำกว่า 90 ซม. ฟรี, 90–120 ซม. 149 บาท และสูงกว่า 120 ซม. คิดราคา 299 บาทครับ'
    if(q.includes('prompt')||q.includes('พร้อมเพย์')||q.includes('จ่าย')) return 'รองรับเงินสดและ PromptPay เบอร์ 06-1564-0529 ครับ'
    return 'สอบถามได้เลยครับ เช่น ราคา เวลาเปิด เมนู ที่ตั้ง การจองโต๊ะ หรือวิธีชำระเงิน'
  }
  if(!supabaseConfigured) return fallback()
  try {
    const {data,error}=await supabase.functions.invoke('ai-chat',{body:{message}})
    if(error) throw error
    return data?.answer || fallback()
  } catch {
    return fallback()
  }
}
