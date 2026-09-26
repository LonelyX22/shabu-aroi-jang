import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { getReports } from '../lib/api'

const money=(n)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n||0))
const dayKey=(v)=>new Date(v).toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})

export default function ReportsAdminPro(){
  const [data,setData]=useState({bills:[],orders:[],reviews:[],sessions:[]}),[period,setPeriod]=useState('month')
  useEffect(()=>{getReports().then(setData)},[])
  const start=useMemo(()=>{const d=new Date();if(period==='today'){d.setHours(0,0,0,0);return d}if(period==='week'){d.setDate(d.getDate()-7);return d}if(period==='month'){d.setMonth(d.getMonth()-1);return d}return new Date(0)},[period])
  const bills=data.bills.filter(b=>new Date(b.paid_at)>=start),orders=data.orders.filter(o=>new Date(o.created_at)>=start),sessions=data.sessions.filter(s=>new Date(s.closed_at)>=start)
  const total=bills.reduce((s,b)=>s+Number(b.total||0),0),customers=bills.reduce((s,b)=>s+Number(b.guest_count||0),0),avgBill=bills.length?total/bills.length:0
  const itemMap={};orders.forEach(o=>(o.food_order_items||[]).forEach(i=>itemMap[i.item_name_th]=(itemMap[i.item_name_th]||0)+Number(i.quantity||0)))
  const top=Object.entries(itemMap).sort((a,b)=>b[1]-a[1]).slice(0,10)
  const hourMap={};orders.forEach(o=>{const h=new Date(o.created_at).toLocaleTimeString('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit'});hourMap[h]=(hourMap[h]||0)+1})
  const busyHour=Object.entries(hourMap).sort((a,b)=>b[1]-a[1])[0]
  const turnAvg=sessions.length?sessions.reduce((s,x)=>s+(new Date(x.closed_at)-new Date(x.started_at||x.closed_at))/60000,0)/sessions.length:0
  const daily={};bills.forEach(b=>{const k=dayKey(b.paid_at);daily[k]=(daily[k]||0)+Number(b.total||0)});const days=Object.entries(daily).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14),max=Math.max(1,...days.map(x=>x[1]))
  function exportExcel(){const rows=bills.map(b=>({Receipt:b.receipt_number,PaidAt:b.paid_at,Guests:b.guest_count,Total:Number(b.total),Payment:b.payment_method})),ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Sales');XLSX.writeFile(wb,'shabu-sales.xlsx')}
  return <><div className="admin-head"><div><span className="eyebrow">REPORTS</span><h1>รายงานยอดขาย</h1><p>รายวัน / 7 วัน / 30 วัน / ทั้งหมด พร้อม Excel</p></div><button className="btn primary" onClick={exportExcel}>Export Excel</button></div><div className="filter-row">{[['today','วันนี้'],['week','7 วัน'],['month','30 วัน'],['all','ทั้งหมด']].map(([v,l])=><button key={v} className={period===v?'active':''} onClick={()=>setPeriod(v)}>{l}</button>)}</div><div className="stat-grid report-stats"><div className="stat-card"><span>฿</span><div><small>ยอดขาย</small><b>{money(total)}</b></div></div><div className="stat-card"><span>🧾</span><div><small>บิล</small><b>{bills.length}</b></div></div><div className="stat-card"><span>👥</span><div><small>ลูกค้า</small><b>{customers}</b></div></div><div className="stat-card"><span>📊</span><div><small>เฉลี่ย/บิล</small><b>{money(avgBill)}</b></div></div><div className="stat-card"><span>⏱</span><div><small>โต๊ะเฉลี่ย</small><b>{Math.round(turnAvg)} นาที</b></div></div></div><div className="admin-grid two"><section className="admin-card"><h2>รายได้รายวัน</h2><div className="bar-chart">{days.map(([d,v])=><div key={d}><span style={{height:Math.max(8,Math.round(v/max*150))}}></span><small>{d.slice(5)}</small><b>{money(v)}</b></div>)}</div></section><section className="admin-card"><h2>ช่วงเวลาลูกค้าเยอะ</h2><div className="big-metric">{busyHour?busyHour[0]+':00–'+String((Number(busyHour[0])+1)%24).padStart(2,'0')+':00':'-'}</div><p className="muted">{busyHour?busyHour[1]+' Orders':'ยังไม่มีข้อมูล'}</p><h3>เมนูยอดนิยม</h3><div className="rank-list">{top.map(([name,q],i)=><div key={name}><b>#{i+1}</b><span>{name}</span><strong>{q}</strong></div>)}</div></section></div></>
}
