import { createClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured, supabaseUrl, supabaseAnonKey } from './supabase'
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

  const merged=new Map()

  // Exact helper when installed.
  try{
    const exact=await supabase.rpc('admin_list_orders')
    if(!exact.error){
      for(const o of exact.data||[]) merged.set(o.id,o)
    }
  }catch{}

  // Always read the base rows and resolve table_id -> table code explicitly.
  const ordersRes=await supabase.from('food_orders').select('*').order('created_at',{ascending:false})
  if(!ordersRes.error){
    const orders=ordersRes.data||[]
    const orderIds=orders.map(x=>x.id)
    const sessionIds=[...new Set(orders.map(x=>x.session_id).filter(Boolean))]

    const [itemsRes,sessionsRes]=await Promise.all([
      orderIds.length
        ? supabase.from('food_order_items').select('*').in('order_id',orderIds)
        : Promise.resolve({data:[],error:null}),
      sessionIds.length
        ? supabase.from('table_sessions').select('id,table_id,token').in('id',sessionIds)
        : Promise.resolve({data:[],error:null})
    ])

    const tableIds=[...new Set((sessionsRes.data||[]).map(s=>s.table_id).filter(Boolean))]
    const tablesRes=tableIds.length
      ? await supabase.from('restaurant_tables').select('id,code,seats,status').in('id',tableIds)
      : {data:[],error:null}

    const tableMap=new Map((tablesRes.data||[]).map(t=>[t.id,t]))
    const sessionMap=new Map((sessionsRes.data||[]).map(s=>[s.id,{...s,table:tableMap.get(s.table_id)}]))
    const itemsByOrder=new Map()

    for(const item of itemsRes.data||[]){
      const arr=itemsByOrder.get(item.order_id)||[]
      arr.push(item)
      itemsByOrder.set(item.order_id,arr)
    }

    for(const o of orders){
      const previous=merged.get(o.id)
      const session=sessionMap.get(o.session_id)
      merged.set(o.id,{
        ...previous,
        ...o,
        table_code:session?.table?.code||previous?.table_code||'-',
        items:itemsByOrder.get(o.id)||previous?.items||[]
      })
    }
  }

  // Merge customer-session RPC data as a final safety net.
  try{
    const sessions=await listActiveSessions()
    for(const s of sessions.filter(x=>x.token)){
      try{
        const rows=await listSessionOrders(s.token)
        for(const o of rows||[]){
          const previous=merged.get(o.id)
          merged.set(o.id,{
            ...previous,
            ...o,
            table_code:s.table_code||previous?.table_code||'-',
            items:o.items||previous?.items||[]
          })
        }
      }catch{}
    }
  }catch{}

  if(!merged.size && ordersRes.error) noerr(ordersRes.error)
  return [...merged.values()].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
}

