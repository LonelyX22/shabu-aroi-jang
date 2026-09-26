create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'staff' check (role in ('owner','manager','cashier','kitchen','staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_settings (
  id integer primary key default 1 check (id = 1),
  shop_name_th text not null default 'ชาบูอร่อยจัง',
  shop_name_en text not null default 'Shabu Aroi Jang',
  phone text not null default '06-1564-0529',
  address_th text not null default '125/3 ม.5 ต.สามควายเผือก อ.เมือง จ.นครปฐม 73000',
  open_time time not null default '11:00',
  close_time time not null default '22:00',
  force_open boolean not null default false,
  force_closed boolean not null default false,
  buffet_price numeric(10,2) not null default 299,
  child_price numeric(10,2) not null default 149,
  dining_minutes integer not null default 120,
  promptpay text not null default '06-1564-0529',
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  seats integer not null check (seats between 1 and 30),
  status text not null default 'available' check (status in ('available','reserved','occupied','service','billing','cleaning','disabled')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_name text not null,
  customer_phone text not null,
  reservation_date date not null,
  reservation_time time not null,
  guest_count integer not null check (guest_count between 1 and 30),
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled','expired')),
  table_id uuid references public.restaurant_tables(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  table_id uuid not null references public.restaurant_tables(id),
  reservation_id uuid references public.reservations(id) on delete set null,
  guest_count integer not null check (guest_count between 1 and 30),
  status text not null default 'reserved' check (status in ('reserved','active','billing','closed','cancelled')),
  started_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name_th text not null unique,
  name_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories(id) on delete restrict,
  name_th text not null,
  name_en text not null,
  emoji text not null default '🍲',
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','preparing','ready','served','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.food_orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name_th text not null,
  item_name_en text not null,
  quantity integer not null check (quantity between 1 and 30)
);

create table if not exists public.service_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  type text not null check (type in ('soup','plates','sauce','cleanup','staff','bill','other')),
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','acknowledged','done','cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.table_sessions(id) on delete restrict,
  guest_count integer not null,
  adult_count integer not null default 0,
  child_count integer not null default 0,
  buffet_subtotal numeric(10,2) not null default 0,
  extra_total numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text check (payment_method in ('cash','promptpay','bank_transfer','card')),
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.table_sessions(id) on delete cascade,
  taste integer not null check (taste between 1 and 5),
  freshness integer not null check (freshness between 1 and 5),
  service integer not null check (service between 1 and 5),
  cleanliness integer not null check (cleanliness between 1 and 5),
  value integer not null check (value between 1 and 5),
  overall integer not null check (overall between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_reservations_created on public.reservations(created_at desc);
create index if not exists idx_reservations_date on public.reservations(reservation_date, reservation_time);
create index if not exists idx_orders_session on public.food_orders(session_id, created_at desc);
create index if not exists idx_orders_status on public.food_orders(status);
create index if not exists idx_calls_status on public.service_calls(status, created_at desc);

create sequence if not exists public.food_order_seq start 1;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_settings_updated on public.shop_settings;
create trigger trg_settings_updated before update on public.shop_settings for each row execute function public.set_updated_at();
drop trigger if exists trg_tables_updated on public.restaurant_tables;
create trigger trg_tables_updated before update on public.restaurant_tables for each row execute function public.set_updated_at();
drop trigger if exists trg_reservations_updated on public.reservations;
create trigger trg_reservations_updated before update on public.reservations for each row execute function public.set_updated_at();
drop trigger if exists trg_menu_updated on public.menu_items;
create trigger trg_menu_updated before update on public.menu_items for each row execute function public.set_updated_at();
drop trigger if exists trg_orders_updated on public.food_orders;
create trigger trg_orders_updated before update on public.food_orders for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and is_active=true
      and role in ('owner','manager','cashier','kitchen','staff')
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and is_active=true and role='owner'
  );
$$;

create or replace function public.current_shop_open()
returns boolean
language plpgsql stable security definer set search_path=public
as $$
declare
  s public.shop_settings%rowtype;
  now_time time := (timezone('Asia/Bangkok',now()))::time;
begin
  select * into s from public.shop_settings where id=1;
  if not found then return false; end if;
  if s.force_open then return true; end if;
  if s.force_closed then return false; end if;
  return now_time >= s.open_time and now_time < s.close_time;
end;
$$;

create or replace function public.create_reservation(p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_code text;
  v_name text;
  v_phone text;
  v_date date;
  v_time time;
  v_guest integer;
  v_note text;
  v_id uuid;
begin
  if not public.current_shop_open() then
    raise exception 'ร้านปิดรับการจองในขณะนี้';
  end if;

  v_name := trim(coalesce(p_payload->>'customer_name',''));
  v_phone := regexp_replace(coalesce(p_payload->>'customer_phone',''),'\D','','g');
  v_date := nullif(p_payload->>'reservation_date','')::date;
  v_time := nullif(p_payload->>'reservation_time','')::time;
  v_guest := coalesce((p_payload->>'guest_count')::integer,0);
  v_note := left(coalesce(p_payload->>'note',''),300);

  if length(v_name)<1 or length(v_name)>80 then raise exception 'ชื่อไม่ถูกต้อง'; end if;
  if v_phone !~ '^0[0-9]{9}$' then raise exception 'เบอร์โทรไม่ถูกต้อง'; end if;
  if v_date is null or v_date < (timezone('Asia/Bangkok',now()))::date then raise exception 'วันที่จองไม่ถูกต้อง'; end if;
  if v_time is null then raise exception 'กรุณาเลือกเวลา'; end if;
  if v_guest < 1 or v_guest > 10 then raise exception 'รองรับการจองออนไลน์ 1-10 คนต่อโต๊ะ'; end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.reservations where code=v_code);
  end loop;

  insert into public.reservations(code,customer_name,customer_phone,reservation_date,reservation_time,guest_count,note)
  values(v_code,v_name,v_phone,v_date,v_time,v_guest,v_note)
  returning id into v_id;

  return jsonb_build_object('id',v_id,'code',v_code,'status','pending');
end;
$$;

create or replace function public.get_reservation_by_code(p_code text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  r public.reservations%rowtype;
  t public.restaurant_tables%rowtype;
  s public.table_sessions%rowtype;
begin
  select * into r from public.reservations where code=upper(trim(p_code)) limit 1;
  if not found then return null; end if;
  if r.table_id is not null then select * into t from public.restaurant_tables where id=r.table_id; end if;
  select * into s from public.table_sessions where reservation_id=r.id order by created_at desc limit 1;

  return jsonb_build_object(
    'id',r.id,'code',r.code,'customer_name',r.customer_name,'customer_phone',r.customer_phone,
    'reservation_date',r.reservation_date,'reservation_time',r.reservation_time,'guest_count',r.guest_count,
    'note',r.note,'status',r.status,'table_code',t.code,
    'session_token',case when r.status='confirmed' then s.token else null end,
    'created_at',r.created_at
  );
end;
$$;

create or replace function public.confirm_reservation(p_reservation_id uuid,p_table_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  r public.reservations%rowtype;
  t public.restaurant_tables%rowtype;
  v_token text;
  v_session uuid;
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  select * into r from public.reservations where id=p_reservation_id for update;
  if not found or r.status<>'pending' then raise exception 'Reservation not available'; end if;
  select * into t from public.restaurant_tables where id=p_table_id for update;
  if not found or t.status<>'available' then raise exception 'โต๊ะไม่ว่าง'; end if;
  if t.seats < r.guest_count then raise exception 'จำนวนที่นั่งไม่พอ'; end if;

  loop
    v_token := upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
    exit when not exists(select 1 from public.table_sessions where token=v_token);
  end loop;

  insert into public.table_sessions(token,table_id,reservation_id,guest_count,status)
  values(v_token,t.id,r.id,r.guest_count,'reserved') returning id into v_session;

  update public.restaurant_tables set status='reserved' where id=t.id;
  update public.reservations set status='confirmed',table_id=t.id where id=r.id;

  return jsonb_build_object('id',r.id,'code',r.code,'status','confirmed','table_code',t.code,'session_token',v_token);
end;
$$;

create or replace function public.get_table_session(p_token text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  s public.table_sessions%rowtype;
  t public.restaurant_tables%rowtype;
begin
  select * into s from public.table_sessions where token=upper(trim(p_token)) limit 1;
  if not found then return null; end if;
  select * into t from public.restaurant_tables where id=s.table_id;
  return jsonb_build_object(
    'id',s.id,'token',s.token,'status',s.status,'guest_count',s.guest_count,
    'table_id',t.id,'table_code',t.code,'started_at',s.started_at,'closed_at',s.closed_at
  );
end;
$$;

create or replace function public.activate_table_session(p_token text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  s public.table_sessions%rowtype;
begin
  select * into s from public.table_sessions where token=upper(trim(p_token)) for update;
  if not found or s.status not in ('reserved','active') then raise exception 'QR หมดอายุหรือไม่พร้อมใช้งาน'; end if;
  if s.status='reserved' then
    update public.table_sessions set status='active',started_at=now() where id=s.id;
    update public.restaurant_tables set status='occupied' where id=s.table_id;
  end if;
  return public.get_table_session(p_token);
end;
$$;

create or replace function public.create_food_order(p_token text,p_items jsonb)
returns jsonb
language plpgsql security definer set search_path=public
as $$
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
    insert into public.food_order_items(order_id,menu_item_id,item_name_th,item_name_en,quantity)
    values(v_order_id,m.id,m.name_th,m.name_en,q);
  end loop;

  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'status','pending');
end;
$$;

create or replace function public.get_session_orders(p_token text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  s public.table_sessions%rowtype;
begin
  select * into s from public.table_sessions where token=upper(trim(p_token));
  if not found then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',o.id,'order_number',o.order_number,'status',o.status,'created_at',o.created_at,
      'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name_th',i.item_name_th,'name_en',i.item_name_en,'quantity',i.quantity)) from public.food_order_items i where i.order_id=o.id),'[]'::jsonb)
    ) order by o.created_at desc)
    from public.food_orders o where o.session_id=s.id
  ),'[]'::jsonb);
