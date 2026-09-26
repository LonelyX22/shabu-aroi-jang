# ชาบูอร่อยจัง — Shabu Aroi Jang

ระบบร้านชาบู Full-stack MVP สำหรับลูกค้า + Admin + Kitchen + Cashier

## จุดเด่น
- Buffet 299 บาท/คน รวมน้ำ NET
- จองโต๊ะ → Admin เลือกโต๊ะ → ลูกค้าได้รับ QR Table Session
- สแกน QR เพื่อสั่งอาหารและล็อกโต๊ะ
- 15 โต๊ะ A01–B05
- 90 เมนูเริ่มต้น
- Kitchen status: รอรับ → รับแล้ว → กำลังเตรียม → พร้อมเสิร์ฟ → เสิร์ฟแล้ว
- เรียกพนักงาน / เติมซุป / เก็บจาน / เช็คบิล
- เงินสด / PromptPay / โอน
- ปิด Session และ QR หลังชำระเงิน
- รีวิว 1–5 ดาวหลังชำระ
- Supabase Realtime
- AI Chat ผ่าน Supabase Edge Function
- ปุ่มเปิดร้าน / ตามเวลา / ปิดร้าน Manual override เหมือนโปรเจกต์ร้านน้ำ
- Responsive สำหรับมือถือ / Tablet / PC

## ร้าน
- โทร: 06-1564-0529
- ที่อยู่: 125/3 ม.5 ต.สามควายเผือก อ.เมือง จ.นครปฐม 73000
- เปิด: 11:00–22:00
- PromptPay: 06-1564-0529

## Setup Supabase
1. สร้าง Supabase project ใหม่
2. SQL Editor → Run `supabase/schema.sql`
3. Run `supabase/seed.sql`
4. Authentication → สร้าง Owner user ด้วย Email ที่ต้องการ
5. นำ UUID ของ Auth user ไปเพิ่มใน `public.profiles` role = `owner`
6. GitHub repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. สำหรับ AI Chat ให้ตั้ง Supabase Edge Function secret:
   - `OPENAI_API_KEY`
8. Deploy function `ai-chat`

## Owner bootstrap
หลังสร้าง Auth user แล้ว:

```sql
insert into public.profiles (id,email,display_name,role,is_active)
values ('AUTH_USER_UUID','o5170797@gmail.com','Owner','owner',true)
on conflict(id) do update set role='owner',is_active=true;
```

## Local
```bash
npm install
npm run dev
```

ถ้ายังไม่ตั้ง Supabase ระบบจะเข้า Demo Mode เพื่อให้เปิดดู UI ได้ก่อน
