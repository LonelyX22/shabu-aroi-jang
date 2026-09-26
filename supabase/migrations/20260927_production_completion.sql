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


create or replace function public.has_role(p_roles text[])
returns boolean
language sql stable security definer set search_path=public
as $body$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and is_active=true and role=any(p_roles)
  );
$body$;



-- Role-specific production policies
drop policy if exists settings_admin_update on public.shop_settings;
create policy settings_admin_update on public.shop_settings for update to authenticated
using(public.has_role(array['owner','manager'])) with check(public.has_role(array['owner','manager']));

drop policy if exists tables_admin_all on public.restaurant_tables;
create policy tables_admin_all on public.restaurant_tables for all to authenticated
using(public.has_role(array['owner','manager','cashier','staff']))
with check(public.has_role(array['owner','manager','cashier','staff']));
drop policy if exists tables_staff_read on public.restaurant_tables;
create policy tables_staff_read on public.restaurant_tables for select to authenticated
using(public.has_role(array['owner','manager','cashier','kitchen','staff']));

drop policy if exists reservations_admin_all on public.reservations;
create policy reservations_admin_all on public.reservations for all to authenticated
using(public.has_role(array['owner','manager','cashier','staff']))
with check(public.has_role(array['owner','manager','cashier','staff']));

drop policy if exists sessions_admin_read on public.table_sessions;
create policy sessions_admin_read on public.table_sessions for select to authenticated
using(public.has_role(array['owner','manager','cashier','kitchen','staff']));

drop policy if exists orders_admin_all on public.food_orders;
create policy orders_admin_all on public.food_orders for all to authenticated
using(public.has_role(array['owner','manager','kitchen','staff']))
with check(public.has_role(array['owner','manager','kitchen','staff']));

drop policy if exists order_items_admin_read on public.food_order_items;
create policy order_items_admin_read on public.food_order_items for select to authenticated
using(public.has_role(array['owner','manager','cashier','kitchen','staff']));

drop policy if exists calls_admin_all on public.service_calls;
create policy calls_admin_all on public.service_calls for all to authenticated
using(public.has_role(array['owner','manager','kitchen','staff']))
with check(public.has_role(array['owner','manager','kitchen','staff']));

drop policy if exists bills_admin_all on public.bills;
create policy bills_admin_all on public.bills for all to authenticated
using(public.has_role(array['owner','manager','cashier']))
with check(public.has_role(array['owner','manager','cashier']));

drop policy if exists reviews_admin_read on public.reviews;
create policy reviews_admin_read on public.reviews for select to authenticated
using(public.has_role(array['owner','manager']));

drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles for select to authenticated
using(id=auth.uid() or public.has_role(array['owner']));
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated
using(public.has_role(array['owner'])) with check(public.has_role(array['owner']));

drop policy if exists menu_categories_admin_all on public.menu_categories;
create policy menu_categories_admin_all on public.menu_categories
for all to authenticated using(public.has_role(array['owner','manager'])) with check(public.has_role(array['owner','manager']));

drop policy if exists menu_items_admin_all on public.menu_items;
create policy menu_items_admin_all on public.menu_items
for all to authenticated using(public.has_role(array['owner','manager'])) with check(public.has_role(array['owner','manager']));

drop policy if exists promotions_public_read on public.promotions;
create policy promotions_public_read on public.promotions
for select to anon,authenticated
using(is_active=true and (start_at is null or start_at<=now()) and (end_at is null or end_at>=now()) or public.is_admin());

drop policy if exists promotions_admin_all on public.promotions;
create policy promotions_admin_all on public.promotions
for all to authenticated using(public.has_role(array['owner','manager'])) with check(public.has_role(array['owner','manager']));

drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs
for select to authenticated using(public.has_role(array['owner']));

drop policy if exists chat_admin_read on public.chat_logs;
create policy chat_admin_read on public.chat_logs
for select to authenticated using(public.has_role(array['owner','manager']));

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


create or replace function public.register_staff_profile(
  p_email text,
  p_display_name text,
  p_role text
)
returns jsonb
language plpgsql security definer set search_path=public
as $body$
declare
  u auth.users%rowtype;
  p public.profiles%rowtype;
begin
  if not public.has_role(array['owner']) then raise exception 'Owner only'; end if;
  if p_role not in ('manager','cashier','kitchen','staff') then raise exception 'Role ไม่ถูกต้อง'; end if;
  select * into u from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if not found then raise exception 'ยังไม่พบ Auth User อีเมลนี้ กรุณาสร้าง User ใน Authentication ก่อน'; end if;

  insert into public.profiles(id,email,display_name,role,is_active)
  values(u.id,u.email,coalesce(nullif(trim(p_display_name),''),split_part(u.email,'@',1)),p_role,true)
  on conflict(id) do update set
    email=excluded.email,display_name=excluded.display_name,role=excluded.role,is_active=true
  returning * into p;

  perform public.log_audit('register_staff','profile',p.id::text,jsonb_build_object('email',p.email,'role',p.role));
  return to_jsonb(p);
