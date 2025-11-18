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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can create users' }, { status: 403 })
    }

    // Get request data
    const { username, full_name, initial_credits = 10 } = await request.json()

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Check if username already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }

    // Generate dummy email for Supabase Auth requirement
    const dummyEmail = `${username}@student.local`
    const defaultPassword = username // Use username as default password

    // Create auth user
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: dummyEmail,
      password: defaultPassword,
      email_confirm: true,
    })

    if (authCreateError || !authData.user) {
      console.error('Error creating auth user:', authCreateError)
      return NextResponse.json({ error: authCreateError?.message || 'Failed to create user' }, { status: 500 })
    }

    // Update profile with username and approved status
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        username: username,
        full_name: full_name || username,
        role: 'student',
        credits: initial_credits,
        approved: true, // Admin-created users are auto-approved
      })
      .eq('id', authData.user.id)

    if (profileError) {
      console.error('Error updating profile:', profileError)
      // Try to delete the auth user if profile update fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        username: username,
        full_name: full_name || username,
        credits: initial_credits,
        password: defaultPassword, // Return password so admin can give to student
      },
    })
  } catch (error: any) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
