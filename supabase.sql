-- Shared passport, deliberately readable/editable without login.
begin;
create table if not exists public.passport_shared (
 id text primary key check(id='aangi'), state jsonb not null,
 revision bigint not null default 1 check(revision>0), updated_at timestamptz not null default now(),
 constraint shared_state_shape check(jsonb_typeof(state)='object'),
 constraint shared_state_size check(octet_length(state::text)<=1048576)
);
insert into public.passport_shared(id,state) values('aangi','{"cur":0,"t":{},"p":{},"m":{},"mute":false}') on conflict do nothing;
alter table public.passport_shared enable row level security;
revoke all on public.passport_shared from anon,authenticated;
grant select on public.passport_shared to anon,authenticated;
create policy shared_passport_read on public.passport_shared for select to anon,authenticated using(id='aangi');
create or replace function public.save_shared_passport(expected_revision bigint,new_state jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare current_revision bigint; photo_group record; photo_path jsonb;
begin
 if expected_revision is null or expected_revision<1 or new_state is null or jsonb_typeof(new_state)<>'object'
  or octet_length(new_state::text)>1048576 or jsonb_typeof(new_state->'p') is distinct from 'object'
  or jsonb_typeof(new_state->'t') is distinct from 'object' or jsonb_typeof(new_state->'m') is distinct from 'object' then raise exception 'invalid_passport'; end if;
 for photo_group in select * from jsonb_each(new_state->'p') loop
  if photo_group.key<>'id' and photo_group.key!~'^p([1-9]|1[0-9]|20)$' then raise exception 'invalid_photo_group'; end if;
  if jsonb_typeof(photo_group.value)<>'array' or jsonb_array_length(photo_group.value)>100 then raise exception 'invalid_photo_list'; end if;
  for photo_path in select value from jsonb_array_elements(photo_group.value) loop
   if jsonb_typeof(photo_path)<>'string' or (photo_path#>>'{}')!~'^aangi/[a-f0-9]{64}\.(jpg|png|webp)$' then raise exception 'invalid_photo_path'; end if;
  end loop;
 end loop;
 select revision into current_revision from public.passport_shared where id='aangi' for update;
 if not found or current_revision<>expected_revision then raise exception 'journal_conflict'; end if;
 update public.passport_shared set state=new_state,revision=current_revision+1,updated_at=now() where id='aangi';
 return current_revision+1;
end;
$$;
revoke all on function public.save_shared_passport(bigint,jsonb) from public;
grant execute on function public.save_shared_passport(bigint,jsonb) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('passport-public-photos','passport-public-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy shared_passport_photo_read on storage.objects for select to anon,authenticated using(bucket_id='passport-public-photos' and name~'^aangi/[a-f0-9]{64}\.(jpg|png|webp)$');
create policy shared_passport_photo_add on storage.objects for insert to anon,authenticated with check(bucket_id='passport-public-photos' and name~'^aangi/[a-f0-9]{64}\.(jpg|png|webp)$');
-- Removing a photo removes its journal reference; immutable originals remain for recovery.
notify pgrst,'reload schema';
commit;