export async function listSessionOrders(token){
  if(!supabaseConfigured){ const db=getDemo(); const s=db.sessions.find(x=>x.token===token); return s?db.orders.filter(o=>o.session_id===s.id):[] }
  const {data,error}=await supabase.rpc('get_session_orders',{p_token:token}); noerr(error); return data||[]
}
export async function updateOrderStatus(id,status){
  if(!supabaseConfigured) return mutate(db=>{const o=db.orders.find(x=>x.id===id); if(o)o.status=status; return o})
  const {data,error}=await supabase.rpc('update_order_status_admin',{p_order_id:id,p_status:status}); noerr(error); return data
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

  const merged=new Map()

  try{
    const exact=await supabase.rpc('admin_list_service_calls')
    if(!exact.error){
      for(const x of exact.data||[]) merged.set(x.id,x)
    }
  }catch{}

  const callsRes=await supabase.from('service_calls').select('*').order('created_at',{ascending:false})
  if(!callsRes.error){
    const rows=callsRes.data||[]
    const sessionIds=[...new Set(rows.map(x=>x.session_id).filter(Boolean))]
    const sessionsRes=sessionIds.length
      ? await supabase.from('table_sessions').select('id,table_id').in('id',sessionIds)
      : {data:[],error:null}

    const tableIds=[...new Set((sessionsRes.data||[]).map(s=>s.table_id).filter(Boolean))]
    const tablesRes=tableIds.length
      ? await supabase.from('restaurant_tables').select('id,code').in('id',tableIds)
      : {data:[],error:null}

    const tableMap=new Map((tablesRes.data||[]).map(t=>[t.id,t.code]))
    const sessionMap=new Map((sessionsRes.data||[]).map(s=>[s.id,tableMap.get(s.table_id)||'-']))

    for(const x of rows){
      const previous=merged.get(x.id)
      merged.set(x.id,{
        ...previous,
        ...x,
        table_code:sessionMap.get(x.session_id)||previous?.table_code||'-'
      })
    }
  }

  // Notification fallback if an old RLS policy hides the underlying call row.
  try{
    const notices=(await listNotifications()).filter(n=>n.event_type==='service_calls')
    const tables=await listTables().catch(()=>[])
    const serviceTables=tables.filter(t=>t.status==='service')
    for(const n of notices){
      if(merged.has(n.entity_id))continue
      const inferredCode=serviceTables.length===1
        ? serviceTables[0].code
        : serviceTables.map(t=>t.code).join(' / ')||'-'
      merged.set(n.entity_id,{
        id:n.entity_id,
        type:n.message||'staff',
        note:'',
        status:'pending',
        created_at:n.created_at,
        table_code:inferredCode,
        notification_fallback:true
      })
    }
  }catch{}

  if(!merged.size && callsRes.error) noerr(callsRes.error)
  return [...merged.values()].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
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

  let result=await supabase
    .from('bills')
    .select('*, table_sessions(restaurant_tables(code))')
    .order('created_at',{ascending:false})

  if(result.error){
    result=await supabase.from('bills').select('*').order('created_at',{ascending:false})
  }
  noerr(result.error)

  const bills=result.data||[]
  if(!bills.length)return []

  const resolved=new Map()
  for(const b of bills){
    const code=b.table_sessions?.restaurant_tables?.code
    if(code)resolved.set(b.session_id,code)
  }

  const missingSessionIds=[...new Set(
    bills.map(b=>b.session_id).filter(id=>id&&!resolved.has(id))
  )]

  if(missingSessionIds.length){
    const sessions=await supabase.from('table_sessions')
      .select('id,table_id')
      .in('id',missingSessionIds)

    if(!sessions.error){
      const tableIds=[...new Set((sessions.data||[]).map(s=>s.table_id).filter(Boolean))]
      const tables=tableIds.length
        ? await supabase.from('restaurant_tables').select('id,code').in('id',tableIds)
        : {data:[],error:null}
      const tableMap=new Map((tables.data||[]).map(t=>[t.id,t.code]))
      for(const s of sessions.data||[]){
        const code=tableMap.get(s.table_id)
        if(code)resolved.set(s.id,code)
      }
    }
  }

  return bills.map(b=>({
    ...b,
    table_code:resolved.get(b.session_id)||b.table_sessions?.restaurant_tables?.code||'-'
  }))
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


export async function askAi(message,history=[],lang='th'){
  const context=await getAiContext().catch(()=>({settings:null,menu:[],promotions:[],knowledge:[]}))
  const cleanHistory=(Array.isArray(history)?history:[])
    .filter(x=>x&&['user','assistant','bot'].includes(x.role)&&String(x.text||x.content||'').trim())
    .slice(-16)
    .map(x=>({
      role:x.role==='bot'?'assistant':x.role,
      content:String(x.text||x.content||'').slice(0,1200)
    }))

  const fallback = () => {
    const q=String(message||'').trim()
    const lower=q.toLowerCase()
    const s=context.settings||{}
    const adult=Number(s.buffet_price||299)
    const child=Number(s.child_price||149)
    const freeHeight=Number(s.free_child_height_cm||90)
    const childMax=Number(s.child_max_height_cm||120)
    const open=String(s.open_time||'11:00').slice(0,5)
    const close=String(s.close_time||'22:00').slice(0,5)

    const recentUser=[...cleanHistory.filter(x=>x.role==='user').map(x=>x.content),q].slice(-8)
    const transcript=recentUser.join(' ').toLowerCase()
    const thai=lang!=='en' && !/\b(hello|hi|price|menu|open|hour|location|reserve|child|recommend|thanks?)\b/i.test(q)

    const reply=(th,en)=>thai?th:en

    if(/^(สวัสดี|หวัดดี|ดีครับ|ดีค่ะ|hello|hi|hey)[! .]*$/i.test(q)){
      return reply(
        'สวัสดีครับ 😊 วันนี้ให้ผมช่วยเรื่องเมนู ราคา จองโต๊ะ หรือช่วยคำนวณราคาสำหรับกลุ่มของคุณได้เลยครับ',
        'Hi 😊 I can help with the menu, prices, reservations, or estimate the total for your group.'
      )
    }
    if(/ขอบคุณ|thank|thx/i.test(q)){
      return reply('ยินดีครับ 😊 ถ้ามีอะไรอยากถามต่อ ถามผมได้เลยครับ','You’re welcome 😊 Ask me anything else about the restaurant.')
    }

    for(const k of context.knowledge||[]){
      const keywords=(k.keywords||[]).map(String)
      const hay=`${k.question||''} ${keywords.join(' ')}`.toLowerCase()
      if(keywords.some(w=>lower.includes(w.toLowerCase())) || (q.length>4&&hay.includes(lower))) return k.answer
    }

    const allNums=(transcript.match(/\d+(?:\.\d+)?/g)||[]).map(Number)
    const heightMatch=q.match(/(?:สูง|height)?\s*(\d{2,3})\s*(?:ซม|cm)?/i)
    const mentionsChild=/เด็ก|child|kid/i.test(transcript)
    const mentionsPeople=/คน|people|persons?|guests?/i.test(transcript)

    if(mentionsChild && heightMatch){
      const h=Number(heightMatch[1])
      const childPrice=h<freeHeight?0:h<=childMax?child:adult
      return reply(
        h<freeHeight
          ? `เด็กสูง ${h} ซม. ทานฟรีครับ เพราะต่ำกว่า ${freeHeight} ซม. ถ้าบอกจำนวนผู้ใหญ่กับเด็กทั้งหมด ผมคำนวณยอดรวมให้ได้ครับ`
          : h<=childMax
            ? `เด็กสูง ${h} ซม. อยู่ในช่วงราคาเด็ก ${child} บาทครับ ถ้าบอกว่ามาทั้งหมดกี่คนและมีเด็กกี่คน ผมคำนวณยอดรวมให้ได้ครับ`
            : `เด็กสูง ${h} ซม. เกิน ${childMax} ซม. คิดราคาผู้ใหญ่ ${adult} บาทครับ`,
        h<freeHeight
          ? `A child who is ${h} cm tall eats free because they are under ${freeHeight} cm. Tell me your full party size and I can calculate the total.`
          : h<=childMax
            ? `A child who is ${h} cm tall is ${child} THB. Tell me your total party size and number of children and I can calculate the total.`
            : `At ${h} cm, the adult price of ${adult} THB applies.`
      )
    }

    const totalMatch=transcript.match(/(?:ทั้งหมด|มากัน|มา\s*|total|party(?: of)?|we are)\s*(\d{1,2})\s*(?:คน|people|persons?|guests?)?/i)
    const childCountMatch=transcript.match(/(?:เด็ก|child(?:ren)?|kids?)\s*(\d{1,2})\s*(?:คน)?/i)
    if(totalMatch&&childCountMatch){
      const total=Number(totalMatch[1]), kids=Number(childCountMatch[1])
      const adults=Math.max(0,total-kids)
      const recentHeight=(transcript.match(/(?:สูง|height)?\s*(\d{2,3})\s*(?:ซม|cm)/ig)||[]).pop()
      const h=recentHeight?Number((recentHeight.match(/\d+/)||[])[0]):null
      if(kids>0&&!h){
        return reply(
          `มาทั้งหมด ${total} คน มีเด็ก ${kids} คน ได้ครับ เด็กสูงประมาณกี่ซม.ครับ? ผมจะคำนวณราคาให้ตรงตามเรตเด็กของร้าน`,
          `Got it: ${total} guests with ${kids} child${kids>1?'ren':''}. About how tall ${kids>1?'are the children':'is the child'}? I’ll calculate the correct child rate.`
        )
      }
      const kidRate=h==null?child:(h<freeHeight?0:h<=childMax?child:adult)
      const totalPrice=adults*adult+kids*kidRate
      return reply(
        `ถ้ามาทั้งหมด ${total} คน เป็นผู้ใหญ่ ${adults} คน และเด็ก ${kids} คน${h?` สูงประมาณ ${h} ซม.`:''} รวมประมาณ ${totalPrice.toLocaleString('th-TH')} บาทครับ (ผู้ใหญ่ ${adult} บาท/คน${kids?`, เด็กเรต ${kidRate} บาท/คน`:''})`,
        `For ${total} guests — ${adults} adult${adults===1?'':'s'} and ${kids} child${kids===1?'':'ren'} — the estimated total is ${totalPrice.toLocaleString('en-US')} THB.`
      )
    }

    if(/ราคา|เท่าไหร่|price|cost|บาท/i.test(lower)){
      return reply(
        `บุฟเฟ่ต์ผู้ใหญ่ ${adult} บาท/คน รวมน้ำและเป็นราคา NET ครับ เด็กต่ำกว่า ${freeHeight} ซม. ฟรี และ ${freeHeight}–${childMax} ซม. ${child} บาทครับ`,
        `Adult buffet is ${adult} THB per person, drinks included, NET. Children under ${freeHeight} cm are free; ${freeHeight}–${childMax} cm are ${child} THB.`
      )
    }

    if(/เปิด|ปิด|กี่โมง|เวลา|hour|open|close/i.test(lower)){
      return reply(`ร้านเปิด ${open}–${close} น. ครับ เวลาทาน ${Number(s.dining_minutes||120)} นาที`,`We’re open ${open}–${close}. Dining time is ${Number(s.dining_minutes||120)} minutes.`)
    }

    if(/ที่อยู่|อยู่ไหน|location|address|map/i.test(lower)){
      return reply(`ร้านอยู่ที่ ${s.address_th||'125/3 ม.5 ต.สามควายเผือก อ.เมือง จ.นครปฐม 73000'} ครับ`,`We’re at ${s.address_th||'125/3 Moo 5, Sam Khwai Phueak, Mueang Nakhon Pathom, Nakhon Pathom 73000'}.`)
    }

    if(/โปร|coupon|promotion|ส่วนลด/i.test(lower)){
      const p=(context.promotions||[]).filter(x=>x.is_active).slice(0,5)
      return p.length
        ? reply(`โปรโมชั่นตอนนี้มี ${p.map(x=>`${x.code} — ${x.name}`).join(', ')} ครับ`,`Current promotions: ${p.map(x=>`${x.code} — ${x.name}`).join(', ')}.`)
        : reply('ตอนนี้ยังไม่มีโปรโมชั่นที่เปิดใช้งานครับ','There are no active promotions right now.')
    }

    const categoryWords=[
      ['เนื้อ','Beef'],['หมู','Pork'],['ไก่','Chicken'],['ซีฟู้ด','Seafood'],['กุ้ง','Seafood'],
      ['ผัก','Vegetables'],['เห็ด','Mushrooms'],['ของหวาน','Dessert'],['เครื่องดื่ม','Drinks'],['น้ำซุป','Soup']
    ]
    const foundCategory=categoryWords.find(([th,en])=>lower.includes(th)||lower.includes(en.toLowerCase()))
    if(foundCategory){
      const [thCat,enCat]=foundCategory
      const matched=(context.menu||[]).filter(x=>{
        const hay=`${x.category||''} ${x.name_th||''} ${x.name_en||''}`.toLowerCase()
        return hay.includes(thCat.toLowerCase())||hay.includes(enCat.toLowerCase())
      }).slice(0,10)
      if(matched.length){
        const names=matched.map(x=>thai?(x.name_th||x.name_en):(x.name_en||x.name_th))
        return reply(`มีครับ เช่น ${names.join(', ')} ครับ อยากให้ผมช่วยเลือกแบบไหนเป็นพิเศษไหมครับ`,`Yes — for example: ${names.join(', ')}. Want me to recommend a few based on what you like?`)
      }
    }

    if(/แนะนำ|กินอะไร|recommend|suggest|อร่อยอะไร/i.test(lower)){
      const sample=(context.menu||[]).filter(x=>!x.is_premium).slice(0,8)
      const names=sample.map(x=>thai?(x.name_th||x.name_en):(x.name_en||x.name_th))
      return names.length
        ? reply(`ถ้าเลือกไม่ถูก ผมแนะนำเริ่มจาก ${names.slice(0,5).join(', ')} ก่อนครับ แล้วบอกผมได้ว่าชอบหมู เนื้อ ซีฟู้ด หรือเผ็ด ผมจะเลือกให้ตรงขึ้นครับ`,`A good start is ${names.slice(0,5).join(', ')}. Tell me if you prefer pork, beef, seafood, or spicy food and I’ll narrow it down.`)
        : reply('บอกผมได้ว่าชอบหมู เนื้อ ซีฟู้ด หรืออาหารเผ็ด เดี๋ยวผมช่วยเลือกให้ครับ','Tell me whether you prefer pork, beef, seafood, or spicy food and I’ll help you choose.')
    }

    if(/เมนู|menu|มีอะไร/i.test(lower)){
      const names=(context.menu||[]).slice(0,12).map(x=>thai?(x.name_th||x.name_en):(x.name_en||x.name_th))
      return names.length
        ? reply(`มีหลายหมวดครับ ตัวอย่างเช่น ${names.join(', ')} และยังมีเมนูอื่นอีกครับ ถ้าบอกว่าชอบอะไร ผมช่วยคัดให้ได้ครับ`,`We have many categories. Examples include ${names.join(', ')}. Tell me what you like and I can narrow it down.`)
        : reply('กำลังอัปเดตข้อมูลเมนูครับ','The menu is being updated right now.')
    }

    if(/จอง|reserve|booking/i.test(lower)){
      return reply('จองได้ครับ กดเมนู “จองโต๊ะ” แล้วกรอกชื่อ เบอร์ วันที่ เวลา และจำนวนคน จากนั้นร้านจะยืนยันโต๊ะให้ครับ','You can reserve from the “Reserve” page. Enter your name, phone, date, time and party size, then the restaurant will confirm your table.')
    }

    if(/เด็ก|child|kid/i.test(lower)){
      return reply(`เด็กต่ำกว่า ${freeHeight} ซม. ฟรี, ${freeHeight}–${childMax} ซม. ${child} บาท และเกิน ${childMax} ซม. คิดราคาผู้ใหญ่ ${adult} บาทครับ เด็กสูงประมาณเท่าไหร่ครับ?`,`Children under ${freeHeight} cm are free, ${freeHeight}–${childMax} cm are ${child} THB, and above ${childMax} cm pay the adult rate of ${adult} THB. About how tall is the child?`)
    }

    if(/prompt|พร้อมเพย์|จ่าย|ชำระ|payment|pay/i.test(lower)){
      return reply(`รองรับ PromptPay ${s.promptpay||'06-1564-0529'} และช่องทางชำระเงินที่ร้านกำหนดครับ`,`PromptPay is available at ${s.promptpay||'06-1564-0529'}, along with the payment methods enabled by the restaurant.`)
    }

    return reply(
      'ได้ครับ คุยกับผมได้ตามปกติเลย 😊 ผมช่วยเรื่องเมนู ราคาเด็ก คำนวณราคากลุ่ม โปรโมชั่น เวลาเปิดร้าน ที่ตั้ง และการจองโต๊ะได้ครับ',
      'Sure — you can chat with me naturally 😊 I can help with the menu, child pricing, group estimates, promotions, opening hours, location and reservations.'
    )
  }

  if(!supabaseConfigured) return fallback()

  try {
    const compact={
      settings:context.settings,
      menu:(context.menu||[]).slice(0,140).map(x=>({
        name_th:x.name_th,name_en:x.name_en,category:x.category,
        description_th:x.description_th,description_en:x.description_en,
        extra_price:x.extra_price,is_premium:x.is_premium,is_available:x.is_available
      })),
      promotions:(context.promotions||[]).filter(x=>x.is_active).slice(0,20),
      knowledge:(context.knowledge||[]).filter(x=>x.is_active).slice(0,80)
    }
    const {data,error}=await supabase.functions.invoke('ai-chat',{
      body:{message:String(message).slice(0,2000),history:cleanHistory,context:compact,lang}
    })
    if(error) throw error
    const answer=String(data?.answer||'').trim() || fallback()
    try{
      const key=localStorage.getItem('shabu-chat-key')||crypto.randomUUID()
      localStorage.setItem('shabu-chat-key',key)
      await supabase.rpc('log_chat',{p_session_key:key,p_customer_message:message,p_assistant_message:answer})
    }catch{}
    return answer
  } catch {
    const answer=fallback()
    try{
      const key=localStorage.getItem('shabu-chat-key')||crypto.randomUUID()
      localStorage.setItem('shabu-chat-key',key)
      await supabase.rpc('log_chat',{p_session_key:key,p_customer_message:message,p_assistant_message:answer})
    }catch{}
    return answer
  }
}

// ----- Production admin helpers -----
export async function listCategories(){
  if(!supabaseConfigured) return [...new Set(getDemo().menu.map(x=>x.category))].map((name_th,i)=>({id:'demo-cat-'+i,name_th,name_en:name_th,sort_order:i+1,is_active:true}))
  const {data,error}=await supabase.from('menu_categories').select('*').order('sort_order'); noerr(error); return data||[]
}
export async function createCategory(payload){
  if(!supabaseConfigured) return payload
  const {data,error}=await supabase.from('menu_categories').insert(payload).select().single(); noerr(error); return data
}
export async function updateCategory(id,payload){
  if(!supabaseConfigured) return payload
  const {data,error}=await supabase.from('menu_categories').update(payload).eq('id',id).select().single(); noerr(error); return data
}
export async function deleteCategory(id){
  if(!supabaseConfigured) return
  const {error}=await supabase.from('menu_categories').delete().eq('id',id); noerr(error)
}
export async function createMenuItem(payload){
  if(!supabaseConfigured) return mutate(db=>{const x={id:rid('m'),is_available:true,...payload};db.menu.push(x);return x})
  const {data,error}=await supabase.from('menu_items').insert(payload).select().single(); noerr(error); return data
}
export async function updateMenuItem(id,payload){
  if(!supabaseConfigured) return mutate(db=>{const x=db.menu.find(m=>m.id===id);Object.assign(x,payload);return x})
  const {data,error}=await supabase.from('menu_items').update(payload).eq('id',id).select().single(); noerr(error); return data
}
export async function deleteMenuItem(id){
  if(!supabaseConfigured) return mutate(db=>{db.menu=db.menu.filter(m=>m.id!==id)})
  const {error}=await supabase.from('menu_items').delete().eq('id',id); noerr(error)
}
export async function listProfiles(){
  if(!supabaseConfigured) return [{id:'demo-owner',email:'demo@shabu.local',display_name:'Owner',role:'owner',is_active:true}]
  const {data,error}=await supabase.from('profiles').select('*').order('created_at'); noerr(error); return data||[]
}
export async function updateProfile(id,payload){
  if(!supabaseConfigured) return payload
  const {data,error}=await supabase.from('profiles').update(payload).eq('id',id).select().single(); noerr(error); return data
}
export async function listPromotions(){
  if(!supabaseConfigured) return []
  const {data,error}=await supabase.from('promotions').select('*').order('created_at',{ascending:false}); noerr(error); return data||[]
}
export async function createPromotion(payload){
  const {data,error}=await supabase.from('promotions').insert(payload).select().single(); noerr(error); return data
}
export async function updatePromotion(id,payload){
  const {data,error}=await supabase.from('promotions').update(payload).eq('id',id).select().single(); noerr(error); return data
}
export async function deletePromotion(id){
  const {error}=await supabase.from('promotions').delete().eq('id',id); noerr(error)
}
export async function listAuditLogs(){
  if(!supabaseConfigured) return []
  const {data,error}=await supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(300); noerr(error); return data||[]
}
export async function openWalkin(tableId,adultCount,childCount=0,freeChildCount=0){
  if(!supabaseConfigured) return mutate(db=>{
    const t=db.tables.find(x=>x.id===tableId);if(!t||t.status!=='available')throw new Error('โต๊ะไม่ว่าง')
    const guest=Number(adultCount)+Number(childCount)+Number(freeChildCount)
    const token=crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase()
    const s={id:rid('s'),token,table_id:t.id,table_code:t.code,status:'active',guest_count:guest,adult_count:Number(adultCount),child_count:Number(childCount),free_child_count:Number(freeChildCount),started_at:now(),created_at:now()}
    db.sessions.push(s);t.status='occupied';return s
  })
  const {data,error}=await supabase.rpc('open_walkin_session',{p_table_id:tableId,p_adult_count:Number(adultCount),p_child_count:Number(childCount),p_free_child_count:Number(freeChildCount)}); noerr(error); return data
}
export async function listActiveSessions(){
  if(!supabaseConfigured) return getDemo().sessions.filter(s=>s.status!=='closed')

  let result=await supabase.from('table_sessions')
    .select('*, restaurant_tables(code,seats), table_session_tables(table_id,is_primary,restaurant_tables(code,seats,status))')
    .in('status',['reserved','active','billing'])
    .order('created_at',{ascending:false})

  if(result.error){
    result=await supabase.from('table_sessions')
      .select('*')
      .in('status',['reserved','active','billing'])
      .order('created_at',{ascending:false})
  }

  noerr(result.error)
  const rows=result.data||[]
  if(!rows.length)return []

  const tableIds=[...new Set(rows.map(s=>s.table_id).filter(Boolean))]
  let tableMap=new Map()
  if(tableIds.length){
    const tables=await supabase.from('restaurant_tables')
      .select('id,code,seats,status')
      .in('id',tableIds)
    if(!tables.error)tableMap=new Map((tables.data||[]).map(t=>[t.id,t]))
  }

  return rows.map(s=>{
    const primary=s.restaurant_tables?.code?s.restaurant_tables:tableMap.get(s.table_id)
    return {
      ...s,
      table_code:primary?.code||'-',
      table_seats:primary?.seats,
      linked_tables:(s.table_session_tables||[]).map(x=>({
        ...x,
        code:x.restaurant_tables?.code,
        seats:x.restaurant_tables?.seats,
        status:x.restaurant_tables?.status
      }))
    }
  })
}

export async function moveTableSession(sessionId,newTableId){
  const {data,error}=await supabase.rpc('move_table_session',{p_session_id:sessionId,p_new_table_id:newTableId}); noerr(error); return data
}
export async function updateBillDetails(id,payload){
  if(!supabaseConfigured) return mutate(db=>{const b=db.bills.find(x=>x.id===id);Object.assign(b,payload);b.total=Number(payload.adult_count)*299+Number(payload.child_count)*149-Number(payload.discount_amount||0);return b})
  const {data,error}=await supabase.rpc('update_bill_details',{
    p_bill_id:id,p_adult_count:Number(payload.adult_count||0),p_child_count:Number(payload.child_count||0),
    p_free_child_count:Number(payload.free_child_count||0),p_discount_amount:Number(payload.discount_amount||0),
    p_promotion_code:payload.promotion_code||null,p_note:payload.note||''
  }); noerr(error); return data
}
export async function expireReservations(){
  if(!supabaseConfigured) return 0
  const {data,error}=await supabase.rpc('expire_old_reservations'); noerr(error); return data
}
export async function listCustomers(){
  if(!supabaseConfigured) return []
  const [{data:reservations,error:e1},{data:sessions,error:e2}]=await Promise.all([
    supabase.from('reservations').select('id,customer_name,customer_phone,created_at,status,guest_count,reservation_date,reservation_time').order('created_at',{ascending:false}),
    supabase.from('table_sessions').select('id,reservation_id,bills(total,status,paid_at),reviews(overall,comment,created_at)')
  ])
  noerr(e1);noerr(e2)
  const byReservation=new Map((sessions||[]).map(s=>[s.reservation_id,s]))
  const map=new Map()
  for(const r of reservations||[]){
    const k=r.customer_phone
    const x=map.get(k)||{customer_phone:k,customer_name:r.customer_name,visits:0,reservations:0,total_guests:0,total_spend:0,last_seen:r.created_at,history:[],reviews:[]}
    x.reservations++;x.total_guests+=Number(r.guest_count||0)
    const s=byReservation.get(r.id)
    const paid=(s?.bills||[]).filter(b=>b.status==='paid')
    if(paid.length)x.visits++
    x.total_spend+=paid.reduce((sum,b)=>sum+Number(b.total||0),0)
    x.history.push({...r,total:paid.reduce((sum,b)=>sum+Number(b.total||0),0)})
    x.reviews.push(...(s?.reviews||[]))
    if(new Date(r.created_at)>new Date(x.last_seen))x.last_seen=r.created_at
    map.set(k,x)
  }
  return [...map.values()].sort((a,b)=>new Date(b.last_seen)-new Date(a.last_seen))
}
export async function getReports(){
  if(!supabaseConfigured) return {bills:[],orders:[],reviews:[],sessions:[]}
  const [{data:bills,error:e1},{data:orders,error:e2},{data:reviews,error:e3},{data:sessions,error:e4}]=await Promise.all([
    supabase.from('bills').select('*, table_sessions(started_at,closed_at,restaurant_tables(code))').eq('status','paid').order('paid_at',{ascending:false}),
    supabase.from('food_orders').select('id,status,created_at,served_at,food_order_items(item_name_th,quantity,station)').order('created_at',{ascending:false}),
    supabase.from('reviews').select('*').order('created_at',{ascending:false}),
    supabase.from('table_sessions').select('id,started_at,closed_at,guest_count,restaurant_tables(code)').not('closed_at','is',null).order('closed_at',{ascending:false})
  ])
  noerr(e1);noerr(e2);noerr(e3);noerr(e4);return {bills:bills||[],orders:orders||[],reviews:reviews||[],sessions:sessions||[]}
}


export async function getCurrentProfile(){
  if(!supabaseConfigured) return {id:'demo-owner',email:'demo@shabu.local',display_name:'Owner',role:'owner',is_active:true}
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) return null
  const {data,error}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle(); noerr(error); return data
}


