import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import ytdl from '@distube/ytdl-core'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

// Pitch shift ratio for +3 semitones: 2^(3/12) ≈ 1.189207
const PITCH_SHIFT_RATIO = 1.189207

// Cache FFmpeg instance
let ffmpegInstance: FFmpeg | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) {
    return ffmpegInstance
  }

  const ffmpeg = new FFmpeg()

  // Load ffmpeg core from CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  ffmpegInstance = ffmpeg
  return ffmpeg
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { youtubeUrl, pitchShift = 3 } = await request.json()

    if (!youtubeUrl) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 })
    }

    // Validate YouTube URL
    if (!ytdl.validateURL(youtubeUrl)) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
    }

    console.log(`[YouTube Download] URL: ${youtubeUrl}`)
    console.log(`[YouTube Download] Pitch shift: +${pitchShift} semitones`)

    // Get video info
    const info = await ytdl.getInfo(youtubeUrl)
    const duration = parseInt(info.videoDetails.lengthSeconds)

    // Check duration (max 8 minutes for kie.ai API)
    if (duration > 480) {
      return NextResponse.json({
        error: `เพลงยาวเกินไป (${Math.round(duration / 60)} นาที) - ต้องไม่เกิน 8 นาที`
      }, { status: 400 })
    }

    console.log(`[YouTube Download] Duration: ${duration}s`)

    // Download audio stream
    const audioStream = ytdl(youtubeUrl, {
      filter: 'audioonly',
      quality: 'highestaudio',
    })

    // Collect audio data into buffer
    const chunks: Buffer[] = []
    for await (const chunk of audioStream) {
      chunks.push(chunk)
    }
    const audioBuffer = Buffer.concat(chunks)

    console.log(`[YouTube Download] Downloaded ${audioBuffer.length} bytes`)

    // Calculate pitch ratio
    const pitchRatio = Math.pow(2, pitchShift / 12)

    // Load FFmpeg
    const ffmpeg = await getFFmpeg()

    // Write input file
    await ffmpeg.writeFile('input.webm', new Uint8Array(audioBuffer))

    // Apply pitch shift using asetrate and aresample filters
    // asetrate changes sample rate (which changes pitch), aresample restores sample rate
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-af', `asetrate=44100*${pitchRatio},aresample=44100`,
      '-c:a', 'libmp3lame',
      '-q:a', '2',
      'output.mp3'
    ])

    // Read output file
    const outputData = await ffmpeg.readFile('output.mp3')
    const outputBuffer = Buffer.from(outputData as Uint8Array)

    console.log(`[Pitch Shift] Output: ${outputBuffer.length} bytes`)

    // Clean up ffmpeg files
    await ffmpeg.deleteFile('input.webm')
    await ffmpeg.deleteFile('output.mp3')

    // Generate filename
    const filename = `cover-${user.id}-${Date.now()}.mp3`

    // Upload to Supabase Storage
    const supabaseAdmin = createServiceClient()

    const { error: uploadError } = await supabaseAdmin.storage
      .from('cover-audio')
      .upload(filename, outputBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      })

    if (uploadError) {
      console.error('[Upload Error]', uploadError)
      throw new Error(`Failed to upload audio: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('cover-audio')
      .getPublicUrl(filename)

    console.log(`[Upload] Success: ${urlData.publicUrl}`)

    return NextResponse.json({
      success: true,
      audioUrl: urlData.publicUrl,
      filename,
      duration,
      title: info.videoDetails.title,
    })

  } catch (error: any) {
    console.error('Error downloading from YouTube:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to download from YouTube' },
      { status: 500 }
    )
  }
}

// Increase max duration for this route (Vercel Pro: 60s, Hobby: 10s)
export const maxDuration = 60
