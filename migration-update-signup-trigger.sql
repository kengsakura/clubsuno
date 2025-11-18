-- Migration: Update signup trigger to set approved = false for new users
-- Date: 2025-01-18

-- Drop and recreate the handle_new_user function with approval support
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract username from metadata if exists
  INSERT INTO public.profiles (id, email, username, role, credits, approved)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'username',
    'student',
    0,
    false  -- New signups require approval
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Creates profile for new user with approved=false, requiring admin approval';
