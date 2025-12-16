import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import axios from 'axios'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const supabaseAdmin = createServiceClient()

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get request body
        const {
            uploadUrl,
            title,
            style,
            prompt,
            customMode = true,
            instrumental = false,
            model = 'V4_5ALL',
            vocalGender = 'f',
            negativeTags = '',
            styleWeight = 0.5,
            weirdnessConstraint = 0.5,
            audioWeight = 0.5,
            sourceYoutubeUrl = '',
        } = await request.json()

        // Validate required fields
        if (!uploadUrl) {
            return NextResponse.json({ error: 'uploadUrl is required' }, { status: 400 })
        }

        if (customMode) {
            if (!title || !style) {
                return NextResponse.json({ error: 'title and style are required in custom mode' }, { status: 400 })
            }
            if (!instrumental && !prompt) {
                return NextResponse.json({ error: 'prompt (lyrics) is required when not instrumental' }, { status: 400 })
            }
        } else {
            if (!prompt) {
                return NextResponse.json({ error: 'prompt is required in non-custom mode' }, { status: 400 })
            }
        }

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
            return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
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

        // Create song record with type 'cover'
        const { data: song, error: songError } = await supabase
            .from('songs')
            .insert({
                user_id: user.id,
                title: title || 'Cover Song',
                lyrics: prompt || '',
                style: style || '',
                status: 'pending',
                credits_used: creditsPerSong,
                type: 'cover',
                source_youtube_url: sourceYoutubeUrl,
            })
            .select()
            .single()

        if (songError) {
            console.error('Song creation error:', songError)
            return NextResponse.json({ error: songError.message }, { status: 500 })
        }

        // Build request body for kie.ai API
        const requestBody: any = {
            uploadUrl,
            customMode,
            instrumental,
            model,
            callBackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://placeholder.com'}/api/cover/callback`,
        }

        if (customMode) {
            requestBody.title = title
            requestBody.style = style
            if (!instrumental) {
                requestBody.prompt = prompt
            }
            requestBody.vocalGender = vocalGender
        } else {
            requestBody.prompt = prompt
        }

        // Add optional parameters
        if (negativeTags) requestBody.negativeTags = negativeTags
        if (styleWeight !== undefined) requestBody.styleWeight = styleWeight
        if (weirdnessConstraint !== undefined) requestBody.weirdnessConstraint = weirdnessConstraint
        if (audioWeight !== undefined) requestBody.audioWeight = audioWeight

        console.log('[Cover Generate] Request:', JSON.stringify(requestBody, null, 2))

        // Call kie.ai upload-cover API
        const coverResponse = await axios.post(
            'https://api.kie.ai/api/v1/generate/upload-cover',
            requestBody,
            {
                headers: {
                    'Authorization': `Bearer ${sunoApiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        )

        console.log('[Cover Generate] Response:', JSON.stringify(coverResponse.data, null, 2))

        if (coverResponse.data.code === 200) {
            const taskId = coverResponse.data.data.taskId

            // Update song with task ID and status
            await supabaseAdmin
                .from('songs')
                .update({
                    task_id: taskId,
                    status: 'generating',
                })
                .eq('id', song.id)

            // Deduct credits
            await supabaseAdmin
                .from('profiles')
                .update({ credits: profile.credits - creditsPerSong })
                .eq('id', user.id)

            // Record transaction
            await supabaseAdmin
                .from('credit_transactions')
                .insert({
                    user_id: user.id,
                    amount: -creditsPerSong,
                    type: 'deduct',
                    reason: 'สร้าง Cover เพลง',
                    related_song_id: song.id,
                })

            return NextResponse.json({
                success: true,
                songId: song.id,
                taskId,
            })
        } else {
            // Update song status to failed
            await supabaseAdmin
                .from('songs')
                .update({
                    status: 'failed',
                    error_message: coverResponse.data.msg,
                })
                .eq('id', song.id)

            return NextResponse.json({ error: coverResponse.data.msg }, { status: 500 })
        }
    } catch (error: any) {
        console.error('Error generating cover:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate cover' },
            { status: 500 }
        )
    }
}
