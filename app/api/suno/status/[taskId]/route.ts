import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const supabase = await createClient()
    const supabaseAdmin = createServiceClient() // Use service role for updates

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get API key from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'suno_api_key')
      .single()

    const sunoApiKey = settings?.value || process.env.SUNO_API_KEY

    if (!sunoApiKey) {
      return NextResponse.json({ error: 'Suno API key not configured' }, { status: 500 })
    }

    // Check task status
    const statusResponse = await axios.get(
      `https://api.kie.ai/api/v1/generate/record-info?taskId=${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${sunoApiKey}`,
        },
      }
    )

    if (statusResponse.data.code === 200) {
      const taskData = statusResponse.data.data
      const status = taskData.status
      console.log(`[Status Check] taskId: ${taskId}, status: ${status}`)

      // Get song record
      const { data: song } = await supabase
        .from('songs')
        .select('*')
        .eq('task_id', taskId)
        .single()

      if (!song) {
        return NextResponse.json({ error: 'Song not found' }, { status: 404 })
      }

      // Update song based on status
      if (status === 'SUCCESS' && taskData.response?.sunoData) {
        const sunoData = taskData.response.sunoData
        console.log('SUCCESS - sunoData:', JSON.stringify(sunoData, null, 2))

        // Get both versions
        const audioData1 = sunoData[0]
        const audioData2 = sunoData[1]

        if (audioData1?.audioUrl) {
          // Use external audio URLs directly (skip Supabase Storage due to RLS issues)
          const updateData: any = {
            status: 'completed',
            audio_url: audioData1.audioUrl,
            audio_path: audioData1.audioUrl, // Use external URL as audio_path
            duration: Math.round(audioData1.duration), // Convert float to integer
          }

          // Add second version if exists
          if (audioData2?.audioUrl) {
            updateData.audio_url_2 = audioData2.audioUrl
            updateData.audio_path_2 = audioData2.audioUrl
          }

          const { data: updatedSong, error: updateError } = await supabaseAdmin
            .from('songs')
            .update(updateData)
            .eq('id', song.id)
            .select()

          if (updateError) {
            console.error('❌ Database update error:', updateError)
            return NextResponse.json({ error: updateError.message }, { status: 500 })
          }

          console.log(`✅ Song completed: ${song.title}`)
          console.log(`   Version 1: ${audioData1.audioUrl}`)
          if (audioData2?.audioUrl) {
            console.log(`   Version 2: ${audioData2.audioUrl}`)
          }
          console.log(`   Updated song data:`, JSON.stringify(updatedSong, null, 2))

          return NextResponse.json({
            status: 'completed',
            audioUrl: audioData1.audioUrl,
            audioUrl2: audioData2?.audioUrl || null,
            duration: audioData1.duration,
          })
        } else {
          console.error('No audioUrl found in audioData')
        }
      } else if (status === 'FIRST_SUCCESS') {
        // Update song status to generating
        await supabaseAdmin
          .from('songs')
          .update({
            status: 'generating',
          })
          .eq('id', song.id)

        return NextResponse.json({
          status: 'generating',
          message: 'First track generated, waiting for second...',
        })
      } else if (['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION', 'SENSITIVE_WORD_ERROR'].includes(status)) {
        await supabaseAdmin
          .from('songs')
          .update({
            status: 'failed',
            error_message: taskData.errorMessage || 'Generation failed',
          })
          .eq('id', song.id)

        // Refund credits
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('credits')
          .eq('id', user.id)
          .single()

        if (profile) {
          await supabaseAdmin
            .from('profiles')
            .update({ credits: profile.credits + song.credits_used })
            .eq('id', user.id)

          await supabaseAdmin
            .from('credit_transactions')
            .insert({
              user_id: user.id,
              amount: song.credits_used,
              type: 'add',
              reason: 'คืนเครดิตจากการสร้างเพลงล้มเหลว',
              related_song_id: song.id,
            })
        }

        return NextResponse.json({
          status: 'failed',
          error: taskData.errorMessage || 'Generation failed',
        })
      } else {
        // Update song status to generating for other pending statuses
        await supabaseAdmin
          .from('songs')
          .update({
            status: 'generating',
          })
          .eq('id', song.id)

        return NextResponse.json({
          status: 'generating',
        })
      }
    }

    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  } catch (error: any) {
    console.error('Error checking status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
