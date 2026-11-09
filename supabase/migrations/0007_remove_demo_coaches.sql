-- Remove demo coaches; keep 丹内 智弥 only as product consult owner.
delete from public.coaches
where name in ('高橋 健', '佐藤 みお');