export async function updateReservationAdmin(id,payload){
  if(!supabaseConfigured) return mutate(db=>{const r=db.reservations.find(x=>x.id===id);if(!r)throw new Error('ไม่พบการจอง');Object.assign(r,payload);return r})
  const {data,error}=await supabase.from('reservations').update(payload).eq('id',id).select().single(); noerr(error); return data
}


export async function cancelReservationAdmin(id){
  if(!supabaseConfigured) return mutate(db=>{
    const r=db.reservations.find(x=>x.id===id);if(!r)throw new Error('ไม่พบการจอง')
    const s=db.sessions.find(x=>x.reservation_id===id&&['reserved','active','billing'].includes(x.status))
    if(s&&['active','billing'].includes(s.status))throw new Error('ลูกค้าเริ่มใช้โต๊ะแล้ว')
    r.status='cancelled'
    if(s){s.status='cancelled';const t=db.tables.find(x=>x.id===s.table_id);if(t)t.status='available'}
    return r
  })
  const {data,error}=await supabase.rpc('cancel_reservation_admin',{p_reservation_id:id}); noerr(error); return data
}


export async function registerStaffProfile(email,displayName,role){
  if(!supabaseConfigured) return {email,display_name:displayName,role,is_active:true}
  const {data,error}=await supabase.rpc('register_staff_profile',{p_email:email,p_display_name:displayName,p_role:role}); noerr(error); return data
}
export async function listChatLogs(){
  if(!supabaseConfigured) return []
  const {data,error}=await supabase.from('chat_logs').select('*').order('created_at',{ascending:false}).limit(300); noerr(error); return data||[]
}


