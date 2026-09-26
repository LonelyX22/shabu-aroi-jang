import { useEffect, useState } from 'react'
import { listOrders, subscribeAll, updateOrderStatus } from '../lib/api'

const dt=(v)=>v?new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'-'

export default function KitchenAdminPro(){
  const [items,setItems]=useState([]),[filter,setFilter]=useState('active'),[station,setStation]=useState('all'),[clock,setClock]=useState(Date.now())
  async function load(){setItems(await listOrders())}
  useEffect(()=>{load();const off=subscribeAll(load),id=setInterval(()=>setClock(Date.now()),30000);return()=>{off();clearInterval(id)}},[])
  const stations=['all',...new Set(items.flatMap(o=>(o.items||[]).map(i=>i.station||'kitchen')))]
  const list=items.filter(o=>(filter==='all'||(filter==='active'?!['served','cancelled'].includes(o.status):o.status===filter))&&(station==='all'||(o.items||[]).some(i=>(i.station||'kitchen')===station)))
  async function move(o,status){try{await updateOrderStatus(o.id,status);await load()}catch(e){alert(e.message)}}
  return <><div className="admin-head"><div><span className="eyebrow">KITCHEN DISPLAY</span><h1>Kitchen / Orders</h1><p>แยก Station จับเวลารอ เตือน Order ช้า และระบบเสิร์ฟ</p></div><button className="btn dark" onClick={()=>document.documentElement.requestFullscreen?.()}>⛶ Full screen</button></div>
  <div className="filter-row">{[['active','กำลังทำ'],['pending','รอรับ'],['accepted','รับแล้ว'],['preparing','กำลังเตรียม'],['ready','พร้อมเสิร์ฟ'],['serving','กำลังเสิร์ฟ'],['served','เสิร์ฟแล้ว'],['all','ทั้งหมด']].map(([v,l])=><button className={filter===v?'active':''} key={v} onClick={()=>setFilter(v)}>{l}</button>)}</div>
  <div className="filter-row">{stations.map(s=><button className={station===s?'active':''} key={s} onClick={()=>setStation(s)}>{s==='all'?'ทุก Station':s}</button>)}</div>
  <div className="kitchen-grid">{list.map(o=>{const mins=Math.max(0,Math.floor((clock-new Date(o.created_at).getTime())/60000)),slow=mins>=15&&!['served','cancelled'].includes(o.status);return <article className={'kitchen-card '+o.status+(slow?' slow':'')} key={o.id}><div className="kitchen-head"><div><span>โต๊ะ</span><h2>{o.table_code||'-'}</h2></div><span className={'status status-'+o.status}>{o.status}</span></div><div className={slow?'order-timer danger-text':'order-timer'}>⏱ {mins} นาที {slow?'• ช้า':''}</div><small>{o.order_number} • {dt(o.created_at)}</small><ul>{(o.items||[]).filter(i=>station==='all'||(i.station||'kitchen')===station).map((i,k)=><li key={i.id||k}><span><b>{i.item_name_th||i.name_th||'เมนู'}</b><small>{i.station||'kitchen'}</small></span><strong>× {i.quantity}</strong></li>)}</ul><div className="kitchen-actions">{['accepted','preparing','ready','serving','served'].map(s=><button key={s} disabled={o.status===s} className={o.status===s?'current':''} onClick={()=>move(o,s)}>{({accepted:'รับแล้ว',preparing:'กำลังเตรียม',ready:'พร้อมเสิร์ฟ',serving:'รับไปเสิร์ฟ',served:'เสิร์ฟแล้ว'})[s]}</button>)}</div>{o.served_at&&<small>เสิร์ฟ {dt(o.served_at)} • Staff {String(o.served_by||'').slice(0,8)}</small>}</article>})}{!list.length&&<div className="empty admin-empty"><h2>ไม่มี Order ในสถานะนี้</h2></div>}</div></>
}
