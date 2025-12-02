import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if song belongs to user
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (songError || !song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    if (song.user_id !== user.id) {
      return NextResponse.json({ error: 'You can only delete your own songs' }, { status: 403 })
    }

    // Delete the song
    const { error: deleteError } = await supabase
      .from('songs')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting song:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
