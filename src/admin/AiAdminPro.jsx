import { useEffect, useState } from 'react'
import { createKnowledge, deleteKnowledge, listChatLogs, listKnowledgeBase, updateKnowledge } from '../lib/api'

const dt=(v)=>v?new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'-'
function Modal({title,onClose,children}){return <div className="modal-backdrop" onClick={onClose}><div className="pro-modal wide" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h2>{title}</h2>{children}</div></div>}

export function KnowledgeAdminPro(){
  const [items,setItems]=useState([]),[edit,setEdit]=useState(null)
  async function load(){setItems(await listKnowledgeBase())}
  useEffect(()=>{load()},[])
  async function save(e){e.preventDefault();const p={question:edit.question,answer:edit.answer,keywords:String(edit.keyword_text||'').split(',').map(x=>x.trim()).filter(Boolean),is_active:Boolean(edit.is_active),sort_order:Number(edit.sort_order||0)};if(edit.id)await updateKnowledge(edit.id,p);else await createKnowledge(p);setEdit(null);await load()}
  return <><div className="admin-head"><div><span className="eyebrow">AI KNOWLEDGE</span><h1>AI Knowledge Base</h1><p>กำหนดข้อมูลที่ AI ใช้ตอบลูกค้า</p></div><button className="btn primary" onClick={()=>setEdit({question:'',answer:'',keyword_text:'',is_active:true,sort_order:items.length+1})}>+ เพิ่มความรู้</button></div><div className="admin-card"><div className="simple-list">{items.map(x=><div key={x.id}><span><b>{x.question}</b><small>{x.answer.slice(0,120)} • {(x.keywords||[]).join(', ')}</small></span><div><button onClick={()=>setEdit({...x,keyword_text:(x.keywords||[]).join(', ')})}>แก้ไข</button><button className="danger-text" onClick={async()=>{if(confirm('ลบข้อมูลนี้?')){await deleteKnowledge(x.id);load()}}}>ลบ</button></div></div>)}</div></div>{edit&&<Modal title={edit.id?'แก้ Knowledge':'เพิ่ม Knowledge'} onClose={()=>setEdit(null)}><form className="pro-form" onSubmit={save}><label className="span-2">คำถาม/หัวข้อ<input required value={edit.question} onChange={e=>setEdit(x=>({...x,question:e.target.value}))}/></label><label className="span-2">คำตอบ<textarea required value={edit.answer} onChange={e=>setEdit(x=>({...x,answer:e.target.value}))}/></label><label className="span-2">Keywords (คั่นด้วย ,)<input value={edit.keyword_text||''} onChange={e=>setEdit(x=>({...x,keyword_text:e.target.value}))}/></label><label className="check"><input type="checkbox" checked={Boolean(edit.is_active)} onChange={e=>setEdit(x=>({...x,is_active:e.target.checked}))}/> เปิดใช้</label><button className="btn primary span-2">บันทึก</button></form></Modal>}</>
}

export function ChatHistoryAdminPro(){
  const [items,setItems]=useState([]),[q,setQ]=useState('')
  useEffect(()=>{listChatLogs().then(setItems)},[])
  const filtered=items.filter(x=>(String(x.customer_message||'')+' '+String(x.assistant_message||'')).toLowerCase().includes(q.toLowerCase()))
  const freq={};items.forEach(x=>{const k=String(x.customer_message||'').trim().slice(0,60);if(k)freq[k]=(freq[k]||0)+1});const popular=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8)
  return <><div className="admin-head"><div><span className="eyebrow">AI CHAT HISTORY</span><h1>AI Chat</h1><p>ประวัติแชตและคำถามยอดนิยม</p></div></div><div className="admin-grid two"><section className="admin-card"><h2>คำถามยอดนิยม</h2><div className="rank-list">{popular.map(([k,v],i)=><div key={k}><b>#{i+1}</b><span>{k}</span><strong>{v}</strong></div>)}</div></section><section className="admin-card"><input className="admin-search" placeholder="ค้นหาคำถาม..." value={q} onChange={e=>setQ(e.target.value)}/><div className="chat-history-list">{filtered.slice(0,100).map(x=><article key={x.id}><div><small>{dt(x.created_at)}</small><b>ลูกค้า: {x.customer_message}</b></div><p>AI: {x.assistant_message||'-'}</p></article>)}</div></section></div></>
}
