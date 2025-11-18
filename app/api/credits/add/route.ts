import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is teacher
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can add credits' }, { status: 403 })
    }

    const { studentId, amount, reason } = await request.json()

    if (!studentId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // Get student profile
    const { data: student } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', studentId)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Add credits
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits: student.credits + amount })
      .eq('id', studentId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Record transaction
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: studentId,
        amount,
        type: 'add',
        reason: reason || 'เติมเครดิตจากครู',
        created_by: user.id,
      })

    if (transactionError) {
      console.error('Transaction error:', transactionError)
    }

    return NextResponse.json({
      success: true,
      newBalance: student.credits + amount,
    })
  } catch (error: any) {
    console.error('Error adding credits:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