// ----- Final production helpers -----
export async function createStaffAccount(email,password,displayName,role){
  if(!supabaseConfigured) return {email,display_name:displayName,role,is_active:true}
  const secondary=createClient(supabaseUrl,supabaseAnonKey,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  })
  const {data,error}=await secondary.auth.signUp({
    email:String(email||'').trim().toLowerCase(),
    password,
    options:{data:{display_name:displayName}}
  })
  noerr(error)
  await registerStaffProfile(email,displayName,role)
  return data.user
}

export async function reorderMenuItems(ids){
  if(!supabaseConfigured) return
  for(let i=0;i<ids.length;i++){
    const {error}=await supabase.from('menu_items').update({sort_order:i+1}).eq('id',ids[i]); noerr(error)
  }
}
export async function reorderCategories(ids){
  if(!supabaseConfigured) return
  for(let i=0;i<ids.length;i++){
    const {error}=await supabase.from('menu_categories').update({sort_order:i+1}).eq('id',ids[i]); noerr(error)
  }
}
export async function uploadPublicImage(bucket,file,prefix='img'){
  if(!supabaseConfigured) return ''
  if(!file?.type?.startsWith('image/')) throw new Error('กรุณาเลือกไฟล์รูปภาพ')
  if(file.size>5*1024*1024) throw new Error('รูปต้องมีขนาดไม่เกิน 5 MB')
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')
  const path=`${prefix}/${Date.now()}-${crypto.randomUUID().slice(0,8)}.${ext}`
  const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type}); noerr(error)
  const {data}=supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
