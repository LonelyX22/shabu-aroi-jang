import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  closeBill, createCategory, createMenuItem, createPromotion, deleteCategory, deleteMenuItem,
  deletePromotion, expireReservations, getReports, listActiveSessions, listAuditLogs, listBills,
  listCategories, listCustomers, listMenu, listProfiles, listPromotions, listTables, moveTableSession,
  openWalkin, subscribeAll, updateBillDetails, updateCategory, updateMenuItem, updateProfile,
  updatePromotion, markTableReady, registerStaffProfile, listChatLogs
} from '../lib/api'

const money=(n)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n||0))
const dt=(v)=>v?new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'-'

function Head({eyebrow,title,desc,action}){return <div className="admin-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{action}</div>}
function Modal({title,onClose,children}){return <div className="modal-backdrop" onClick={onClose}><div className="pro-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h2>{title}</h2>{children}</div></div>}

export function MenuManager(){
  const [items,setItems]=useState([]),[cats,setCats]=useState([]),[editing,setEditing]=useState(null),[catModal,setCatModal]=useState(false)
  const [form,setForm]=useState({name_th:'',name_en:'',emoji:'🍲',category_id:'',extra_price:0,is_premium:false,is_available:true,description_th:'',description_en:''})
  async function load(){const [m,c]=await Promise.all([listMenu(),listCategories()]);setItems(m);setCats(c)}
  useEffect(()=>{load()},[])
  function open(item=null){setEditing(item);setForm(item?{...item,category_id:item.category_id||'',extra_price:Number(item.extra_price||0)}:{name_th:'',name_en:'',emoji:'🍲',category_id:cats[0]?.id||'',extra_price:0,is_premium:false,is_available:true,description_th:'',description_en:''})}
  async function save(e){e.preventDefault();const payload={name_th:form.name_th,name_en:form.name_en,emoji:form.emoji||'🍲',category_id:form.category_id,extra_price:Number(form.extra_price||0),is_premium:Boolean(form.is_premium),is_available:Boolean(form.is_available),description_th:form.description_th||'',description_en:form.description_en||'',sort_order:editing?.sort_order||items.length+1}; if(editing?.id) await updateMenuItem(editing.id,payload); else await createMenuItem(payload);setEditing(null);await load()}
  async function remove(id){if(confirm('ลบเมนูนี้?')){await deleteMenuItem(id);await load()}}
  async function toggle(x){await updateMenuItem(x.id,{is_available:!x.is_available});await load()}
  return <><Head eyebrow="MENU CRUD" title="จัดการเมนูแบบเต็ม" desc="เพิ่ม แก้ไข ปิดขาย Premium และราคาบวกเพิ่ม" action={<div className="head-actions"><button className="btn ghost" onClick={()=>setCatModal(true)}>หมวดหมู่</button><button className="btn primary" onClick={()=>open()}>+ เพิ่มเมนู</button></div>}/>
    <div className="admin-card"><div className="table-scroll"><table><thead><tr><th>หมวด</th><th>เมนู</th><th>EN</th><th>ราคาเพิ่ม</th><th>ประเภท</th><th>สถานะ</th><th></th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{x.category}</td><td>{x.emoji} <b>{x.name_th}</b></td><td>{x.name_en}</td><td>{Number(x.extra_price||0)>0?money(x.extra_price):'รวม Buffet'}</td><td>{x.is_premium?'Premium':'ปกติ'}</td><td><button className={x.is_available?'pill-btn good':'pill-btn bad'} onClick={()=>toggle(x)}>{x.is_available?'พร้อมขาย':'ปิดขาย'}</button></td><td><div className="row-actions"><button onClick={()=>open(x)}>แก้ไข</button><button className="danger-text" onClick={()=>remove(x.id)}>ลบ</button></div></td></tr>)}</tbody></table></div></div>
    {editing!==null&&<Modal title={editing?.id?'แก้ไขเมนู':'เพิ่มเมนู'} onClose={()=>setEditing(null)}><form className="pro-form" onSubmit={save}><label>ชื่อไทย<input required value={form.name_th} onChange={e=>setForm(f=>({...f,name_th:e.target.value}))}/></label><label>ชื่ออังกฤษ<input required value={form.name_en} onChange={e=>setForm(f=>({...f,name_en:e.target.value}))}/></label><label>หมวด<select required value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}>{cats.map(c=><option value={c.id} key={c.id}>{c.name_th}</option>)}</select></label><label>Emoji<input value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))}/></label><label>ราคาเพิ่ม<input type="number" min="0" value={form.extra_price} onChange={e=>setForm(f=>({...f,extra_price:e.target.value}))}/></label><label className="check"><input type="checkbox" checked={form.is_premium} onChange={e=>setForm(f=>({...f,is_premium:e.target.checked}))}/> Premium</label><label className="check"><input type="checkbox" checked={form.is_available} onChange={e=>setForm(f=>({...f,is_available:e.target.checked}))}/> พร้อมขาย</label><label className="span-2">คำอธิบาย<textarea value={form.description_th} onChange={e=>setForm(f=>({...f,description_th:e.target.value}))}/></label><button className="btn primary span-2">บันทึกเมนู</button></form></Modal>}
    {catModal&&<CategoryManager cats={cats} onClose={()=>setCatModal(false)} onChanged={load}/>}
  </>
}
function CategoryManager({cats,onClose,onChanged}){
  const [nameTh,setNameTh]=useState(''),[nameEn,setNameEn]=useState('')
  async function add(e){e.preventDefault();await createCategory({name_th:nameTh,name_en:nameEn||nameTh,sort_order:cats.length+1,is_active:true});setNameTh('');setNameEn('');await onChanged()}
  async function rename(c){const n=prompt('ชื่อหมวดใหม่',c.name_th);if(!n)return;await updateCategory(c.id,{name_th:n});await onChanged()}
  async function remove(c){if(confirm(`ลบหมวด ${c.name_th}? ต้องไม่มีเมนูอยู่ในหมวดนี้ก่อน`)){try{await deleteCategory(c.id);await onChanged()}catch(e){alert(e.message)}}}
  return <Modal title="จัดการหมวดหมู่" onClose={onClose}><form className="inline-form" onSubmit={add}><input required placeholder="ชื่อไทย" value={nameTh} onChange={e=>setNameTh(e.target.value)}/><input placeholder="English" value={nameEn} onChange={e=>setNameEn(e.target.value)}/><button className="btn primary">เพิ่ม</button></form><div className="simple-list">{cats.map(c=><div key={c.id}><span><b>{c.name_th}</b><small>{c.name_en}</small></span><div><button onClick={()=>rename(c)}>แก้ชื่อ</button><button className="danger-text" onClick={()=>remove(c)}>ลบ</button></div></div>)}</div></Modal>
}

