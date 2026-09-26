function field(id,value){
  const s=String(value)
  return id+String(s.length).padStart(2,'0')+s
}
function crc16(payload){
  let crc=0xffff
  for(let i=0;i<payload.length;i++){
    crc^=payload.charCodeAt(i)<<8
    for(let j=0;j<8;j++) crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1)
    crc&=0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4,'0')
}
export function promptPayPayload(target,amount){
  const raw=String(target||'').replace(/\D/g,'')
  let account=''
  let accountType='01'
  if(raw.length===10&&raw.startsWith('0')){
    account='0066'+raw.slice(1)
    accountType='01'
  }else if(raw.length===13){
    account=raw
    accountType='02'
  }else{
    throw new Error('PromptPay ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก')
  }
  const merchant=field('00','A000000677010111')+field(accountType,account)
  let payload=field('00','01')+field('01',Number(amount)>0?'12':'11')+field('29',merchant)+field('53','764')+field('58','TH')
  if(Number(amount)>0) payload+=field('54',Number(amount).toFixed(2))
  payload+='6304'
  return payload+crc16(payload)
}
