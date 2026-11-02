-- Run once in a new Supabase project's SQL editor.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null,
 role text not null check (role in ('coach','athlete'))
);
create function public.is_coach() returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='coach');
$$;
revoke all on function public.is_coach() from public;
grant execute on function public.is_coach() to authenticated;
create table public.sessions (
 id uuid primary key,
 athlete_id uuid not null references public.profiles(id),
 date date not null,
 kind text not null check (kind in ('Track','Gym','Trainer','Recovery')),
 title text not null, objective text not null default '', warmup text not null default '', cues text not null default '',
 threshold numeric check(threshold > 0 and threshold <= 100),
 efforts jsonb not null check(jsonb_typeof(efforts)='array' and jsonb_array_length(efforts)>0)
);
create index sessions_athlete_date on public.sessions(athlete_id,date);
create table public.results (
 id uuid primary key,
 session_id uuid not null references public.sessions(id) on delete cascade,
 effort_id uuid not null,
 athlete_id uuid not null references public.profiles(id),
 time numeric check(time > 0), split numeric check(split > 0),
 gear numeric check(gear > 0), power numeric check(power > 0),
 rpe numeric check(rpe between 1 and 10), weight numeric check(weight > 0),
 reps integer check(reps > 0), duration numeric check(duration > 0),
 notes text not null default '',
 check (split is null or time is null or split <= time),
 unique(session_id,effort_id)
);
create index results_athlete on public.results(athlete_id);
-- A trigger guards references to effort IDs inside the session JSON, also for direct API requests.
create function public.check_effort() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from public.sessions s, jsonb_array_elements(s.efforts) e
  where s.id=new.session_id and s.athlete_id=new.athlete_id and e->>'id'=new.effort_id::text)
 then raise exception 'Effort does not belong to this athlete and session'; end if;
 return new;
end; $$;
create trigger validate_effort before insert or update on public.results for each row execute function public.check_effort();
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.results enable row level security;
revoke all on public.profiles, public.sessions, public.results from anon, authenticated;
grant select on public.profiles to authenticated;
grant select,insert,update,delete on public.sessions to authenticated;
grant select,insert,update on public.results to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_coach());
-- No browser role changes or profile creation: provisioning is admin-only.
create policy sessions_read on public.sessions for select to authenticated using(athlete_id=auth.uid() or public.is_coach());
create policy sessions_coach_insert on public.sessions for insert to authenticated with check(public.is_coach());
create policy sessions_coach_update on public.sessions for update to authenticated using(public.is_coach()) with check(public.is_coach());
create policy sessions_coach_delete on public.sessions for delete to authenticated using(public.is_coach());
create policy results_read on public.results for select to authenticated using(athlete_id=auth.uid() or public.is_coach());
create policy results_insert on public.results for insert to authenticated with check(athlete_id=auth.uid() and exists(select 1 from public.sessions s where s.id=session_id and s.athlete_id=auth.uid()));
create policy results_update on public.results for update to authenticated using(athlete_id=auth.uid()) with check(athlete_id=auth.uid() and exists(select 1 from public.sessions s where s.id=session_id and s.athlete_id=auth.uid()));
-- Preserve the meaning of historical results. Copy a logged plan to change its protocol.
create function public.protect_logged_session() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.results where session_id=old.id) and
 (new.athlete_id is distinct from old.athlete_id or new.kind is distinct from old.kind or new.efforts is distinct from old.efforts)
 then raise exception 'Copy this session to change athlete, type or efforts after results are logged'; end if;
 return new;
end; $$;
create trigger preserve_protocol before update on public.sessions for each row execute function public.protect_logged_session();