end;
$body$;

create or replace function public.log_chat(
  p_session_key text,
  p_customer_message text,
  p_assistant_message text
)
returns void
language plpgsql security definer set search_path=public
as $body$
begin
  if length(trim(coalesce(p_customer_message,'')))=0 then return; end if;
  insert into public.chat_logs(session_key,customer_message,assistant_message)
  values(left(coalesce(p_session_key,''),80),left(p_customer_message,1000),left(coalesce(p_assistant_message,''),3000));
end;
$body$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path=public
as $body$
declare
  v_email text;
  v_id text;
begin
  select email into v_email from auth.users where id=auth.uid();
  v_id := coalesce((case when tg_op='DELETE' then old.id::text else new.id::text end),'');
  insert into public.audit_logs(actor_id,actor_email,action,entity_type,entity_id,detail)
  values(auth.uid(),v_email,lower(tg_op),tg_table_name,v_id,
    case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return case when tg_op='DELETE' then old else new end;
end;
$body$;

drop trigger if exists audit_shop_settings on public.shop_settings;
create trigger audit_shop_settings after update on public.shop_settings
for each row execute function public.audit_row_change();
drop trigger if exists audit_menu_items on public.menu_items;
create trigger audit_menu_items after insert or update or delete on public.menu_items
for each row execute function public.audit_row_change();
drop trigger if exists audit_promotions on public.promotions;
create trigger audit_promotions after insert or update or delete on public.promotions
for each row execute function public.audit_row_change();
drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after update on public.profiles
for each row execute function public.audit_row_change();

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
  if not public.has_role(array['owner','manager','cashier','staff']) then raise exception 'Unauthorized'; end if;
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
  if not public.has_role(array['owner','manager','cashier','staff']) then raise exception 'Unauthorized'; end if;
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
  if not public.has_role(array['owner','manager','cashier']) then raise exception 'Unauthorized'; end if;
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
as $func$
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
$func$;

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
  if not public.has_role(array['owner','manager','cashier']) then raise exception 'Unauthorized'; end if;
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


create or replace function public.cancel_reservation_admin(p_reservation_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $body$
declare
  r public.reservations%rowtype;
  s public.table_sessions%rowtype;
begin
  if not public.has_role(array['owner','manager','cashier','staff']) then raise exception 'Unauthorized'; end if;
  select * into r from public.reservations where id=p_reservation_id for update;
  if not found then raise exception 'ไม่พบการจอง'; end if;

  select * into s from public.table_sessions
  where reservation_id=r.id and status in ('reserved','active','billing')
  order by created_at desc limit 1 for update;

  if found and s.status in ('active','billing') then
    raise exception 'ลูกค้าเริ่มใช้โต๊ะแล้ว กรุณาจัดการจากระบบโต๊ะ/เช็คบิล';
  end if;

  update public.reservations set status='cancelled' where id=r.id;
  if found then
    update public.table_sessions set status='cancelled',closed_at=now() where id=s.id;
    update public.restaurant_tables set status='available' where id=s.table_id;
  elsif r.table_id is not null then
    update public.restaurant_tables set status='available' where id=r.table_id and status='reserved';
  end if;

  perform public.log_audit('cancel_reservation','reservation',r.id::text,jsonb_build_object('code',r.code));
  return jsonb_build_object('id',r.id,'status','cancelled');
end;
$body$;

create or replace function public.expire_old_reservations()
returns integer
language plpgsql security definer set search_path=public
as $$
declare
  v_count integer;
begin
  if not public.has_role(array['owner','manager','cashier']) then raise exception 'Unauthorized'; end if;
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

  update public.table_sessions s
  set status='cancelled',closed_at=now()
  where s.status='reserved'
    and exists(select 1 from public.reservations r where r.id=s.reservation_id and r.status='expired');

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
grant execute on function public.cancel_reservation_admin(uuid) to authenticated;
grant execute on function public.log_audit(text,text,text,jsonb) to authenticated;
grant execute on function public.register_staff_profile(text,text,text) to authenticated;
grant execute on function public.log_chat(text,text,text) to anon,authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.promotions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.audit_logs; exception when duplicate_object then null; end;
end $$;


-- =========================================================
-- Final production features
-- =========================================================

alter table public.shop_settings
  add column if not exists booking_slot_minutes integer not null default 30,
  add column if not exists max_bookings_per_slot integer not null default 15,
  add column if not exists tax_id text,
  add column if not exists tax_branch text not null default 'สำนักงานใหญ่',
  add column if not exists tax_registered boolean not null default false,
  add column if not exists logo_url text,
  add column if not exists card_payment_url text;

alter table public.reservations
  add column if not exists customer_birthday date;

alter table public.menu_items
  add column if not exists station text not null default 'kitchen';

alter table public.food_order_items
  add column if not exists station text not null default 'kitchen';

alter table public.food_orders
  add column if not exists accepted_at timestamptz,
  add column if not exists preparing_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists serving_at timestamptz,
  add column if not exists served_at timestamptz,
  add column if not exists served_by uuid references public.profiles(id) on delete set null;

do $$
declare
  v_name text;
begin
  select conname into v_name
  from pg_constraint
  where conrelid='public.food_orders'::regclass
    and contype='c'
    and pg_get_constraintdef(oid) ilike '%status%pending%accepted%';
  if v_name is not null then
    execute format('alter table public.food_orders drop constraint %I',v_name);
  end if;
end $$;

alter table public.food_orders
  add constraint food_orders_status_check
  check (status in ('pending','accepted','preparing','ready','serving','served','cancelled'));

alter table public.bills
  add column if not exists slip_url text,
  add column if not exists slip_status text not null default 'none',
  add column if not exists slip_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists slip_reviewed_at timestamptz;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.bills'::regclass and conname='bills_slip_status_check'
  ) then
    alter table public.bills add constraint bills_slip_status_check
      check (slip_status in ('none','pending','approved','rejected'));
  end if;
end $$;

alter table public.promotions
  add column if not exists min_guest_count integer not null default 1,
  add column if not exists birthday_only boolean not null default false,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists weekdays integer[] not null default array[0,1,2,3,4,5,6];

alter table public.reviews
  add column if not exists is_flagged boolean not null default false,
  add column if not exists flag_note text not null default '',
  add column if not exists followed_up_at timestamptz;

create table if not exists public.table_session_tables (
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(session_id,table_id)
);

insert into public.table_session_tables(session_id,table_id,is_primary)
select id,table_id,true from public.table_sessions
on conflict(session_id,table_id) do nothing;

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  event_type text not null,
  title text not null,
  message text not null default '',
  entity_type text,
  entity_id text,
  target_roles text[] not null default array['owner','manager'],
  created_at timestamptz not null default now()
);