export function TablesManager(){
  const [tables,setTables]=useState([]),[sessions,setSessions]=useState([]),[walkin,setWalkin]=useState(null),[move,setMove]=useState(null),[qrSession,setQrSession]=useState(null)
  const [counts,setCounts]=useState({adult:2,child:0,free:0})
  async function load(){const [t,s]=await Promise.all([listTables(),listActiveSessions()]);setTables(t);setSessions(s)}
  useEffect(()=>{load();return subscribeAll(load)},[])
  async function open(){
    const created=await openWalkin(walkin.id,counts.adult,counts.child,counts.free)
    setWalkin(null);setQrSession(created);setCounts({adult:2,child:0,free:0});await load()
  }
  async function moveNow(newId){await moveTableSession(move.id,newId);setMove(null);await load()}
  const activeByTable=new Map(sessions.map(s=>[s.table_id,s]))
  const qrUrl=qrSession?.token?`${window.location.origin}/shabu-aroi-jang/table/${qrSession.token}`:''
  return <><Head eyebrow="TABLE OPERATIONS" title="จัดการโต๊ะ / Walk-in" desc="เปิดโต๊ะลูกค้า Walk-in, ย้ายโต๊ะ, ดู QR และคืนโต๊ะหลังทำความสะอาด"/>
    <div className="floor-grid">{tables.map(t=>{const s=activeByTable.get(t.id);return <article className={`table-tile ${t.status}`} key={t.id}><div className="table-icon">🍲</div><h2>{t.code}</h2><p>{t.seats} ที่นั่ง</p><span className={`status status-${t.status}`}>{t.status}</span>{s&&<small>{s.guest_count} คน • {s.status}</small>}<div className="table-actions">{t.status==='available'&&<button className="mini-btn ok" onClick={()=>setWalkin(t)}>+ Walk-in</button>}{s&&<button className="mini-btn qr" onClick={()=>setQrSession(s)}>ดู QR</button>}{s&&<button className="mini-btn" onClick={()=>setMove(s)}>ย้ายโต๊ะ</button>}{t.status==='cleaning'&&<button className="mini-btn ok" onClick={async()=>{await markTableReady(t.id);load()}}>พร้อมใช้งาน</button>}</div></article>})}</div>
    {walkin&&<Modal title={`เปิดโต๊ะ ${walkin.code}`} onClose={()=>setWalkin(null)}><div className="pro-form"><label>ผู้ใหญ่<input type="number" min="0" value={counts.adult} onChange={e=>setCounts(c=>({...c,adult:Number(e.target.value)}))}/></label><label>เด็ก 90–120 ซม.<input type="number" min="0" value={counts.child} onChange={e=>setCounts(c=>({...c,child:Number(e.target.value)}))}/></label><label>เด็กต่ำกว่า 90 ซม.<input type="number" min="0" value={counts.free} onChange={e=>setCounts(c=>({...c,free:Number(e.target.value)}))}/></label><div className="span-2 total-preview">รวม {counts.adult+counts.child+counts.free} คน • ประมาณ {money(counts.adult*299+counts.child*149)}</div><button className="btn primary span-2" onClick={open}>เปิดโต๊ะและสร้าง QR</button></div></Modal>}
    {move&&<Modal title={`ย้ายโต๊ะ ${move.table_code}`} onClose={()=>setMove(null)}><div className="simple-list">{tables.filter(t=>t.status==='available'&&t.seats>=move.guest_count).map(t=><div key={t.id}><span><b>{t.code}</b><small>{t.seats} ที่นั่ง</small></span><button className="mini-btn ok" onClick={()=>moveNow(t.id)}>ย้ายมาที่นี่</button></div>)}</div></Modal>}
    {qrSession&&<Modal title={`QR โต๊ะ ${qrSession.table_code||'-'}`} onClose={()=>setQrSession(null)}><div className="admin-qr-box"><QRCodeSVG value={qrUrl} size={250}/></div><p className="muted">Session นี้ใช้สั่งอาหาร เรียกพนักงาน และเช็คบิล</p><div className="qr-modal-actions"><a className="btn dark" href={qrUrl} target="_blank" rel="noreferrer">เปิดหน้าสั่งอาหาร</a><button className="btn ghost" onClick={()=>navigator.clipboard?.writeText(qrUrl)}>คัดลอกลิงก์</button><button className="btn primary" onClick={()=>window.print()}>🖨 พิมพ์ QR</button></div></Modal>}
  </>
}

