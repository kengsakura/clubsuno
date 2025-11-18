-- ลบ policy ทั้งหมดของ profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can update student credits" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can update all profiles" ON public.profiles;

-- สร้าง policy ใหม่ที่ไม่มี recursion
-- Policy 1: ทุกคนดูข้อมูลตัวเองได้
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: ครูดูข้อมูล student ทั้งหมดได้ (ไม่ใช้ subquery ที่วนลูป)
CREATE POLICY "Teachers can view students"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- เช็คจาก metadata ของ JWT token แทน
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'teacher'
    OR
    -- หรือเช็คจาก app_metadata
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
  );

-- Policy 3: ทุกคนแก้ไขข้อมูลตัวเองได้
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 4: ครูแก้ไขข้อมูล student ได้
CREATE POLICY "Teachers can update students"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'teacher'
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'teacher'
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
  );