create table if not exists public.notification_reads (
  notification_id bigint not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(notification_id,user_id)
);

create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  keywords text[] not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_knowledge_updated on public.knowledge_base;
create trigger trg_knowledge_updated before update on public.knowledge_base
for each row execute function public.set_updated_at();

alter table public.table_session_tables enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.knowledge_base enable row level security;

drop policy if exists session_tables_admin on public.table_session_tables;
create policy session_tables_admin on public.table_session_tables for all to authenticated
using(public.has_role(array['owner','manager','cashier','staff']))
with check(public.has_role(array['owner','manager','cashier','staff']));

drop policy if exists notifications_admin_read on public.notifications;
create policy notifications_admin_read on public.notifications for select to authenticated
using(public.has_role(target_roles));

drop policy if exists notification_reads_own on public.notification_reads;
create policy notification_reads_own on public.notification_reads for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists kb_public_read on public.knowledge_base;
create policy kb_public_read on public.knowledge_base for select to anon,authenticated
using(is_active=true or public.has_role(array['owner','manager']));

drop policy if exists kb_admin_all on public.knowledge_base;
create policy kb_admin_all on public.knowledge_base for all to authenticated
using(public.has_role(array['owner','manager']))
with check(public.has_role(array['owner','manager']));

drop policy if exists reviews_admin_update on public.reviews;
create policy reviews_admin_update on public.reviews for update to authenticated
using(public.has_role(array['owner','manager']))
with check(public.has_role(array['owner','manager']));

-- Storage buckets for menu images, branding and payment slips.
insert into storage.buckets(id,name,public)
values ('menu-images','menu-images',true),('branding','branding',true),('payment-slips','payment-slips',false)
on conflict(id) do update set public=excluded.public;

drop policy if exists public_menu_images_read on storage.objects;
create policy public_menu_images_read on storage.objects for select to public
using(bucket_id='menu-images');

drop policy if exists admin_menu_images_write on storage.objects;
create policy admin_menu_images_write on storage.objects for all to authenticated
using(bucket_id='menu-images' and public.has_role(array['owner','manager']))
with check(bucket_id='menu-images' and public.has_role(array['owner','manager']));

drop policy if exists public_branding_read on storage.objects;
create policy public_branding_read on storage.objects for select to public
using(bucket_id='branding');

drop policy if exists admin_branding_write on storage.objects;
create policy admin_branding_write on storage.objects for all to authenticated
using(bucket_id='branding' and public.has_role(array['owner','manager']))
with check(bucket_id='branding' and public.has_role(array['owner','manager']));