export async function uploadMenuImage(file){return uploadPublicImage('menu-images',file,'menu')}
export async function uploadBrandLogo(file){return uploadPublicImage('branding',file,'logo')}

export async function mergeSessionTable(sessionId,tableId){
  const {data,error}=await supabase.rpc('merge_session_table',{p_session_id:sessionId,p_table_id:tableId}); noerr(error); return data
}
export async function detachSessionTable(sessionId,tableId){
  const {data,error}=await supabase.rpc('detach_session_table',{p_session_id:sessionId,p_table_id:tableId}); noerr(error); return data
}
export async function updateSessionGuests(sessionId,adultCount,childCount,freeChildCount){
  const {data,error}=await supabase.rpc('update_session_guests',{
    p_session_id:sessionId,p_adult_count:Number(adultCount),p_child_count:Number(childCount),p_free_child_count:Number(freeChildCount)
  }); noerr(error); return data
}
export async function regenerateSessionQr(sessionId){
  const {data,error}=await supabase.rpc('regenerate_session_qr',{p_session_id:sessionId}); noerr(error); return data
}

export async function listSessionTableLinks(sessionId){
  if(!supabaseConfigured) return []
  const {data,error}=await supabase.from('table_session_tables').select('*, restaurant_tables(*)').eq('session_id',sessionId).order('is_primary',{ascending:false}); noerr(error)
  return data||[]
}

