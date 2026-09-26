-- Production completion upgrade for Shabu Aroi Jang
-- Safe to run once on the existing project after schema.sql + seed.sql.

alter table public.shop_settings
  add column if not exists facebook text,
  add column if not exists line_id text,
  add column if not exists instagram text,
  add column if not exists google_maps_url text,
  add column if not exists reservation_grace_minutes integer not null default 15,
  add column if not exists free_child_height_cm integer not null default 90,
  add column if not exists child_max_height_cm integer not null default 120,
  add column if not exists service_charge_percent numeric(5,2) not null default 0,
  add column if not exists vat_included boolean not null default true,
  add column if not exists sound_enabled boolean not null default true;

alter table public.menu_items
  add column if not exists extra_price numeric(10,2) not null default 0,
  add column if not exists is_premium boolean not null default false,
  add column if not exists image_url text,
  add column if not exists description_th text not null default '',
  add column if not exists description_en text not null default '';

alter table public.food_order_items
  add column if not exists unit_price numeric(10,2) not null default 0,
  add column if not exists line_total numeric(10,2) not null default 0;

alter table public.table_sessions
  add column if not exists adult_count integer not null default 0,
  add column if not exists child_count integer not null default 0,
  add column if not exists free_child_count integer not null default 0;

update public.table_sessions
set adult_count = guest_count
where adult_count = 0 and child_count = 0 and free_child_count = 0;

alter table public.bills
  add column if not exists free_child_count integer not null default 0,
  add column if not exists discount_amount numeric(10,2) not null default 0,
  add column if not exists promotion_code text,
  add column if not exists note text not null default '',
  add column if not exists receipt_number text unique;

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  discount_type text not null default 'fixed' check (discount_type in ('fixed','percent')),
  discount_value numeric(10,2) not null default 0,
  start_at timestamptz,
  end_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_logs (
  id bigint generated always as identity primary key,
  session_key text,
  customer_message text not null,
  assistant_message text,
  created_at timestamptz not null default now()
);

create sequence if not exists public.receipt_number_seq start 1;

drop trigger if exists trg_promotions_updated on public.promotions;
create trigger trg_promotions_updated before update on public.promotions
for each row execute function public.set_updated_at();

alter table public.promotions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.chat_logs enable row level security;

drop policy if exists menu_categories_admin_all on public.menu_categories;
create policy menu_categories_admin_all on public.menu_categories
for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists menu_items_admin_all on public.menu_items;
create policy menu_items_admin_all on public.menu_items
for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists promotions_public_read on public.promotions;
create policy promotions_public_read on public.promotions
for select to anon,authenticated
using(is_active=true and (start_at is null or start_at<=now()) and (end_at is null or end_at>=now()) or public.is_admin());

drop policy if exists promotions_admin_all on public.promotions;
create policy promotions_admin_all on public.promotions
for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs
for select to authenticated using(public.is_owner());

drop policy if exists chat_admin_read on public.chat_logs;
create policy chat_admin_read on public.chat_logs
for select to authenticated using(public.is_admin());

create or replace function public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path=public
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id=auth.uid();
  insert into public.audit_logs(actor_id,actor_email,action,entity_type,entity_id,detail)
  values(auth.uid(),v_email,p_action,p_entity_type,p_entity_id,p_detail);
end;
$$;

