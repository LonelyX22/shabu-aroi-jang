import { useEffect, useState } from 'react'
import { listReviews, subscribeAll, updateReviewAdmin } from '../lib/api'

const dt=(v)=>v?new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'-'

export default function ReviewsAdminPro(){
  const [items,setItems]=useState([]),[star,setStar]=useState('all')
  async function load(){setItems(await listReviews())}
  useEffect(()=>{load();return subscribeAll(load)},[])
  const list=items.filter(x=>star==='all'||Number(x.overall)===Number(star))
  const counts=[1,2,3,4,5].map(n=>[n,items.filter(x=>Number(x.overall)===n).length]),max=Math.max(1,...counts.map(x=>x[1]))
  const avg=k=>items.length?(items.reduce((s,x)=>s+Number(x[k]||0),0)/items.length).toFixed(2):'-'
  function exportCsv(){const rows=[['created_at','overall','taste','freshness','service','cleanliness','value','comment','flagged'],...items.map(x=>[x.created_at,x.overall,x.taste,x.freshness,x.service,x.cleanliness,x.value,x.comment,x.is_flagged])];const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='reviews.csv';a.click()}
  async function toggleFlag(x){await updateReviewAdmin(x.id,{is_flagged:!x.is_flagged,flag_note:!x.is_flagged?'Manager ติดตาม':'',followed_up_at:x.is_flagged?new Date().toISOString():null});await load()}
  return <><div className="admin-head"><div><span className="eyebrow">FEEDBACK ANALYTICS</span><h1>รีวิวลูกค้า</h1><p>Filter ดาว กราฟคะแนน แยกหัวข้อ Export และ Flag ติดตาม</p></div><button className="btn primary" onClick={exportCsv}>Export Reviews</button></div><div className="filter-row"><button className={star==='all'?'active':''} onClick={()=>setStar('all')}>ทั้งหมด</button>{[5,4,3,2,1].map(n=><button key={n} className={String(star)===String(n)?'active':''} onClick={()=>setStar(n)}>{n} ดาว</button>)}</div><div className="admin-grid two"><section className="admin-card"><h2>คะแนนรวม</h2><div className="review-bars">{counts.map(([n,v])=><div key={n}><b>{n}★</b><span><i style={{width:(v/max*100)+'%'}}></i></span><strong>{v}</strong></div>)}</div></section><section className="admin-card"><h2>คะแนนแยกหัวข้อ</h2><div className="metric-list"><div>รสชาติ <b>{avg('taste')}</b></div><div>ความสด <b>{avg('freshness')}</b></div><div>บริการ <b>{avg('service')}</b></div><div>ความสะอาด <b>{avg('cleanliness')}</b></div><div>ความคุ้มค่า <b>{avg('value')}</b></div><div>รวม <b>{avg('overall')}</b></div></div></section></div><div className="reviews-grid">{list.map(x=><article className={x.is_flagged?'flagged':''} key={x.id}><div className="stars">{'★'.repeat(Number(x.overall||0))}{'☆'.repeat(5-Number(x.overall||0))}</div><p>{x.comment||'ไม่มีความคิดเห็นเพิ่มเติม'}</p><small>{dt(x.created_at)}</small><button className={x.is_flagged?'mini-btn danger wide-mini':'mini-btn qr wide-mini'} onClick={()=>toggleFlag(x)}>{x.is_flagged?'✓ ติดตามแล้ว / ปลด Flag':'⚑ Flag ให้ Manager ติดตาม'}</button></article>)}</div></>
}
