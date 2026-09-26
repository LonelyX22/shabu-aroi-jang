import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  closeBill, getSettings, getSlipSignedUrl, listBills, reviewPaymentSlip, subscribeAll, updateBillDetails
} from '../lib/api'
import { promptPayPayload } from '../lib/promptpay'

const money=(n)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(Number(n||0))
const dt=(v)=>v?new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'-'
function Head(){return <div className="admin-head"><div><span className="eyebrow">CASHIER PRO</span><h1>เช็คบิล / ชำระเงิน</h1><p>ราคาเด็ก Premium โปรโมชั่น PromptPay สลิป PDF และ Tax invoice</p></div></div>}
function Modal({title,onClose,children}){return <div className="modal-backdrop" onClick={onClose}><div className="pro-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h2>{title}</h2>{children}</div></div>}

async function pdfReceipt(b,settings){
  const el=document.createElement('div')
  el.style.cssText='position:fixed;left:-9999px;top:0;width:420px;background:#fff;padding:28px;color:#222;font-family:Arial,sans-serif'
  el.innerHTML='<div style="text-align:center"><h2>ชาบูอร่อยจัง</h2><p>'+String(settings?.address_th||'')+'</p><p>โทร '+String(settings?.phone||'')+'</p><h3>'+(b.receipt_number||'Receipt')+'</h3></div><hr><p>โต๊ะ: <b>'+(b.table_code||'-')+'</b></p><p>ผู้ใหญ่ '+Number(b.adult_count||0)+' = '+money(Number(b.adult_count||0)*Number(settings?.buffet_price||299))+'</p><p>เด็ก '+Number(b.child_count||0)+' = '+money(Number(b.child_count||0)*Number(settings?.child_price||149))+'</p><p>Premium/Add-on: '+money(b.extra_total||0)+'</p><p>ส่วนลด: -'+money(b.discount_amount||0)+'</p><hr><h2>รวม '+money(b.total)+'</h2>'+(settings?.tax_registered?'<p>Tax ID: '+String(settings.tax_id||'-')+' • '+String(settings.tax_branch||'สำนักงานใหญ่')+'</p>':'')+'<p style="text-align:center">ขอบคุณที่ใช้บริการ</p>'
  document.body.appendChild(el)
  const canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff'});el.remove()
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),img=canvas.toDataURL('image/png'),width=180,height=canvas.height*width/canvas.width
  pdf.addImage(img,'PNG',15,15,width,Math.min(height,265));pdf.save((b.receipt_number||'receipt')+'.pdf')
}