export function BillingManager(){
  const [items,setItems]=useState([]),[edit,setEdit]=useState(null)
  async function load(){setItems(await listBills())}
  useEffect(()=>{load();return subscribeAll(load)},[])
  async function saveBill(){await updateBillDetails(edit.id,edit);setEdit(null);await load()}
  async function pay(b,method){if(!confirm(`ยืนยันรับชำระ ${money(b.total)} ?`))return;const paid=await closeBill(b.id,method);await load();setTimeout(()=>printReceipt({...b,...paid}),200)}
  function printReceipt(b){
    const w=window.open('','_blank','width=420,height=720');if(!w)return
    w.document.write(`<html><head><title>${b.receipt_number||'Receipt'}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#222}.c{text-align:center}hr{border:0;border-top:1px dashed #999}.row{display:flex;justify-content:space-between;margin:8px 0}h2{margin:4px}</style></head><body><div class="c"><h2>ชาบูอร่อยจัง</h2><div>125/3 ม.5 ต.สามควายเผือก อ.เมือง จ.นครปฐม</div><div>โทร 06-1564-0529</div><h3>${b.receipt_number||'ใบเสร็จ'}</h3></div><hr><div class="row"><span>โต๊ะ</span><b>${b.table_code||'-'}</b></div><div class="row"><span>ผู้ใหญ่ ${b.adult_count||0} × 299</span><b>${money((b.adult_count||0)*299)}</b></div><div class="row"><span>เด็ก ${b.child_count||0} × 149</span><b>${money((b.child_count||0)*149)}</b></div><div class="row"><span>เด็กฟรี</span><b>${b.free_child_count||0}</b></div><div class="row"><span>ส่วนลด</span><b>-${money(b.discount_amount||0)}</b></div><hr><div class="row"><strong>รวม</strong><strong>${money(b.total)}</strong></div><div class="c"><p>ขอบคุณที่ใช้บริการ</p></div><script>window.print()</script></body></html>`);w.document.close()
  }
  return <><Head eyebrow="CASHIER PRO" title="เช็คบิล / ชำระเงิน" desc="แยกผู้ใหญ่ เด็ก เด็กฟรี ส่วนลด และพิมพ์ใบเสร็จ"/>
    <div className="billing-grid">{items.map(b=><article className={b.status} key={b.id}><div className="billing-top"><div><span>โต๊ะ</span><h2>{b.table_code||'-'}</h2></div><span className={`bill-state ${b.status}`}>{b.status==='paid'?'ชำระแล้ว':'รอชำระ'}</span></div><div className="bill-breakdown"><span>ผู้ใหญ่ <b>{b.adult_count||0}</b></span><span>เด็ก <b>{b.child_count||0}</b></span><span>เด็กฟรี <b>{b.free_child_count||0}</b></span></div><div className="bill-line"><span>ยอดสุทธิ</span><b>{money(b.total)}</b></div>{b.status==='pending'?<><button className="mini-btn qr wide-mini" onClick={()=>setEdit({...b,adult_count:b.adult_count||b.guest_count||0,child_count:b.child_count||0,free_child_count:b.free_child_count||0,discount_amount:b.discount_amount||0,promotion_code:b.promotion_code||'',note:b.note||''})}>แก้จำนวน / ส่วนลด</button><div className="pay-actions"><button onClick={()=>pay(b,'cash')}>💵 เงินสด</button><button onClick={()=>pay(b,'promptpay')}>📱 PromptPay</button><button onClick={()=>pay(b,'bank_transfer')}>🏦 โอนเงิน</button></div></>:<><small>{b.receipt_number} • {b.payment_method} • {dt(b.paid_at)}</small><button className="mini-btn qr wide-mini" onClick={()=>printReceipt(b)}>🖨 พิมพ์ใบเสร็จ</button></>}</article>)}</div>
    {edit&&<Modal title={`แก้บิลโต๊ะ ${edit.table_code}`} onClose={()=>setEdit(null)}><div className="pro-form"><label>ผู้ใหญ่<input type="number" min="0" value={edit.adult_count} onChange={e=>setEdit(x=>({...x,adult_count:Number(e.target.value)}))}/></label><label>เด็ก 149 บาท<input type="number" min="0" value={edit.child_count} onChange={e=>setEdit(x=>({...x,child_count:Number(e.target.value)}))}/></label><label>เด็กฟรี<input type="number" min="0" value={edit.free_child_count} onChange={e=>setEdit(x=>({...x,free_child_count:Number(e.target.value)}))}/></label><label>ส่วนลด<input type="number" min="0" value={edit.discount_amount} onChange={e=>setEdit(x=>({...x,discount_amount:Number(e.target.value)}))}/></label><label>Promo Code<input value={edit.promotion_code} onChange={e=>setEdit(x=>({...x,promotion_code:e.target.value.toUpperCase()}))}/></label><label>หมายเหตุ<input value={edit.note} onChange={e=>setEdit(x=>({...x,note:e.target.value}))}/></label><div className="span-2 total-preview">ประมาณ {money(edit.adult_count*299+edit.child_count*149-edit.discount_amount)}</div><button className="btn primary span-2" onClick={saveBill}>บันทึกบิล</button></div></Modal>}
  </>
}