end;
$$;

create or replace function public.create_service_call(p_token text,p_type text,p_note text default '')
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  s public.table_sessions%rowtype;
  c public.service_calls%rowtype;
begin
  select * into s from public.table_sessions where token=upper(trim(p_token)) and status='active';
  if not found then raise exception 'Session ไม่พร้อมใช้งาน'; end if;
  if p_type not in ('soup','plates','sauce','cleanup','staff','bill','other') then raise exception 'ประเภทไม่ถูกต้อง'; end if;
  insert into public.service_calls(session_id,type,note) values(s.id,p_type,left(coalesce(p_note,''),200)) returning * into c;
  update public.restaurant_tables set status=case when p_type='bill' then 'billing' else 'service' end where id=s.table_id;
  return to_jsonb(c);
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
  v_total numeric(10,2);
begin
  select * into s from public.table_sessions where token=upper(trim(p_token)) and status='active' for update;
  if not found then raise exception 'Session ไม่พร้อมใช้งาน'; end if;
  select * into st from public.shop_settings where id=1;
  v_total := s.guest_count * st.buffet_price;

  insert into public.bills(session_id,guest_count,adult_count,buffet_subtotal,total)
  values(s.id,s.guest_count,s.guest_count,v_total,v_total)
  on conflict(session_id) do update set total=excluded.total
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
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  if p_payment_method not in ('cash','promptpay','bank_transfer','card') then raise exception 'วิธีชำระเงินไม่ถูกต้อง'; end if;
  select * into b from public.bills where id=p_bill_id for update;
  if not found then raise exception 'ไม่พบบิล'; end if;
  if b.status='paid' then return to_jsonb(b); end if;

  update public.bills set status='paid',payment_method=p_payment_method,paid_at=now() where id=b.id returning * into b;
  select * into s from public.table_sessions where id=b.session_id;
  update public.table_sessions set status='closed',closed_at=now() where id=s.id;
  update public.restaurant_tables set status='cleaning' where id=s.table_id;
  return to_jsonb(b);
