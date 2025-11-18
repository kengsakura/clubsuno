-- Fix RLS policies for profiles table
-- ลบ policy เก่าที่อาจทับซ้อนกัน
DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can update student credits" ON public.profiles;

-- สร้าง policy ใหม่ที่ชัดเจนกว่า
-- Policy 1: ครูสามารถดูข้อมูล student ทั้งหมดได้
CREATE POLICY "Teachers can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- ถ้าเป็นการดูตัวเอง หรือ ถ้า user ที่ login เป็น teacher
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
  );

-- Policy 2: ครูสามารถอัปเดตข้อมูล (เช่น credits) ของ student ได้
CREATE POLICY "Teachers can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- อนุญาตให้แก้ไขตัวเองหรือถ้าเป็น teacher
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
  )
  WITH CHECK (
    -- ตรวจสอบเงื่อนไขเดียวกัน
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
  );

-- ตรวจสอบว่า policy ทำงานถูกต้อง
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles';