export function ReportsPage(){
  const [data,setData]=useState({bills:[],orders:[],reviews:[]})
  useEffect(()=>{getReports().then(setData)},[])
  const total=data.bills.reduce((s,b)=>s+Number(b.total||0),0)
  const customers=data.bills.reduce((s,b)=>s+Number(b.guest_count||0),0)
  const avgBill=data.bills.length?total/data.bills.length:0
  const itemMap={}
  data.orders.forEach(o=>(o.food_order_items||[]).forEach(i=>{itemMap[i.item_name_th]=(itemMap[i.item_name_th]||0)+Number(i.quantity||0)}))
  const top=Object.entries(itemMap).sort((a,b)=>b[1]-a[1]).slice(0,10)
  const avgReview=data.reviews.length?data.reviews.reduce((s,r)=>s+Number(r.overall||0),0)/data.reviews.length:0
  function exportCsv(){const rows=[['receipt','paid_at','guests','total','payment'],...data.bills.map(b=>[b.receipt_number||'',b.paid_at||'',b.guest_count,b.total,b.payment_method])];const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='shabu-sales.csv';a.click()}
  return <><Head eyebrow="REPORTS" title="รายงานร้าน" desc="ยอดขาย ลูกค้า เมนูยอดนิยม และรีวิว" action={<button className="btn primary" onClick={exportCsv}>Export CSV</button>}/><div className="stat-grid report-stats"><div className="stat-card"><span>฿</span><div><small>ยอดขายรวม</small><b>{money(total)}</b></div></div><div className="stat-card"><span>🧾</span><div><small>จำนวนบิล</small><b>{data.bills.length}</b></div></div><div className="stat-card"><span>👥</span><div><small>ลูกค้า</small><b>{customers}</b></div></div><div className="stat-card"><span>📊</span><div><small>เฉลี่ย/บิล</small><b>{money(avgBill)}</b></div></div><div className="stat-card"><span>★</span><div><small>รีวิวเฉลี่ย</small><b>{avgReview.toFixed(1)}</b></div></div></div><div className="admin-grid two"><section className="admin-card"><h2>เมนูยอดนิยม</h2><div className="rank-list">{top.map(([name,q],i)=><div key={name}><b>#{i+1}</b><span>{name}</span><strong>{q}</strong></div>)}</div></section><section className="admin-card"><h2>บิลล่าสุด</h2><div className="simple-list">{data.bills.slice(0,12).map(b=><div key={b.id}><span><b>{b.receipt_number||'Receipt'}</b><small>{dt(b.paid_at)}</small></span><strong>{money(b.total)}</strong></div>)}</div></section></div></>
}

export function CustomersPage(){
  const [items,setItems]=useState([]),[q,setQ]=useState('')
  useEffect(()=>{listCustomers().then(setItems)},[])
  const list=items.filter(x=>`${x.customer_name} ${x.customer_phone}`.toLowerCase().includes(q.toLowerCase()))
  return <><Head eyebrow="CUSTOMERS" title="ลูกค้า" desc="สรุปจากประวัติการจอง"/><div className="admin-card"><input className="admin-search" placeholder="ค้นหาชื่อหรือเบอร์..." value={q} onChange={e=>setQ(e.target.value)}/><div className="table-scroll"><table><thead><tr><th>ลูกค้า</th><th>เบอร์</th><th>การจอง</th><th>ยืนยันแล้ว</th><th>รวมผู้มา</th><th>ล่าสุด</th></tr></thead><tbody>{list.map(x=><tr key={x.customer_phone}><td><b>{x.customer_name}</b></td><td>{x.customer_phone}</td><td>{x.reservations}</td><td>{x.visits}</td><td>{x.total_guests}</td><td>{dt(x.last_seen)}</td></tr>)}</tbody></table></div></div></>
}

export function StaffPage(){
  const [items,setItems]=useState([]),[adding,setAdding]=useState(false)
  const [form,setForm]=useState({email:'',display_name:'',role:'staff'})
  async function load(){setItems(await listProfiles())}
  useEffect(()=>{load()},[])
  async function patch(id,p){await updateProfile(id,p);await load()}
  async function bind(e){
    e.preventDefault()
    try{
      await registerStaffProfile(form.email,form.display_name,form.role)
      setAdding(false);setForm({email:'',display_name:'',role:'staff'});await load()
    }catch(err){alert(err.message)}
  }
  return <><Head eyebrow="STAFF & ROLES" title="พนักงานและสิทธิ์" desc="Owner กำหนด Role, เปิด/ปิดบัญชี และผูก Auth User" action={<button className="btn primary" onClick={()=>setAdding(true)}>+ เพิ่มพนักงาน</button>}/><div className="admin-card"><div className="table-scroll"><table><thead><tr><th>ชื่อ</th><th>Email</th><th>Role</th><th>สถานะ</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td><b>{x.display_name||'-'}</b></td><td>{x.email}</td><td><select value={x.role} disabled={x.role==='owner'} onChange={e=>patch(x.id,{role:e.target.value})}><option>owner</option><option>manager</option><option>cashier</option><option>kitchen</option><option>staff</option></select></td><td><button disabled={x.role==='owner'} className={x.is_active?'pill-btn good':'pill-btn bad'} onClick={()=>patch(x.id,{is_active:!x.is_active})}>{x.is_active?'ใช้งาน':'ปิดบัญชี'}</button></td></tr>)}</tbody></table></div><div className="alert warn">ก่อนเพิ่มจากหน้านี้ ให้สร้าง User ใน Supabase Authentication ด้วย Email/Password ก่อนหนึ่งครั้ง แล้วกลับมากรอก Email เดิมที่นี่ ระบบจะผูก Role ให้โดย Owner เท่านั้น</div></div>
    {adding&&<Modal title="เพิ่มพนักงาน" onClose={()=>setAdding(false)}><form className="pro-form" onSubmit={bind}><label>Email<input type="email" required value={form.email} onChange={e=>setForm(x=>({...x,email:e.target.value}))}/></label><label>ชื่อแสดง<input required value={form.display_name} onChange={e=>setForm(x=>({...x,display_name:e.target.value}))}/></label><label>Role<select value={form.role} onChange={e=>setForm(x=>({...x,role:e.target.value}))}><option value="manager">Manager</option><option value="cashier">Cashier</option><option value="kitchen">Kitchen</option><option value="staff">Staff</option></select></label><button className="btn primary span-2">ผูกบัญชีพนักงาน</button></form></Modal>}
  </>
}

