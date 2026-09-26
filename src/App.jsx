import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  activateSession, askAi, closeBill, confirmReservation, createFoodOrder, createReservation,
  createServiceCall, getAdminSession, getCurrentProfile, getReservation, getSession, getSettings, listBills, listMenu,
  listOrders, listReservations, listReviews, listServiceCalls, listSessionOrders, listTables, login,
  logout, markTableReady, rejectReservation, requestBill, resolveServiceCall, shopIsOpen, submitReview,
  subscribeAll, updateOrderStatus, updateSettings, expireReservations, updateReservationAdmin, cancelReservationAdmin,
  getReports, listNotifications, markNotificationRead, markAllNotificationsRead, subscribeNotifications,
  uploadPaymentSlip, uploadBrandLogo
} from './lib/api'
import { MENU, ORDER_FLOW, ORDER_LABEL, SHOP, TABLE_LABEL } from './lib/constants'
import { supabaseConfigured } from './lib/supabase'
import { AuditPage, BillingManager, ChatHistoryPage, CustomersPage, KnowledgeBasePage, MenuManager, PromotionsPage, ReportsPage, ReviewsAdvancedPage, StaffPage, TablesManager } from './admin/ProductionPages'
import { promptPayPayload } from './lib/promptpay'
import premiumLogo from './premiumLogo'

const money=(n)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n||0))
const dateTime=(v)=>v?new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'-'
const t=(lang,th,en)=>lang==='th'?th:en

function Logo({small=false,hero=false}) {
  const fallback=`${import.meta.env.BASE_URL}logo.svg`
  const src=hero?premiumLogo:(localStorage.getItem('shabu-logo-url')||fallback)
  return <img className={hero?'logo hero-logo':small?'logo small':'logo'} src={src} alt={SHOP.nameTh} />
}

const CATEGORY_EN={
  'ทั้งหมด':'All','หมู':'Pork','เนื้อ':'Beef','ไก่':'Chicken','ซีฟู้ด':'Seafood',
  'ผัก':'Vegetables','เห็ด':'Mushrooms','เส้น':'Noodles','ของชาบู':'Shabu Items',
  'ของทานเล่น':'Sides','น้ำซุป':'Soup','น้ำจิ้ม':'Sauce','เครื่องดื่ม':'Drinks','ของหวาน':'Dessert'
}
const categoryLabel=(lang,value)=>lang==='th'?value:(CATEGORY_EN[value]||value)
function Status({value,type='order'}) {
  const labels=type==='table'?TABLE_LABEL:ORDER_LABEL
  return <span className={`status status-${value}`}>{labels[value]||value}</span>
}

function CustomerShell({children,lang,setLang,settings}) {
  const open=shopIsOpen(settings)
  const address=t(lang,SHOP.addressTh,'125/3 Moo 5, Sam Khwai Phueak, Mueang Nakhon Pathom, Nakhon Pathom 73000')
  return <div className="customer-shell premium-site luxe-site">
    {!supabaseConfigured && <div className="demo-bar">{t(lang,'DEMO MODE • เชื่อม Supabase แล้วข้อมูลจะเป็น Realtime จริง','DEMO MODE • Connect Supabase for live realtime data')}</div>}
    <header className="topbar luxe-topbar">
      <div className="wrap topbar-inner">
        <Link className="brand luxe-brand" to="/"><Logo small/><div><strong>{lang==='th'?SHOP.nameTh:SHOP.nameEn}</strong><span>JAPANESE SHABU BUFFET</span></div></Link>
        <nav className="main-nav luxe-nav">
          <NavLink to="/">{t(lang,'หน้าแรก','Home')}</NavLink>
          <NavLink to="/menu">{t(lang,'เมนู','Menu')}</NavLink>
          <NavLink to="/reserve">{t(lang,'จองโต๊ะ','Reserve')}</NavLink>
          <NavLink to="/reservation">{t(lang,'เช็กการจอง','My Booking')}</NavLink>
          <NavLink to="/chat">{t(lang,'AI Chat','AI Chat')}</NavLink>
        </nav>
        <div className="top-actions luxe-actions">
          <span className={open?'open-pill':'closed-pill'}>{open?t(lang,'● เปิดร้าน','● Open'):t(lang,'● ปิดร้าน','● Closed')}</span>
          <button className="lang" onClick={()=>setLang(lang==='th'?'en':'th')}>{lang==='th'?'EN':'TH'}</button>
        </div>
      </div>
    </header>
    {!open && <div className="closed-banner">{t(lang,'ขณะนี้ร้านปิดรับลูกค้าใหม่ • ยังสามารถตรวจสอบการจองและพูดคุยกับ AI ได้','We are currently closed for new guests • You can still check bookings and chat with AI')}</div>}
    {children}
    <footer className="luxe-footer">
      <div className="wrap footer-grid">
        <div><Logo small/><h3>{lang==='th'?SHOP.nameTh:SHOP.nameEn}</h3><p>{t(lang,'ชาบูบุฟเฟ่ต์พรีเมียม 299 บาท รวมน้ำ NET','Premium shabu buffet ฿299, drinks included, NET')}</p></div>
        <div><b>{t(lang,'ติดต่อร้าน','Contact')}</b><p>{SHOP.phone}<br/>{address}</p></div>
        <div><b>{t(lang,'เวลาทำการ','Opening hours')}</b><p>{SHOP.openTime}–{SHOP.closeTime}<br/>{t(lang,`เวลาทาน ${SHOP.diningMinutes} นาที`,`${SHOP.diningMinutes}-minute dining time`)}</p><Link className="footer-admin" to="/admin/login">Admin</Link></div>
      </div>
    </footer>
  </div>
}

