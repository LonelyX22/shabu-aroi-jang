import { useEffect, useState } from 'react'
import { listCustomers } from '../lib/api'

const money=(n)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n||0))
const dt=(v)=>v?new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'-'
function Modal({title,onClose,children}){return <div className="modal-backdrop" onClick={onClose}><div className="pro-modal wide" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h2>{title}</h2>{children}</div></div>}

export default function CustomersAdminPro(){
  const [items,setItems]=useState([]),[q,setQ]=useState(''),[detail,setDetail]=useState(null)
  useEffect(()=>{listCustomers().then(setItems)},[])
  const list=items.filter(x=>(x.customer_name+' '+x.customer_phone).toLowerCase().includes(q.toLowerCase()))
  return <><div className="admin-head"><div><span className="eyebrow">CUSTOMERS</span><h1>ลูกค้า</h1><p>จำนวนครั้งที่มา ยอดใช้จ่าย Booking history และรีวิว</p></div></div><div className="admin-card"><input className="admin-search" placeholder="ค้นหาชื่อหรือเบอร์..." value={q} onChange={e=>setQ(e.target.value)}/><div className="table-scroll"><table><thead><tr><th>ลูกค้า</th><th>เบอร์</th><th>การจอง</th><th>มาใช้บริการ</th><th>ยอดใช้จ่าย</th><th>ล่าสุด</th><th></th></tr></thead><tbody>{list.map(x=><tr key={x.customer_phone}><td><b>{x.customer_name}</b></td><td>{x.customer_phone}</td><td>{x.reservations}</td><td>{x.visits}</td><td>{money(x.total_spend)}</td><td>{dt(x.last_seen)}</td><td><button className="mini-btn qr" onClick={()=>setDetail(x)}>ประวัติ</button></td></tr>)}</tbody></table></div></div>{detail&&<Modal title={'ประวัติ '+detail.customer_name} onClose={()=>setDetail(null)}><h3>Booking history</h3><div className="simple-list">{detail.history.map((h,i)=><div key={i}><span><b>{h.reservation_date} {String(h.reservation_time).slice(0,5)}</b><small>{h.status} • {h.guest_count} คน</small></span><strong>{money(h.total||0)}</strong></div>)}</div><h3>รีวิวที่ผ่านมา</h3><div className="simple-list">{detail.reviews.length?detail.reviews.map((r,i)=><div key={i}><span><b>{'★'.repeat(Number(r.overall||0))}</b><small>{r.comment||'ไม่มีข้อความ'} • {dt(r.created_at)}</small></span></div>):<p className="muted">ยังไม่มีรีวิว</p>}</div></Modal>}</>
}