drop policy if exists admin_slips_read on storage.objects;
create policy admin_slips_read on storage.objects for select to authenticated
using(bucket_id='payment-slips' and public.has_role(array['owner','manager','cashier']));

drop policy if exists public_slips_insert on storage.objects;
create policy public_slips_insert on storage.objects for insert to anon,authenticated
with check(bucket_id='payment-slips');

create or replace function public.create_reservation(p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=public
as $reservation$
declare
  v_code text;
  v_name text;
  v_phone text;
  v_date date;
  v_time time;
  v_guest integer;
  v_note text;
  v_birthday date;
  v_id uuid;
  v_settings public.shop_settings%rowtype;
  v_slot_count integer;
  v_slot_guests integer;
  v_capacity integer;
  v_largest_table integer;
  v_slot_start timestamp;
  v_slot_end timestamp;
begin
  if not public.current_shop_open() then raise exception 'ร้านปิดรับการจองในขณะนี้'; end if;

  select * into v_settings from public.shop_settings where id=1;
  v_name := trim(coalesce(p_payload->>'customer_name',''));
  v_phone := regexp_replace(coalesce(p_payload->>'customer_phone',''),'\D','','g');
  v_date := nullif(p_payload->>'reservation_date','')::date;
  v_time := nullif(p_payload->>'reservation_time','')::time;
  v_guest := coalesce((p_payload->>'guest_count')::integer,0);
  v_note := left(coalesce(p_payload->>'note',''),300);
  v_birthday := nullif(p_payload->>'customer_birthday','')::date;

  if length(v_name)<1 or length(v_name)>80 then raise exception 'ชื่อไม่ถูกต้อง'; end if;
  if v_phone !~ '^0[0-9]{9}$' then raise exception 'เบอร์โทรไม่ถูกต้อง'; end if;
  if v_date is null or v_date < (timezone('Asia/Bangkok',now()))::date then raise exception 'วันที่จองไม่ถูกต้อง'; end if;
  if v_time is null then raise exception 'กรุณาเลือกเวลา'; end if;
  if v_guest < 1 or v_guest > 10 then raise exception 'รองรับการจองออนไลน์ 1-10 คนต่อโต๊ะ'; end if;

  select coalesce(sum(seats),0),coalesce(max(seats),0) into v_capacity,v_largest_table
  from public.restaurant_tables where status<>'disabled';
  if v_guest>v_largest_table then raise exception 'จำนวนคนเกินขนาดโต๊ะที่ร้านรองรับ'; end if;

  v_slot_start := v_date + v_time;
  v_slot_end := v_slot_start + make_interval(mins=>greatest(15,v_settings.booking_slot_minutes));
  select count(*),coalesce(sum(guest_count),0)
    into v_slot_count,v_slot_guests
  from public.reservations
  where status in ('pending','confirmed')
    and (reservation_date + reservation_time) >= v_slot_start
    and (reservation_date + reservation_time) < v_slot_end;

  if v_slot_count >= v_settings.max_bookings_per_slot then raise exception 'ช่วงเวลานี้เต็มแล้ว กรุณาเลือกเวลาอื่น'; end if;
  if v_slot_guests + v_guest > v_capacity then raise exception 'จำนวนลูกค้าช่วงเวลานี้เต็มความจุร้านแล้ว'; end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.reservations where code=v_code);
  end loop;

  insert into public.reservations(code,customer_name,customer_phone,reservation_date,reservation_time,guest_count,note,customer_birthday)
  values(v_code,v_name,v_phone,v_date,v_time,v_guest,v_note,v_birthday)
  returning id into v_id;

  return jsonb_build_object('id',v_id,'code',v_code,'status','pending');
end;
$reservation$;