export async function uploadPaymentSlip(token,file){
  if(!supabaseConfigured) return {slip_status:'pending'}
  if(!file?.type?.startsWith('image/')) throw new Error('กรุณาเลือกรูปสลิป')
  if(file.size>6*1024*1024) throw new Error('สลิปต้องมีขนาดไม่เกิน 6 MB')
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')
  const path=`${String(token).slice(0,8)}/${Date.now()}-${crypto.randomUUID().slice(0,8)}.${ext}`
  const {error}=await supabase.storage.from('payment-slips').upload(path,file,{contentType:file.type}); noerr(error)
  const {data,error:e2}=await supabase.rpc('submit_payment_slip',{p_token:token,p_path:path}); noerr(e2); return data
}
export async function getSlipSignedUrl(path){
  if(!path) return null
  const {data,error}=await supabase.storage.from('payment-slips').createSignedUrl(path,600); noerr(error); return data?.signedUrl||null
}
export async function reviewPaymentSlip(billId,status){
  const {data,error}=await supabase.rpc('review_payment_slip',{p_bill_id:billId,p_status:status}); noerr(error); return data
}

export async function listNotifications(){
  if(!supabaseConfigured) return []
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) return []
  const {data,error}=await supabase.from('notifications').select('*, notification_reads!left(user_id,read_at)').order('created_at',{ascending:false}).limit(100); noerr(error)
  return (data||[]).map(n=>({...n,is_read:(n.notification_reads||[]).some(r=>r.user_id===user.id)}))
}
export async function markNotificationRead(id){
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return
  const {error}=await supabase.from('notification_reads').upsert({notification_id:id,user_id:user.id},{onConflict:'notification_id,user_id'}); noerr(error)
}
export async function markAllNotificationsRead(ids){
  for(const id of ids) await markNotificationRead(id)
}
export function subscribeNotifications(cb){
  if(!supabaseConfigured) return ()=>{}
  const ch=supabase.channel('admin-notifications')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications'},cb)
    .subscribe()
  return()=>supabase.removeChannel(ch)
}