end;
$$;

create or replace function public.submit_review(p_token text,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  s public.table_sessions%rowtype;
  r public.reviews%rowtype;
begin
  select * into s from public.table_sessions where token=upper(trim(p_token)) and status='closed';
  if not found then raise exception 'สามารถประเมินได้หลังชำระเงินเท่านั้น'; end if;

  insert into public.reviews(session_id,taste,freshness,service,cleanliness,value,overall,comment)
  values(
    s.id,
    (p_payload->>'taste')::integer,(p_payload->>'freshness')::integer,(p_payload->>'service')::integer,
    (p_payload->>'cleanliness')::integer,(p_payload->>'value')::integer,(p_payload->>'overall')::integer,
    left(coalesce(p_payload->>'comment',''),500)
  )
  on conflict(session_id) do update set
    taste=excluded.taste,freshness=excluded.freshness,service=excluded.service,
    cleanliness=excluded.cleanliness,value=excluded.value,overall=excluded.overall,comment=excluded.comment
  returning * into r;
  return to_jsonb(r);
end;
$$;

alter table public.profiles enable row level security;
alter table public.shop_settings enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.reservations enable row level security;
alter table public.table_sessions enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.food_orders enable row level security;
alter table public.food_order_items enable row level security;
alter table public.service_calls enable row level security;
alter table public.bills enable row level security;
alter table public.reviews enable row level security;

drop policy if exists settings_public_read on public.shop_settings;
create policy settings_public_read on public.shop_settings for select to anon,authenticated using(true);
drop policy if exists settings_admin_update on public.shop_settings;
create policy settings_admin_update on public.shop_settings for update to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists menu_categories_public_read on public.menu_categories;
create policy menu_categories_public_read on public.menu_categories for select to anon,authenticated using(is_active=true or public.is_admin());
drop policy if exists menu_items_public_read on public.menu_items;
create policy menu_items_public_read on public.menu_items for select to anon,authenticated using(is_available=true or public.is_admin());

drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_owner());

