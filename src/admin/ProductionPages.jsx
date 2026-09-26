import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  closeBill, createCategory, createMenuItem, createPromotion, deleteCategory, deleteMenuItem,
  deletePromotion, expireReservations, getReports, listActiveSessions, listAuditLogs, listBills,
  listCategories, listCustomers, listMenu, listProfiles, listPromotions, listTables, moveTableSession,
  openWalkin, subscribeAll, updateBillDetails, updateCategory, updateMenuItem, updateProfile,
  updatePromotion, markTableReady, registerStaffProfile, createStaffAccount, listChatLogs, uploadMenuImage,
  reorderMenuItems, reorderCategories, mergeSessionTable, detachSessionTable, updateSessionGuests,
  regenerateSessionQr, getSettings, getSlipSignedUrl, reviewPaymentSlip, listReviews, updateReviewAdmin,
  listKnowledgeBase, createKnowledge, updateKnowledge, deleteKnowledge, listOrders, listReservations, listServiceCalls
} from '../lib/api'
import { promptPayPayload } from '../lib/promptpay'

const money=(n)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n||0))
const dt=(v)=>v?new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'-'

function Head({eyebrow,title,desc,action}){return <div className="admin-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{action}</div>}
function Modal({title,onClose,children}){return <div className="modal-backdrop" onClick={onClose}><div className="pro-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h2>{title}</h2>{children}</div></div>}

export function MenuManager(){
  const [items,setItems]=useState([]),[cats,setCats]=useState([]),[editing,setEditing]=useState(undefined),[catModal,setCatModal]=useState(false),[busy,setBusy]=useState(false)
  const blank={name_th:'',name_en:'',emoji:'🍲',category_id:'',extra_price:0,is_premium:false,is_available:true,description_th:'',description_en:'',image_url:'',station:'kitchen'}
  const [form,setForm]=useState(blank)
  async function load(){const [m,cc]=await Promise.all([listMenu(),listCategories()]);setItems(m);setCats(cc)}
  useEffect(()=>{load()},[])
  function open(item=null){setEditing(item);setForm(item?{...blank,...item}:{...blank,category_id:cats[0]?.id||''})}
  async function save(e){e.preventDefault();setBusy(true);try{const payload={name_th:form.name_th,name_en:form.name_en,emoji:form.emoji||'🍲',category_id:form.category_id,extra_price:Number(form.extra_price||0),is_premium:!!form.is_premium,is_available:!!form.is_available,description_th:form.description_th||'',description_en:form.description_en||'',image_url:form.image_url||null,station:form.station||'kitchen',sort_order:editing?.sort_order||items.length+1};if(editing?.id)await updateMenuItem(editing.id,payload);else await createMenuItem(payload);setEditing(undefined);await load()}finally{setBusy(false)}}
  async function upload(e){const file=e.target.files?.[0];if(!file)return;setBusy(true);try{const url=await uploadMenuImage(file);setForm(x=>({...x,image_url:url}))}catch(err){alert(err.message)}finally{setBusy(false)}}
  async function remove(id){if(confirm('ลบเมนูนี้?')){await deleteMenuItem(id);await load()}}
  async function toggle(x){await updateMenuItem(x.id,{is_available:!x.is_available});await load()}
  async function move(index,delta){const n=index+delta;if(n<0||n>=items.length)return;const ids=items.map(x=>x.id);[ids[index],ids[n]]=[ids[n],ids[index]];await reorderMenuItems(ids);await load()}
  return <><Head eyebrow="MENU CRUD" title="จัดการเมนูแบบเต็ม" desc="เพิ่ม แก้ไข รูปอาหาร จัดลำดับ แยก Station Premium และเปิด/ปิดขาย" action={<div className="head-actions"><button className="btn ghost" onClick={()=>setCatModal(true)}>หมวดหมู่</button><button className="btn primary" onClick={()=>open()}>+ เพิ่มเมนู</button></div>}/>
    <div className="admin-card"><div className="table-scroll"><table><thead><tr><th>ลำดับ</th><th>รูป</th><th>หมวด</th><th>เมนู</th><th>Station</th><th>ราคาเพิ่ม</th><th>สถานะ</th><th></th></tr></thead><tbody>{items.map((x,i)=><tr key={x.id}><td><div className="row-actions"><button onClick={()=>move(i,-1)}>↑</button><button onClick={()=>move(i,1)}>↓</button></div></td><td>{x.image_url?<img className="admin-food-thumb" src={x.image_url} alt=""/>:<span className="food-mini">{x.emoji||'🍲'}</span>}</td><td>{x.category}</td><td><b>{x.name_th}</b><small className="block-muted">{x.name_en}{x.is_premium?' • PREMIUM':''}</small></td><td>{({kitchen:'ครัวหลัก',hot:'ครัวร้อน',fried:'ของทอด',bar:'บาร์น้ำ',dessert:'ของหวาน'})[x.station]||x.station||'ครัวหลัก'}</td><td>{Number(x.extra_price||0)>0?money(x.extra_price):'รวม Buffet'}</td><td><button className={x.is_available?'pill-btn good':'pill-btn bad'} onClick={()=>toggle(x)}>{x.is_available?'พร้อมขาย':'ปิดขาย'}</button></td><td><div className="row-actions"><button onClick={()=>open(x)}>แก้ไข</button><button className="danger-text" onClick={()=>remove(x.id)}>ลบ</button></div></td></tr>)}</tbody></table></div></div>
    {editing!==undefined&&<Modal title={editing?.id?'แก้ไขเมนู':'เพิ่มเมนู'} onClose={()=>setEditing(undefined)}><form className="pro-form" onSubmit={save}><label>ชื่อไทย<input required value={form.name_th} onChange={e=>setForm(x=>({...x,name_th:e.target.value}))}/></label><label>ชื่ออังกฤษ<input required value={form.name_en} onChange={e=>setForm(x=>({...x,name_en:e.target.value}))}/></label><label>หมวด<select required value={form.category_id} onChange={e=>setForm(x=>({...x,category_id:e.target.value}))}>{cats.map(cc=><option value={cc.id} key={cc.id}>{cc.name_th}</option>)}</select></label><label>Station<select value={form.station} onChange={e=>setForm(x=>({...x,station:e.target.value}))}><option value="kitchen">ครัวหลัก</option><option value="hot">ครัวร้อน</option><option value="fried">ของทอด</option><option value="bar">บาร์น้ำ</option><option value="dessert">ของหวาน</option></select></label><label>Emoji<input value={form.emoji} onChange={e=>setForm(x=>({...x,emoji:e.target.value}))}/></label><label>ราคาเพิ่ม<input type="number" min="0" value={form.extra_price} onChange={e=>setForm(x=>({...x,extra_price:e.target.value}))}/></label><label className="span-2">รูปอาหาร<input type="file" accept="image/*" onChange={upload}/>{form.image_url&&<img className="image-preview" src={form.image_url} alt="preview"/>}</label><label className="check"><input type="checkbox" checked={form.is_premium} onChange={e=>setForm(x=>({...x,is_premium:e.target.checked}))}/> Premium / คิดเงินเพิ่ม</label><label className="check"><input type="checkbox" checked={form.is_available} onChange={e=>setForm(x=>({...x,is_available:e.target.checked}))}/> พร้อมขาย</label><label className="span-2">คำอธิบาย<textarea value={form.description_th} onChange={e=>setForm(x=>({...x,description_th:e.target.value}))}/></label><button className="btn primary span-2" disabled={busy}>{busy?'กำลังบันทึก...':'บันทึกเมนู'}</button></form></Modal>}
    {catModal&&<CategoryManager cats={cats} onClose={()=>setCatModal(false)} onChanged={load}/>}
  </>
}

function CategoryManager({cats,onClose,onChanged}){
  const [nameTh,setNameTh]=useState(''),[nameEn,setNameEn]=useState('')
  async function add(e){e.preventDefault();await createCategory({name_th:nameTh,name_en:nameEn||nameTh,sort_order:cats.length+1,is_active:true});setNameTh('');setNameEn('');await onChanged()}
  async function rename(cc){const n=prompt('ชื่อหมวดใหม่',cc.name_th);if(!n)return;await updateCategory(cc.id,{name_th:n});await onChanged()}
  async function remove(cc){if(confirm(`ลบหมวด ${cc.name_th}? ต้องไม่มีเมนูอยู่ในหมวดนี้ก่อน`)){try{await deleteCategory(cc.id);await onChanged()}catch(e){alert(e.message)}}}
  async function move(i,d){const n=i+d;if(n<0||n>=cats.length)return;const ids=cats.map(x=>x.id);[ids[i],ids[n]]=[ids[n],ids[i]];await reorderCategories(ids);await onChanged()}
  return <Modal title="จัดการหมวดหมู่" onClose={onClose}><form className="inline-form" onSubmit={add}><input required placeholder="ชื่อไทย" value={nameTh} onChange={e=>setNameTh(e.target.value)}/><input placeholder="English" value={nameEn} onChange={e=>setNameEn(e.target.value)}/><button className="btn primary">เพิ่ม</button></form><div className="simple-list">{cats.map((cc,i)=><div key={cc.id}><span><b>{cc.name_th}</b><small>{cc.name_en}</small></span><div><button onClick={()=>move(i,-1)}>↑</button><button onClick={()=>move(i,1)}>↓</button><button onClick={()=>rename(cc)}>แก้ชื่อ</button><button className="danger-text" onClick={()=>remove(cc)}>ลบ</button></div></div>)}</div></Modal>
}

export function TablesManager(){
  const [tables,setTables]=useState([]),[sessions,setSessions]=useState([]),[walkin,setWalkin]=useState(null),[move,setMove]=useState(null),[manage,setManage]=useState(null),[qrSession,setQrSession]=useState(null),[links,setLinks]=useState([])
  const [counts,setCounts]=useState({adult:2,child:0,free:0}),[loadError,setLoadError]=useState('')
  async function load(){
    const [tableResult,sessionResult]=await Promise.allSettled([listTables(),listActiveSessions()])
    if(tableResult.status==='fulfilled'){
      setTables(tableResult.value||[])
      setLoadError('')
    }else{
      setTables([])
      setLoadError(tableResult.reason?.message||'โหลดข้อมูลโต๊ะไม่สำเร็จ')
    }
    if(sessionResult.status==='fulfilled') setSessions(sessionResult.value||[])
    else setSessions([])
  }
  useEffect(()=>{load();return subscribeAll(load)},[])
  async function open(){try{const created=await openWalkin(walkin.id,counts.adult,counts.child,counts.free);setWalkin(null);setQrSession(created);setCounts({adult:2,child:0,free:0});await load()}catch(e){alert(e.message)}}
  async function moveNow(newId){try{await moveTableSession(move.id,newId);setMove(null);await load()}catch(e){alert(e.message)}}
  async function openManage(s){setManage({...s,adult_count:s.adult_count||s.guest_count||0,child_count:s.child_count||0,free_child_count:s.free_child_count||0});try{setLinks(await listSessionTableLinks(s.id))}catch{setLinks([])}}
  async function merge(tid){try{await mergeSessionTable(manage.id,tid);setLinks(await listSessionTableLinks(manage.id));await load()}catch(e){alert(e.message)}}
  async function detach(tid){try{await detachSessionTable(manage.id,tid);setLinks(await listSessionTableLinks(manage.id));await load()}catch(e){alert(e.message)}}
  async function saveGuests(){try{await updateSessionGuests(manage.id,manage.adult_count,manage.child_count,manage.free_child_count);setManage(null);await load()}catch(e){alert(e.message)}}
  async function regen(){if(!confirm('สร้าง QR ใหม่? QR เดิมจะใช้ไม่ได้ทันที'))return;try{const x=await regenerateSessionQr(qrSession.id);setQrSession(s=>({...s,token:x.token}));await load()}catch(e){alert(e.message)}}
  function downloadQr(){const canvas=document.getElementById('admin-table-qr');if(!canvas)return;const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=`QR-${qrSession.table_code||'table'}.png`;a.click()}
  const activeByTable=new Map(sessions.map(s=>[s.table_id,s]))
  const qrUrl=qrSession?.token?`${window.location.origin}/shabu-aroi-jang/table/${qrSession.token}`:''
  return <><Head eyebrow="TABLE OPERATIONS" title="จัดการโต๊ะขั้นสูง" desc="Walk-in, ย้าย/รวม/แยกโต๊ะ, ปรับจำนวนคน และจัดการ QR"/>
    {loadError&&<div className="alert warn table-load-error"><b>โหลดข้อมูลโต๊ะไม่สำเร็จ</b><span>{loadError}</span><button className="mini-btn" onClick={load}>ลองใหม่</button></div>}
    {!loadError&&!tables.length&&<div className="admin-card"><p className="muted">ยังไม่มีข้อมูลโต๊ะในระบบ</p></div>}
    <div className="floor-grid">{tables.map(t=>{const s=activeByTable.get(t.id);return <article className={`table-tile ${t.status}`} key={t.id}><div className="table-icon">🍲</div><h2>{t.code}</h2><p>{t.seats} ที่นั่ง</p><span className={`status status-${t.status}`}>{t.status}</span>{s&&<small>{s.guest_count} คน • {s.status}</small>}<div className="table-actions">{t.status==='available'&&<button className="mini-btn ok" onClick={()=>setWalkin(t)}>+ Walk-in</button>}{s&&<button className="mini-btn qr" onClick={()=>setQrSession(s)}>QR</button>}{s&&<button className="mini-btn" onClick={()=>setMove(s)}>ย้าย</button>}{s&&<button className="mini-btn" onClick={()=>openManage(s)}>จัดการ</button>}{t.status==='cleaning'&&<button className="mini-btn ok" onClick={async()=>{await markTableReady(t.id);load()}}>พร้อมใช้งาน</button>}</div></article>})}</div>
    {walkin&&<Modal title={`เปิดโต๊ะ ${walkin.code}`} onClose={()=>setWalkin(null)}><div className="pro-form"><label>ผู้ใหญ่<input type="number" min="0" value={counts.adult} onChange={e=>setCounts(x=>({...x,adult:Number(e.target.value)}))}/></label><label>เด็ก 90–120 ซม.<input type="number" min="0" value={counts.child} onChange={e=>setCounts(x=>({...x,child:Number(e.target.value)}))}/></label><label>เด็กต่ำกว่า 90 ซม.<input type="number" min="0" value={counts.free} onChange={e=>setCounts(x=>({...x,free:Number(e.target.value)}))}/></label><div className="span-2 total-preview">รวม {counts.adult+counts.child+counts.free} คน • ประมาณ {money(counts.adult*299+counts.child*149)}</div><button className="btn primary span-2" onClick={open}>เปิดโต๊ะและสร้าง QR</button></div></Modal>}
    {move&&<Modal title={`ย้ายโต๊ะ ${move.table_code}`} onClose={()=>setMove(null)}><div className="simple-list">{tables.filter(t=>t.status==='available'&&t.seats>=move.guest_count).map(t=><div key={t.id}><span><b>{t.code}</b><small>{t.seats} ที่นั่ง</small></span><button className="mini-btn ok" onClick={()=>moveNow(t.id)}>ย้ายมาที่นี่</button></div>)}</div></Modal>}
    {manage&&<Modal title={`จัดการ Session โต๊ะ ${manage.table_code}`} onClose={()=>setManage(null)}><div className="pro-form"><label>ผู้ใหญ่<input type="number" min="0" value={manage.adult_count} onChange={e=>setManage(x=>({...x,adult_count:Number(e.target.value)}))}/></label><label>เด็ก<input type="number" min="0" value={manage.child_count} onChange={e=>setManage(x=>({...x,child_count:Number(e.target.value)}))}/></label><label>เด็กฟรี<input type="number" min="0" value={manage.free_child_count} onChange={e=>setManage(x=>({...x,free_child_count:Number(e.target.value)}))}/></label><button className="btn primary" onClick={saveGuests}>บันทึกจำนวนคน</button></div><h3>โต๊ะที่รวมอยู่</h3><div className="simple-list">{links.map(l=><div key={l.table_id}><span><b>{l.restaurant_tables?.code}</b><small>{l.is_primary?'โต๊ะหลัก':'โต๊ะเสริม'}</small></span>{!l.is_primary&&<button className="danger-text" onClick={()=>detach(l.table_id)}>แยกโต๊ะ</button>}</div>)}</div><h3>รวมโต๊ะเพิ่ม</h3><div className="simple-list compact">{tables.filter(t=>t.status==='available').map(t=><div key={t.id}><span><b>{t.code}</b><small>{t.seats} ที่นั่ง</small></span><button className="mini-btn ok" onClick={()=>merge(t.id)}>+ รวม</button></div>)}</div></Modal>}
    {qrSession&&<Modal title={`QR โต๊ะ ${qrSession.table_code||'-'}`} onClose={()=>setQrSession(null)}><div className="admin-qr-box"><QRCodeCanvas id="admin-table-qr" value={qrUrl} size={260}/></div><p className="muted">Session นี้ใช้สั่งอาหาร เรียกพนักงาน และเช็คบิล</p><div className="qr-modal-actions"><a className="btn dark" href={qrUrl} target="_blank" rel="noreferrer">เปิดหน้าสั่งอาหาร</a><button className="btn ghost" onClick={()=>navigator.clipboard?.writeText(qrUrl)}>คัดลอกลิงก์</button><button className="btn ghost" onClick={downloadQr}>⬇ PNG</button><button className="btn ghost" onClick={()=>window.print()}>🖨 พิมพ์</button><button className="btn primary" onClick={regen}>↻ สร้าง QR ใหม่</button></div></Modal>}
  </>
}

export function BillingManager(){
  const [items,setItems]=useState([]),[edit,setEdit]=useState(null),[payQr,setPayQr]=useState(null),[slip,setSlip]=useState(null),[settings,setSettings]=useState(null)
  async function load(){const [b,s]=await Promise.all([listBills(),getSettings()]);setItems(b);setSettings(s)}
  useEffect(()=>{load();return subscribeAll(load)},[])
  async function saveBill(){try{await updateBillDetails(edit.id,edit);setEdit(null);await load()}catch(e){alert(e.message)}}
  async function pay(b,method){if(!confirm(`ยืนยันรับชำระ ${money(b.total)} ?`))return;try{const paid=await closeBill(b.id,method);await load();setPayQr(null);setTimeout(()=>printReceipt({...b,...paid}),100)}catch(e){alert(e.message)}}
  async function viewSlip(b){try{const url=await getSlipSignedUrl(b.slip_url);setSlip({...b,url})}catch(e){alert(e.message)}}
  async function review(b,status){try{await reviewPaymentSlip(b.id,status);setSlip(null);await load()}catch(e){alert(e.message)}}
  function receiptHtml(b){return `<div style="font-family:Arial,sans-serif;padding:24px;color:#222;width:360px"><div style="text-align:center"><h2 style="margin:4px">ชาบูอร่อยจัง</h2><div>${settings?.address_th||''}</div><div>โทร ${settings?.phone||''}</div><h3>${b.receipt_number||'ใบเสร็จ'}</h3></div><hr><p>โต๊ะ <b>${b.table_code||'-'}</b></p><p>ผู้ใหญ่ ${b.adult_count||0} × ${money(settings?.buffet_price||299)}</p><p>เด็ก ${b.child_count||0} × ${money(settings?.child_price||149)}</p><p>เด็กฟรี ${b.free_child_count||0}</p><p>เมนูเพิ่ม ${money(b.extra_total||0)}</p><p>ส่วนลด -${money(b.discount_amount||0)}</p><hr><h2>รวม ${money(b.total)}</h2><p>ชำระ: ${b.payment_method||'-'}</p><p style="text-align:center">ขอบคุณที่ใช้บริการ</p></div>`}
  function printReceipt(b){const w=window.open('','_blank','width=430,height=760');if(!w)return;w.document.write(`<html><head><title>${b.receipt_number||'Receipt'}</title></head><body>${receiptHtml(b)}<script>window.print()</script></body></html>`);w.document.close()}
  function pdfReceipt(b){const doc=new jsPDF({unit:'mm',format:[80,180]});doc.setFontSize(13);doc.text('SHABU AROI JANG',40,10,{align:'center'});doc.setFontSize(9);doc.text(String(b.receipt_number||'RECEIPT'),40,17,{align:'center'});doc.text(`Table: ${b.table_code||'-'}`,6,28);doc.text(`Adult: ${b.adult_count||0}`,6,36);doc.text(`Child: ${b.child_count||0}`,6,43);doc.text(`Extra: ${Number(b.extra_total||0).toFixed(2)} THB`,6,50);doc.text(`Discount: ${Number(b.discount_amount||0).toFixed(2)} THB`,6,57);doc.setFontSize(13);doc.text(`TOTAL: ${Number(b.total||0).toFixed(2)} THB`,6,68);doc.setFontSize(8);doc.text(`Payment: ${b.payment_method||'-'}`,6,77);doc.save(`${b.receipt_number||'receipt'}.pdf`)}
  const ppValue=payQr&&settings?.promptpay?promptPayPayload(settings.promptpay,payQr.total):''
  return <><Head eyebrow="CASHIER PRO" title="เช็คบิล / ชำระเงิน" desc="ผู้ใหญ่/เด็ก, Premium, Coupon, PromptPay QR, ตรวจสลิป, บัตร/EDC และใบเสร็จ PDF"/>
    <div className="billing-grid">{items.map(b=><article className={b.status} key={b.id}><div className="billing-top"><div><span>โต๊ะ</span><h2>{b.table_code||'-'}</h2></div><span className={`bill-state ${b.status}`}>{b.status==='paid'?'ชำระแล้ว':'รอชำระ'}</span></div><div className="bill-breakdown"><span>ผู้ใหญ่ <b>{b.adult_count||0}</b></span><span>เด็ก <b>{b.child_count||0}</b></span><span>เด็กฟรี <b>{b.free_child_count||0}</b></span></div><div className="bill-line"><span>ยอดสุทธิ</span><b>{money(b.total)}</b></div>{b.slip_url&&<button className={b.slip_status==='approved'?'pill-btn good':'pill-btn bad'} onClick={()=>viewSlip(b)}>สลิป: {b.slip_status||'pending'}</button>}{b.status==='pending'?<><button className="mini-btn qr wide-mini" onClick={()=>setEdit({...b,adult_count:b.adult_count||b.guest_count||0,child_count:b.child_count||0,free_child_count:b.free_child_count||0,discount_amount:b.discount_amount||0,promotion_code:b.promotion_code||'',note:b.note||''})}>แก้จำนวน / ส่วนลด</button><div className="pay-actions"><button onClick={()=>pay(b,'cash')}>💵 เงินสด</button><button onClick={()=>setPayQr(b)}>📱 PromptPay</button><button onClick={()=>pay(b,'bank_transfer')}>🏦 โอน</button><button onClick={()=>pay(b,'card')}>💳 บัตร / EDC</button></div></>:<><small>{b.receipt_number} • {b.payment_method} • {dt(b.paid_at)}</small><div className="row-actions receipt-actions"><button onClick={()=>printReceipt(b)}>🖨 พิมพ์</button><button onClick={()=>pdfReceipt(b)}>⬇ PDF</button></div></>}</article>)}</div>
    {edit&&<Modal title={`แก้บิลโต๊ะ ${edit.table_code}`} onClose={()=>setEdit(null)}><div className="pro-form"><label>ผู้ใหญ่<input type="number" min="0" value={edit.adult_count} onChange={e=>setEdit(x=>({...x,adult_count:Number(e.target.value)}))}/></label><label>เด็ก<input type="number" min="0" value={edit.child_count} onChange={e=>setEdit(x=>({...x,child_count:Number(e.target.value)}))}/></label><label>เด็กฟรี<input type="number" min="0" value={edit.free_child_count} onChange={e=>setEdit(x=>({...x,free_child_count:Number(e.target.value)}))}/></label><label>ส่วนลด<input type="number" min="0" value={edit.discount_amount} onChange={e=>setEdit(x=>({...x,discount_amount:Number(e.target.value)}))}/></label><label>Promo Code<input value={edit.promotion_code} onChange={e=>setEdit(x=>({...x,promotion_code:e.target.value.toUpperCase()}))}/></label><label>หมายเหตุ<input value={edit.note} onChange={e=>setEdit(x=>({...x,note:e.target.value}))}/></label><div className="span-2 total-preview">ประมาณ {money(edit.adult_count*Number(settings?.buffet_price||299)+edit.child_count*Number(settings?.child_price||149)+Number(edit.extra_total||0)-edit.discount_amount)}</div><button className="btn primary span-2" onClick={saveBill}>บันทึกบิล</button></div></Modal>}
    {payQr&&<Modal title={`PromptPay โต๊ะ ${payQr.table_code}`} onClose={()=>setPayQr(null)}><div className="admin-qr-box"><QRCodeSVG value={ppValue} size={260}/></div><h2 className="center-total">{money(payQr.total)}</h2><p className="muted">PromptPay {settings?.promptpay}</p>{payQr.slip_url&&<p>สลิป: <b>{payQr.slip_status}</b></p>}<button className="btn primary wide" onClick={()=>pay(payQr,'promptpay')}>ยืนยันรับเงินแล้ว</button></Modal>}
    {slip&&<Modal title="ตรวจสลิป" onClose={()=>setSlip(null)}><img className="slip-preview" src={slip.url} alt="payment slip"/><p>สถานะ: <b>{slip.slip_status}</b></p><div className="qr-modal-actions"><button className="btn primary" onClick={()=>review(slip,'approved')}>✓ ผ่าน</button><button className="btn danger" onClick={()=>review(slip,'rejected')}>✕ ไม่ผ่าน</button></div></Modal>}
  </>
}

export function ReportsPage(){
  const [data,setData]=useState({bills:[],orders:[],reviews:[]}),[period,setPeriod]=useState('month')
  useEffect(()=>{getReports().then(setData)},[])
  const now=new Date()
  const since=period==='day'?new Date(now.getFullYear(),now.getMonth(),now.getDate()):period==='week'?new Date(now.getTime()-7*86400000):period==='month'?new Date(now.getFullYear(),now.getMonth(),1):new Date(0)
  const bills=data.bills.filter(b=>new Date(b.paid_at||b.created_at)>=since)
  const orders=data.orders.filter(o=>new Date(o.created_at)>=since)
  const total=bills.reduce((s,b)=>s+Number(b.total||0),0),customers=bills.reduce((s,b)=>s+Number(b.guest_count||0),0),avgBill=bills.length?total/bills.length:0
  const itemMap={},hourMap={}
  orders.forEach(o=>{hourMap[new Date(o.created_at).getHours()]=(hourMap[new Date(o.created_at).getHours()]||0)+1;(o.food_order_items||[]).forEach(i=>{itemMap[i.item_name_th]=(itemMap[i.item_name_th]||0)+Number(i.quantity||0)})})
  const top=Object.entries(itemMap).sort((a,b)=>b[1]-a[1]).slice(0,10),hours=Object.entries(hourMap).sort((a,b)=>a[0]-b[0]),maxHour=Math.max(1,...hours.map(x=>x[1]))
  const daily={}
  bills.forEach(b=>{const k=new Date(b.paid_at).toLocaleDateString('th-TH');daily[k]=(daily[k]||0)+Number(b.total||0)})
  const dailyRows=Object.entries(daily),maxDaily=Math.max(1,...dailyRows.map(x=>x[1]))
  function exportCsv(){const rows=[['receipt','paid_at','guests','adult','child','extra','discount','total','payment'],...bills.map(b=>[b.receipt_number||'',b.paid_at||'',b.guest_count,b.adult_count,b.child_count,b.extra_total,b.discount_amount,b.total,b.payment_method])];const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='shabu-sales.csv';a.click()}
  function exportExcel(){const rows=bills.map(b=>({Receipt:b.receipt_number,Date:b.paid_at,Guests:b.guest_count,Adult:b.adult_count,Child:b.child_count,Extra:b.extra_total,Discount:b.discount_amount,Total:b.total,Payment:b.payment_method}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Sales');XLSX.writeFile(wb,'shabu-sales.xlsx')}
  return <><Head eyebrow="REPORTS" title="รายงานยอดขาย" desc="รายวัน / 7 วัน / เดือน / ทั้งหมด พร้อม CSV และ Excel" action={<div className="head-actions"><button className="btn ghost" onClick={exportCsv}>CSV</button><button className="btn primary" onClick={exportExcel}>Excel</button></div>}/><div className="filter-row">{[['day','วันนี้'],['week','7 วัน'],['month','เดือนนี้'],['all','ทั้งหมด']].map(([v,l])=><button key={v} className={period===v?'active':''} onClick={()=>setPeriod(v)}>{l}</button>)}</div><div className="stat-grid report-stats"><div className="stat-card"><span>฿</span><div><small>ยอดขาย</small><b>{money(total)}</b></div></div><div className="stat-card"><span>🧾</span><div><small>บิล</small><b>{bills.length}</b></div></div><div className="stat-card"><span>👥</span><div><small>ลูกค้า</small><b>{customers}</b></div></div><div className="stat-card"><span>📊</span><div><small>เฉลี่ย/บิล</small><b>{money(avgBill)}</b></div></div></div><div className="admin-grid two"><section className="admin-card"><h2>กราฟรายได้</h2><div className="bar-chart">{dailyRows.slice(-14).map(([d,v])=><div key={d}><span>{d}</span><i style={{width:`${Math.max(3,v/maxDaily*100)}%`}}></i><b>{money(v)}</b></div>)}</div></section><section className="admin-card"><h2>Order ต่อชั่วโมง</h2><div className="bar-chart">{hours.map(([h,v])=><div key={h}><span>{String(h).padStart(2,'0')}:00</span><i style={{width:`${Math.max(3,v/maxHour*100)}%`}}></i><b>{v}</b></div>)}</div></section><section className="admin-card"><h2>เมนูยอดนิยม</h2><div className="rank-list">{top.map(([name,q],i)=><div key={name}><b>#{i+1}</b><span>{name}</span><strong>{q}</strong></div>)}</div></section><section className="admin-card"><h2>บิลล่าสุด</h2><div className="simple-list">{bills.slice(0,12).map(b=><div key={b.id}><span><b>{b.receipt_number||'Receipt'}</b><small>{dt(b.paid_at)}</small></span><strong>{money(b.total)}</strong></div>)}</div></section></div></>
}

export function CustomersPage(){
  const [items,setItems]=useState([]),[q,setQ]=useState(''),[detail,setDetail]=useState(null)
  useEffect(()=>{listCustomers().then(setItems)},[])
  const list=items.filter(x=>`${x.customer_name} ${x.customer_phone}`.toLowerCase().includes(q.toLowerCase()))
  return <><Head eyebrow="CUSTOMERS" title="ลูกค้า" desc="จำนวนครั้งที่มา ยอดใช้จ่าย Booking history และรีวิว"/><div className="admin-card"><input className="admin-search" placeholder="ค้นหาชื่อหรือเบอร์..." value={q} onChange={e=>setQ(e.target.value)}/><div className="table-scroll"><table><thead><tr><th>ลูกค้า</th><th>เบอร์</th><th>การจอง</th><th>มาใช้บริการ</th><th>ยอดใช้จ่าย</th><th>ล่าสุด</th><th></th></tr></thead><tbody>{list.map(x=><tr key={x.customer_phone}><td><b>{x.customer_name}</b></td><td>{x.customer_phone}</td><td>{x.reservations}</td><td>{x.visits}</td><td>{money(x.total_spend)}</td><td>{dt(x.last_seen)}</td><td><button className="mini-btn qr" onClick={()=>setDetail(x)}>ดูประวัติ</button></td></tr>)}</tbody></table></div></div>{detail&&<Modal title={`${detail.customer_name} • ${detail.customer_phone}`} onClose={()=>setDetail(null)}><div className="stat-grid mini-stats"><div className="stat-card"><span>🍲</span><div><small>มาใช้บริการ</small><b>{detail.visits}</b></div></div><div className="stat-card"><span>฿</span><div><small>ยอดรวม</small><b>{money(detail.total_spend)}</b></div></div></div><h3>ประวัติการจอง</h3><div className="simple-list">{detail.history.map(h=><div key={h.id}><span><b>{h.reservation_date} • {String(h.reservation_time||'').slice(0,5)}</b><small>{h.guest_count} คน • {h.status}</small></span><strong>{money(h.total||0)}</strong></div>)}</div><h3>รีวิวที่ผ่านมา</h3><div className="reviews-grid one-col">{detail.reviews.map((r,i)=><article key={i}><div className="stars">{'★'.repeat(Number(r.overall||0))}{'☆'.repeat(5-Number(r.overall||0))}</div><p>{r.comment||'ไม่มีความคิดเห็น'}</p><small>{dt(r.created_at)}</small></article>)}{!detail.reviews.length&&<p className="muted">ยังไม่มีรีวิว</p>}</div></Modal>}</>
}

export function StaffPage(){
  const [items,setItems]=useState([]),[adding,setAdding]=useState(false),[busy,setBusy]=useState(false)
  const [form,setForm]=useState({email:'',password:'',display_name:'',role:'staff'})
  async function load(){setItems(await listProfiles())}
  useEffect(()=>{load()},[])
  async function patch(id,p){try{await updateProfile(id,p);await load()}catch(e){alert(e.message)}}
  async function create(e){e.preventDefault();setBusy(true);try{await createStaffAccount(form.email,form.password,form.display_name,form.role);setAdding(false);setForm({email:'',password:'',display_name:'',role:'staff'});await load();alert('สร้างบัญชีพนักงานแล้ว')}catch(err){alert(err.message)}finally{setBusy(false)}}
  return <><Head eyebrow="STAFF & ROLES" title="พนักงานและสิทธิ์" desc="สร้าง Login จากหลังบ้าน กำหนด Role และปิด/เปิดบัญชี" action={<button className="btn primary" onClick={()=>setAdding(true)}>+ เพิ่มพนักงาน</button>}/><div className="admin-card"><div className="table-scroll"><table><thead><tr><th>ชื่อ</th><th>Email</th><th>Role</th><th>สถานะ</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td><b>{x.display_name||'-'}</b></td><td>{x.email}</td><td><select value={x.role} disabled={x.role==='owner'} onChange={e=>patch(x.id,{role:e.target.value})}><option>owner</option><option>manager</option><option>cashier</option><option>kitchen</option><option>staff</option></select></td><td><button disabled={x.role==='owner'} className={x.is_active?'pill-btn good':'pill-btn bad'} onClick={()=>patch(x.id,{is_active:!x.is_active})}>{x.is_active?'ใช้งาน':'ปิดบัญชี'}</button></td></tr>)}</tbody></table></div><div className="role-help"><b>Owner</b> ทุกระบบ • <b>Manager</b> บริหารร้าน • <b>Cashier</b> จอง/โต๊ะ/บิล • <b>Kitchen</b> ครัว • <b>Staff</b> โต๊ะ/บริการ</div></div>
    {adding&&<Modal title="เพิ่มพนักงาน" onClose={()=>setAdding(false)}><form className="pro-form" onSubmit={create}><label>Email<input type="email" required value={form.email} onChange={e=>setForm(x=>({...x,email:e.target.value}))}/></label><label>Password<input type="password" minLength="8" required value={form.password} onChange={e=>setForm(x=>({...x,password:e.target.value}))}/></label><label>ชื่อแสดง<input required value={form.display_name} onChange={e=>setForm(x=>({...x,display_name:e.target.value}))}/></label><label>Role<select value={form.role} onChange={e=>setForm(x=>({...x,role:e.target.value}))}><option value="manager">Manager</option><option value="cashier">Cashier</option><option value="kitchen">Kitchen</option><option value="staff">Staff</option></select></label><button className="btn primary span-2" disabled={busy}>{busy?'กำลังสร้าง...':'สร้างบัญชีพนักงาน'}</button></form></Modal>}
  </>
}

export function PromotionsPage(){
  const [items,setItems]=useState([]),[edit,setEdit]=useState(null)
  async function load(){setItems(await listPromotions())}
  useEffect(()=>{load()},[])
  const blank={code:'',name:'',description:'',discount_type:'fixed',discount_value:0,is_active:true,start_at:'',end_at:'',birthday_only:false,min_guest_count:1,start_time:'',end_time:'',weekdays:[0,1,2,3,4,5,6]}
  async function save(e){e.preventDefault();const p={...edit,code:edit.code.toUpperCase(),discount_value:Number(edit.discount_value||0),min_guest_count:Number(edit.min_guest_count||1),start_at:edit.start_at?new Date(edit.start_at).toISOString():null,end_at:edit.end_at?new Date(edit.end_at).toISOString():null,start_time:edit.start_time||null,end_time:edit.end_time||null};delete p.id;if(edit.id)await updatePromotion(edit.id,p);else await createPromotion(p);setEdit(null);await load()}
  return <><Head eyebrow="PROMOTIONS" title="โปรโมชั่น" desc="Coupon, วันเกิด, ช่วงเวลา, วันในสัปดาห์ และขั้นต่ำจำนวนคน" action={<button className="btn primary" onClick={()=>setEdit({...blank})}>+ โปรโมชั่น</button>}/><div className="admin-card"><div className="simple-list">{items.map(x=><div key={x.id}><span><b>{x.code} • {x.name}</b><small>{x.discount_type==='percent'?`${x.discount_value}%`:money(x.discount_value)} • ขั้นต่ำ {x.min_guest_count||1} คน{x.birthday_only?' • วันเกิด':''} • {x.is_active?'เปิด':'ปิด'}</small></span><div><button onClick={()=>setEdit({...blank,...x,start_at:x.start_at?x.start_at.slice(0,16):'',end_at:x.end_at?x.end_at.slice(0,16):''})}>แก้ไข</button><button className="danger-text" onClick={async()=>{if(confirm('ลบโปรโมชั่น?')){await deletePromotion(x.id);load()}}}>ลบ</button></div></div>)}</div></div>{edit&&<Modal title={edit.id?'แก้โปรโมชั่น':'เพิ่มโปรโมชั่น'} onClose={()=>setEdit(null)}><form className="pro-form" onSubmit={save}><label>Code<input required value={edit.code} onChange={e=>setEdit(x=>({...x,code:e.target.value}))}/></label><label>ชื่อ<input required value={edit.name} onChange={e=>setEdit(x=>({...x,name:e.target.value}))}/></label><label>ประเภท<select value={edit.discount_type} onChange={e=>setEdit(x=>({...x,discount_type:e.target.value}))}><option value="fixed">ลดเป็นบาท</option><option value="percent">ลดเปอร์เซ็นต์</option></select></label><label>ส่วนลด<input type="number" min="0" required value={edit.discount_value} onChange={e=>setEdit(x=>({...x,discount_value:e.target.value}))}/></label><label>จำนวนคนขั้นต่ำ<input type="number" min="1" value={edit.min_guest_count||1} onChange={e=>setEdit(x=>({...x,min_guest_count:e.target.value}))}/></label><label className="check"><input type="checkbox" checked={!!edit.birthday_only} onChange={e=>setEdit(x=>({...x,birthday_only:e.target.checked}))}/> โปรวันเกิด</label><label>เริ่มวันที่<input type="datetime-local" value={edit.start_at||''} onChange={e=>setEdit(x=>({...x,start_at:e.target.value}))}/></label><label>หมดอายุ<input type="datetime-local" value={edit.end_at||''} onChange={e=>setEdit(x=>({...x,end_at:e.target.value}))}/></label><label>เริ่มเวลา<input type="time" value={edit.start_time||''} onChange={e=>setEdit(x=>({...x,start_time:e.target.value}))}/></label><label>สิ้นสุดเวลา<input type="time" value={edit.end_time||''} onChange={e=>setEdit(x=>({...x,end_time:e.target.value}))}/></label><label className="check"><input type="checkbox" checked={!!edit.is_active} onChange={e=>setEdit(x=>({...x,is_active:e.target.checked}))}/> เปิดใช้งาน</label><label className="span-2">รายละเอียด<textarea value={edit.description||''} onChange={e=>setEdit(x=>({...x,description:e.target.value}))}/></label><button className="btn primary span-2">บันทึกโปรโมชั่น</button></form></Modal>}</>
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
  const freq={}
  items.forEach(x=>{const k=String(x.customer_message||'').trim().toLowerCase();if(k)freq[k]=(freq[k]||0)+1})
  const popular=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8)
  return <><Head eyebrow="AI CHAT HISTORY" title="ประวัติ AI Chat" desc="คำถามล่าสุดและคำถามยอดนิยม"/><div className="admin-grid two"><section className="admin-card"><h2>คำถามยอดนิยม</h2><div className="rank-list">{popular.map(([t,n],i)=><div key={t}><b>#{i+1}</b><span>{t}</span><strong>{n}</strong></div>)}</div></section><section className="admin-card"><input className="admin-search" placeholder="ค้นหาคำถาม..." value={q} onChange={e=>setQ(e.target.value)}/><div className="chat-history-list">{filtered.map(x=><article key={x.id}><div><small>{dt(x.created_at)}</small><b>ลูกค้า: {x.customer_message}</b></div><p>AI: {x.assistant_message||'-'}</p></article>)}</div>{!filtered.length&&<p className="muted">ยังไม่มีประวัติ AI Chat</p>}</section></div></>
}

export function KnowledgeBasePage(){
  const [items,setItems]=useState([]),[edit,setEdit]=useState(null)
  async function load(){setItems(await listKnowledgeBase())}
  useEffect(()=>{load()},[])
  async function save(e){e.preventDefault();const p={question:edit.question,answer:edit.answer,keywords:String(edit.keywords_text||'').split(',').map(x=>x.trim()).filter(Boolean),is_active:!!edit.is_active,sort_order:Number(edit.sort_order||items.length+1)};if(edit.id)await updateKnowledge(edit.id,p);else await createKnowledge(p);setEdit(null);await load()}
  return <><Head eyebrow="AI KNOWLEDGE BASE" title="ความรู้สำหรับ AI" desc="เพิ่มคำถาม/คำตอบและคีย์เวิร์ดที่ AI ใช้ตอบลูกค้าแบบ Dynamic" action={<button className="btn primary" onClick={()=>setEdit({question:'',answer:'',keywords_text:'',is_active:true,sort_order:items.length+1})}>+ เพิ่มข้อมูล</button>}/><div className="admin-card"><div className="simple-list">{items.map(x=><div key={x.id}><span><b>{x.question}</b><small>{x.answer.slice(0,120)}{x.answer.length>120?'…':''}</small></span><div><button onClick={()=>setEdit({...x,keywords_text:(x.keywords||[]).join(', ')})}>แก้ไข</button><button className="danger-text" onClick={async()=>{if(confirm('ลบข้อมูลนี้?')){await deleteKnowledge(x.id);load()}}}>ลบ</button></div></div>)}</div></div>{edit&&<Modal title={edit.id?'แก้ Knowledge':'เพิ่ม Knowledge'} onClose={()=>setEdit(null)}><form className="pro-form" onSubmit={save}><label className="span-2">คำถาม / หัวข้อ<input required value={edit.question} onChange={e=>setEdit(x=>({...x,question:e.target.value}))}/></label><label className="span-2">คำตอบ<textarea required rows="8" value={edit.answer} onChange={e=>setEdit(x=>({...x,answer:e.target.value}))}/></label><label className="span-2">Keywords (คั่นด้วย ,)<input value={edit.keywords_text||''} onChange={e=>setEdit(x=>({...x,keywords_text:e.target.value}))}/></label><label>ลำดับ<input type="number" value={edit.sort_order} onChange={e=>setEdit(x=>({...x,sort_order:e.target.value}))}/></label><label className="check"><input type="checkbox" checked={!!edit.is_active} onChange={e=>setEdit(x=>({...x,is_active:e.target.checked}))}/> เปิดใช้งาน</label><button className="btn primary span-2">บันทึก</button></form></Modal>}</>
}

export function ReviewsAdvancedPage(){
  const [items,setItems]=useState([])
  const [star,setStar]=useState('all')

  async function load(){
    setItems(await listReviews())
  }

  useEffect(()=>{
    load()
    return subscribeAll(load)
  },[])

  const list=items.filter(x=>star==='all'||Number(x.overall)===Number(star))
  const avg=(key)=>{
    if(!items.length) return '-'
    return (items.reduce((sum,x)=>sum+Number(x[key]||0),0)/items.length).toFixed(2)
  }

  function exportCsv(){
    const rows=[
      ['date','overall','taste','freshness','service','cleanliness','value','comment','flagged'],
      ...list.map(x=>[
        x.created_at,x.overall,x.taste,x.freshness,x.service,
        x.cleanliness,x.value,x.comment,x.is_flagged
      ])
    ]
    const csv=rows
      .map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(','))
      .join('\n')
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}))
    a.download='shabu-reviews.csv'
    a.click()
  }

  async function toggleFlag(review){
    await updateReviewAdmin(review.id,{
      is_flagged:!review.is_flagged,
      flag_note:!review.is_flagged?'Manager ติดตาม':''
    })
    await load()
  }

  return <>
    <Head
      eyebrow="REVIEWS ANALYTICS"
      title="รีวิวลูกค้า"
      desc="กรองดาว วิเคราะห์รายหัวข้อ Export และติดตามรีวิวต่ำ"
      action={<button className="btn primary" onClick={exportCsv}>Export CSV</button>}
    />

    <div className="filter-row">
      {['all',5,4,3,2,1].map(v=>(
        <button
          key={v}
          className={String(star)===String(v)?'active':''}
          onClick={()=>setStar(v)}
        >
          {v==='all'?'ทั้งหมด':`${v} ดาว`}
        </button>
      ))}
    </div>

    <div className="stat-grid review-stats">
      {[
        ['overall','รวม'],['taste','รสชาติ'],['freshness','ความสด'],
        ['service','บริการ'],['cleanliness','ความสะอาด'],['value','ความคุ้มค่า']
      ].map(([key,label])=>(
        <div className="stat-card" key={key}>
          <span>★</span>
          <div><small>{label}</small><b>{avg(key)}</b></div>
        </div>
      ))}
    </div>

    <div className="reviews-grid">
      {list.map(review=>(
        <article key={review.id} className={review.is_flagged?'review-flagged':''}>
          <div className="stars">
            {'★'.repeat(Number(review.overall||0))}
            {'☆'.repeat(Math.max(0,5-Number(review.overall||0)))}
          </div>
          <p>{review.comment||'ไม่มีความคิดเห็นเพิ่มเติม'}</p>
          <small>{dt(review.created_at)}</small>
          <div className="score-mini">
            รส {review.taste} • สด {review.freshness} • บริการ {review.service}
            {' • '}สะอาด {review.cleanliness} • คุ้ม {review.value}
          </div>
          <button
            className={review.is_flagged?'pill-btn bad':'pill-btn good'}
            onClick={()=>toggleFlag(review)}
          >
            {review.is_flagged?'⚑ ต้องติดตาม':'✓ ปกติ'}
          </button>
        </article>
      ))}
    </div>
  </>
}

export function ReservationTools(){
  const [busy,setBusy]=useState(false)
  async function expire(){setBusy(true);try{const n=await expireReservations();alert(`หมดอายุ ${n||0} รายการ`)}finally{setBusy(false)}}
  return <button className="btn ghost" disabled={busy} onClick={expire}>⏱ ตรวจการจองที่เลยเวลา</button>
}