export function PromotionsPage(){
  const [items,setItems]=useState([]),[edit,setEdit]=useState(null)
  async function load(){setItems(await listPromotions())}
  useEffect(()=>{load()},[])
  async function save(e){e.preventDefault();const p={...edit,code:edit.code.toUpperCase(),discount_value:Number(edit.discount_value||0)};delete p.id;if(edit.id)await updatePromotion(edit.id,p);else await createPromotion(p);setEdit(null);await load()}
  return <><Head eyebrow="PROMOTIONS" title="โปรโมชั่น" desc="สร้างส่วนลดแบบจำนวนเงินหรือเปอร์เซ็นต์" action={<button className="btn primary" onClick={()=>setEdit({code:'',name:'',description:'',discount_type:'fixed',discount_value:0,is_active:true,start_at:null,end_at:null})}>+ โปรโมชั่น</button>}/><div className="admin-card"><div className="simple-list">{items.map(x=><div key={x.id}><span><b>{x.code} • {x.name}</b><small>{x.discount_type==='percent'?`${x.discount_value}%`:money(x.discount_value)} • {x.is_active?'เปิด':'ปิด'}</small></span><div><button onClick={()=>setEdit(x)}>แก้ไข</button><button className="danger-text" onClick={async()=>{if(confirm('ลบโปรโมชั่น?')){await deletePromotion(x.id);load()}}}>ลบ</button></div></div>)}</div></div>{edit&&<Modal title={edit.id?'แก้โปรโมชั่น':'เพิ่มโปรโมชั่น'} onClose={()=>setEdit(null)}><form className="pro-form" onSubmit={save}><label>Code<input required value={edit.code} onChange={e=>setEdit(x=>({...x,code:e.target.value}))}/></label><label>ชื่อ<input required value={edit.name} onChange={e=>setEdit(x=>({...x,name:e.target.value}))}/></label><label>ประเภท<select value={edit.discount_type} onChange={e=>setEdit(x=>({...x,discount_type:e.target.value}))}><option value="fixed">บาท</option><option value="percent">เปอร์เซ็นต์</option></select></label><label>ส่วนลด<input type="number" min="0" required value={edit.discount_value} onChange={e=>setEdit(x=>({...x,discount_value:e.target.value}))}/></label><label className="check"><input type="checkbox" checked={edit.is_active} onChange={e=>setEdit(x=>({...x,is_active:e.target.checked}))}/> เปิดใช้งาน</label><button className="btn primary span-2">บันทึก</button></form></Modal>}</>
}

