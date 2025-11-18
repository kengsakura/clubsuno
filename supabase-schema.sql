-- ====================================
-- Suno Music Generator Web App Schema
-- ====================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ====================================
-- TABLES
-- ====================================

-- Users table (extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  role text not null check (role in ('teacher', 'student')),
  credits integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Settings table (for teachers to configure)
create table public.settings (
  id uuid default uuid_generate_v4() primary key,
  key text unique not null,
  value jsonb not null,
  created_by uuid references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Songs table
create table public.songs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  lyrics text not null,
  style text not null,
  task_id text,
  status text not null check (status in ('pending', 'generating', 'completed', 'failed')) default 'pending',
  audio_url text,
  audio_path text,
  duration integer,
  credits_used integer not null default 0,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Credit transactions table
create table public.credit_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount integer not null,
  type text not null check (type in ('add', 'deduct')),
  reason text not null,
  related_song_id uuid references public.songs(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ====================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.songs enable row level security;
alter table public.credit_transactions enable row level security;

-- Profiles policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Teachers can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Teachers can update student credits"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

-- Settings policies
create policy "Teachers can manage settings"
  on public.settings for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

create policy "Everyone can view settings"
  on public.settings for select
  using (true);

-- Songs policies
create policy "Users can view their own songs"
  on public.songs for select
  using (auth.uid() = user_id);

create policy "Teachers can view all songs"
  on public.songs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

create policy "Users can create their own songs"
  on public.songs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own songs"
  on public.songs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own songs"
  on public.songs for delete
  using (auth.uid() = user_id);

-- Credit transactions policies
create policy "Users can view their own transactions"
  on public.credit_transactions for select
  using (auth.uid() = user_id);

create policy "Teachers can view all transactions"
  on public.credit_transactions for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

create policy "Teachers can create transactions"
  on public.credit_transactions for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

create policy "System can create transactions"
  on public.credit_transactions for insert
  with check (true);

-- ====================================
-- FUNCTIONS
-- ====================================

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger settings_updated_at before update on public.settings
  for each row execute procedure public.handle_updated_at();

create trigger songs_updated_at before update on public.songs
  for each row execute procedure public.handle_updated_at();

-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, credits)
  values (new.id, new.email, 'student', 0);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ====================================
-- INDEXES
-- ====================================

create index songs_user_id_idx on public.songs(user_id);
create index songs_status_idx on public.songs(status);
create index credit_transactions_user_id_idx on public.credit_transactions(user_id);
create index profiles_role_idx on public.profiles(role);

-- ====================================
-- STORAGE SETUP
-- ====================================

-- Create storage bucket for songs
insert into storage.buckets (id, name, public)
values ('songs', 'songs', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Users can upload their own songs"
  on storage.objects for insert
  with check (
    bucket_id = 'songs' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view their own songs"
  on storage.objects for select
  using (
    bucket_id = 'songs' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Teachers can view all songs"
  on storage.objects for select
  using (
    bucket_id = 'songs' and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

create policy "Users can delete their own songs"
  on storage.objects for delete
  using (
    bucket_id = 'songs' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ====================================
-- DEFAULT DATA
-- ====================================

-- Insert default settings
insert into public.settings (key, value) values
  ('credits_per_song', '1'::jsonb),
  ('suno_api_key', '""'::jsonb),
  ('ai_api_key', '""'::jsonb),
  ('ai_provider', '"openai"'::jsonb),
  ('ai_model', '"gpt-4o-mini"'::jsonb)
on conflict (key) do nothing;
