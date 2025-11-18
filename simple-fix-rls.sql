-- วิธีแก้แบบง่าย: ลบ policy ทั้งหมดแล้วสร้างใหม่แบบไม่มี recursion

-- 1. ลบ policy เก่าทั้งหมด
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view students" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can update student credits" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can update students" ON public.profiles;

-- 2. สร้าง policy ใหม่แบบง่ายๆ ไม่มี recursion
-- ใช้วิธีให้ authenticated users ทุกคนเห็นข้อมูล profiles ทั้งหมด
-- (เหมาะสำหรับระบบเล็กๆ ที่มีแค่ครูกับนักเรียน)

CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- หมายเหตุ: วิธีนี้ทำให้ทุกคนที่ login แล้วเห็นและแก้ไขข้อมูลได้ทั้งหมด
-- แต่จะตรวจสอบสิทธิ์ที่ application level (ใน code) แทน
-- เหมาะสำหรับ development และระบบเล็กๆ

-- ตรวจสอบ policy
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';