create or replace function public.confirm_reservation(p_reservation_id uuid,p_table_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $confirm$
declare
  r public.reservations%rowtype;
  t public.restaurant_tables%rowtype;
  v_token text;
  v_session uuid;
begin
  if not public.has_role(array['owner','manager','cashier','staff']) then raise exception 'Unauthorized'; end if;
  select * into r from public.reservations where id=p_reservation_id for update;
  if not found or r.status<>'pending' then raise exception 'Reservation not available'; end if;
  select * into t from public.restaurant_tables where id=p_table_id for update;
  if not found or t.status<>'available' then raise exception 'โต๊ะไม่ว่าง'; end if;
  if t.seats < r.guest_count then raise exception 'จำนวนที่นั่งไม่พอ'; end if;

  loop
    v_token := upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
    exit when not exists(select 1 from public.table_sessions where token=v_token);
  end loop;

  insert into public.table_sessions(token,table_id,reservation_id,guest_count,adult_count,status)
  values(v_token,t.id,r.id,r.guest_count,r.guest_count,'reserved') returning id into v_session;
  insert into public.table_session_tables(session_id,table_id,is_primary) values(v_session,t.id,true)
  on conflict do nothing;

  update public.restaurant_tables set status='reserved' where id=t.id;
  update public.reservations set status='confirmed',table_id=t.id where id=r.id;
  perform public.log_audit('confirm_reservation','reservation',r.id::text,jsonb_build_object('table',t.code));

  return jsonb_build_object('id',r.id,'code',r.code,'status','confirmed','table_code',t.code,'session_token',v_token);
end;
$confirm$;

create or replace function public.open_walkin_session(
  p_table_id uuid,p_adult_count integer,p_child_count integer default 0,p_free_child_count integer default 0
)
returns jsonb
language plpgsql security definer set search_path=public
as $walkin$
declare
  t public.restaurant_tables%rowtype;
  v_token text;
  v_session public.table_sessions%rowtype;
  v_guest integer := coalesce(p_adult_count,0)+coalesce(p_child_count,0)+coalesce(p_free_child_count,0);
begin
  if not public.has_role(array['owner','manager','cashier','staff']) then raise exception 'Unauthorized'; end if;
  if v_guest < 1 or p_adult_count < 0 or p_child_count < 0 or p_free_child_count < 0 then raise exception 'จำนวนลูกค้าไม่ถูกต้อง'; end if;
  select * into t from public.restaurant_tables where id=p_table_id for update;
  if not found or t.status<>'available' then raise exception 'โต๊ะไม่ว่าง'; end if;
  if t.seats < v_guest then raise exception 'จำนวนที่นั่งไม่พอ'; end if;

  loop
    v_token := upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
    exit when not exists(select 1 from public.table_sessions where token=v_token);
  end loop;

  insert into public.table_sessions(token,table_id,guest_count,adult_count,child_count,free_child_count,status,started_at)
  values(v_token,t.id,v_guest,p_adult_count,p_child_count,p_free_child_count,'active',now())
  returning * into v_session;
  insert into public.table_session_tables(session_id,table_id,is_primary) values(v_session.id,t.id,true)
  on conflict do nothing;

  update public.restaurant_tables set status='occupied' where id=t.id;
  perform public.log_audit('open_walkin','table_session',v_session.id::text,jsonb_build_object('table',t.code,'guest_count',v_guest));
  return jsonb_build_object('id',v_session.id,'token',v_token,'table_code',t.code,'guest_count',v_guest,'status','active');
end;
$walkin$;

create or replace function public.merge_session_table(p_session_id uuid,p_table_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $merge$
declare
  s public.table_sessions%rowtype;
  t public.restaurant_tables%rowtype;
begin
  if not public.has_role(array['owner','manager','cashier','staff']) then raise exception 'Unauthorized'; end if;
  select * into s from public.table_sessions where id=p_session_id and status in ('reserved','active','billing') for update;
  if not found then raise exception 'Session ไม่พร้อมใช้งาน'; end if;
  select * into t from public.restaurant_tables where id=p_table_id for update;
  if not found or t.status<>'available' then raise exception 'โต๊ะไม่ว่าง'; end if;

  insert into public.table_session_tables(session_id,table_id,is_primary) values(s.id,t.id,false)
  on conflict do nothing;
  update public.restaurant_tables set status=case when s.status='billing' then 'billing' when s.status='reserved' then 'reserved' else 'occupied' end where id=t.id;
  perform public.log_audit('merge_table','table_session',s.id::text,jsonb_build_object('table',t.code));
  return jsonb_build_object('session_id',s.id,'table_code',t.code);
end;
$merge$;

create or replace function public.detach_session_table(p_session_id uuid,p_table_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $detach$
declare
  l public.table_session_tables%rowtype;
  t public.restaurant_tables%rowtype;
begin
  if not public.has_role(array['owner','manager','cashier','staff']) then raise exception 'Unauthorized'; end if;
  select * into l from public.table_session_tables where session_id=p_session_id and table_id=p_table_id for update;
  if not found then raise exception 'ไม่พบโต๊ะใน Session'; end if;
  if l.is_primary then raise exception 'ไม่สามารถแยกโต๊ะหลักได้ ให้ย้ายโต๊ะหลักก่อน'; end if;
  select * into t from public.restaurant_tables where id=p_table_id;
  delete from public.table_session_tables where session_id=p_session_id and table_id=p_table_id;
  update public.restaurant_tables set status='available' where id=p_table_id;
  perform public.log_audit('detach_table','table_session',p_session_id::text,jsonb_build_object('table',t.code));
  return jsonb_build_object('session_id',p_session_id,'table_code',t.code);
end;
$detach$;

create or replace function public.update_session_guests(
  p_session_id uuid,p_adult_count integer,p_child_count integer,p_free_child_count integer
)
returns jsonb
language plpgsql security definer set search_path=public
as $guests$
declare
  s public.table_sessions%rowtype;
  v_total integer;
  v_seats integer;
begin
  if not public.has_role(array['owner','manager','cashier','staff']) then raise exception 'Unauthorized'; end if;
  v_total := coalesce(p_adult_count,0)+coalesce(p_child_count,0)+coalesce(p_free_child_count,0);
  if v_total<1 then raise exception 'จำนวนลูกค้าไม่ถูกต้อง'; end if;
  select * into s from public.table_sessions where id=p_session_id and status in ('reserved','active','billing') for update;
  if not found then raise exception 'Session ไม่พร้อมใช้งาน'; end if;
  select coalesce(sum(t.seats),0) into v_seats
  from public.table_session_tables l join public.restaurant_tables t on t.id=l.table_id
  where l.session_id=s.id;
  if v_total>v_seats then raise exception 'จำนวนคนเกินที่นั่งของโต๊ะที่รวมอยู่'; end if;

  update public.table_sessions
  set guest_count=v_total,adult_count=p_adult_count,child_count=p_child_count,free_child_count=p_free_child_count
  where id=s.id returning * into s;
  perform public.log_audit('update_guests','table_session',s.id::text,jsonb_build_object('guest_count',v_total));
  return to_jsonb(s);
end;
$guests$;

create or replace function public.regenerate_session_qr(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $regen$
declare
  s public.table_sessions%rowtype;
  v_token text;
begin
  if not public.has_role(array['owner','manager','cashier','staff']) then raise exception 'Unauthorized'; end if;
  select * into s from public.table_sessions where id=p_session_id and status in ('reserved','active','billing') for update;
  if not found then raise exception 'Session ไม่พร้อมใช้งาน'; end if;
  loop
    v_token := upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
    exit when not exists(select 1 from public.table_sessions where token=v_token);
  end loop;
  update public.table_sessions set token=v_token where id=s.id;
  perform public.log_audit('regenerate_qr','table_session',s.id::text,'{}'::jsonb);
  return jsonb_build_object('id',s.id,'token',v_token);
end;
$regen$;

create or replace function public.update_order_status_admin(p_order_id uuid,p_status text)
returns jsonb
language plpgsql security definer set search_path=public
as $orderstatus$
declare
  o public.food_orders%rowtype;
begin
  if not public.has_role(array['owner','manager','kitchen','staff']) then raise exception 'Unauthorized'; end if;
  if p_status not in ('pending','accepted','preparing','ready','serving','served','cancelled') then raise exception 'สถานะไม่ถูกต้อง'; end if;
  update public.food_orders set
    status=p_status,
    accepted_at=case when p_status='accepted' and accepted_at is null then now() else accepted_at end,
    preparing_at=case when p_status='preparing' and preparing_at is null then now() else preparing_at end,
    ready_at=case when p_status='ready' and ready_at is null then now() else ready_at end,
    serving_at=case when p_status='serving' and serving_at is null then now() else serving_at end,
    served_at=case when p_status='served' and served_at is null then now() else served_at end,
    served_by=case when p_status in ('serving','served') then auth.uid() else served_by end
  where id=p_order_id returning * into o;
  if not found then raise exception 'ไม่พบ Order'; end if;
  perform public.log_audit('order_status','food_order',o.id::text,jsonb_build_object('status',p_status));
  return to_jsonb(o);
end;
$orderstatus$;

create or replace function public.create_food_order(p_token text,p_items jsonb)
returns jsonb
language plpgsql security definer set search_path=public
as $food$
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
    insert into public.food_order_items(order_id,menu_item_id,item_name_th,item_name_en,quantity,unit_price,line_total,station)
    values(v_order_id,m.id,m.name_th,m.name_en,q,coalesce(m.extra_price,0),coalesce(m.extra_price,0)*q,coalesce(m.station,'kitchen'));
  end loop;

  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'status','pending');
end;
$food$;

create or replace function public.update_bill_details(
  p_bill_id uuid,p_adult_count integer,p_child_count integer,p_free_child_count integer,
  p_discount_amount numeric default 0,p_promotion_code text default null,p_note text default ''
)
returns jsonb
language plpgsql security definer set search_path=public
as $billupdate$
declare
  b public.bills%rowtype;
  s public.table_sessions%rowtype;
  st public.shop_settings%rowtype;
  r public.reservations%rowtype;
  promo public.promotions%rowtype;
  v_subtotal numeric(10,2);
  v_total numeric(10,2);
  v_discount numeric(10,2) := greatest(0,coalesce(p_discount_amount,0));
  v_dow integer := extract(dow from timezone('Asia/Bangkok',now()))::integer;
  v_now_time time := timezone('Asia/Bangkok',now())::time;
begin
  if not public.has_role(array['owner','manager','cashier']) then raise exception 'Unauthorized'; end if;
  if p_adult_count<0 or p_child_count<0 or p_free_child_count<0 then raise exception 'จำนวนลูกค้าไม่ถูกต้อง'; end if;
  if p_adult_count+p_child_count+p_free_child_count < 1 then raise exception 'ต้องมีลูกค้าอย่างน้อย 1 คน'; end if;

  select * into b from public.bills where id=p_bill_id for update;
  if not found or b.status<>'pending' then raise exception 'บิลนี้แก้ไขไม่ได้'; end if;
  select * into s from public.table_sessions where id=b.session_id;
  if s.reservation_id is not null then select * into r from public.reservations where id=s.reservation_id; end if;
  select * into st from public.shop_settings where id=1;

  v_subtotal := p_adult_count*st.buffet_price + p_child_count*st.child_price;

  if nullif(trim(coalesce(p_promotion_code,'')),'') is not null then
    select * into promo from public.promotions
    where code=upper(trim(p_promotion_code))
      and is_active=true
      and (start_at is null or start_at<=now())
      and (end_at is null or end_at>=now())
      and p_adult_count+p_child_count+p_free_child_count >= min_guest_count
      and v_dow=any(weekdays)
      and (start_time is null or v_now_time>=start_time)
      and (end_time is null or v_now_time<=end_time)
    limit 1;
    if not found then raise exception 'Promotion code ไม่ถูกต้อง ไม่ตรงเงื่อนไข หรือหมดอายุ'; end if;
    if promo.birthday_only then
      if r.customer_birthday is null
         or extract(month from r.customer_birthday)<>extract(month from timezone('Asia/Bangkok',now()))
      then raise exception 'Promotion นี้ใช้สำหรับวันเกิดเท่านั้น'; end if;
    end if;
    if promo.discount_type='percent' then
      v_discount := round((v_subtotal + coalesce(b.extra_total,0)) * promo.discount_value / 100, 2);
    else
      v_discount := promo.discount_value;
    end if;
  end if;

  v_total := greatest(0,v_subtotal + coalesce(b.extra_total,0) - v_discount);
  update public.table_sessions set
    guest_count=p_adult_count+p_child_count+p_free_child_count,
    adult_count=p_adult_count,child_count=p_child_count,free_child_count=p_free_child_count
  where id=s.id;

  update public.bills set
    guest_count=p_adult_count+p_child_count+p_free_child_count,
    adult_count=p_adult_count,child_count=p_child_count,free_child_count=p_free_child_count,
    buffet_subtotal=v_subtotal,discount_amount=v_discount,
    promotion_code=case when nullif(trim(coalesce(p_promotion_code,'')),'') is null then null else upper(trim(p_promotion_code)) end,
    note=left(coalesce(p_note,''),500),total=v_total
  where id=b.id returning * into b;

  perform public.log_audit('update_bill','bill',b.id::text,jsonb_build_object('total',b.total));
  return to_jsonb(b);
end;
$billupdate$;

create or replace function public.close_bill(p_bill_id uuid,p_payment_method text)
returns jsonb
language plpgsql security definer set search_path=public
as $closebill$
declare
  b public.bills%rowtype;
  s public.table_sessions%rowtype;
  v_receipt text;
begin
  if not public.has_role(array['owner','manager','cashier']) then raise exception 'Unauthorized'; end if;
  if p_payment_method not in ('cash','promptpay','bank_transfer','card') then raise exception 'วิธีชำระเงินไม่ถูกต้อง'; end if;
  select * into b from public.bills where id=p_bill_id for update;
  if not found then raise exception 'ไม่พบบิล'; end if;
  if b.status='paid' then return to_jsonb(b); end if;
  if p_payment_method in ('promptpay','bank_transfer') and b.slip_status='pending' then
    raise exception 'กรุณาตรวจสลิปให้ผ่านก่อนปิดบิล';
  end if;
  if p_payment_method in ('promptpay','bank_transfer') and b.slip_url is not null and b.slip_status='rejected' then
    raise exception 'สลิปถูกปฏิเสธ กรุณาให้ลูกค้าส่งใหม่';
  end if;

  v_receipt := 'RC-'||to_char(timezone('Asia/Bangkok',now()),'YYMMDD')||'-'||lpad(nextval('public.receipt_number_seq')::text,5,'0');
  update public.bills set status='paid',payment_method=p_payment_method,paid_at=now(),receipt_number=v_receipt where id=b.id returning * into b;
  select * into s from public.table_sessions where id=b.session_id;
  update public.table_sessions set status='closed',closed_at=now() where id=s.id;
  update public.restaurant_tables t set status='cleaning'
  where t.id in(select table_id from public.table_session_tables where session_id=s.id);
  perform public.log_audit('close_bill','bill',b.id::text,jsonb_build_object('receipt_number',v_receipt,'payment_method',p_payment_method,'total',b.total));
  return to_jsonb(b);
end;
$closebill$;

create or replace function public.review_payment_slip(p_bill_id uuid,p_status text)
returns jsonb
language plpgsql security definer set search_path=public
as $slip$
declare
  b public.bills%rowtype;
begin
  if not public.has_role(array['owner','manager','cashier']) then raise exception 'Unauthorized'; end if;
  if p_status not in ('approved','rejected') then raise exception 'สถานะสลิปไม่ถูกต้อง'; end if;
  update public.bills set slip_status=p_status,slip_reviewed_by=auth.uid(),slip_reviewed_at=now()
  where id=p_bill_id returning * into b;
  perform public.log_audit('review_slip','bill',b.id::text,jsonb_build_object('status',p_status));
  return to_jsonb(b);
end;
$slip$;

create or replace function public.submit_payment_slip(p_token text,p_path text)
returns jsonb
language plpgsql security definer set search_path=public
as $submitslip$
declare
  s public.table_sessions%rowtype;
  b public.bills%rowtype;
begin
  select * into s from public.table_sessions where token=upper(trim(p_token)) and status='billing';
  if not found then raise exception 'Session ไม่พร้อมส่งสลิป'; end if;
  update public.bills set slip_url=p_path,slip_status='pending',slip_reviewed_by=null,slip_reviewed_at=null
  where session_id=s.id returning * into b;
  if not found then raise exception 'ไม่พบบิล'; end if;
  return jsonb_build_object('id',b.id,'slip_status',b.slip_status);
end;
$submitslip$;

create or replace function public.create_notification_for_event()
returns trigger
language plpgsql security definer set search_path=public
as $notify$
declare
  v_title text;
  v_message text;
  v_roles text[];
  v_entity text;
begin
  if tg_table_name='reservations' then
    v_title:='มีการจองโต๊ะใหม่';v_message:=new.customer_name||' • '||new.guest_count||' คน';v_roles:=array['owner','manager','cashier','staff'];v_entity:=new.id::text;
  elsif tg_table_name='food_orders' then
    v_title:='มี Order ใหม่';v_message:=new.order_number;v_roles:=array['owner','manager','kitchen','staff'];v_entity:=new.id::text;
  elsif tg_table_name='service_calls' then
    v_title:='ลูกค้าเรียกพนักงาน';v_message:=new.type;v_roles:=array['owner','manager','staff','kitchen'];v_entity:=new.id::text;
  elsif tg_table_name='bills' then
    v_title:='มีโต๊ะเรียกเช็คบิล';v_message:='ยอด '||new.total::text||' บาท';v_roles:=array['owner','manager','cashier'];v_entity:=new.id::text;
  else
    return new;
  end if;
  insert into public.notifications(event_type,title,message,entity_type,entity_id,target_roles)
  values(tg_table_name,v_title,v_message,tg_table_name,v_entity,v_roles);
  return new;
end;
$notify$;

drop trigger if exists notify_reservation_insert on public.reservations;
create trigger notify_reservation_insert after insert on public.reservations
for each row execute function public.create_notification_for_event();
drop trigger if exists notify_order_insert on public.food_orders;
create trigger notify_order_insert after insert on public.food_orders
for each row execute function public.create_notification_for_event();
drop trigger if exists notify_service_insert on public.service_calls;
create trigger notify_service_insert after insert on public.service_calls
for each row execute function public.create_notification_for_event();
drop trigger if exists notify_bill_insert on public.bills;
create trigger notify_bill_insert after insert on public.bills
for each row execute function public.create_notification_for_event();

create or replace function public.flag_low_review()
returns trigger
language plpgsql security definer set search_path=public
as $flagreview$
begin
  if new.overall<=2 then
    update public.reviews set is_flagged=true,flag_note='คะแนนรวมต่ำ กรุณาติดตามลูกค้า' where id=new.id;
    insert into public.notifications(event_type,title,message,entity_type,entity_id,target_roles)
    values('review','รีวิวคะแนนต่ำ','คะแนน '||new.overall||'/5','reviews',new.id::text,array['owner','manager']);
  end if;
  return new;
end;
$flagreview$;

drop trigger if exists flag_low_review_trigger on public.reviews;
create trigger flag_low_review_trigger after insert on public.reviews
for each row execute function public.flag_low_review();

grant execute on function public.merge_session_table(uuid,uuid) to authenticated;
grant execute on function public.detach_session_table(uuid,uuid) to authenticated;
grant execute on function public.update_session_guests(uuid,integer,integer,integer) to authenticated;
grant execute on function public.regenerate_session_qr(uuid) to authenticated;
grant execute on function public.update_order_status_admin(uuid,text) to authenticated;
grant execute on function public.review_payment_slip(uuid,text) to authenticated;
grant execute on function public.submit_payment_slip(text,text) to anon,authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notification_reads; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.knowledge_base; exception when duplicate_object then null; end;
end $$;
