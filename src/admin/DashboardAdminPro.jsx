import { useEffect, useState } from 'react'
import { getReports, listReservations, listServiceCalls, listTables, subscribeAll } from '../lib/api'

const money=(n)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n||0))
const dayKey=(v)=>new Date(v).toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})

export default function DashboardAdminPro(){
  const [reports,setReports]=useState({bills:[],orders:[],reviews:[],sessions:[]}),[tables,setTables]=useState([]),[reservations,setReservations]=useState([]),[calls,setCalls]=useState([])
  async function load(){const [r,t,rv,c]=await Promise.all([getReports(),listTables(),listReservations(),listServiceCalls()]);setReports(r);setTables(t);setReservations(rv);setCalls(c)}
  useEffect(()=>{load();return subscribeAll(load)},[])
  const today=dayKey(new Date()),bills=reports.bills.filter(b=>dayKey(b.paid_at)===today),orders=reports.orders.filter(o=>dayKey(o.created_at)===today)
  const sales=bills.reduce((s,b)=>s+Number(b.total||0),0),customers=bills.reduce((s,b)=>s+Number(b.guest_count||0),0)
  const hourly={};orders.forEach(o=>{const h=new Date(o.created_at).toLocaleTimeString('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit'});hourly[h]=(hourly[h]||0)+1})
  const hourRows=Object.entries(hourly).sort((a,b)=>a[0].localeCompare(b[0])),max=Math.max(1,...hourRows.map(x=>x[1]))
  const itemMap={};orders.forEach(o=>(o.food_order_items||[]).forEach(i=>itemMap[i.item_name_th]=(itemMap[i.item_name_th]||0)+Number(i.quantity||0)))
  const top=Object.entries(itemMap).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const turn={};reports.sessions.forEach(s=>{const code=s.restaurant_tables?.code||'-',mins=(new Date(s.closed_at)-new Date(s.started_at||s.closed_at))/60000;(turn[code]||(turn[code]=[])).push(mins)})
  const fastest=Object.entries(turn).map(([k,v])=>[k,v.reduce((a,b)=>a+b,0)/v.length]).sort((a,b)=>a[1]-b[1])[0]
  return <><div className="admin-head"><div><span className="eyebrow">LIVE BUSINESS</span><h1>Dashboard</h1><p>ยอดขายวันนี้ สถานะร้าน และการทำงานแบบ Realtime</p></div></div><div className="stat-grid"><div className="stat-card"><span>฿</span><div><small>ยอดขายวันนี้</small><b>{money(sales)}</b></div></div><div className="stat-card"><span>👥</span><div><small>ลูกค้าวันนี้</small><b>{customers}</b></div></div><div className="stat-card"><span>🧾</span><div><small>บิลวันนี้</small><b>{bills.length}</b></div></div><div className="stat-card"><span>🍲</span><div><small>Orders วันนี้</small><b>{orders.length}</b></div></div><div className="stat-card"><span>🟢</span><div><small>โต๊ะว่าง</small><b>{tables.filter(x=>x.status==='available').length}</b></div></div><div className="stat-card"><span>◷</span><div><small>จองรอยืนยัน</small><b>{reservations.filter(x=>x.status==='pending').length}</b></div></div><div className="stat-card"><span>🔔</span><div><small>เรียกพนักงาน</small><b>{calls.filter(x=>x.status!=='done').length}</b></div></div></div><div className="admin-grid two"><section className="admin-card"><h2>Order ต่อชั่วโมง</h2><div className="bar-chart compact">{hourRows.map(([h,v])=><div key={h}><span style={{height:Math.max(8,Math.round(v/max*130))}}></span><small>{h}:00</small><b>{v}</b></div>)}</div></section><section className="admin-card"><h2>เมนูยอดนิยมวันนี้</h2><div className="rank-list">{top.map(([n,q],i)=><div key={n}><b>#{i+1}</b><span>{n}</span><strong>{q}</strong></div>)}</div><h3>โต๊ะหมุนเร็วสุด</h3><div className="big-metric">{fastest?fastest[0]:'-'}</div><p className="muted">{fastest?Math.round(fastest[1])+' นาที/รอบ':'ยังไม่มีข้อมูล'}</p></section></div></>
}