drop policy if exists tables_admin_all on public.restaurant_tables;
create policy tables_admin_all on public.restaurant_tables for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists reservations_admin_all on public.reservations;
create policy reservations_admin_all on public.reservations for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists sessions_admin_read on public.table_sessions;
create policy sessions_admin_read on public.table_sessions for select to authenticated using(public.is_admin());
drop policy if exists orders_admin_all on public.food_orders;
create policy orders_admin_all on public.food_orders for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists order_items_admin_read on public.food_order_items;
create policy order_items_admin_read on public.food_order_items for select to authenticated using(public.is_admin());
drop policy if exists calls_admin_all on public.service_calls;
create policy calls_admin_all on public.service_calls for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists bills_admin_all on public.bills;
create policy bills_admin_all on public.bills for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists reviews_admin_read on public.reviews;
create policy reviews_admin_read on public.reviews for select to authenticated using(public.is_admin());

grant execute on function public.create_reservation(jsonb) to anon,authenticated;
grant execute on function public.get_reservation_by_code(text) to anon,authenticated;
grant execute on function public.get_table_session(text) to anon,authenticated;
grant execute on function public.activate_table_session(text) to anon,authenticated;
grant execute on function public.create_food_order(text,jsonb) to anon,authenticated;
grant execute on function public.get_session_orders(text) to anon,authenticated;
grant execute on function public.create_service_call(text,text,text) to anon,authenticated;
grant execute on function public.request_bill(text) to anon,authenticated;
grant execute on function public.submit_review(text,jsonb) to anon,authenticated;
grant execute on function public.confirm_reservation(uuid,uuid) to authenticated;
grant execute on function public.close_bill(uuid,text) to authenticated;

insert into public.shop_settings(id) values(1) on conflict(id) do nothing;

do $$
begin
  begin alter publication supabase_realtime add table public.restaurant_tables; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.reservations; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.food_orders; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.service_calls; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.bills; exception when duplicate_object then null; end;
end $$;