export function AuditPage(){
  const [items,setItems]=useState([])
  useEffect(()=>{listAuditLogs().then(setItems)},[])
  return <><Head eyebrow="AUDIT LOG" title="ประวัติการจัดการ" desc="ตรวจสอบว่าใครทำอะไรกับระบบ"/><div className="admin-card"><div className="table-scroll"><table><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>Action</th><th>ประเภท</th><th>รายละเอียด</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{dt(x.created_at)}</td><td>{x.actor_email||'-'}</td><td><b>{x.action}</b></td><td>{x.entity_type}</td><td><code>{JSON.stringify(x.detail)}</code></td></tr>)}</tbody></table></div></div></>
}

export function ChatHistoryPage(){
  const [items,setItems]=useState([]),[q,setQ]=useState('')
  useEffect(()=>{listChatLogs().then(setItems)},[])
  const filtered=items.filter(x=>`${x.customer_message} ${x.assistant_message}`.toLowerCase().includes(q.toLowerCase()))
  return <><Head eyebrow="AI CHAT HISTORY" title="ประวัติ AI Chat" desc="ดูคำถามที่ลูกค้าถามและคำตอบของระบบ"/><div className="admin-card"><input className="admin-search" placeholder="ค้นหาคำถาม..." value={q} onChange={e=>setQ(e.target.value)}/><div className="chat-history-list">{filtered.map(x=><article key={x.id}><div><small>{dt(x.created_at)}</small><b>ลูกค้า: {x.customer_message}</b></div><p>AI: {x.assistant_message||'-'}</p></article>)}</div>{!filtered.length&&<p className="muted">ยังไม่มีประวัติ AI Chat</p>}</div></>
}

export function ReservationTools(){
  const [busy,setBusy]=useState(false)
  async function expire(){setBusy(true);try{const n=await expireReservations();alert(`หมดอายุ ${n||0} รายการ`)}finally{setBusy(false)}}
  return <button className="btn ghost" disabled={busy} onClick={expire}>⏱ ตรวจการจองที่เลยเวลา</button>
}
