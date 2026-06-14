create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.job_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'AI 求职画布',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.job_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_type text not null check (file_type in ('resume', 'jd', 'other')),
  storage_bucket text not null default 'career-canvas-assets',
  storage_path text not null,
  mime_type text not null check (
    mime_type in (
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/markdown',
      'text/x-markdown',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  size_bytes integer not null check (size_bytes > 0),
  original_filename text,
  created_at timestamptz not null default now()
);

create table if not exists public.canvas_nodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.job_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  node_type text not null check (
    node_type in (
      'input',
      'persona',
      'recommended_jobs',
      'job_detail',
      'jd_request',
      'jd_analysis',
      'optimization_suggestions',
      'optimized_resume',
      'career_change_translation'
    )
  ),
  title text not null,
  content_markdown text not null,
  version integer not null default 1 check (version > 0),
  position_x integer not null default 0,
  position_y integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.canvas_edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.job_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_node_id uuid not null references public.canvas_nodes(id) on delete cascade,
  target_node_id uuid not null references public.canvas_nodes(id) on delete cascade,
  label text not null default 'continues',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.job_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_node_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now()
);

create index if not exists job_workspaces_user_updated_idx
  on public.job_workspaces(user_id, updated_at desc);

create index if not exists uploaded_files_workspace_idx
  on public.uploaded_files(workspace_id, user_id, created_at);

create index if not exists canvas_nodes_workspace_position_idx
  on public.canvas_nodes(workspace_id, user_id, position_x, created_at);

create index if not exists canvas_edges_workspace_idx
  on public.canvas_edges(workspace_id, user_id, created_at);

create index if not exists ai_messages_workspace_idx
  on public.ai_messages(workspace_id, user_id, created_at);

drop trigger if exists set_job_workspaces_updated_at on public.job_workspaces;
create trigger set_job_workspaces_updated_at
before update on public.job_workspaces
for each row execute function public.set_updated_at();

drop trigger if exists set_canvas_nodes_updated_at on public.canvas_nodes;
create trigger set_canvas_nodes_updated_at
before update on public.canvas_nodes
for each row execute function public.set_updated_at();

alter table public.job_workspaces enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.canvas_nodes enable row level security;
alter table public.canvas_edges enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists "Users can read own workspaces" on public.job_workspaces;
create policy "Users can read own workspaces"
on public.job_workspaces for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own workspaces" on public.job_workspaces;
create policy "Users can insert own workspaces"
on public.job_workspaces for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own workspaces" on public.job_workspaces;
create policy "Users can update own workspaces"
on public.job_workspaces for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own workspaces" on public.job_workspaces;
create policy "Users can delete own workspaces"
on public.job_workspaces for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own files" on public.uploaded_files;
create policy "Users can read own files"
on public.uploaded_files for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own files" on public.uploaded_files;
create policy "Users can insert own files"
on public.uploaded_files for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own files" on public.uploaded_files;
create policy "Users can update own files"
on public.uploaded_files for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own files" on public.uploaded_files;
create policy "Users can delete own files"
on public.uploaded_files for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own nodes" on public.canvas_nodes;
create policy "Users can read own nodes"
on public.canvas_nodes for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own nodes" on public.canvas_nodes;
create policy "Users can insert own nodes"
on public.canvas_nodes for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own nodes" on public.canvas_nodes;
create policy "Users can update own nodes"
on public.canvas_nodes for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own nodes" on public.canvas_nodes;
create policy "Users can delete own nodes"
on public.canvas_nodes for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own edges" on public.canvas_edges;
create policy "Users can read own edges"
on public.canvas_edges for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own edges" on public.canvas_edges;
create policy "Users can insert own edges"
on public.canvas_edges for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own edges" on public.canvas_edges;
create policy "Users can update own edges"
on public.canvas_edges for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own edges" on public.canvas_edges;
create policy "Users can delete own edges"
on public.canvas_edges for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own messages" on public.ai_messages;
create policy "Users can read own messages"
on public.ai_messages for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own messages" on public.ai_messages;
create policy "Users can insert own messages"
on public.ai_messages for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own messages" on public.ai_messages;
create policy "Users can update own messages"
on public.ai_messages for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own messages" on public.ai_messages;
create policy "Users can delete own messages"
on public.ai_messages for delete
to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'career-canvas-assets',
  'career-canvas-assets',
  false,
  10485760,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/markdown',
    'text/x-markdown',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own career canvas assets" on storage.objects;
create policy "Users can read own career canvas assets"
on storage.objects for select
to authenticated
using (
  bucket_id = 'career-canvas-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can insert own career canvas assets" on storage.objects;
create policy "Users can insert own career canvas assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'career-canvas-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own career canvas assets" on storage.objects;
create policy "Users can update own career canvas assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'career-canvas-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'career-canvas-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own career canvas assets" on storage.objects;
create policy "Users can delete own career canvas assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'career-canvas-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);