export default function BillingAdminPro(){
  const [items,setItems]=useState([]),[edit,setEdit]=useState(null),[settings,setSettings]=useState(null),[payQr,setPayQr]=useState(null),[slipView,setSlipView]=useState(null)
  async function load(){const [b,s]=await Promise.all([listBills(),getSettings()]);setItems(b);setSettings(s)}
  useEffect(()=>{load();return subscribeAll(load)},[])
  async function saveBill(){try{await updateBillDetails(edit.id,edit);setEdit(null);await load()}catch(e){alert(e.message)}}
  async function pay(b,method){if(!confirm('ยืนยันรับชำระ '+money(b.total)+' ?'))return;try{await closeBill(b.id,method);await load()}catch(e){alert(e.message)}}
  async function viewSlip(b){try{const url=await getSlipSignedUrl(b.slip_url);setSlipView({bill:b,url})}catch(e){alert(e.message)}}
  async function reviewSlip(b,status){await reviewPaymentSlip(b.id,status);setSlipView(null);await load()}
  function printReceipt(b){
    const w=window.open('','_blank','width=450,height=760');if(!w)return
    w.document.write('<html><head><title>'+(b.receipt_number||'Receipt')+'</title><style>body{font-family:Arial;padding:24px}.row{display:flex;justify-content:space-between;margin:8px 0}hr{border:0;border-top:1px dashed #999}</style></head><body><h2 style="text-align:center">ชาบูอร่อยจัง</h2><p style="text-align:center">'+String(settings?.address_th||'')+'</p><h3 style="text-align:center">'+(b.receipt_number||'ใบเสร็จ')+'</h3><hr><div class="row"><span>โต๊ะ</span><b>'+(b.table_code||'-')+'</b></div><div class="row"><span>Premium/Add-on</span><b>'+money(b.extra_total||0)+'</b></div><div class="row"><span>ส่วนลด</span><b>-'+money(b.discount_amount||0)+'</b></div><hr><div class="row"><strong>รวม</strong><strong>'+money(b.total)+'</strong></div>'+(settings?.tax_registered?'<p>Tax ID: '+String(settings.tax_id||'-')+' '+String(settings.tax_branch||'')+'</p>':'')+'<script>window.print()</script></body></html>');w.document.close()
  }
  return <><Head/><div className="billing-grid">{items.map(b=><article className={b.status} key={b.id}><div className="billing-top"><div><span>โต๊ะ</span><h2>{b.table_code||'-'}</h2></div><span className={'bill-state '+b.status}>{b.status==='paid'?'ชำระแล้ว':'รอชำระ'}</span></div><div className="bill-breakdown"><span>ผู้ใหญ่ <b>{b.adult_count||0}</b></span><span>เด็ก <b>{b.child_count||0}</b></span><span>เด็กฟรี <b>{b.free_child_count||0}</b></span></div><div className="bill-line"><span>ยอดสุทธิ</span><b>{money(b.total)}</b></div>{b.promotion_code&&<small>Promo: {b.promotion_code} • ลด {money(b.discount_amount||0)}</small>}{b.slip_url&&<button className={'mini-btn '+(b.slip_status==='approved'?'ok':b.slip_status==='rejected'?'danger':'qr')+' wide-mini'} onClick={()=>viewSlip(b)}>สลิป: {b.slip_status}</button>}{b.status==='pending'?<><button className="mini-btn qr wide-mini" onClick={()=>setEdit({...b,adult_count:b.adult_count||b.guest_count||0,child_count:b.child_count||0,free_child_count:b.free_child_count||0,discount_amount:b.discount_amount||0,promotion_code:b.promotion_code||'',note:b.note||''})}>แก้จำนวน / ส่วนลด</button><button className="mini-btn qr wide-mini" onClick={()=>setPayQr(b)}>แสดง PromptPay QR</button><div className="pay-actions"><button onClick={()=>pay(b,'cash')}>เงินสด</button><button onClick={()=>pay(b,'promptpay')}>PromptPay</button><button onClick={()=>pay(b,'bank_transfer')}>โอนเงิน</button>{settings?.card_payment_url&&<button onClick={()=>window.open(settings.card_payment_url,'_blank')}>Card</button>}</div></>:<><small>{b.receipt_number} • {b.payment_method} • {dt(b.paid_at)}</small><button className="mini-btn qr wide-mini" onClick={()=>printReceipt(b)}>พิมพ์ใบเสร็จ</button><button className="mini-btn qr wide-mini" onClick={()=>pdfReceipt(b,settings)}>PDF</button></>}</article>)}</div>
  {edit&&<Modal title={'แก้บิลโต๊ะ '+edit.table_code} onClose={()=>setEdit(null)}><div className="pro-form"><label>ผู้ใหญ่<input type="number" min="0" value={edit.adult_count} onChange={e=>setEdit(x=>({...x,adult_count:Number(e.target.value)}))}/></label><label>เด็ก<input type="number" min="0" value={edit.child_count} onChange={e=>setEdit(x=>({...x,child_count:Number(e.target.value)}))}/></label><label>เด็กฟรี<input type="number" min="0" value={edit.free_child_count} onChange={e=>setEdit(x=>({...x,free_child_count:Number(e.target.value)}))}/></label><label>ส่วนลด Manual<input type="number" min="0" value={edit.discount_amount} onChange={e=>setEdit(x=>({...x,discount_amount:Number(e.target.value)}))}/></label><label>Promo Code<input value={edit.promotion_code} onChange={e=>setEdit(x=>({...x,promotion_code:e.target.value.toUpperCase()}))}/></label><label>หมายเหตุ<input value={edit.note} onChange={e=>setEdit(x=>({...x,note:e.target.value}))}/></label><button className="btn primary span-2" onClick={saveBill}>บันทึกบิล</button></div></Modal>}
  {payQr&&<Modal title={'PromptPay โต๊ะ '+payQr.table_code} onClose={()=>setPayQr(null)}><div className="admin-qr-box"><QRCodeSVG value={promptPayPayload(settings?.promptpay||'0615640529',payQr.total)} size={250}/></div><h2 className="center-text">{money(payQr.total)}</h2><p className="center-text muted">PromptPay {settings?.promptpay||'06-1564-0529'}</p></Modal>}
  {slipView&&<Modal title={'ตรวจสลิปโต๊ะ '+slipView.bill.table_code} onClose={()=>setSlipView(null)}><img className="slip-preview" src={slipView.url} alt="Payment slip"/><div className="qr-modal-actions"><button className="btn primary" onClick={()=>reviewSlip(slipView.bill,'approved')}>ผ่าน</button><button className="btn ghost" onClick={()=>reviewSlip(slipView.bill,'rejected')}>ไม่ผ่าน</button></div></Modal>}</>
}
