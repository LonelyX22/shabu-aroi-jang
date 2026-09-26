import { useEffect, useState } from 'react'
import {
  createCategory, createMenuItem, deleteCategory, deleteMenuItem, listCategories, listMenu,
  reorderCategories, reorderMenuItems, updateCategory, updateMenuItem, uploadMenuImage
} from '../lib/api'

const money=(n)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n||0))
function Head({title,desc,action}){return <div className="admin-head"><div><span className="eyebrow">MENU CRUD</span><h1>{title}</h1><p>{desc}</p></div>{action}</div>}
function Modal({title,onClose,children}){return <div className="modal-backdrop" onClick={onClose}><div className="pro-modal wide" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h2>{title}</h2>{children}</div></div>}

export default function MenuAdminPro(){
  const [items,setItems]=useState([]),[cats,setCats]=useState([]),[showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[catModal,setCatModal]=useState(false),[file,setFile]=useState(null)
  const empty={name_th:'',name_en:'',emoji:'🍲',category_id:'',extra_price:0,is_premium:false,is_available:true,description_th:'',description_en:'',station:'kitchen',image_url:''}
  const [form,setForm]=useState(empty)
  async function load(){const [m,c]=await Promise.all([listMenu(),listCategories()]);setItems(m);setCats(c)}
  useEffect(()=>{load()},[])
  function open(item){setEditing(item||null);setFile(null);setForm(item?{...empty,...item,category_id:item.category_id||''}:{...empty,category_id:cats[0]?.id||''});setShowForm(true)}
  async function save(e){
    e.preventDefault()
    try{
      let imageUrl=form.image_url||''
      if(file) imageUrl=await uploadMenuImage(file)
      const payload={name_th:form.name_th,name_en:form.name_en,emoji:form.emoji||'🍲',category_id:form.category_id,extra_price:Number(form.extra_price||0),is_premium:Boolean(form.is_premium),is_available:Boolean(form.is_available),description_th:form.description_th||'',description_en:form.description_en||'',station:form.station||'kitchen',image_url:imageUrl,sort_order:editing?.sort_order||items.length+1}
      if(editing?.id) await updateMenuItem(editing.id,payload); else await createMenuItem(payload)
      setShowForm(false);await load()
    }catch(err){alert(err.message)}
  }
  async function move(idx,delta){const next=[...items],j=idx+delta;if(j<0||j>=next.length)return;[next[idx],next[j]]=[next[j],next[idx]];setItems(next);await reorderMenuItems(next.map(x=>x.id));await load()}
  return <><Head title="จัดการเมนู" desc="เพิ่ม แก้ไข รูปอาหาร Premium Station และจัดลำดับ" action={<div className="head-actions"><button className="btn ghost" onClick={()=>setCatModal(true)}>หมวดหมู่</button><button className="btn primary" onClick={()=>open(null)}>+ เพิ่มเมนู</button></div>}/>
  <div className="admin-card"><div className="table-scroll"><table><thead><tr><th>รูป</th><th>หมวด</th><th>เมนู</th><th>Station</th><th>ราคาเพิ่ม</th><th>สถานะ</th><th>ลำดับ</th><th></th></tr></thead><tbody>{items.map((x,i)=><tr key={x.id}><td>{x.image_url?<img className="menu-thumb" src={x.image_url} alt=""/>:<span className="menu-emoji-mini">{x.emoji||'🍲'}</span>}</td><td>{x.category}</td><td><b>{x.name_th}</b><small className="block-muted">{x.name_en}</small></td><td>{x.station||'kitchen'}</td><td>{Number(x.extra_price||0)>0?money(x.extra_price):'รวม Buffet'}</td><td><button className={x.is_available?'pill-btn good':'pill-btn bad'} onClick={async()=>{await updateMenuItem(x.id,{is_available:!x.is_available});load()}}>{x.is_available?'พร้อมขาย':'ปิดขาย'}</button></td><td><div className="row-actions"><button onClick={()=>move(i,-1)}>↑</button><button onClick={()=>move(i,1)}>↓</button></div></td><td><div className="row-actions"><button onClick={()=>open(x)}>แก้ไข</button><button className="danger-text" onClick={async()=>{if(confirm('ลบเมนูนี้?')){await deleteMenuItem(x.id);load()}}}>ลบ</button></div></td></tr>)}</tbody></table></div></div>
  {showForm&&<Modal title={editing?.id?'แก้ไขเมนู':'เพิ่มเมนู'} onClose={()=>setShowForm(false)}><form className="pro-form" onSubmit={save}><label>ชื่อไทย<input required value={form.name_th} onChange={e=>setForm(f=>({...f,name_th:e.target.value}))}/></label><label>ชื่ออังกฤษ<input required value={form.name_en} onChange={e=>setForm(f=>({...f,name_en:e.target.value}))}/></label><label>หมวด<select required value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}>{cats.map(c=><option value={c.id} key={c.id}>{c.name_th}</option>)}</select></label><label>Station<select value={form.station} onChange={e=>setForm(f=>({...f,station:e.target.value}))}><option value="kitchen">ครัวหลัก</option><option value="hot">ครัวร้อน</option><option value="fried">ของทอด</option><option value="bar">บาร์น้ำ</option><option value="dessert">ของหวาน</option></select></label><label>Emoji<input value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))}/></label><label>ราคาเพิ่ม<input type="number" min="0" value={form.extra_price} onChange={e=>setForm(f=>({...f,extra_price:e.target.value}))}/></label><label>รูปอาหาร<input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><label className="check"><input type="checkbox" checked={form.is_premium} onChange={e=>setForm(f=>({...f,is_premium:e.target.checked}))}/> Premium / Add-on</label><label className="check"><input type="checkbox" checked={form.is_available} onChange={e=>setForm(f=>({...f,is_available:e.target.checked}))}/> พร้อมขาย</label><label className="span-2">คำอธิบาย<textarea value={form.description_th} onChange={e=>setForm(f=>({...f,description_th:e.target.value}))}/></label><button className="btn primary span-2">บันทึกเมนู</button></form></Modal>}
  {catModal&&<CategoryModal cats={cats} onClose={()=>setCatModal(false)} onChanged={load}/>}</>
}

