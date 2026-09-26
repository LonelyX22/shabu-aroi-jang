-- Exact admin live lists for Shabu Aroi Jang
-- Run after 20260927_production_completion.sql

create or replace function public.admin_list_service_calls()
returns jsonb
language plpgsql
security definer
set search_path=public
as $svc$
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',c.id,
        'session_id',c.session_id,
        'type',c.type,
        'note',c.note,
        'status',c.status,
        'created_at',c.created_at,
        'resolved_at',c.resolved_at,
        'table_code',t.code
      )
      order by c.created_at desc
    )
    from public.service_calls c
    join public.table_sessions s on s.id=c.session_id
    join public.restaurant_tables t on t.id=s.table_id
  ),'[]'::jsonb);
end;
$svc$;

create or replace function public.admin_list_orders()
returns jsonb
language plpgsql
security definer
set search_path=public
as $ord$
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',o.id,
        'order_number',o.order_number,
        'session_id',o.session_id,
        'status',o.status,
        'created_at',o.created_at,
        'accepted_at',o.accepted_at,
        'preparing_at',o.preparing_at,
        'ready_at',o.ready_at,
        'serving_at',o.serving_at,
        'served_at',o.served_at,
        'table_code',t.code,
        'items',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id',i.id,
              'menu_item_id',i.menu_item_id,
              'name_th',i.item_name_th,
              'name_en',i.item_name_en,
              'quantity',i.quantity,
              'station',i.station
            )
            order by i.id
          )
          from public.food_order_items i
          where i.order_id=o.id
        ),'[]'::jsonb)
      )
      order by o.created_at desc
    )
    from public.food_orders o
    join public.table_sessions s on s.id=o.session_id
    join public.restaurant_tables t on t.id=s.table_id
  ),'[]'::jsonb);
end;
$ord$;

grant execute on function public.admin_list_service_calls() to authenticated;
grant execute on function public.admin_list_orders() to authenticated;