function Home({lang,settings}) {
  const open=shopIsOpen(settings)
  const address=t(lang,SHOP.addressTh,'125/3 Moo 5, Sam Khwai Phueak, Mueang Nakhon Pathom, Nakhon Pathom 73000')
  const highlights=lang==='th'?[
    ['01','ซุปซิกเนเจอร์','น้ำดำญี่ปุ่น หม่าล่า ต้มยำ และซุปยอดนิยม'],
    ['02','วัตถุดิบพรีเมียม','หมู เนื้อ ซีฟู้ด ผักสด เติมได้ไม่อั้น'],
    ['03','สั่งอาหารผ่าน QR','สั่งตรงจากโต๊ะ เข้าครัวแบบ Realtime'],
    ['04','บริการถึงโต๊ะ','เติมซุป ขอจาน เรียกพนักงาน และเช็กบิล']
  ]:[
    ['01','Signature broths','Japanese black soup, Mala, Tom Yum and favorites'],
    ['02','Premium ingredients','Pork, beef, seafood and fresh vegetables'],
    ['03','QR table ordering','Send orders straight to the kitchen in realtime'],
    ['04','Table service','Soup refill, extra plates, staff call and checkout']
  ]
  const journey=lang==='th'?[
    ['จองโต๊ะ','เลือกวัน เวลา และจำนวนคน'],
    ['รับการยืนยัน','ร้านจัดโต๊ะที่เหมาะสมให้'],
    ['สแกน QR','เปิดโต๊ะและเริ่ม Session'],
    ['อิ่มแบบพรีเมียม','สั่งได้ต่อเนื่องตลอดมื้อ']
  ]:[
    ['Reserve','Choose your date, time and party size'],
    ['Get confirmed','We assign the best available table'],
    ['Scan your QR','Activate the table session'],
    ['Enjoy premium dining','Keep ordering throughout your meal']
  ]
  return <>
    <section className="luxe-hero">
      <div className="luxe-aurora luxe-aurora-a"></div>
      <div className="luxe-aurora luxe-aurora-b"></div>
      <div className="luxe-grain"></div>
      <div className="wrap luxe-hero-grid">
        <div className="luxe-copy">
          <div className="luxe-overline"><span></span> SHABU • NAKHON PATHOM</div>
          <div className="luxe-script">{t(lang,'Japanese Premium Buffet','Japanese Premium Buffet')}</div>
          <h1>{t(lang,'ชาบูที่ไม่ได้มีแค่อิ่ม','More than just')}<br/><em>{t(lang,'แต่ต้องรู้สึกพิเศษ','a buffet experience')}</em></h1>
          <p>{t(lang,'ชาบูบุฟเฟ่ต์ในบรรยากาศพรีเมียม จัดเต็มทั้งหมู เนื้อ ซีฟู้ด ผัก ของทอด เครื่องดื่ม และของหวาน ในราคาเดียวแบบ NET','A premium all-you-can-eat shabu experience with pork, beef, seafood, vegetables, sides, drinks and dessert — one NET price.')}</p>
          <div className="luxe-hero-actions">
            <Link className={open?'luxe-btn gold':'luxe-btn disabled'} to={open?'/reserve':'/'}>{t(lang,'จองโต๊ะตอนนี้','Reserve now')} <span>↗</span></Link>
            <Link className="luxe-btn glass" to="/menu">{t(lang,'ดูเมนูทั้งหมด','View menu')}</Link>
          </div>
          <div className="luxe-meta-row">
            <div><small>{t(lang,'เวลาทาน','Dining')}</small><b>{SHOP.diningMinutes} {t(lang,'นาที','min')}</b></div>
            <div><small>{t(lang,'เครื่องดื่ม','Drinks')}</small><b>{t(lang,'รวมแล้ว','Included')}</b></div>
            <div><small>{t(lang,'ชำระเงิน','Payment')}</small><b>PromptPay</b></div>
          </div>
        </div>

        <div className="luxe-visual">
          <div className="luxe-orbit one"></div><div className="luxe-orbit two"></div>
          <div className="luxe-logo-shell">
            <div className="luxe-logo-glow"></div>
            <Logo hero/>
          </div>
          <div className="luxe-price-card">
            <small>{t(lang,'บุฟเฟ่ต์ NET','BUFFET NET')}</small>
            <strong>299</strong>
            <span>{t(lang,'บาท / คน','THB / PERSON')}</span>
          </div>
          <div className="luxe-float-chip chip-a">✦ {t(lang,'70+ เมนู','70+ ITEMS')}</div>
          <div className="luxe-float-chip chip-b">🔥 {t(lang,'5 น้ำซุป','5 BROTHS')}</div>
        </div>
      </div>
      <div className="luxe-scroll-cue"><span></span>{t(lang,'เลื่อนลงเพื่อดูประสบการณ์ของเรา','DISCOVER THE EXPERIENCE')}</div>
    </section>

    <section className="luxe-highlight-section">
      <div className="wrap">
        <div className="luxe-section-heading">
          <div><span>THE EXPERIENCE</span><h2>{t(lang,'ทุกดีเทล ถูกออกแบบให้มื้อชาบูดูพิเศษขึ้น','Every detail, designed to feel special')}</h2></div>
          <p>{t(lang,'ตั้งแต่รสชาติ ไปจนถึงระบบสั่งอาหาร เราออกแบบให้ทุกอย่างเรียบง่าย รวดเร็ว และดูพรีเมียม','From flavor to ordering flow, everything is designed to feel seamless, fast and premium.')}</p>
        </div>
        <div className="luxe-highlight-grid">
          {highlights.map(([n,h,p],idx)=><article className={`luxe-highlight-card card-${idx+1}`} key={n}>
            <div className="shine"></div><small>{n}</small><h3>{h}</h3><p>{p}</p><span>↗</span>
          </article>)}
        </div>
      </div>
    </section>

    <section className="luxe-price-section">
      <div className="wrap luxe-price-layout">
        <div className="luxe-price-copy">
          <span className="eyebrow">ONE PRICE • FULL EXPERIENCE</span>
          <h2>{t(lang,'ราคาเดียว ได้ครบแบบไม่ต้องคิดเยอะ','One price. Everything you need.')}</h2>
          <p>{t(lang,'299 บาทต่อคน รวมน้ำแล้วแบบ NET พร้อมเวลาทาน 120 นาที และระบบสั่งผ่าน QR ที่โต๊ะ','฿299 per person, drinks included, NET. Enjoy a 120-minute dining session with table-side QR ordering.')}</p>
          <div className="luxe-price-big"><span>฿</span><b>299</b><small>/ {t(lang,'คน','person')}</small></div>
          <Link className="luxe-btn dark" to="/menu">{t(lang,'เปิดดูเมนูทั้งหมด','Explore the full menu')} <span>→</span></Link>
        </div>
        <div className="luxe-price-panel">
          <div className="panel-light"></div>
          <div className="luxe-mini-stat"><span>70+</span><small>{t(lang,'เมนู','menu items')}</small></div>
          <div className="luxe-mini-stat"><span>5</span><small>{t(lang,'น้ำซุป','broths')}</small></div>
          <div className="luxe-mini-stat"><span>120</span><small>{t(lang,'นาที','minutes')}</small></div>
          <div className="luxe-mini-stat"><span>299</span><small>{t(lang,'บาท NET','THB NET')}</small></div>
        </div>
      </div>
    </section>

    <section className="luxe-journey-section">
      <div className="wrap">
        <div className="luxe-section-heading narrow-heading">
          <div><span>YOUR JOURNEY</span><h2>{t(lang,'ตั้งแต่จองโต๊ะ จนถึงเช็กบิล ทุกขั้นตอนลื่นไหล','From reservation to checkout, everything flows')}</h2></div>
        </div>
        <div className="luxe-journey">
          {journey.map(([h,p],i)=><div className="luxe-journey-step" key={h}>
            <i>{String(i+1).padStart(2,'0')}</i><div><h3>{h}</h3><p>{p}</p></div>
          </div>)}
        </div>
      </div>
    </section>

    <section className="luxe-location-section">
      <div className="wrap luxe-location-card">
        <div className="location-light"></div>
        <div>
          <span className="eyebrow">LOCATION • NAKHON PATHOM</span>
          <h2>{t(lang,'แวะมาอิ่มแบบพรีเมียมกับเรา','Your premium shabu spot in Nakhon Pathom')}</h2>
          <p>{address}</p>
          <div className="location-hours"><span>{t(lang,'เปิดทุกวัน','Open daily')}</span><b>{SHOP.openTime}–{SHOP.closeTime}</b></div>
        </div>
        <a className="luxe-map-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SHOP.addressTh)}`} target="_blank" rel="noreferrer"><span>⌖</span><div><small>GOOGLE MAPS</small><b>{t(lang,'เปิดเส้นทาง','Get directions')}</b></div><em>↗</em></a>
      </div>
    </section>
  </>
}