export async function listKnowledgeBase(){
  if(!supabaseConfigured) return []
  const {data,error}=await supabase.from('knowledge_base').select('*').order('sort_order').order('created_at'); noerr(error); return data||[]
}
export async function createKnowledge(payload){
  const {data,error}=await supabase.from('knowledge_base').insert(payload).select().single(); noerr(error); return data
}
export async function updateKnowledge(id,payload){
  const {data,error}=await supabase.from('knowledge_base').update(payload).eq('id',id).select().single(); noerr(error); return data
}
export async function deleteKnowledge(id){
  const {error}=await supabase.from('knowledge_base').delete().eq('id',id); noerr(error)
}
export async function updateReviewAdmin(id,payload){
  const {data,error}=await supabase.from('reviews').update(payload).eq('id',id).select().single(); noerr(error); return data
}

export async function getAiContext(){
  if(!supabaseConfigured) return {settings:null,menu:[],promotions:[],knowledge:[]}
  const [settings,menu,promotions,knowledge]=await Promise.all([
    getSettings().catch(()=>null),listMenu().catch(()=>[]),listPromotions().catch(()=>[]),listKnowledgeBase().catch(()=>[])
  ])
  return {settings,menu:menu.filter(x=>x.is_available!==false),promotions:promotions.filter(x=>x.is_active),knowledge:knowledge.filter(x=>x.is_active)}
}
