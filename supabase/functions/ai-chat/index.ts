import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const SHOP_CONTEXT = `
You are the customer-service AI for "ชาบูอร่อยจัง / Shabu Aroi Jang".
Reply in the same language as the customer, concise and friendly.
Only answer about this restaurant. If unsure, say you do not have that information.

Facts:
- Buffet adult price: 299 THB/person, drinks included, NET price.
- Dining time: 120 minutes.
- Child: below 90 cm free, 90-120 cm 149 THB, above 120 cm adult price.
- Hours: 11:00-22:00.
- Address: 125/3 Moo 5, Sam Khwai Phueak, Mueang Nakhon Pathom, Nakhon Pathom 73000.
- Phone: 06-1564-0529.
- PromptPay: 06-1564-0529.
- Reservation: customer submits name, phone, date, time, guest count; restaurant assigns table and confirms.
- After confirmation customer receives a table-session QR for food ordering.
- Customers can call staff, request soup refill, plate pickup, and bill from the table page.
- Menu includes pork, beef, chicken, seafood, vegetables, mushrooms, noodles, shabu items, sides, 5 soups, sauces, drinks and desserts.
`

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { message } = await req.json()
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'message is required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ answer: 'AI ยังไม่ได้ตั้งค่า API Key กรุณาติดต่อร้านครับ' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        instructions: SHOP_CONTEXT,
        input: message,
        max_output_tokens: 250,
      }),
    })

    if (!response.ok) throw new Error(await response.text())
    const data = await response.json()
    const answer =
      data.output_text ||
      data.output?.flatMap((item: any) => item.content || []).find((x: any) => x.type === 'output_text')?.text ||
      'ขออภัยครับ ระบบ AI ไม่สามารถตอบได้ในขณะนี้'

    return new Response(JSON.stringify({ answer }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error), answer: 'ขออภัยครับ ระบบ AI ขัดข้องชั่วคราว' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