function MenuPage({lang}) {
  const [items,setItems]=useState([])
  const [q,setQ]=useState('')
  const [cat,setCat]=useState('ทั้งหมด')
  useEffect(()=>{listMenu().then(setItems).catch(()=>setItems(MENU))},[])
  const cats=['ทั้งหมด',...new Set(items.map(x=>x.category))]
  const filtered=items.filter(x=>(cat==='ทั้งหมด'||x.category===cat)&&(`${x.name_th} ${x.name_en}`.toLowerCase().includes(q.toLowerCase())))
  return <section className="section page premium-page"><div className="wrap">
    <div className="page-head center"><span className="eyebrow">BUFFET MENU</span><h1>{t(lang,'เมนูชาบูของเรา','Our Shabu Selection')}</h1><p>{t(lang,'เมนูส่วนใหญ่รวมในบุฟเฟ่ต์ 299 บาท เมนู Premium จะแสดงราคาเพิ่มอย่างชัดเจน','Most items are included in the ฿299 buffet. Premium add-ons are clearly marked with an extra price.')}</p></div>
    <div className="menu-toolbar"><input value={q} onChange={e=>setQ(e.target.value)} placeholder={t(lang,'ค้นหาเมนู...','Search the menu...')}/></div>
    <div className="chips">{cats.map(c=><button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{categoryLabel(lang,c)}</button>)}</div>
    <div className="menu-grid">{filtered.map(x=><article className="food-card" key={x.id}><div className="food-emoji">{x.emoji||'🍲'}</div><div><small>{categoryLabel(lang,x.category)}{x.is_premium?' • PREMIUM':''}</small><h3>{lang==='th'?x.name_th:x.name_en}</h3><span>{x.is_available!==false?t(lang,'พร้อมเสิร์ฟ','Available'):t(lang,'หมดชั่วคราว','Temporarily unavailable')}{Number(x.extra_price||0)>0?` • +${money(x.extra_price)}`:''}</span></div></article>)}</div>
  </div></section>
}

function ReservePage({settings,lang}) {
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
  if(!open)return <section className="section page premium-page"><div className="wrap narrow"><div className="empty"><h2>{t(lang,'ร้านปิดรับการจองชั่วคราว','Reservations are currently closed')}</h2><p>{t(lang,`กรุณากลับมาในเวลาทำการ ${SHOP.openTime}–${SHOP.closeTime}`,`Please return during opening hours ${SHOP.openTime}–${SHOP.closeTime}`)}</p></div></div></section>
  return <section className="section page premium-page"><div className="wrap narrow">
    <div className="page-head"><span className="eyebrow">RESERVATION</span><h1>{t(lang,'จองโต๊ะล่วงหน้า','Reserve your table')}</h1><p>{t(lang,'ส่งคำขอจอง แล้วทีมงานจะจัดโต๊ะที่เหมาะสมและยืนยันให้คุณ','Send your request and our team will assign the best available table and confirm it for you.')}</p></div>
    <form className="form-card premium-form" onSubmit={submit}>
      {err&&<div className="alert error">{err}</div>}
      <div className="form-grid">
        <label>{t(lang,'ชื่อผู้จอง','Name')}<input required value={form.customer_name} onChange={e=>set('customer_name',e.target.value)}/></label>
        <label>{t(lang,'เบอร์โทร','Phone')}<input required inputMode="tel" value={form.customer_phone} onChange={e=>set('customer_phone',e.target.value.replace(/\D/g,'').slice(0,10))}/></label>
        <label>{t(lang,'วันที่','Date')}<input required type="date" value={form.reservation_date} onChange={e=>set('reservation_date',e.target.value)}/></label>
        <label>{t(lang,'เวลา','Time')}<input required type="time" value={form.reservation_time} onChange={e=>set('reservation_time',e.target.value)}/></label>
        <label>{t(lang,'จำนวนคน','Guests')}<input min="1" max="10" required type="number" value={form.guest_count} onChange={e=>set('guest_count',e.target.value)}/></label>
        <label>{t(lang,'หมายเหตุ','Note')}<input value={form.note} onChange={e=>set('note',e.target.value)} placeholder={t(lang,'เช่น มีเด็ก 1 คน','e.g. 1 child')}/></label>
      </div>
      <div className="price-preview"><span>{t(lang,'ราคาโดยประมาณ','Estimated price')}</span><strong>{money(Number(form.guest_count||0)*299)}</strong><small>{t(lang,'* ราคาเด็กสามารถปรับตอนเปิดโต๊ะจริงได้','* Child pricing can be adjusted when the table session starts.')}</small></div>
      <button className="btn primary wide" disabled={busy}>{busy?t(lang,'กำลังส่ง...','Submitting...'):t(lang,'ยืนยันคำขอจองโต๊ะ','Submit reservation request')}</button>
    </form>
  </div></section>
}

function ReservationPage({lang}) {
  const loc=useLocation(); const params=new URLSearchParams(loc.search)
  const [code,setCode]=useState(params.get('code')||''); const [data,setData]=useState(null); const [err,setErr]=useState('')
  async function search(c=code){setErr('');try{const r=await getReservation(c.trim());if(!r)throw new Error(t(lang,'ไม่พบการจอง','Reservation not found'));setData(r)}catch(e){setData(null);setErr(e.message)}}
  useEffect(()=>{if(code)search(code)},[])
  const stateLabels=lang==='th'?{pending:'รอยืนยัน',confirmed:'ยืนยันแล้ว',rejected:'ไม่อนุมัติ',cancelled:'ยกเลิก'}:{pending:'Pending',confirmed:'Confirmed',rejected:'Rejected',cancelled:'Cancelled'}
  return <section className="section page premium-page"><div className="wrap narrow">
    <div className="page-head center"><span className="eyebrow">YOUR RESERVATION</span><h1>{t(lang,'ตรวจสอบการจอง','Check your reservation')}</h1><p>{t(lang,'กรอกรหัสการจองที่ได้รับหลังส่งคำขอ','Enter the reservation code you received after submitting your request.')}</p></div>
    <div className="search-box"><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={10}/><button className="btn primary" onClick={()=>search()}>{t(lang,'ค้นหา','Search')}</button></div>
    {err&&<div className="alert error">{err}</div>}
    {data&&<div className="reservation-card">
      <div className="reservation-top"><div><small>RESERVATION</small><h2>{data.code}</h2></div><span className={`reservation-state ${data.status}`}>{stateLabels[data.status]||data.status}</span></div>
      <div className="reservation-info"><div><span>{t(lang,'ชื่อ','Name')}</span><b>{data.customer_name}</b></div><div><span>{t(lang,'จำนวน','Guests')}</span><b>{data.guest_count} {t(lang,'คน','people')}</b></div><div><span>{t(lang,'วัน/เวลา','Date / time')}</span><b>{data.reservation_date} • {data.reservation_time}</b></div><div><span>{t(lang,'โต๊ะ','Table')}</span><b>{data.table_code||data.restaurant_tables?.code||t(lang,'รอร้านจัดโต๊ะ','Awaiting table assignment')}</b></div></div>
      {data.status==='confirmed'&&data.session_token&&<div className="qr-zone"><QRCodeSVG value={`${location.origin}/shabu-aroi-jang/table/${data.session_token}`} size={210}/><h3>{t(lang,`QR สำหรับโต๊ะ ${data.table_code||data.restaurant_tables?.code}`,`QR for table ${data.table_code||data.restaurant_tables?.code}`)}</h3><p>{t(lang,'สแกน QR เมื่อมาถึงร้านเพื่อเปิด Session และเริ่มสั่งอาหาร','Scan this QR when you arrive to activate your table session and start ordering.')}</p><Link className="btn dark" to={`/table/${data.session_token}`}>{t(lang,'เปิดหน้าสั่งอาหาร','Open ordering page')}</Link></div>}
    </div>}
  </div></section>
}

