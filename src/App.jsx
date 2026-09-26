import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  activateSession, askAi, closeBill, confirmReservation, createFoodOrder, createReservation,
  createServiceCall, getAdminSession, getCurrentProfile, getReservation, getSession, getSettings, listBills, listMenu,
  listOrders, listReservations, listReviews, listServiceCalls, listSessionOrders, listTables, login,
  logout, markTableReady, rejectReservation, requestBill, resolveServiceCall, shopIsOpen, submitReview,
  subscribeAll, updateOrderStatus, updateSettings, expireReservations, updateReservationAdmin, cancelReservationAdmin
} from './lib/api'
import { MENU, ORDER_FLOW, ORDER_LABEL, SHOP, TABLE_LABEL } from './lib/constants'
import { supabaseConfigured } from './lib/supabase'
import { AuditPage, BillingManager, CustomersPage, MenuManager, PromotionsPage, ReportsPage, StaffPage, TablesManager } from './admin/ProductionPages'

const money=(n)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n||0))
const dateTime=(v)=>v?new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'-'
const t=(lang,th,en)=>lang==='th'?th:en

function Logo({small=false}) {
  return <img className={small?'logo small':'logo'} src="/shabu-aroi-jang/logo.svg" alt={SHOP.nameTh} />
}

function Status({value,type='order'}) {
  const labels=type==='table'?TABLE_LABEL:ORDER_LABEL
  return <span className={`status status-${value}`}>{labels[value]||value}</span>
}

function CustomerShell({children,lang,setLang,settings}) {
  const open=shopIsOpen(settings)
  return <div className="customer-shell">
    {!supabaseConfigured && <div className="demo-bar">DEMO MODE • เชื่อม Supabase แล้วข้อมูลจะเป็น Realtime จริง</div>}
    <header className="topbar">
      <div className="wrap topbar-inner">
        <Link className="brand" to="/"><Logo small/><div><strong>{lang==='th'?SHOP.nameTh:SHOP.nameEn}</strong><span>Japanese Shabu Buffet</span></div></Link>
        <nav className="main-nav">
          <NavLink to="/">{t(lang,'หน้าแรก','Home')}</NavLink>
          <NavLink to="/menu">{t(lang,'เมนู','Menu')}</NavLink>
          <NavLink to="/reserve">{t(lang,'จองโต๊ะ','Reserve')}</NavLink>
          <NavLink to="/reservation">{t(lang,'เช็กการจอง','Reservation')}</NavLink>
          <NavLink to="/chat">AI Chat</NavLink>
        </nav>
        <div className="top-actions">
          <span className={open?'open-pill':'closed-pill'}>{open?'● เปิดร้าน':'● ปิดร้าน'}</span>
          <button className="lang" onClick={()=>setLang(lang==='th'?'en':'th')}>{lang==='th'?'EN':'TH'}</button>
        </div>
      </div>
    </header>
    {!open && <div className="closed-banner">ขณะนี้ร้านปิดรับลูกค้าใหม่ • ยังสามารถตรวจสอบการจองและพูดคุยกับ AI ได้</div>}
    {children}
    <footer>
      <div className="wrap footer-grid">
        <div><Logo small/><h3>{SHOP.nameTh}</h3><p>บุฟเฟ่ต์ชาบู 299 บาท รวมน้ำ NET • อิ่มคุ้มในนครปฐม</p></div>
        <div><b>ติดต่อร้าน</b><p>{SHOP.phone}<br/>{SHOP.addressTh}</p></div>
        <div><b>เวลาทำการ</b><p>{SHOP.openTime}–{SHOP.closeTime}<br/>เวลาทาน {SHOP.diningMinutes} นาที</p><Link className="footer-admin" to="/admin/login">Admin</Link></div>
      </div>
    </footer>
  </div>
}