create or replace function public.open_walkin_session(
  p_table_id uuid,
  p_adult_count integer,
  p_child_count integer default 0,
  p_free_child_count integer default 0
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  t public.restaurant_tables%rowtype;
  v_token text;
  v_session public.table_sessions%rowtype;
  v_guest integer := coalesce(p_adult_count,0)+coalesce(p_child_count,0)+coalesce(p_free_child_count,0);
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  if v_guest < 1 or p_adult_count < 0 or p_child_count < 0 or p_free_child_count < 0 then raise exception 'จำนวนลูกค้าไม่ถูกต้อง'; end if;

  select * into t from public.restaurant_tables where id=p_table_id for update;
  if not found or t.status<>'available' then raise exception 'โต๊ะไม่ว่าง'; end if;
  if t.seats < v_guest then raise exception 'จำนวนที่นั่งไม่พอ'; end if;

  loop
    v_token := upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
    exit when not exists(select 1 from public.table_sessions where token=v_token);
  end loop;

  insert into public.table_sessions(
    token,table_id,guest_count,adult_count,child_count,free_child_count,status,started_at
  ) values(
    v_token,t.id,v_guest,p_adult_count,p_child_count,p_free_child_count,'active',now()
  ) returning * into v_session;

  update public.restaurant_tables set status='occupied' where id=t.id;
  perform public.log_audit('open_walkin','table_session',v_session.id::text,jsonb_build_object('table',t.code,'guest_count',v_guest));

  return jsonb_build_object('id',v_session.id,'token',v_token,'table_code',t.code,'guest_count',v_guest,'status','active');
end;
$$;

create or replace function public.move_table_session(
  p_session_id uuid,
  p_new_table_id uuid
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  s public.table_sessions%rowtype;
  old_t public.restaurant_tables%rowtype;
  new_t public.restaurant_tables%rowtype;
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  select * into s from public.table_sessions where id=p_session_id and status in ('reserved','active','billing') for update;
  if not found then raise exception 'ไม่พบ Session ที่ย้ายได้'; end if;
  select * into old_t from public.restaurant_tables where id=s.table_id for update;
  select * into new_t from public.restaurant_tables where id=p_new_table_id for update;
  if not found or new_t.status<>'available' then raise exception 'โต๊ะปลายทางไม่ว่าง'; end if;
  if new_t.seats < s.guest_count then raise exception 'จำนวนที่นั่งไม่พอ'; end if;

  update public.table_sessions set table_id=new_t.id where id=s.id;
  update public.restaurant_tables set status='available' where id=old_t.id;
  update public.restaurant_tables set status=case when s.status='billing' then 'billing' when s.status='reserved' then 'reserved' else 'occupied' end where id=new_t.id;
  if s.reservation_id is not null then update public.reservations set table_id=new_t.id where id=s.reservation_id; end if;
  perform public.log_audit('move_table','table_session',s.id::text,jsonb_build_object('from',old_t.code,'to',new_t.code));
  return jsonb_build_object('session_id',s.id,'from',old_t.code,'to',new_t.code);
end;
$$;

create or replace function public.update_bill_details(
  p_bill_id uuid,
  p_adult_count integer,
  p_child_count integer,
  p_free_child_count integer,
  p_discount_amount numeric default 0,
  p_promotion_code text default null,
  p_note text default ''
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  b public.bills%rowtype;
  s public.table_sessions%rowtype;
  st public.shop_settings%rowtype;
  v_subtotal numeric(10,2);
  v_total numeric(10,2);
  v_discount numeric(10,2) := greatest(0,coalesce(p_discount_amount,0));
  promo public.promotions%rowtype;
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  if p_adult_count<0 or p_child_count<0 or p_free_child_count<0 then raise exception 'จำนวนลูกค้าไม่ถูกต้อง'; end if;
  if p_adult_count+p_child_count+p_free_child_count < 1 then raise exception 'ต้องมีลูกค้าอย่างน้อย 1 คน'; end if;

  select * into b from public.bills where id=p_bill_id for update;
  if not found or b.status<>'pending' then raise exception 'บิลนี้แก้ไขไม่ได้'; end if;
  select * into s from public.table_sessions where id=b.session_id;
  select * into st from public.shop_settings where id=1;

  v_subtotal := p_adult_count*st.buffet_price + p_child_count*st.child_price;

  if nullif(trim(coalesce(p_promotion_code,'')),'') is not null then
    select * into promo from public.promotions
    where code=upper(trim(p_promotion_code))
      and is_active=true
      and (start_at is null or start_at<=now())
      and (end_at is null or end_at>=now())
    limit 1;
    if not found then raise exception 'Promotion code ไม่ถูกต้องหรือหมดอายุ'; end if;
    if promo.discount_type='percent' then
      v_discount := round((v_subtotal + coalesce(b.extra_total,0)) * promo.discount_value / 100, 2);
    else
      v_discount := promo.discount_value;
    end if;
  end if;

  v_total := greatest(0,v_subtotal + coalesce(b.extra_total,0) - v_discount);

  update public.table_sessions
  set guest_count=p_adult_count+p_child_count+p_free_child_count,
      adult_count=p_adult_count, child_count=p_child_count, free_child_count=p_free_child_count
  where id=s.id;

  update public.bills
  set guest_count=p_adult_count+p_child_count+p_free_child_count,
      adult_count=p_adult_count, child_count=p_child_count, free_child_count=p_free_child_count,
      buffet_subtotal=v_subtotal, discount_amount=v_discount,
      promotion_code=case when nullif(trim(coalesce(p_promotion_code,'')),'') is null then null else upper(trim(p_promotion_code)) end,
      note=left(coalesce(p_note,''),500), total=v_total
  where id=b.id
  returning * into b;

  perform public.log_audit('update_bill','bill',b.id::text,jsonb_build_object('total',b.total));
  return to_jsonb(b);
end;
$$;

create or replace function public.create_food_order(p_token text,p_items jsonb)
returns jsonb
language plpgsql security definer set search_path=public
as $
declare
  s public.table_sessions%rowtype;
  v_order_id uuid;
  v_order_number text;
  x jsonb;
  m public.menu_items%rowtype;
  q integer;
begin
  select * into s from public.table_sessions where token=upper(trim(p_token)) and status='active';
  if not found then raise exception 'Session ไม่พร้อมใช้งาน'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'ไม่มีรายการอาหาร'; end if;
  if jsonb_array_length(p_items)>40 then raise exception 'รายการต่อรอบมากเกินไป'; end if;

  v_order_number := 'SH-'||to_char(timezone('Asia/Bangkok',now()),'YYMMDD')||'-'||lpad(nextval('public.food_order_seq')::text,5,'0');
  insert into public.food_orders(order_number,session_id) values(v_order_number,s.id) returning id into v_order_id;

  for x in select value from jsonb_array_elements(p_items)
  loop
    q := coalesce((x->>'quantity')::integer,0);
    if q<1 or q>20 then raise exception 'จำนวนสินค้าไม่ถูกต้อง'; end if;
    select * into m from public.menu_items where id=(x->>'menu_item_id')::uuid and is_available=true;
    if not found then raise exception 'มีเมนูที่ไม่พร้อมเสิร์ฟ'; end if;
    insert into public.food_order_items(order_id,menu_item_id,item_name_th,item_name_en,quantity,unit_price,line_total)
    values(v_order_id,m.id,m.name_th,m.name_en,q,coalesce(m.extra_price,0),coalesce(m.extra_price,0)*q);
  end loop;

  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'status','pending');
end;
$$;

create or replace function public.request_bill(p_token text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  s public.table_sessions%rowtype;
  st public.shop_settings%rowtype;
  b public.bills%rowtype;
  v_adult integer;
  v_child integer;
  v_free integer;
  v_subtotal numeric(10,2);
  v_extra numeric(10,2);
begin
  select * into s from public.table_sessions where token=upper(trim(p_token)) and status='active' for update;
  if not found then raise exception 'Session ไม่พร้อมใช้งาน'; end if;
  select * into st from public.shop_settings where id=1;

  v_adult := case when s.adult_count+s.child_count+s.free_child_count=0 then s.guest_count else s.adult_count end;
  v_child := s.child_count;
  v_free := s.free_child_count;
  v_subtotal := v_adult*st.buffet_price + v_child*st.child_price;
  select coalesce(sum(i.line_total),0) into v_extra
  from public.food_order_items i
  join public.food_orders o on o.id=i.order_id
  where o.session_id=s.id and o.status<>'cancelled';

  insert into public.bills(session_id,guest_count,adult_count,child_count,free_child_count,buffet_subtotal,extra_total,total)
  values(s.id,s.guest_count,v_adult,v_child,v_free,v_subtotal,v_extra,v_subtotal+v_extra)
  on conflict(session_id) do update set
    guest_count=excluded.guest_count,adult_count=excluded.adult_count,child_count=excluded.child_count,
    free_child_count=excluded.free_child_count,buffet_subtotal=excluded.buffet_subtotal,
    extra_total=excluded.extra_total,total=excluded.total
  returning * into b;

  update public.table_sessions set status='billing' where id=s.id;
  update public.restaurant_tables set status='billing' where id=s.table_id;
  return to_jsonb(b);
end;
$$;

create or replace function public.close_bill(p_bill_id uuid,p_payment_method text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  b public.bills%rowtype;
  s public.table_sessions%rowtype;
  v_receipt text;
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  if p_payment_method not in ('cash','promptpay','bank_transfer','card') then raise exception 'วิธีชำระเงินไม่ถูกต้อง'; end if;
  select * into b from public.bills where id=p_bill_id for update;
  if not found then raise exception 'ไม่พบบิล'; end if;
  if b.status='paid' then return to_jsonb(b); end if;

  v_receipt := 'RC-'||to_char(timezone('Asia/Bangkok',now()),'YYMMDD')||'-'||lpad(nextval('public.receipt_number_seq')::text,5,'0');
  update public.bills set status='paid',payment_method=p_payment_method,paid_at=now(),receipt_number=v_receipt where id=b.id returning * into b;
  select * into s from public.table_sessions where id=b.session_id;
  update public.table_sessions set status='closed',closed_at=now() where id=s.id;
  update public.restaurant_tables set status='cleaning' where id=s.table_id;
  perform public.log_audit('close_bill','bill',b.id::text,jsonb_build_object('receipt_number',v_receipt,'payment_method',p_payment_method,'total',b.total));
  return to_jsonb(b);
end;
$$;

create or replace function public.expire_old_reservations()
returns integer
language plpgsql security definer set search_path=public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  with changed as (
    update public.reservations r
    set status='expired'
    from public.shop_settings s
    where s.id=1
      and r.status in ('pending','confirmed')
      and (r.reservation_date + r.reservation_time + make_interval(mins=>s.reservation_grace_minutes)) < timezone('Asia/Bangkok',now())
    returning r.id,r.table_id
  )
  select count(*) into v_count from changed;

  update public.restaurant_tables t
  set status='available'
  where t.status='reserved'
    and not exists(select 1 from public.reservations r where r.table_id=t.id and r.status='confirmed');

  return v_count;
end;
$$;

grant execute on function public.open_walkin_session(uuid,integer,integer,integer) to authenticated;
grant execute on function public.move_table_session(uuid,uuid) to authenticated;
grant execute on function public.update_bill_details(uuid,integer,integer,integer,numeric,text,text) to authenticated;
grant execute on function public.expire_old_reservations() to authenticated;
grant execute on function public.log_audit(text,text,text,jsonb) to authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.promotions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.audit_logs; exception when duplicate_object then null; end;
end $$;