function ChatPage({lang}) {
  const welcome=t(lang,'สวัสดีครับ 👋 ผมเป็น AI ของชาบูอร่อยจัง ถามเรื่องราคา เมนู เวลาเปิด ที่ตั้ง หรือการจองได้เลยครับ','Hello 👋 I’m the Shabu Aroi Jang AI concierge. Ask me about prices, menu, opening hours, location or reservations.')
  const [messages,setMessages]=useState([{role:'bot',text:welcome}])
  const [input,setInput]=useState(''); const [busy,setBusy]=useState(false)
  useEffect(()=>{setMessages([{role:'bot',text:welcome}])},[lang])
  async function send(){
    const q=input.trim(); if(!q||busy)return
    setInput(''); setMessages(m=>[...m,{role:'user',text:q}]); setBusy(true)
    const answer=await askAi(q); setMessages(m=>[...m,{role:'bot',text:answer}]); setBusy(false)
  }
  return <section className="section page premium-page"><div className="wrap chat-wrap">
    <div className="page-head center"><span className="eyebrow">AI CONCIERGE</span><h1>{t(lang,'ถามชาบู AI','Shabu AI Concierge')}</h1><p>{t(lang,'ผู้ช่วยตอบคำถามเกี่ยวกับร้านได้ตลอดเวลา','Your always-on assistant for restaurant questions.')}</p></div>
    <div className="chat-card"><div className="chat-log">{messages.map((m,i)=><div key={i} className={`bubble-msg ${m.role}`}><span>{m.role==='bot'?'✦':'🙂'}</span><p>{m.text}</p></div>)}{busy&&<div className="bubble-msg bot"><span>✦</span><p>{t(lang,'กำลังคิด...','Thinking...')}</p></div>}</div>
      <div className="chat-input"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={t(lang,'เช่น ร้านเปิดกี่โมง?','e.g. What time do you open?')}/><button className="btn primary" onClick={send}>{t(lang,'ส่ง','Send')}</button></div>
    </div>
  </div></section>
}