function Home({lang,settings}) {
  const open=shopIsOpen(settings)
  return <>
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          <span className="eyebrow">SHABU • NAKHON PATHOM</span>
          <h1>{t(lang,'ชาบูร้อนๆ','Hot Pot Happiness')}<br/><em>{t(lang,'อร่อยไม่อั้น','Unlimited Goodness')}</em></h1>
          <p>{t(lang,'บุฟเฟ่ต์ชาบูครบทั้งหมู เนื้อ ซีฟู้ด ผัก ของทอด เครื่องดื่ม และของหวาน ในราคาเดียว','Unlimited shabu with pork, beef, seafood, vegetables, sides, drinks and dessert — all in one price.')}</p>
          <div className="hero-price"><strong>299</strong><span>บาท / คน<br/>รวมน้ำ + NET</span></div>
          <div className="hero-actions">
            <Link className={open?'btn primary':'btn disabled'} to={open?'/reserve':'/'}>{t(lang,'จองโต๊ะ','Reserve a table')}</Link>
            <Link className="btn ghost" to="/menu">{t(lang,'ดูเมนู','View menu')}</Link>
            <Link className="btn dark" to="/chat">💬 AI Chat</Link>
          </div>
          <div className="hero-badges"><span>⏱ {SHOP.diningMinutes} นาที</span><span>🥤 รวมน้ำ</span><span>💳 PromptPay</span></div>
        </div>
        <div className="hero-art">
          <Logo/>
          <div className="float-card one">🔥 5 น้ำซุป</div>
          <div className="float-card two">🥩 70+ เมนู</div>
        </div>
      </div>
    </section>
    <section className="feature-band"><div className="wrap feature-grid">
      {[
        ['🍲','ซุปหลากหลาย','น้ำดำ หม่าล่า ต้มยำ และอีกมาก'],
        ['🥩','วัตถุดิบแน่น','หมู เนื้อ ซีฟู้ด ผักสด'],
        ['📱','สั่งผ่าน QR','ไม่ต้องรอพนักงานรับออเดอร์'],
        ['🔔','เรียกพนักงาน','เติมซุป เก็บจาน เช็คบิลได้ทันที'],
      ].map(([i,h,p])=><div className="feature-card" key={h}><span>{i}</span><div><b>{h}</b><small>{p}</small></div></div>)}
    </div></section>
    <section className="section"><div className="wrap split">
      <div className="panel warm"><span className="eyebrow">HOW IT WORKS</span><h2>จอง → QR → สั่ง → เช็คบิล</h2>
        <div className="steps">{[
          ['1','จองโต๊ะ','กรอกวัน เวลา และจำนวนคน'],
          ['2','ร้านยืนยัน','Admin เลือกโต๊ะที่เหมาะสม'],
          ['3','รับ QR','สแกนแล้วล็อกโต๊ะอัตโนมัติ'],
          ['4','สั่งได้ไม่อั้น','Kitchen รับรายการแบบ Realtime'],
        ].map(([n,h,p])=><div key={n}><i>{n}</i><span><b>{h}</b><small>{p}</small></span></div>)}</div>
      </div>
      <div className="panel map-card"><span className="eyebrow">LOCATION</span><h2>ร้านอยู่ที่ไหน?</h2><p>{SHOP.addressTh}</p>
        <div className="fake-map"><div>📍</div><b>ชาบูอร่อยจัง</b><span>สามควายเผือก • เมืองนครปฐม</span></div>
        <a className="btn primary wide" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SHOP.addressTh)}`} target="_blank" rel="noreferrer">เปิด Google Maps</a>
      </div>
    </div></section>
  </>
}

function MenuPage({lang}) {
  const [items,setItems]=useState([])
  const [q,setQ]=useState('')
  const [cat,setCat]=useState('ทั้งหมด')
  useEffect(()=>{listMenu().then(setItems).catch(()=>setItems(MENU))},[])
  const cats=['ทั้งหมด',...new Set(items.map(x=>x.category))]
  const filtered=items.filter(x=>(cat==='ทั้งหมด'||x.category===cat)&&(`${x.name_th} ${x.name_en}`.toLowerCase().includes(q.toLowerCase())))
  return <section className="section page"><div className="wrap">
    <div className="page-head center"><span className="eyebrow">BUFFET MENU</span><h1>{t(lang,'เมนูชาบูของเรา','Our Shabu Menu')}</h1><p>รวมอยู่ใน Buffet 299 บาท เว้นแต่ร้านกำหนดเป็นเมนูพิเศษในอนาคต</p></div>
    <div className="menu-toolbar"><input value={q} onChange={e=>setQ(e.target.value)} placeholder={t(lang,'ค้นหาเมนู...','Search menu...')}/></div>
    <div className="chips">{cats.map(c=><button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{c}</button>)}</div>
    <div className="menu-grid">{filtered.map(x=><article className="food-card" key={x.id}><div className="food-emoji">{x.emoji||'🍲'}</div><div><small>{x.category}{x.is_premium?' • PREMIUM':''}</small><h3>{lang==='th'?x.name_th:x.name_en}</h3><span>{x.is_available!==false?'พร้อมเสิร์ฟ':'หมดชั่วคราว'}{Number(x.extra_price||0)>0?` • +${money(x.extra_price)}`:''}</span></div></article>)}</div>
  </div></section>
}

function ReservePage({settings}) {
  const nav=useNavigate(); const open=shopIsOpen(settings)
  const [form,setForm]=useState({customer_name:'',customer_phone:'',reservation_date:'',reservation_time:'18:00',guest_count:2,note:''})
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  async function submit(e){
    e.preventDefault(); if(!open)return
    setBusy(true);setErr('')
    try{
      const r=await createReservation({...form,guest_count:Number(form.guest_count)})
      nav(`/reservation?code=${encodeURIComponent(r.code)}`)
    }catch(e2){setErr(e2.message)}finally{setBusy(false)}
  }
  if(!open)return <section className="section page"><div className="wrap narrow"><div className="empty"><h2>ร้านปิดรับการจองชั่วคราว</h2><p>กรุณากลับมาในเวลาทำการ {SHOP.openTime}–{SHOP.closeTime}</p></div></div></section>
  return <section className="section page"><div className="wrap narrow">
    <div className="page-head"><span className="eyebrow">RESERVATION</span><h1>จองโต๊ะล่วงหน้า</h1><p>หลังส่งคำขอ ร้านจะเป็นผู้เลือกโต๊ะและยืนยันให้คุณ</p></div>
    <form className="form-card" onSubmit={submit}>
      {err&&<div className="alert error">{err}</div>}
      <div className="form-grid">
        <label>ชื่อผู้จอง<input required value={form.customer_name} onChange={e=>set('customer_name',e.target.value)}/></label>
        <label>เบอร์โทร<input required inputMode="tel" value={form.customer_phone} onChange={e=>set('customer_phone',e.target.value.replace(/\D/g,'').slice(0,10))}/></label>
        <label>วันที่<input required type="date" value={form.reservation_date} onChange={e=>set('reservation_date',e.target.value)}/></label>
        <label>เวลา<input required type="time" value={form.reservation_time} onChange={e=>set('reservation_time',e.target.value)}/></label>
        <label>จำนวนคน<input min="1" max="10" required type="number" value={form.guest_count} onChange={e=>set('guest_count',e.target.value)}/></label>
        <label>หมายเหตุ<input value={form.note} onChange={e=>set('note',e.target.value)} placeholder="เช่น มีเด็ก 1 คน"/></label>
      </div>
      <div className="price-preview"><span>ราคาโดยประมาณ</span><strong>{money(Number(form.guest_count||0)*299)}</strong><small>* ราคาเด็กสามารถปรับตอนเปิดโต๊ะจริงได้</small></div>
      <button className="btn primary wide" disabled={busy}>{busy?'กำลังส่ง...':'ยืนยันคำขอจองโต๊ะ'}</button>
    </form>
  </div></section>
}

function ReservationPage() {
  const loc=useLocation(); const params=new URLSearchParams(loc.search)
  const [code,setCode]=useState(params.get('code')||''); const [data,setData]=useState(null); const [err,setErr]=useState('')
  async function search(c=code){setErr('');try{const r=await getReservation(c.trim());if(!r)throw new Error('ไม่พบการจอง');setData(r)}catch(e){setData(null);setErr(e.message)}}
  useEffect(()=>{if(code)search(code)},[])
  return <section className="section page"><div className="wrap narrow">
    <div className="page-head center"><span className="eyebrow">YOUR RESERVATION</span><h1>ตรวจสอบการจอง</h1><p>กรอกรหัสการจอง 6 ตัวที่ได้รับหลังส่งคำขอ</p></div>
    <div className="search-box"><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={10}/><button className="btn primary" onClick={()=>search()}>ค้นหา</button></div>
    {err&&<div className="alert error">{err}</div>}
    {data&&<div className="reservation-card">
      <div className="reservation-top"><div><small>RESERVATION</small><h2>{data.code}</h2></div><span className={`reservation-state ${data.status}`}>{({pending:'รอยืนยัน',confirmed:'ยืนยันแล้ว',rejected:'ไม่อนุมัติ',cancelled:'ยกเลิก'})[data.status]||data.status}</span></div>
      <div className="reservation-info"><div><span>ชื่อ</span><b>{data.customer_name}</b></div><div><span>จำนวน</span><b>{data.guest_count} คน</b></div><div><span>วัน/เวลา</span><b>{data.reservation_date} • {data.reservation_time}</b></div><div><span>โต๊ะ</span><b>{data.table_code||data.restaurant_tables?.code||'รอร้านจัดโต๊ะ'}</b></div></div>
      {data.status==='confirmed'&&data.session_token&&<div className="qr-zone"><QRCodeSVG value={`${location.origin}/shabu-aroi-jang/table/${data.session_token}`} size={210}/><h3>QR สำหรับโต๊ะ {data.table_code||data.restaurant_tables?.code}</h3><p>สแกน QR เมื่อมาถึงร้านเพื่อเปิด Session และเริ่มสั่งอาหาร</p><Link className="btn dark" to={`/table/${data.session_token}`}>เปิดหน้าสั่งอาหาร</Link></div>}
    </div>}
  </div></section>
}

function ChatPage() {
  const [messages,setMessages]=useState([{role:'bot',text:'สวัสดีครับ 👋 ผมเป็น AI ของชาบูอร่อยจัง ถามเรื่องราคา เมนู เวลาเปิด ที่ตั้ง หรือการจองได้เลยครับ'}])
  const [input,setInput]=useState(''); const [busy,setBusy]=useState(false)
  async function send(){
    const q=input.trim(); if(!q||busy)return
    setInput(''); setMessages(m=>[...m,{role:'user',text:q}]); setBusy(true)
    const answer=await askAi(q); setMessages(m=>[...m,{role:'bot',text:answer}]); setBusy(false)
  }
  return <section className="section page"><div className="wrap chat-wrap">
    <div className="page-head center"><span className="eyebrow">AI CONCIERGE</span><h1>ถามชาบู AI</h1><p>ผู้ช่วยตอบคำถามเกี่ยวกับร้านตลอดเวลา</p></div>
    <div className="chat-card"><div className="chat-log">{messages.map((m,i)=><div key={i} className={`bubble-msg ${m.role}`}><span>{m.role==='bot'?'🍲':'🙂'}</span><p>{m.text}</p></div>)}{busy&&<div className="bubble-msg bot"><span>🍲</span><p>กำลังคิด...</p></div>}</div>
      <div className="chat-input"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="เช่น ร้านเปิดกี่โมง?"/><button className="btn primary" onClick={send}>ส่ง</button></div>
    </div>
  </div></section>
}

function TablePage() {
  const {token}=useParams()
  const [session,setSession]=useState(null); const [menu,setMenu]=useState([]); const [orders,setOrders]=useState([])
  const [cart,setCart]=useState({}); const [cat,setCat]=useState('ทั้งหมด'); const [notice,setNotice]=useState(''); const [loading,setLoading]=useState(true)
  async function load(){
    try{
      const [s,m,o]=await Promise.all([getSession(token),listMenu(),listSessionOrders(token)])
      setSession(s);setMenu(m);setOrders(o)
    }finally{setLoading(false)}
  }
  useEffect(()=>{load();const u=subscribeAll(load);const id=setInterval(load,5000);return()=>{u();clearInterval(id)}},[token])
  async function enter(){await activateSession(token);await load()}
  const cats=['ทั้งหมด',...new Set(menu.map(x=>x.category))]
  const items=menu.filter(x=>cat==='ทั้งหมด'||x.category===cat)
  const qty=(id)=>cart[id]||0
  const add=(id,d)=>setCart(c=>({...c,[id]:Math.max(0,(c[id]||0)+d)}))
  const totalItems=Object.values(cart).reduce((a,b)=>a+b,0)
  const extraTotal=menu.reduce((sum,x)=>sum+Number(x.extra_price||0)*qty(x.id),0)
  async function submit(){
    const selected=menu.filter(x=>qty(x.id)>0).map(x=>({menu_item_id:x.id,quantity:qty(x.id),name_th:x.name_th,name_en:x.name_en}))
    if(!selected.length)return
    await createFoodOrder(token,selected);setCart({});setNotice('ส่งรายการเข้าครัวแล้ว');setTimeout(()=>setNotice(''),2500);await load()
  }
  async function service(type){await createServiceCall(token,type);setNotice('เรียกพนักงานแล้ว');setTimeout(()=>setNotice(''),2200)}
  async function bill(){if(!confirm('ยืนยันเรียกเช็คบิล? หลังจากนี้กรุณารอพนักงาน'))return;await requestBill(token);await load()}
  if(loading)return <div className="loader">กำลังโหลดโต๊ะ...</div>
  if(!session)return <section className="section page"><div className="wrap narrow"><div className="empty"><h2>QR นี้ไม่พร้อมใช้งาน</h2><p>กรุณาติดต่อพนักงาน</p></div></div></section>
  if(session.status==='reserved')return <section className="section page"><div className="wrap narrow"><div className="table-welcome"><span>TABLE</span><h1>{session.table_code||session.table?.code}</h1><p>{session.guest_count} คน • Buffet 299 บาท • {SHOP.diningMinutes} นาที</p><button className="btn primary wide" onClick={enter}>เริ่มใช้โต๊ะและสั่งอาหาร</button></div></div></section>
  if(session.status==='closed')return <ReviewForm token={token} table={session.table_code||session.table?.code}/>
  return <section className="table-app">
    {notice&&<div className="toast">{notice}</div>}
    <div className="table-app-head"><div><Logo small/><div><small>TABLE SESSION</small><h2>โต๊ะ {session.table_code||session.table?.code}</h2></div></div><span>{session.guest_count} คน</span></div>
    <div className="table-nav"><button onClick={()=>document.getElementById('order-menu')?.scrollIntoView()}>🍲 สั่งอาหาร</button><button onClick={()=>document.getElementById('my-orders')?.scrollIntoView()}>📦 รายการของฉัน</button><button onClick={()=>service('staff')}>🔔 เรียกพนักงาน</button><button className="bill" onClick={bill}>💳 เช็คบิล</button></div>
    <div className="table-content" id="order-menu">
      <div className="table-title"><div><span className="eyebrow">UNLIMITED MENU</span><h1>อยากทานอะไรเพิ่ม?</h1></div><div className="cart-count">{totalItems} รายการ</div></div>
      <div className="chips horizontal">{cats.map(c=><button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{c}</button>)}</div>
      <div className="order-menu-grid">{items.map(x=><div className="order-menu-card" key={x.id}><div className="food-emoji small">{x.emoji||'🍲'}</div><div className="food-copy"><small>{x.category}{x.is_premium?' • PREMIUM':''}</small><b>{x.name_th}</b>{Number(x.extra_price||0)>0&&<em className="extra-price">+${money(x.extra_price)}</em>}</div><div className="stepper"><button onClick={()=>add(x.id,-1)}>−</button><strong>{qty(x.id)}</strong><button onClick={()=>add(x.id,1)}>+</button></div></div>)}</div>
      {totalItems>0&&<div className="sticky-submit"><span><b>{totalItems}</b> รายการที่เลือก{extraTotal>0&&<small> • เพิ่ม {money(extraTotal)}</small>}</span><button className="btn primary" onClick={submit}>ยืนยันและส่งเข้าครัว →</button></div>}
      <div className="quick-service"><h2>เรียกพนักงาน</h2><div>{[['soup','🍲 เติมน้ำซุป'],['plates','🍽 ขอจานเพิ่ม'],['sauce','🥣 ขอน้ำจิ้ม'],['cleanup','🧹 เก็บจาน'],['staff','🔔 เรียกพนักงาน']].map(([v,l])=><button key={v} onClick={()=>service(v)}>{l}</button>)}</div></div>
      <div id="my-orders" className="my-orders"><h2>รายการที่สั่ง</h2>{orders.length===0?<p className="muted">ยังไม่มีรายการที่สั่ง</p>:orders.map(o=><article key={o.id}><div><small>{dateTime(o.created_at)}</small><h3>{o.order_number}</h3></div><Status value={o.status}/><ul>{(o.items||o.food_order_items||[]).map((i,k)=><li key={i.id||k}>{i.name_th||i.item_name_th||'เมนู'} × {i.quantity}</li>)}</ul></article>)}</div>
    </div>
  </section>
}

function ReviewForm({token,table}) {
  const [scores,setScores]=useState({taste:5,freshness:5,service:5,cleanliness:5,value:5,overall:5})
  const [comment,setComment]=useState(''); const [done,setDone]=useState(false)
  async function send(){await submitReview(token,{...scores,comment});setDone(true)}
  if(done)return <section className="section page"><div className="wrap narrow"><div className="empty"><div className="big-ok">✓</div><h2>ขอบคุณสำหรับความคิดเห็น</h2><p>หวังว่าจะได้ต้อนรับคุณอีกครั้งที่ชาบูอร่อยจัง</p><Link className="btn primary" to="/">กลับหน้าแรก</Link></div></div></section>
  return <section className="section page"><div className="wrap narrow"><div className="page-head center"><span className="eyebrow">THANK YOU • TABLE {table}</span><h1>ประเมินความพึงพอใจ</h1><p>ช่วยให้เราพัฒนาร้านให้ดีขึ้นในครั้งต่อไป</p></div>
    <div className="review-card">{Object.entries({taste:'รสชาติอาหาร',freshness:'ความสด',service:'การบริการ',cleanliness:'ความสะอาด',value:'ความคุ้มค่า',overall:'โดยรวม'}).map(([k,l])=><div className="rating-row" key={k}><b>{l}</b><div>{[1,2,3,4,5].map(n=><button className={n<=scores[k]?'on':''} key={n} onClick={()=>setScores(s=>({...s,[k]:n}))}>★</button>)}</div></div>)}<textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ)"/><button className="btn primary wide" onClick={send}>ส่งแบบประเมิน</button></div>
  </div></section>
}

function AdminLogin({onLogin}) {
  const nav=useNavigate(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [err,setErr]=useState('')
  async function submit(e){e.preventDefault();setErr('');try{const s=await login(email,password);onLogin(s);nav('/admin/dashboard')}catch(e2){setErr(e2.message)}}
  return <div className="login-page"><div className="login-card"><Logo/><span className="eyebrow">ADMIN PORTAL</span><h1>ชาบูอร่อยจัง</h1><p>เข้าสู่ระบบเพื่อจัดการร้าน โต๊ะ ครัว และการชำระเงิน</p>{!supabaseConfigured&&<div className="alert warn">Demo mode: กรอกอะไรก็ได้เพื่อเข้าใช้งาน</div>}{err&&<div className="alert error">{err}</div>}<form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="btn primary wide">เข้าสู่ระบบ</button></form><Link to="/">← กลับหน้าร้าน</Link></div></div>
}

const adminNav=[
  ['/admin/dashboard','▦','Dashboard',['owner','manager','cashier','kitchen','staff']],
  ['/admin/reservations','◷','Reservations',['owner','manager','cashier','staff']],
  ['/admin/tables','▤','Tables',['owner','manager','cashier','staff']],
  ['/admin/orders','🍲','Kitchen / Orders',['owner','manager','kitchen','staff']],
  ['/admin/service','🔔','Service Calls',['owner','manager','staff','kitchen']],
  ['/admin/billing','฿','Billing',['owner','manager','cashier']],
  ['/admin/menu','☷','Menu',['owner','manager']],
  ['/admin/customers','👥','Customers',['owner','manager','cashier']],
  ['/admin/promotions','%','Promotions',['owner','manager']],
  ['/admin/reviews','★','Reviews',['owner','manager']],
  ['/admin/reports','▥','Reports',['owner','manager']],
  ['/admin/staff','♟','Staff',['owner']],
  ['/admin/audit','⌁','Audit Log',['owner']],
  ['/admin/settings','⚙','Settings',['owner','manager']],
]
function AdminShell({children,onLogout,profile}) {
  const [soundOn,setSoundOn]=useState(false)
  const [noticeCount,setNoticeCount]=useState(0)
  useEffect(()=>{
    const off=subscribeAll((payload)=>{
      setNoticeCount(n=>n+1)
      if(soundOn){
        try{
          const A=window.AudioContext||window.webkitAudioContext
          const ctx=new A();const osc=ctx.createOscillator();const gain=ctx.createGain()
          osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=880;gain.gain.value=.05;osc.start();osc.stop(ctx.currentTime+.12)
        }catch{}
      }
    })
    return off
  },[soundOn])
  const role=profile?.role||'staff'
  return <div className="admin-shell"><aside><div className="admin-brand"><Logo small/><div><b>ชาบูอร่อยจัง</b><span>{profile?.display_name||'STAFF'} • {role.toUpperCase()}</span></div></div><nav>{adminNav.filter(([, , ,roles])=>roles.includes(role)).map(([to,i,l])=><NavLink key={to} to={to}><span>{i}</span>{l}</NavLink>)}</nav><div className="admin-side-tools"><button className={soundOn?'sound-toggle on':'sound-toggle'} onClick={()=>setSoundOn(v=>!v)}>{soundOn?'🔊 เสียงแจ้งเตือน':'🔇 เปิดเสียงแจ้งเตือน'}</button>{noticeCount>0&&<button className="notice-reset" onClick={()=>setNoticeCount(0)}>🔔 {noticeCount} รายการใหม่</button>}</div><button className="logout" onClick={onLogout}>ออกจากระบบ</button></aside><main>{children}</main></div>
}
function AdminHead({eyebrow,title,desc,action}){return <div className="admin-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{action}</div>}

function Dashboard(){
  const [tables,setTables]=useState([]),[orders,setOrders]=useState([]),[res,setRes]=useState([]),[calls,setCalls]=useState([]),[bills,setBills]=useState([]),[reviews,setReviews]=useState([])
  async function load(){
    const result=await Promise.allSettled([listTables(),listOrders(),listReservations(),listServiceCalls(),listBills(),listReviews()])
    const val=(i)=>result[i].status==='fulfilled'?result[i].value:[]
    setTables(val(0));setOrders(val(1));setRes(val(2));setCalls(val(3));setBills(val(4));setReviews(val(5))
  }
  useEffect(()=>{load();return subscribeAll(load)},[])
  const avg=reviews.length?(reviews.reduce((s,x)=>s+Number(x.overall||0),0)/reviews.length).toFixed(1):'-'
  const cards=[
    ['🟢','โต๊ะว่าง',tables.filter(x=>x.status==='available').length],
    ['🍲','โต๊ะใช้งาน',tables.filter(x=>x.status==='occupied').length],
    ['◷','จองรอยืนยัน',res.filter(x=>x.status==='pending').length],
    ['🔥','ออเดอร์รอครัว',orders.filter(x=>x.status==='pending').length],
    ['🔔','เรียกพนักงาน',calls.filter(x=>x.status==='pending').length],
    ['💳','รอเช็คบิล',bills.filter(x=>x.status==='pending').length],
    ['★','รีวิวเฉลี่ย',avg],
  ]
  return <><AdminHead eyebrow="OVERVIEW" title="Dashboard" desc="ภาพรวมร้านแบบ Realtime"/><div className="stat-grid">{cards.map(([i,l,v])=><div className="stat-card" key={l}><span>{i}</span><div><small>{l}</small><b>{v}</b></div></div>)}</div>
    <div className="admin-grid two"><section className="admin-card"><div className="card-head"><h2>โต๊ะในร้าน</h2><Link to="/admin/tables">จัดการ →</Link></div><div className="mini-table-grid">{tables.map(x=><div key={x.id} className={`mini-table ${x.status}`}><b>{x.code}</b><small>{x.seats} ที่ • {TABLE_LABEL[x.status]}</small></div>)}</div></section>
    <section className="admin-card"><div className="card-head"><h2>Order ล่าสุด</h2><Link to="/admin/orders">ดูครัว →</Link></div><div className="admin-list">{orders.slice(0,8).map(o=><div key={o.id}><span><b>โต๊ะ {o.table_code||'-'}</b><small>{o.order_number} • {dateTime(o.created_at)}</small></span><Status value={o.status}/></div>)}{!orders.length&&<p className="muted">ยังไม่มี Order</p>}</div></section></div>
  </>
}

function ReservationsAdmin(){
  const [items,setItems]=useState([]),[tables,setTables]=useState([]),[selected,setSelected]=useState({}),[qrItem,setQrItem]=useState(null),[editItem,setEditItem]=useState(null)
  async function load(){const [r,tb]=await Promise.all([listReservations(),listTables()]);setItems(r);setTables(tb)}
  useEffect(()=>{load();return subscribeAll(load)},[])
  async function confirmOne(r){const tableId=selected[r.id];if(!tableId)return alert('เลือกโต๊ะก่อน');await confirmReservation(r.id,tableId);await load()}
  async function rejectOne(id){if(confirm('ไม่อนุมัติการจองนี้?')){await rejectReservation(id);await load()}}
  async function expireOld(){const n=await expireReservations();alert(`อัปเดตการจองหมดเวลา ${n||0} รายการ`);await load()}
  async function saveEdit(){
    await updateReservationAdmin(editItem.id,{
      customer_name:editItem.customer_name,
      customer_phone:editItem.customer_phone,
      reservation_date:editItem.reservation_date,
      reservation_time:editItem.reservation_time,
      guest_count:Number(editItem.guest_count),
      note:editItem.note||''
    })
    setEditItem(null);await load()
  }
  async function cancelOne(r){if(!confirm('ยกเลิกการจองนี้?'))return;try{await cancelReservationAdmin(r.id);await load()}catch(e){alert(e.message)}}
  const available=tables.filter(x=>x.status==='available')
  const qrUrl=qrItem?.session_token?`${window.location.origin}/shabu-aroi-jang/table/${qrItem.session_token}`:''
  return <>
    <AdminHead eyebrow="RESERVATIONS" title="การจองโต๊ะ" desc="ยืนยัน แก้ไข ยกเลิก ตรวจหมดเวลา และจัดการ QR" action={<button className="btn ghost" onClick={expireOld}>⏱ ตรวจรายการเลยเวลา</button>}/>
    <div className="admin-card"><div className="admin-list reservations">
      {items.map(r=><div key={r.id}>
        <span>
          <b>{r.customer_name} • {r.guest_count} คน</b>
          <small>{r.reservation_date} {r.reservation_time} • {r.customer_phone} • Code {r.code}</small>
          {r.status==='confirmed'&&<small><b>โต๊ะ {r.table_code||'-'}</b> • Session {r.session_status||'-'}</small>}
        </span>
        <div className="reservation-actions">
          {r.status==='pending'?<>
            <select value={selected[r.id]||''} onChange={e=>setSelected(s=>({...s,[r.id]:e.target.value}))}>
              <option value="">เลือกโต๊ะ</option>
              {available.filter(t=>t.seats>=Number(r.guest_count||1)).map(t=><option key={t.id} value={t.id}>{t.code} ({t.seats} ที่)</option>)}
            </select>
            <button className="mini-btn" onClick={()=>setEditItem({...r,reservation_time:String(r.reservation_time||'').slice(0,5)})}>แก้ไข</button>
            <button className="mini-btn ok" onClick={()=>confirmOne(r)}>ยืนยัน</button>
            <button className="mini-btn danger" onClick={()=>rejectOne(r.id)}>ปฏิเสธ</button>
          </>:<>
            <span className={`reservation-state ${r.status}`}>{r.status}</span>
            {r.status==='confirmed'&&r.session_token&&<button className="mini-btn qr" onClick={()=>setQrItem(r)}>ดู QR</button>}
            {['confirmed'].includes(r.status)&&<button className="mini-btn danger" onClick={()=>cancelOne(r)}>ยกเลิก</button>}
          </>}
        </div>
      </div>)}
      {!items.length&&<p className="muted">ยังไม่มีการจอง</p>}
    </div></div>

    {editItem&&<div className="modal-backdrop" onClick={()=>setEditItem(null)}><div className="pro-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setEditItem(null)}>×</button><h2>แก้ไขการจอง {editItem.code}</h2><div className="pro-form"><label>ชื่อ<input value={editItem.customer_name} onChange={e=>setEditItem(x=>({...x,customer_name:e.target.value}))}/></label><label>เบอร์โทร<input value={editItem.customer_phone} onChange={e=>setEditItem(x=>({...x,customer_phone:e.target.value.replace(/\D/g,'').slice(0,10)}))}/></label><label>วันที่<input type="date" value={editItem.reservation_date} onChange={e=>setEditItem(x=>({...x,reservation_date:e.target.value}))}/></label><label>เวลา<input type="time" value={editItem.reservation_time} onChange={e=>setEditItem(x=>({...x,reservation_time:e.target.value}))}/></label><label>จำนวนคน<input type="number" min="1" max="10" value={editItem.guest_count} onChange={e=>setEditItem(x=>({...x,guest_count:e.target.value}))}/></label><label>หมายเหตุ<input value={editItem.note||''} onChange={e=>setEditItem(x=>({...x,note:e.target.value}))}/></label><button className="btn primary span-2" onClick={saveEdit}>บันทึก</button></div></div></div>}

    {qrItem&&<div className="modal-backdrop qr-print-area" onClick={()=>setQrItem(null)}>
      <div className="qr-admin-modal" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={()=>setQrItem(null)}>×</button>
        <span className="eyebrow">TABLE QR</span>
        <h2>โต๊ะ {qrItem.table_code||'-'}</h2>
        <p>{qrItem.customer_name} • {qrItem.guest_count} คน • Code {qrItem.code}</p>
        <div className="admin-qr-box"><QRCodeSVG value={qrUrl} size={240}/></div>
        <small>สแกนเพื่อเปิดหน้าสั่งอาหารของโต๊ะนี้</small>
        <div className="qr-modal-actions">
          <a className="btn dark" href={qrUrl} target="_blank" rel="noreferrer">เปิดหน้าสั่งอาหาร</a>
          <button className="btn ghost" onClick={()=>navigator.clipboard?.writeText(qrUrl)}>คัดลอกลิงก์</button>
          <button className="btn primary" onClick={()=>window.print()}>🖨 พิมพ์ QR</button>
        </div>
      </div>
    </div>}
  </>
}

function TablesAdmin(){
  const [items,setItems]=useState([])
  async function load(){setItems(await listTables())}
  useEffect(()=>{load();return subscribeAll(load)},[])
  return <><AdminHead eyebrow="FLOOR" title="สถานะโต๊ะ" desc="ดูโต๊ะทั้งหมด 15 โต๊ะและสถานะแบบ Realtime"/><div className="floor-grid">{items.map(t=><article className={`table-tile ${t.status}`} key={t.id}><div className="table-icon">🍲</div><h2>{t.code}</h2><p>{t.seats} ที่นั่ง</p><Status value={t.status} type="table"/>{t.status==='cleaning'&&<button className="mini-btn ok" onClick={async()=>{await markTableReady(t.id);load()}}>ทำความสะอาดแล้ว</button>}</article>)}</div></>
}

function OrdersAdmin(){
  const [items,setItems]=useState([]); const [filter,setFilter]=useState('active')
  async function load(){setItems(await listOrders())}
  useEffect(()=>{load();return subscribeAll(load)},[])
  const list=items.filter(x=>filter==='all'?true:filter==='active'?x.status!=='served'&&x.status!=='cancelled':x.status===filter)
  async function move(o,status){await updateOrderStatus(o.id,status);load()}
  return <><AdminHead eyebrow="KITCHEN DISPLAY" title="Kitchen / Orders" desc="รับออเดอร์ เตรียม และส่งต่อพนักงานเสิร์ฟ"/><div className="filter-row">{[['active','กำลังทำ'],['pending','รอรับ'],['preparing','กำลังเตรียม'],['ready','พร้อมเสิร์ฟ'],['served','เสิร์ฟแล้ว'],['all','ทั้งหมด']].map(([v,l])=><button className={filter===v?'active':''} key={v} onClick={()=>setFilter(v)}>{l}</button>)}</div><div className="kitchen-grid">{list.map(o=><article className={`kitchen-card ${o.status}`} key={o.id}><div className="kitchen-head"><div><span>โต๊ะ</span><h2>{o.table_code||'-'}</h2></div><Status value={o.status}/></div><small>{o.order_number} • {dateTime(o.created_at)}</small><ul>{(o.items||[]).map((i,k)=><li key={i.id||k}><b>{i.name_th||i.item_name_th||'เมนู'}</b><strong>× {i.quantity}</strong></li>)}</ul><div className="kitchen-actions">{ORDER_FLOW.map(s=><button key={s} disabled={o.status===s} className={o.status===s?'current':''} onClick={()=>move(o,s)}>{ORDER_LABEL[s]}</button>)}</div></article>)}{!list.length&&<div className="empty admin-empty"><h2>ไม่มี Order ในสถานะนี้</h2></div>}</div></>
}

function ServiceAdmin(){
  const [items,setItems]=useState([])
  async function load(){setItems(await listServiceCalls())}
  useEffect(()=>{load();return subscribeAll(load)},[])
  const label={soup:'เติมน้ำซุป',plates:'ขอจานเพิ่ม',sauce:'ขอน้ำจิ้ม',cleanup:'เก็บจาน',staff:'เรียกพนักงาน',bill:'เช็คบิล'}
  return <><AdminHead eyebrow="SERVICE CALLS" title="เรียกพนักงาน" desc="คำขอจากลูกค้าแต่ละโต๊ะ"/><div className="service-grid">{items.filter(x=>x.status!=='done').map(x=><article key={x.id}><div><span>โต๊ะ</span><h2>{x.table_code||'-'}</h2></div><h3>{label[x.type]||x.type}</h3><small>{dateTime(x.created_at)}</small><button className="btn primary wide" onClick={async()=>{await resolveServiceCall(x.id);load()}}>รับเรื่องแล้ว ✓</button></article>)}{!items.filter(x=>x.status!=='done').length&&<div className="empty admin-empty"><h2>ไม่มีลูกค้าเรียกพนักงาน</h2></div>}</div></>
}

function BillingAdmin(){
  const [items,setItems]=useState([])
  async function load(){setItems(await listBills())}
  useEffect(()=>{load();return subscribeAll(load)},[])
  async function pay(b,method){if(!confirm(`ยืนยันรับชำระ ${money(b.total)} ?`))return;await closeBill(b.id,method);load()}
  return <><AdminHead eyebrow="CASHIER" title="เช็คบิล / ชำระเงิน" desc="ปิดบิลแล้ว QR ของโต๊ะจะหมดอายุทันที"/><div className="billing-grid">{items.map(b=><article className={b.status} key={b.id}><div className="billing-top"><div><span>โต๊ะ</span><h2>{b.table_code||'-'}</h2></div><span className={`bill-state ${b.status}`}>{b.status==='paid'?'ชำระแล้ว':'รอชำระ'}</span></div><div className="bill-line"><span>{b.guest_count} คน × 299</span><b>{money(b.total)}</b></div>{b.status==='pending'?<div className="pay-actions"><button onClick={()=>pay(b,'cash')}>💵 เงินสด</button><button onClick={()=>pay(b,'promptpay')}>📱 PromptPay</button><button onClick={()=>pay(b,'bank_transfer')}>🏦 โอนเงิน</button></div>:<small>{b.payment_method} • {dateTime(b.paid_at)}</small>}</article>)}</div></>
}

function MenuAdmin(){
  const [items,setItems]=useState([]); useEffect(()=>{listMenu().then(setItems)},[])
  return <><AdminHead eyebrow="MENU" title="จัดการเมนู" desc="เวอร์ชันแรกแสดงรายการจากฐานข้อมูล พร้อมรองรับเปิด/ปิดเมนู"/><div className="admin-card"><div className="table-scroll"><table><thead><tr><th>หมวด</th><th>เมนู</th><th>EN</th><th>สถานะ</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{x.category}</td><td>{x.emoji} <b>{x.name_th}</b></td><td>{x.name_en}</td><td><span className={x.is_available!==false?'good':'bad'}>{x.is_available!==false?'พร้อมขาย':'ปิดขาย'}</span></td></tr>)}</tbody></table></div></div></>
}

function ReviewsAdmin(){
  const [items,setItems]=useState([]); useEffect(()=>{listReviews().then(setItems);return subscribeAll(()=>listReviews().then(setItems))},[])
  const avg=items.length?(items.reduce((s,x)=>s+Number(x.overall||0),0)/items.length).toFixed(2):'-'
  return <><AdminHead eyebrow="FEEDBACK" title="รีวิวลูกค้า" desc={`คะแนนเฉลี่ย ${avg} / 5 จาก ${items.length} รีวิว`}/><div className="reviews-grid">{items.map(x=><article key={x.id}><div className="stars">{'★'.repeat(Number(x.overall||0))}{'☆'.repeat(5-Number(x.overall||0))}</div><p>{x.comment||'ไม่มีความคิดเห็นเพิ่มเติม'}</p><small>{dateTime(x.created_at)}</small></article>)}{!items.length&&<div className="empty admin-empty"><h2>ยังไม่มีรีวิว</h2></div>}</div></>
}

function SettingsAdmin({settings,onChange}){
  const [form,setForm]=useState(settings||{}); useEffect(()=>setForm(settings||{}),[settings])
  async function mode(v){const patch=v==='open'?{force_open:true,force_closed:false}:v==='closed'?{force_open:false,force_closed:true}:{force_open:false,force_closed:false};const next=await updateSettings(patch);setForm(next);onChange(next)}
  async function save(e){
    e.preventDefault()
    const next=await updateSettings({
      open_time:form.open_time||'11:00',close_time:form.close_time||'22:00',
      buffet_price:Number(form.buffet_price||299),child_price:Number(form.child_price||149),
      dining_minutes:Number(form.dining_minutes||120),reservation_grace_minutes:Number(form.reservation_grace_minutes||15),
      free_child_height_cm:Number(form.free_child_height_cm||90),child_max_height_cm:Number(form.child_max_height_cm||120),
      promptpay:form.promptpay||SHOP.promptpay,bank_name:form.bank_name||null,bank_account_name:form.bank_account_name||null,bank_account_number:form.bank_account_number||null,
      facebook:form.facebook||null,line_id:form.line_id||null,instagram:form.instagram||null,google_maps_url:form.google_maps_url||null,
      phone:form.phone||SHOP.phone,address_th:form.address_th||SHOP.addressTh
    })
    setForm(next);onChange(next);alert('บันทึกแล้ว')
  }
  const modeValue=form.force_open?'open':form.force_closed?'closed':'auto'
  return <><AdminHead eyebrow="SETTINGS" title="ตั้งค่าร้าน" desc="ตั้งสถานะร้าน ราคา เวลา ข้อมูลติดต่อ เด็ก และ Payment"/>
    <div className="admin-grid two">
      <section className="admin-card"><h2>สถานะร้าน</h2><p className="muted">Manual จะ Override เวลาเปิด–ปิดปกติ</p><div className="shop-mode">
        <button className={modeValue==='open'?'active open':''} onClick={()=>mode('open')}><span>🟢</span><b>เปิดร้าน</b><small>เปิดรับลูกค้าทันที</small></button>
        <button className={modeValue==='auto'?'active auto':''} onClick={()=>mode('auto')}><span>🕒</span><b>ตามเวลา</b><small>{String(form.open_time||'11:00').slice(0,5)}–{String(form.close_time||'22:00').slice(0,5)}</small></button>
        <button className={modeValue==='closed'?'active closed':''} onClick={()=>mode('closed')}><span>🔴</span><b>ปิดร้าน</b><small>หยุดรับลูกค้าชั่วคราว</small></button>
      </div></section>
      <section className="admin-card"><h2>กติกาการขาย</h2><form className="settings-form" onSubmit={save}>
        <label>เวลาเปิด<input type="time" value={String(form.open_time||'11:00').slice(0,5)} onChange={e=>setForm(f=>({...f,open_time:e.target.value}))}/></label>
        <label>เวลาปิด<input type="time" value={String(form.close_time||'22:00').slice(0,5)} onChange={e=>setForm(f=>({...f,close_time:e.target.value}))}/></label>
        <label>ราคาผู้ใหญ่<input type="number" value={form.buffet_price??299} onChange={e=>setForm(f=>({...f,buffet_price:e.target.value}))}/></label>
        <label>ราคาเด็ก<input type="number" value={form.child_price??149} onChange={e=>setForm(f=>({...f,child_price:e.target.value}))}/></label>
        <label>เวลาทาน (นาที)<input type="number" value={form.dining_minutes??120} onChange={e=>setForm(f=>({...f,dining_minutes:e.target.value}))}/></label>
        <label>สายได้ (นาที)<input type="number" value={form.reservation_grace_minutes??15} onChange={e=>setForm(f=>({...f,reservation_grace_minutes:e.target.value}))}/></label>
        <label>ต่ำกว่าส่วนสูงนี้ฟรี (ซม.)<input type="number" value={form.free_child_height_cm??90} onChange={e=>setForm(f=>({...f,free_child_height_cm:e.target.value}))}/></label>
        <label>เด็กไม่เกิน (ซม.)<input type="number" value={form.child_max_height_cm??120} onChange={e=>setForm(f=>({...f,child_max_height_cm:e.target.value}))}/></label>
        <label>PromptPay<input value={form.promptpay||''} onChange={e=>setForm(f=>({...f,promptpay:e.target.value}))}/></label>
        <label>ธนาคาร<input value={form.bank_name||''} onChange={e=>setForm(f=>({...f,bank_name:e.target.value}))}/></label>
        <label>ชื่อบัญชี<input value={form.bank_account_name||''} onChange={e=>setForm(f=>({...f,bank_account_name:e.target.value}))}/></label>
        <label>เลขบัญชี<input value={form.bank_account_number||''} onChange={e=>setForm(f=>({...f,bank_account_number:e.target.value}))}/></label>
        <label>เบอร์ร้าน<input value={form.phone||''} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></label>
        <label>Facebook<input value={form.facebook||''} onChange={e=>setForm(f=>({...f,facebook:e.target.value}))}/></label>
        <label>LINE<input value={form.line_id||''} onChange={e=>setForm(f=>({...f,line_id:e.target.value}))}/></label>
        <label>Instagram<input value={form.instagram||''} onChange={e=>setForm(f=>({...f,instagram:e.target.value}))}/></label>
        <label className="span-2">Google Maps URL<input value={form.google_maps_url||''} onChange={e=>setForm(f=>({...f,google_maps_url:e.target.value}))}/></label>
        <label className="span-2">ที่อยู่<textarea value={form.address_th||''} onChange={e=>setForm(f=>({...f,address_th:e.target.value}))}/></label>
        <button className="btn primary span-2">บันทึกการตั้งค่า</button>
      </form></section>
    </div>
  </>
}

function Protected({session,profile,roles,children}){
  if(!session) return <Navigate to="/admin/login" replace/>
  if(!profile) return <div className="loader">กำลังตรวจสอบสิทธิ์...</div>
  if(profile.is_active===false) return <div className="login-page"><div className="login-card"><h2>บัญชีถูกปิดใช้งาน</h2><p>กรุณาติดต่อ Owner</p></div></div>
  if(roles&&!roles.includes(profile.role)) return <Navigate to="/admin/dashboard" replace/>
  return children
}

export default function App(){
  const [lang,setLang]=useState(localStorage.getItem('shabu-lang')||'th')
  const [settings,setSettings]=useState(null)
  const [adminSession,setAdminSession]=useState(null)
  const [adminProfile,setAdminProfile]=useState(null)
  const [authReady,setAuthReady]=useState(false)
  useEffect(()=>{localStorage.setItem('shabu-lang',lang)},[lang])
  useEffect(()=>{getSettings().then(setSettings).catch(()=>setSettings({open_time:'11:00',close_time:'22:00'}));getAdminSession().then(async s=>{setAdminSession(s);if(s)setAdminProfile(await getCurrentProfile());setAuthReady(true)})},[])
  if(!settings||!authReady)return <div className="loader">กำลังเปิดร้านชาบูอร่อยจัง...</div>
  async function doLogout(){await logout();setAdminSession(null);setAdminProfile(null)}
  async function onAdminLogin(s){setAdminSession(s);setAdminProfile(await getCurrentProfile())}
  const admin=(page,roles)=><Protected session={adminSession} profile={adminProfile} roles={roles}><AdminShell onLogout={doLogout} profile={adminProfile}>{page}</AdminShell></Protected>
  return <Routes>
    <Route path="/" element={<CustomerShell lang={lang} setLang={setLang} settings={settings}><Home lang={lang} settings={settings}/></CustomerShell>}/>
    <Route path="/menu" element={<CustomerShell lang={lang} setLang={setLang} settings={settings}><MenuPage lang={lang}/></CustomerShell>}/>
    <Route path="/reserve" element={<CustomerShell lang={lang} setLang={setLang} settings={settings}><ReservePage settings={settings}/></CustomerShell>}/>
    <Route path="/reservation" element={<CustomerShell lang={lang} setLang={setLang} settings={settings}><ReservationPage/></CustomerShell>}/>
    <Route path="/chat" element={<CustomerShell lang={lang} setLang={setLang} settings={settings}><ChatPage/></CustomerShell>}/>
    <Route path="/table/:token" element={<TablePage/>}/>
    <Route path="/admin/login" element={adminSession?<Navigate to="/admin/dashboard" replace/>:<AdminLogin onLogin={onAdminLogin}/>}/>
    <Route path="/admin/dashboard" element={admin(<Dashboard/>,['owner','manager','cashier','kitchen','staff'])}/>
    <Route path="/admin/reservations" element={admin(<ReservationsAdmin/>,['owner','manager','cashier','staff'])}/>
    <Route path="/admin/tables" element={admin(<TablesManager/>,['owner','manager','cashier','staff'])}/>
    <Route path="/admin/orders" element={admin(<OrdersAdmin/>,['owner','manager','kitchen','staff'])}/>
    <Route path="/admin/service" element={admin(<ServiceAdmin/>,['owner','manager','staff','kitchen'])}/>
    <Route path="/admin/billing" element={admin(<BillingManager/>,['owner','manager','cashier'])}/>
    <Route path="/admin/menu" element={admin(<MenuManager/>,['owner','manager'])}/>
    <Route path="/admin/reviews" element={admin(<ReviewsAdmin/>,['owner','manager'])}/>
    <Route path="/admin/customers" element={admin(<CustomersPage/>,['owner','manager','cashier'])}/>
    <Route path="/admin/promotions" element={admin(<PromotionsPage/>,['owner','manager'])}/>
    <Route path="/admin/reports" element={admin(<ReportsPage/>,['owner','manager'])}/>
    <Route path="/admin/staff" element={admin(<StaffPage/>,['owner'])}/>
    <Route path="/admin/audit" element={admin(<AuditPage/>,['owner'])}/>
    <Route path="/admin/settings" element={admin(<SettingsAdmin settings={settings} onChange={setSettings}/>,['owner','manager'])}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>
}