function CategoryModal({cats,onClose,onChanged}){
  const [th,setTh]=useState(''),[en,setEn]=useState('')
  async function add(e){e.preventDefault();await createCategory({name_th:th,name_en:en||th,sort_order:cats.length+1,is_active:true});setTh('');setEn('');await onChanged()}
  async function move(i,d){const next=[...cats],j=i+d;if(j<0||j>=next.length)return;[next[i],next[j]]=[next[j],next[i]];await reorderCategories(next.map(x=>x.id));await onChanged()}
  return <Modal title="จัดการหมวดหมู่" onClose={onClose}><form className="inline-form" onSubmit={add}><input required placeholder="ชื่อไทย" value={th} onChange={e=>setTh(e.target.value)}/><input placeholder="English" value={en} onChange={e=>setEn(e.target.value)}/><button className="btn primary">เพิ่ม</button></form><div className="simple-list">{cats.map((c,i)=><div key={c.id}><span><b>{c.name_th}</b><small>{c.name_en}</small></span><div><button onClick={()=>move(i,-1)}>↑</button><button onClick={()=>move(i,1)}>↓</button><button onClick={async()=>{const n=prompt('ชื่อหมวดใหม่',c.name_th);if(n){await updateCategory(c.id,{name_th:n});onChanged()}}}>แก้ชื่อ</button><button className="danger-text" onClick={async()=>{if(confirm('ลบหมวดนี้?')){try{await deleteCategory(c.id);onChanged()}catch(e){alert(e.message)}}}}>ลบ</button></div></div>)}</div></Modal>
}