function TablePage({lang,setLang}) {
  const {token}=useParams()
  const [session,setSession]=useState(null); const [menu,setMenu]=useState([]); const [orders,setOrders]=useState([]); const [tableSettings,setTableSettings]=useState(null); const [slipBusy,setSlipBusy]=useState(false)
  const [cart,setCart]=useState({}); const [cat,setCat]=useState('ทั้งหมด'); const [notice,setNotice]=useState(''); const [loading,setLoading]=useState(true)
  const orderEn={pending:'Pending',accepted:'Accepted',preparing:'Preparing',ready:'Ready to serve',serving:'On the way',served:'Served',cancelled:'Cancelled'}
  const noticeText=(th,en)=>setNotice(t(lang,th,en))
  async function load(){
    try{
      const [s,m,o,st]=await Promise.all([getSession(token),listMenu(),listSessionOrders(token),getSettings()])
      setSession(s);setMenu(m);setOrders(o);setTableSettings(st)
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
    await createFoodOrder(token,selected);setCart({});noticeText('ส่งรายการเข้าครัวแล้ว','Order sent to the kitchen');setTimeout(()=>setNotice(''),2500);await load()
  }
  async function service(type){await createServiceCall(token,type);noticeText('เรียกพนักงานแล้ว','Staff request sent');setTimeout(()=>setNotice(''),2200)}
  async function bill(){if(!confirm(t(lang,'ยืนยันเรียกเช็คบิล? หลังจากนี้กรุณารอพนักงาน','Request the bill? Please wait for staff after confirming.')))return;await requestBill(token);await load()}
  if(loading)return <div className="loader">{t(lang,'กำลังโหลดโต๊ะ...','Loading table...')}</div>
  if(!session)return <section className="section page"><div className="wrap narrow"><div className="empty"><h2>{t(lang,'QR นี้ไม่พร้อมใช้งาน','This QR is not available')}</h2><p>{t(lang,'กรุณาติดต่อพนักงาน','Please contact a staff member.')}</p></div></div></section>
  if(session.status==='reserved')return <section className="section page"><div className="wrap narrow"><div className="table-welcome"><span>TABLE</span><h1>{session.table_code||session.table?.code}</h1><p>{session.guest_count} {t(lang,'คน','guests')} • Buffet 299 {t(lang,'บาท','THB')} • {SHOP.diningMinutes} {t(lang,'นาที','min')}</p><button className="btn primary wide" onClick={enter}>{t(lang,'เริ่มใช้โต๊ะและสั่งอาหาร','Start table session & order')}</button></div></div></section>
  if(session.status==='closed')return <ReviewForm token={token} table={session.table_code||session.table?.code} lang={lang}/>
  if(session.status==='billing'){
    const b=session.bill||{}
    let pp=''
    try{pp=promptPayPayload(tableSettings?.promptpay||SHOP.promptpay,b.total||0)}catch{}
    const slipLabels=lang==='th'?{pending:'รอตรวจ',approved:'ผ่านแล้ว',rejected:'ไม่ผ่าน'}:{pending:'Pending review',approved:'Approved',rejected:'Rejected'}
    const uploadSlip=async(e)=>{const file=e.target.files?.[0];if(!file)return;setSlipBusy(true);try{await uploadPaymentSlip(token,file);noticeText('ส่งสลิปแล้ว กรุณารอพนักงานตรวจ','Slip uploaded. Please wait for staff verification.');await load()}catch(err){alert(err.message)}finally{setSlipBusy(false)}}
    return <section className="section page"><div className="wrap narrow"><div className="payment-customer"><div className="table-language"><button onClick={()=>setLang(lang==='th'?'en':'th')}>{lang==='th'?'EN':'TH'}</button></div><span className="eyebrow">CHECKOUT • TABLE {session.table_code}</span><h1>{t(lang,'รอชำระเงิน','Payment')}</h1><div className="payment-total">{money(b.total)}</div><div className="bill-customer-lines"><span>{t(lang,'ผู้ใหญ่','Adults')} {b.adult_count||0}</span><span>{t(lang,'เด็ก','Children')} {b.child_count||0}</span><span>{t(lang,'เด็กฟรี','Free children')} {b.free_child_count||0}</span><span>{t(lang,'เมนูเพิ่ม','Add-ons')} {money(b.extra_total||0)}</span><span>{t(lang,'ส่วนลด','Discount')} -{money(b.discount_amount||0)}</span></div>{pp&&<div className="admin-qr-box"><QRCodeSVG value={pp} size={260}/></div>}<p>PromptPay: <b>{tableSettings?.promptpay||SHOP.promptpay}</b></p><label className="upload-slip">📎 {t(lang,'อัปโหลดสลิป','Upload payment slip')}<input type="file" accept="image/*" disabled={slipBusy} onChange={uploadSlip}/></label>{b.slip_status&&b.slip_status!=='none'&&<div className={`slip-status ${b.slip_status}`}>{t(lang,'สถานะสลิป','Slip status')}: {slipLabels[b.slip_status]||b.slip_status}</div>}{tableSettings?.card_payment_url&&<a className="btn dark wide" href={tableSettings.card_payment_url} target="_blank" rel="noreferrer">💳 {t(lang,'ชำระด้วยบัตรออนไลน์','Pay by card online')}</a>}<p className="muted">{t(lang,'หลังชำระแล้ว กรุณารอพนักงานปิดบิล ระบบจะพาไปหน้ารีวิวอัตโนมัติ','After payment, please wait for staff to close the bill. You will then be taken to the review page.')}</p></div></div></section>
  }
  const serviceOptions=lang==='th'
    ?[['soup','🍲 เติมน้ำซุป'],['plates','🍽 ขอจานเพิ่ม'],['sauce','🥣 ขอน้ำจิ้ม'],['cleanup','🧹 เก็บจาน'],['staff','🔔 เรียกพนักงาน']]
    :[['soup','🍲 Refill soup'],['plates','🍽 More plates'],['sauce','🥣 More sauce'],['cleanup','🧹 Clear dishes'],['staff','🔔 Call staff']]
  return <section className="table-app">
    {notice&&<div className="toast">{notice}</div>}
    <div className="table-app-head"><div><Logo small/><div><small>TABLE SESSION</small><h2>{t(lang,'โต๊ะ','Table')} {session.table_code||session.table?.code}</h2></div></div><div className="table-head-actions"><span>{session.guest_count} {t(lang,'คน','guests')}</span><button className="table-lang-btn" onClick={()=>setLang(lang==='th'?'en':'th')}>{lang==='th'?'EN':'TH'}</button></div></div>
    <div className="table-nav"><button onClick={()=>document.getElementById('order-menu')?.scrollIntoView()}>🍲 {t(lang,'สั่งอาหาร','Order')}</button><button onClick={()=>document.getElementById('my-orders')?.scrollIntoView()}>📦 {t(lang,'รายการของฉัน','My orders')}</button><button onClick={()=>service('staff')}>🔔 {t(lang,'เรียกพนักงาน','Call staff')}</button><button className="bill" onClick={bill}>💳 {t(lang,'เช็คบิล','Bill')}</button></div>
    <div className="table-content" id="order-menu">
      <div className="table-title"><div><span className="eyebrow">UNLIMITED MENU</span><h1>{t(lang,'อยากทานอะไรเพิ่ม?','What would you like next?')}</h1></div><div className="cart-count">{totalItems} {t(lang,'รายการ','items')}</div></div>
      <div className="chips horizontal">{cats.map(c=><button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{categoryLabel(lang,c)}</button>)}</div>
      <div className="order-menu-grid">{items.map(x=><div className="order-menu-card" key={x.id}><div className="food-emoji small">{x.emoji||'🍲'}</div><div className="food-copy"><small>{categoryLabel(lang,x.category)}{x.is_premium?' • PREMIUM':''}</small><b>{lang==='th'?x.name_th:(x.name_en||x.name_th)}</b>{Number(x.extra_price||0)>0&&<em className="extra-price">+{money(x.extra_price)}</em>}</div><div className="stepper"><button onClick={()=>add(x.id,-1)}>−</button><strong>{qty(x.id)}</strong><button onClick={()=>add(x.id,1)}>+</button></div></div>)}</div>
      {totalItems>0&&<div className="sticky-submit"><span><b>{totalItems}</b> {t(lang,'รายการที่เลือก','selected')}{extraTotal>0&&<small> • {t(lang,'เพิ่ม','extra')} {money(extraTotal)}</small>}</span><button className="btn primary" onClick={submit}>{t(lang,'ยืนยันและส่งเข้าครัว →','Send to kitchen →')}</button></div>}
      <div className="quick-service"><h2>{t(lang,'เรียกพนักงาน','Table service')}</h2><div>{serviceOptions.map(([v,l])=><button key={v} onClick={()=>service(v)}>{l}</button>)}</div></div>
      <div id="my-orders" className="my-orders"><h2>{t(lang,'รายการที่สั่ง','Your orders')}</h2>{orders.length===0?<p className="muted">{t(lang,'ยังไม่มีรายการที่สั่ง','No orders yet.')}</p>:orders.map(o=><article key={o.id}><div><small>{dateTime(o.created_at)}</small><h3>{o.order_number}</h3></div>{lang==='th'?<Status value={o.status}/>:<span className={`status status-${o.status}`}>{orderEn[o.status]||o.status}</span>}<ul>{(o.items||o.food_order_items||[]).map((i,k)=><li key={i.id||k}>{lang==='th'?(i.name_th||i.item_name_th||'เมนู'):(i.name_en||i.item_name_en||i.name_th||'Item')} × {i.quantity}</li>)}</ul></article>)}</div>
    </div>
  </section>
}

function ReviewForm({token,table,lang='th'}) {
  const [scores,setScores]=useState({taste:5,freshness:5,service:5,cleanliness:5,value:5,overall:5})
  const [comment,setComment]=useState(''); const [done,setDone]=useState(false)
  async function send(){await submitReview(token,{...scores,comment});setDone(true)}
  const labels=lang==='th'
    ?{taste:'รสชาติอาหาร',freshness:'ความสด',service:'การบริการ',cleanliness:'ความสะอาด',value:'ความคุ้มค่า',overall:'โดยรวม'}
    :{taste:'Taste',freshness:'Freshness',service:'Service',cleanliness:'Cleanliness',value:'Value',overall:'Overall'}
  if(done)return <section className="section page"><div className="wrap narrow"><div className="empty"><div className="big-ok">✓</div><h2>{t(lang,'ขอบคุณสำหรับความคิดเห็น','Thank you for your feedback')}</h2><p>{t(lang,'หวังว่าจะได้ต้อนรับคุณอีกครั้งที่ชาบูอร่อยจัง','We hope to welcome you back to Shabu Aroi Jang soon.')}</p><Link className="btn primary" to="/">{t(lang,'กลับหน้าแรก','Back to home')}</Link></div></div></section>
  return <section className="section page"><div className="wrap narrow"><div className="page-head center"><span className="eyebrow">THANK YOU • TABLE {table}</span><h1>{t(lang,'ประเมินความพึงพอใจ','Rate your experience')}</h1><p>{t(lang,'ช่วยให้เราพัฒนาร้านให้ดีขึ้นในครั้งต่อไป','Your feedback helps us make your next visit even better.')}</p></div>
    <div className="review-card">{Object.entries(labels).map(([k,l])=><div className="rating-row" key={k}><b>{l}</b><div>{[1,2,3,4,5].map(n=><button className={n<=scores[k]?'on':''} key={n} onClick={()=>setScores(s=>({...s,[k]:n}))}>★</button>)}</div></div>)}<textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder={t(lang,'ความคิดเห็นเพิ่มเติม (ไม่บังคับ)','Additional comments (optional)')}/><button className="btn primary wide" onClick={send}>{t(lang,'ส่งแบบประเมิน','Submit review')}</button></div>
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
  ['/admin/ai-history','💬','AI History',['owner','manager']],
  ['/admin/knowledge','🧠','AI Knowledge',['owner','manager']],
  ['/admin/staff','♟','Staff',['owner']],
  ['/admin/audit','⌁','Audit Log',['owner']],
  ['/admin/settings','⚙','Settings',['owner','manager']],
]
function AdminShell({children,onLogout,profile}) {
  const [soundOn,setSoundOn]=useState(localStorage.getItem('shabu-sound')==='1')
  const [notices,setNotices]=useState([]),[openNotice,setOpenNotice]=useState(false)
  const role=profile?.role||'staff'
  async function loadNotices(){try{setNotices(await listNotifications())}catch{}}
  function beep(type){
    if(!soundOn)return
    const freq={reservations:660,food_orders:880,service_calls:1040,bills:520,review:440}[type]||760
    try{const A=window.AudioContext||window.webkitAudioContext;const ctx=new A();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=freq;gain.gain.value=.05;osc.start();osc.stop(ctx.currentTime+.16)}catch{}
  }
  useEffect(()=>{loadNotices();const off=subscribeNotifications(p=>{beep(p?.new?.event_type);loadNotices()});return off},[soundOn])
  useEffect(()=>{localStorage.setItem('shabu-sound',soundOn?'1':'0')},[soundOn])
  const unread=notices.filter(n=>!n.is_read)
  async function readOne(n){await markNotificationRead(n.id);await loadNotices()}
  async function readAll(){await markAllNotificationsRead(unread.map(n=>n.id));await loadNotices()}
  return <div className="admin-shell"><aside><div className="admin-brand"><Logo small/><div><b>ชาบูอร่อยจัง</b><span>{profile?.display_name||'STAFF'} • {role.toUpperCase()}</span></div></div><nav>{adminNav.filter(([, , ,roles])=>roles.includes(role)).map(([to,i,l])=><NavLink key={to} to={to}><span>{i}</span>{l}</NavLink>)}</nav><div className="admin-side-tools"><button className={soundOn?'sound-toggle on':'sound-toggle'} onClick={()=>setSoundOn(v=>!v)}>{soundOn?'🔊 เสียงแจ้งเตือน':'🔇 เปิดเสียงแจ้งเตือน'}</button><button className="notice-reset" onClick={()=>setOpenNotice(v=>!v)}>🔔 {unread.length} ยังไม่อ่าน</button></div><button className="logout" onClick={onLogout}>ออกจากระบบ</button></aside><main>{openNotice&&<div className="notification-panel"><div className="card-head"><h3>การแจ้งเตือน</h3><button className="mini-btn" onClick={readAll}>อ่านทั้งหมด</button></div><div className="notification-list">{notices.slice(0,30).map(n=><button key={n.id} className={n.is_read?'read':''} onClick={()=>readOne(n)}><b>{n.title}</b><span>{n.message}</span><small>{dateTime(n.created_at)}</small></button>)}{!notices.length&&<p className="muted">ยังไม่มีการแจ้งเตือน</p>}</div></div>}{children}</main></div>
}
function AdminHead({eyebrow,title,desc,action}){return <div className="admin-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{action}</div>}

function Dashboard(){
  const [tables,setTables]=useState([]),[orders,setOrders]=useState([]),[res,setRes]=useState([]),[calls,setCalls]=useState([]),[bills,setBills]=useState([]),[reviews,setReviews]=useState([]),[report,setReport]=useState({bills:[],orders:[],sessions:[]})
  async function load(){
    const result=await Promise.allSettled([listTables(),listOrders(),listReservations(),listServiceCalls(),listBills(),listReviews(),getReports()])
    const val=(i)=>result[i].status==='fulfilled'?result[i].value:[]
    setTables(val(0));setOrders(val(1));setRes(val(2));setCalls(val(3));setBills(val(4));setReviews(val(5));setReport(result[6].status==='fulfilled'?result[6].value:{bills:[],orders:[],sessions:[]})
  }
  useEffect(()=>{load();return subscribeAll(load)},[])
  const avg=reviews.length?(reviews.reduce((s,x)=>s+Number(x.overall||0),0)/reviews.length).toFixed(1):'-'
  const today=new Date();const sameDay=(v)=>{const d=new Date(v);return d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth()&&d.getDate()===today.getDate()}
  const todayBills=(report.bills||[]).filter(x=>sameDay(x.paid_at)),todaySales=todayBills.reduce((s,x)=>s+Number(x.total||0),0),todayCustomers=todayBills.reduce((s,x)=>s+Number(x.guest_count||0),0)
  const topMap={};(report.orders||[]).filter(x=>sameDay(x.created_at)).forEach(o=>(o.food_order_items||[]).forEach(i=>{topMap[i.item_name_th]=(topMap[i.item_name_th]||0)+Number(i.quantity||0)}))
  const topMenu=Object.entries(topMap).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const turn={};(report.sessions||[]).forEach(s=>{const code=s.restaurant_tables?.code;if(code)turn[code]=(turn[code]||0)+1})
  const topTable=Object.entries(turn).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const hour={};(report.orders||[]).filter(x=>sameDay(x.created_at)).forEach(o=>{const h=new Date(o.created_at).getHours();hour[h]=(hour[h]||0)+1})
  const maxH=Math.max(1,...Object.values(hour))
  const cards=[
    ['฿','ยอดขายวันนี้',money(todaySales)],['👥','ลูกค้าวันนี้',todayCustomers],
    ['🟢','โต๊ะว่าง',tables.filter(x=>x.status==='available').length],['🍲','โต๊ะใช้งาน',tables.filter(x=>['occupied','service','billing'].includes(x.status)).length],
    ['◷','จองรอยืนยัน',res.filter(x=>x.status==='pending').length],['🔥','ออเดอร์รอครัว',orders.filter(x=>x.status==='pending').length],
    ['🔔','เรียกพนักงาน',calls.filter(x=>x.status==='pending').length],['💳','รอเช็คบิล',bills.filter(x=>x.status==='pending').length],['★','รีวิวเฉลี่ย',avg],
  ]
  return <><AdminHead eyebrow="OVERVIEW" title="Dashboard" desc="ภาพรวมร้าน ยอดขาย และการปฏิบัติงานแบบ Realtime"/><div className="stat-grid dashboard-stats">{cards.map(([i,l,v])=><div className="stat-card" key={l}><span>{i}</span><div><small>{l}</small><b>{v}</b></div></div>)}</div>
    <div className="admin-grid two"><section className="admin-card"><div className="card-head"><h2>Order ต่อชั่วโมงวันนี้</h2><Link to="/admin/reports">รายงาน →</Link></div><div className="bar-chart">{Object.entries(hour).sort((a,b)=>a[0]-b[0]).map(([h,n])=><div key={h}><span>{String(h).padStart(2,'0')}:00</span><i style={{width:`${Math.max(4,n/maxH*100)}%`}}></i><b>{n}</b></div>)}</div>{!Object.keys(hour).length&&<p className="muted">ยังไม่มี Order วันนี้</p>}</section><section className="admin-card"><div className="card-head"><h2>เมนูยอดนิยมวันนี้</h2><Link to="/admin/orders">ดูครัว →</Link></div><div className="rank-list">{topMenu.map(([n,q],i)=><div key={n}><b>#{i+1}</b><span>{n}</span><strong>{q}</strong></div>)}</div></section><section className="admin-card"><h2>โต๊ะหมุนเวียนสูง</h2><div className="rank-list">{topTable.map(([n,q],i)=><div key={n}><b>#{i+1}</b><span>โต๊ะ {n}</span><strong>{q} รอบ</strong></div>)}</div></section><section className="admin-card"><div className="card-head"><h2>โต๊ะในร้าน</h2><Link to="/admin/tables">จัดการ →</Link></div><div className="mini-table-grid">{tables.map(x=><div key={x.id} className={`mini-table ${x.status}`}><b>{x.code}</b><small>{x.seats} ที่ • {TABLE_LABEL[x.status]||x.status}</small></div>)}</div></section></div>
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
  const [items,setItems]=useState([]),[filter,setFilter]=useState('active'),[station,setStation]=useState('all'),[tick,setTick]=useState(0),[loadError,setLoadError]=useState('')
  async function load(){
    try{
      setItems(await listOrders())
      setLoadError('')
    }catch(e){
      setLoadError(e.message||'โหลด Order ไม่สำเร็จ')
    }
  }
  useEffect(()=>{load();const off=subscribeAll(load);const id=setInterval(()=>setTick(x=>x+1),30000);return()=>{off();clearInterval(id)}},[])
  const stations=[['all','ทุก Station'],['kitchen','ครัวหลัก'],['hot','ครัวร้อน'],['fried','ของทอด'],['bar','บาร์น้ำ'],['dessert','ของหวาน']]
  const list=items.filter(x=>(filter==='all'?true:filter==='active'?!['served','cancelled'].includes(x.status):x.status===filter)&&
    (station==='all'||(x.items||[]).some(i=>(i.station||'kitchen')===station)))
  async function move(o,status){try{await updateOrderStatus(o.id,status);load()}catch(e){alert(e.message)}}
  function age(o){return Math.max(0,Math.floor((Date.now()-new Date(o.created_at).getTime())/60000))}
  function full(){const el=document.querySelector('.kitchen-view');if(el?.requestFullscreen)el.requestFullscreen()}
  return <div className="kitchen-view"><AdminHead eyebrow="KITCHEN DISPLAY" title="Kitchen / Orders" desc="แยก Station, เตือน Order ช้า, Serving และ Full screen" action={<button className="btn dark" onClick={full}>⛶ Full screen</button>}/>{loadError&&<div className="alert warn"><b>โหลด Order ไม่สำเร็จ</b><span>{loadError}</span><button className="mini-btn" onClick={load}>ลองใหม่</button></div>}<div className="filter-row">{[['active','กำลังทำ'],['pending','รอรับ'],['preparing','กำลังเตรียม'],['ready','พร้อมเสิร์ฟ'],['serving','กำลังเสิร์ฟ'],['served','เสิร์ฟแล้ว'],['all','ทั้งหมด']].map(([v,l])=><button className={filter===v?'active':''} key={v} onClick={()=>setFilter(v)}>{l}</button>)}</div><div className="filter-row station-filter">{stations.map(([v,l])=><button className={station===v?'active':''} key={v} onClick={()=>setStation(v)}>{l}</button>)}</div><div className="kitchen-grid">{list.map(o=>{const mins=age(o),slow=mins>=15&&!['served','cancelled'].includes(o.status);return <article className={`kitchen-card ${o.status} ${slow?'slow-order':''}`} key={o.id}><div className="kitchen-head"><div><span>โต๊ะ</span><h2>{o.table_code||'-'}</h2></div><Status value={o.status}/></div><div className="order-clock"><b>{mins} นาที</b>{slow&&<span>⚠ ช้า</span>}</div><small>{o.order_number} • {dateTime(o.created_at)}</small><ul>{(o.items||[]).filter(i=>station==='all'||(i.station||'kitchen')===station).map((i,k)=><li key={i.id||k}><span><b>{i.name_th||i.item_name_th||'เมนู'}</b><small>{({kitchen:'ครัวหลัก',hot:'ครัวร้อน',fried:'ของทอด',bar:'บาร์น้ำ',dessert:'ของหวาน'})[i.station]||i.station||'ครัวหลัก'}</small></span><strong>× {i.quantity}</strong></li>)}</ul><div className="kitchen-actions">{ORDER_FLOW.map(s=><button key={s} disabled={o.status===s} className={o.status===s?'current':''} onClick={()=>move(o,s)}>{ORDER_LABEL[s]}</button>)}</div>{o.served_at&&<small>เสิร์ฟ {dateTime(o.served_at)}</small>}</article>})}{!list.length&&<div className="empty admin-empty"><h2>ไม่มี Order ในสถานะนี้</h2></div>}</div></div>
}
function ServiceAdmin(){
  const [items,setItems]=useState([]),[loadError,setLoadError]=useState('')
  async function load(){
    try{
      setItems(await listServiceCalls())
      setLoadError('')
    }catch(e){
      setLoadError(e.message||'โหลดคำขอไม่สำเร็จ')
    }
  }
  useEffect(()=>{load();return subscribeAll(load)},[])
  const label={soup:'เติมน้ำซุป',plates:'ขอจานเพิ่ม',sauce:'ขอน้ำจิ้ม',cleanup:'เก็บจาน',staff:'เรียกพนักงาน',bill:'เช็คบิล'}
  return <><AdminHead eyebrow="SERVICE CALLS" title="เรียกพนักงาน" desc="คำขอจากลูกค้าแต่ละโต๊ะ"/>{loadError&&<div className="alert warn"><b>โหลดคำขอไม่สำเร็จ</b><span>{loadError}</span><button className="mini-btn" onClick={load}>ลองใหม่</button></div>}<div className="service-grid">{items.filter(x=>x.status!=='done').map(x=><article key={x.id}><div><span>โต๊ะ</span><h2>{x.table_code||'-'}</h2></div><h3>{label[x.type]||x.type}</h3><small>{dateTime(x.created_at)}</small><button className="btn primary wide" onClick={async()=>{await resolveServiceCall(x.id);load()}}>รับเรื่องแล้ว ✓</button></article>)}{!items.filter(x=>x.status!=='done').length&&<div className="empty admin-empty"><h2>ไม่มีลูกค้าเรียกพนักงาน</h2></div>}</div></>
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
      phone:form.phone||SHOP.phone,address_th:form.address_th||SHOP.addressTh,shop_name_th:form.shop_name_th||SHOP.nameTh,shop_name_en:form.shop_name_en||SHOP.nameEn,
      booking_slot_minutes:Number(form.booking_slot_minutes||30),max_bookings_per_slot:Number(form.max_bookings_per_slot||15),tax_id:form.tax_id||null,tax_branch:form.tax_branch||'สำนักงานใหญ่',tax_registered:!!form.tax_registered,logo_url:form.logo_url||null,card_payment_url:form.card_payment_url||null
    })
    if(next.logo_url)localStorage.setItem('shabu-logo-url',next.logo_url);setForm(next);onChange(next);alert('บันทึกแล้ว')
  }
  async function uploadLogo(e){const file=e.target.files?.[0];if(!file)return;try{const url=await uploadBrandLogo(file);setForm(x=>({...x,logo_url:url}))}catch(err){alert(err.message)}}
  const modeValue=form.force_open?'open':form.force_closed?'closed':'auto'
  return <><AdminHead eyebrow="SETTINGS" title="ตั้งค่าร้าน" desc="ตั้งสถานะร้าน ราคา เวลา ข้อมูลติดต่อ เด็ก และ Payment"/>
    <div className="admin-grid two">
      <section className="admin-card"><h2>สถานะร้าน</h2><p className="muted">Manual จะ Override เวลาเปิด–ปิดปกติ</p><div className="shop-mode">
        <button className={modeValue==='open'?'active open':''} onClick={()=>mode('open')}><span>🟢</span><b>เปิดร้าน</b><small>เปิดรับลูกค้าทันที</small></button>
        <button className={modeValue==='auto'?'active auto':''} onClick={()=>mode('auto')}><span>🕒</span><b>ตามเวลา</b><small>{String(form.open_time||'11:00').slice(0,5)}–{String(form.close_time||'22:00').slice(0,5)}</small></button>
        <button className={modeValue==='closed'?'active closed':''} onClick={()=>mode('closed')}><span>🔴</span><b>ปิดร้าน</b><small>หยุดรับลูกค้าชั่วคราว</small></button>
      </div></section>
      <section className="admin-card"><h2>กติกาการขาย</h2><form className="settings-form" onSubmit={save}>
        <label>ชื่อร้าน<input value={form.shop_name_th||''} onChange={e=>setForm(f=>({...f,shop_name_th:e.target.value}))}/></label>
        <label>ชื่อร้าน EN<input value={form.shop_name_en||''} onChange={e=>setForm(f=>({...f,shop_name_en:e.target.value}))}/></label>
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
        <label>ช่วงจอง (นาที)<input type="number" value={form.booking_slot_minutes??30} onChange={e=>setForm(f=>({...f,booking_slot_minutes:e.target.value}))}/></label>
        <label>Booking สูงสุด/ช่วง<input type="number" value={form.max_bookings_per_slot??15} onChange={e=>setForm(f=>({...f,max_bookings_per_slot:e.target.value}))}/></label>
        <label>Tax ID<input value={form.tax_id||''} onChange={e=>setForm(f=>({...f,tax_id:e.target.value}))}/></label>
        <label>สาขา<input value={form.tax_branch||''} onChange={e=>setForm(f=>({...f,tax_branch:e.target.value}))}/></label>
        <label className="check"><input type="checkbox" checked={!!form.tax_registered} onChange={e=>setForm(f=>({...f,tax_registered:e.target.checked}))}/> จด VAT / ใช้ข้อมูลใบกำกับภาษี</label>
        <label>Card Payment URL<input value={form.card_payment_url||''} onChange={e=>setForm(f=>({...f,card_payment_url:e.target.value}))}/></label>
        <label className="span-2">Logo<input type="file" accept="image/*" onChange={uploadLogo}/>{form.logo_url&&<img className="image-preview brand-preview" src={form.logo_url} alt="logo"/>}</label>
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
  useEffect(()=>{getSettings().then(s=>{setSettings(s);if(s?.logo_url)localStorage.setItem('shabu-logo-url',s.logo_url)}).catch(()=>setSettings({open_time:'11:00',close_time:'22:00'}));getAdminSession().then(async s=>{setAdminSession(s);if(s)setAdminProfile(await getCurrentProfile());setAuthReady(true)})},[])
  if(!settings||!authReady)return <div className="loader">กำลังเปิดร้านชาบูอร่อยจัง...</div>
  async function doLogout(){await logout();setAdminSession(null);setAdminProfile(null)}
  async function onAdminLogin(s){setAdminSession(s);setAdminProfile(await getCurrentProfile())}
  const admin=(page,roles)=><Protected session={adminSession} profile={adminProfile} roles={roles}><AdminShell onLogout={doLogout} profile={adminProfile}>{page}</AdminShell></Protected>
  return <Routes>
    <Route path="/" element={<CustomerShell lang={lang} setLang={setLang} settings={settings}><Home lang={lang} settings={settings}/></CustomerShell>}/>
    <Route path="/menu" element={<CustomerShell lang={lang} setLang={setLang} settings={settings}><MenuPage lang={lang}/></CustomerShell>}/>
    <Route path="/reserve" element={<CustomerShell lang={lang} setLang={setLang} settings={settings}><ReservePage settings={settings} lang={lang}/></CustomerShell>}/>
    <Route path="/reservation" element={<CustomerShell lang={lang} setLang={setLang} settings={settings}><ReservationPage lang={lang}/></CustomerShell>}/>
    <Route path="/chat" element={<CustomerShell lang={lang} setLang={setLang} settings={settings}><ChatPage lang={lang}/></CustomerShell>}/>
    <Route path="/table/:token" element={<TablePage lang={lang} setLang={setLang}/>}/>
    <Route path="/admin/login" element={adminSession?<Navigate to="/admin/dashboard" replace/>:<AdminLogin onLogin={onAdminLogin}/>}/>
    <Route path="/admin/dashboard" element={admin(<Dashboard/>,['owner','manager','cashier','kitchen','staff'])}/>
    <Route path="/admin/reservations" element={admin(<ReservationsAdmin/>,['owner','manager','cashier','staff'])}/>
    <Route path="/admin/tables" element={admin(<TablesManager/>,['owner','manager','cashier','staff'])}/>
    <Route path="/admin/orders" element={admin(<OrdersAdmin/>,['owner','manager','kitchen','staff'])}/>
    <Route path="/admin/service" element={admin(<ServiceAdmin/>,['owner','manager','staff','kitchen'])}/>
    <Route path="/admin/billing" element={admin(<BillingManager/>,['owner','manager','cashier'])}/>
    <Route path="/admin/menu" element={admin(<MenuManager/>,['owner','manager'])}/>
    <Route path="/admin/reviews" element={admin(<ReviewsAdvancedPage/>,['owner','manager'])}/>
    <Route path="/admin/customers" element={admin(<CustomersPage/>,['owner','manager','cashier'])}/>
    <Route path="/admin/promotions" element={admin(<PromotionsPage/>,['owner','manager'])}/>
    <Route path="/admin/reports" element={admin(<ReportsPage/>,['owner','manager'])}/>
    <Route path="/admin/ai-history" element={admin(<ChatHistoryPage/>,['owner','manager'])}/>
    <Route path="/admin/knowledge" element={admin(<KnowledgeBasePage/>,['owner','manager'])}/>
    <Route path="/admin/staff" element={admin(<StaffPage/>,['owner'])}/>
    <Route path="/admin/audit" element={admin(<AuditPage/>,['owner'])}/>
    <Route path="/admin/settings" element={admin(<SettingsAdmin settings={settings} onChange={setSettings}/>,['owner','manager'])}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>
}
