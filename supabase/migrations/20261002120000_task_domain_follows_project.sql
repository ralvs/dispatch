-- A task in a project is filed in that project's domain (docs/adr/0072).
--
-- The rule used to live in the app, and only on two of its write paths:
-- capture (resolveTaskRouting: the project wins) and the form's title-only
-- path (withStatedDomain: a stated domain wins, and the project is dropped).
-- The form's own create and edit, assignDomain, and a project moving to
-- another domain all wrote whatever they were given. The database sees every
-- write, so the rule lives here now, once. Those two precedence rules stay in
-- the app: they decide WHICH project a capture keeps, before the write.
--
-- Adding this changes nothing the live code relies on: every write the app
-- makes today already satisfies it, or is corrected to what the form shows.

-- On any write that sets a task's project or domain, the project's domain
-- wins. A task with no project keeps the domain it was given (or none: the
-- inbox, docs/adr/0027).
create or replace function public.task_domain_follows_project()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  project_domain uuid;
begin
  if new.project_id is not null then
    select p.domain_id into project_domain from public.projects p where p.id = new.project_id;
    if found then
      new.domain_id := project_domain;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_domain_follows_project on public.tasks;
create trigger trg_tasks_domain_follows_project
  before insert or update of project_id, domain_id on public.tasks
  for each row execute function public.task_domain_follows_project();

-- A project that moves to another domain takes its tasks with it.
create or replace function public.project_domain_moves_tasks()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.tasks
    set domain_id = new.domain_id
    where project_id = new.id and domain_id is distinct from new.domain_id;
  return null;
end;
$$;

drop trigger if exists trg_projects_domain_moves_tasks on public.projects;
create trigger trg_projects_domain_moves_tasks
  after update of domain_id on public.projects
  for each row
  when (old.domain_id is distinct from new.domain_id)
  execute function public.project_domain_moves_tasks();

-- Rows written before the rule existed.
update public.tasks t
  set domain_id = p.domain_id
  from public.projects p
  where t.project_id = p.id and t.domain_id is distinct from p.domain_id;
