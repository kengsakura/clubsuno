-- Function to get email by username (bypassing RLS)
create or replace function public.get_email_by_username(username_input text)
returns table (email text, approved boolean)
language plpgsql
security definer
as $$
begin
  return query
  select p.email, p.approved
  from public.profiles p
  where p.username = username_input;
end;
$$;

-- Function to check if username exists (bypassing RLS)
create or replace function public.check_username_exists(username_input text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1
    from public.profiles
    where username = username_input
  );
end;
$$;
