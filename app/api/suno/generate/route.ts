import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import axios from 'axios'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const { title, lyrics, style, instrumental = false, model = 'V5', vocalGender = 'f' } = await request.json()

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['credits_per_song', 'suno_api_key'])

    const settingsMap = settings?.reduce((acc: any, s: any) => {
      acc[s.key] = s.value
      return acc
    }, {})

    const creditsPerSong = parseInt(settingsMap?.credits_per_song || 1)
    const sunoApiKey = settingsMap?.suno_api_key || process.env.SUNO_API_KEY

    if (!sunoApiKey) {
      return NextResponse.json({ error: 'Suno API key not configured' }, { status: 500 })
    }

    // Get user profile and check credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    if (!profile || profile.credits < creditsPerSong) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 })
    }

    // Create song record
    const { data: song, error: songError } = await supabase
      .from('songs')
      .insert({
        user_id: user.id,
        title,
        lyrics,
        style,
        status: 'pending',
        credits_used: creditsPerSong,
      })
      .select()
      .single()

    if (songError) {
      return NextResponse.json({ error: songError.message }, { status: 500 })
    }

    // Call Suno API with correct parameters
    const sunoResponse = await axios.post(
      'https://api.kie.ai/api/v1/generate',
      {
        prompt: lyrics,
        style: style,
        title: title,
        customMode: true,
        instrumental: instrumental,
        model: model,
        vocalGender: vocalGender,
        callBackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://placeholder.com'}/api/suno/callback`,
      },
      {
        headers: {
          'Authorization': `Bearer ${sunoApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (sunoResponse.data.code === 200) {
      const taskId = sunoResponse.data.data.taskId

      // Update song with task ID and status
      await supabase
        .from('songs')
        .update({
          task_id: taskId,
          status: 'generating',
        })
        .eq('id', song.id)

      // Deduct credits
      await supabase
        .from('profiles')
        .update({ credits: profile.credits - creditsPerSong })
        .eq('id', user.id)

      // Record transaction
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          amount: -creditsPerSong,
          type: 'deduct',
          reason: 'สร้างเพลง',
          related_song_id: song.id,
        })

      return NextResponse.json({
        success: true,
        songId: song.id,
        taskId,
      })
    } else {
      // Update song status to failed
      await supabase
        .from('songs')
        .update({
          status: 'failed',
          error_message: sunoResponse.data.msg,
        })
        .eq('id', song.id)

      return NextResponse.json({ error: sunoResponse.data.msg }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Error generating song:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate song' }, { status: 500 })
  }
}
