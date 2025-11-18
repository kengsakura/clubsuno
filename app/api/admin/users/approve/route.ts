import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createServiceClient()

    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'teacher') {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ในการดำเนินการนี้' }, { status: 403 })
    }

    // Get request data
    const { user_id, approved } = await request.json()

    if (!user_id || typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง: ต้องการ user_id และ approved (boolean)' }, { status: 400 })
    }

    // Update user approval status
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ approved })
      .eq('id', user_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: approved ? 'อนุมัติผู้ใช้งานเรียบร้อยแล้ว' : 'ยกเลิกการอนุมัติเรียบร้อยแล้ว' })
  } catch (error: any) {
    console.error('Error approving user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
