import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { audioUrl } = await request.json()

    if (!audioUrl) {
      return NextResponse.json({ error: 'audioUrl is required' }, { status: 400 })
    }

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['gemini_api_key'])

    const settingsMap = settings?.reduce((acc: any, s: any) => {
      acc[s.key] = s.value
      return acc
    }, {})

    const geminiApiKey = settingsMap?.gemini_api_key || process.env.GEMINI_API_KEY

    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    console.log('[Transcribe] Starting transcription for:', audioUrl)

    // Download audio file
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio file')
    }
    
    const audioBuffer = await audioResponse.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')
    
    // Determine mime type from URL
    let mimeType = 'audio/mpeg'
    if (audioUrl.includes('.wav')) mimeType = 'audio/wav'
    else if (audioUrl.includes('.m4a')) mimeType = 'audio/mp4'
    else if (audioUrl.includes('.mp4')) mimeType = 'audio/mp4'

    // Use Gemini to transcribe
    const ai = new GoogleGenAI({ apiKey: geminiApiKey })

    const prompt = `คุณเป็นผู้เชี่ยวชาญในการแกะเนื้อเพลง กรุณาฟังเพลงนี้และเขียนเนื้อเพลงออกมาให้ถูกต้องที่สุด

กฎการเขียน:
1. แกะเนื้อร้องให้ครบถ้วนตามที่ได้ยิน
2. ใส่ tag โครงสร้างเพลงให้ถูกต้อง เช่น [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Outro] ฯลฯ
3. ถ้าเป็นเพลงไทย ให้เขียนเป็นภาษาไทย
4. ถ้าเป็นเพลงอังกฤษ ให้เขียนเป็นภาษาอังกฤษ
5. ถ้ามีส่วนที่ไม่มีเนื้อร้อง (instrumental) ให้เขียน [Instrumental] หรือ [Music]
6. ไม่ต้องใส่คำอธิบายอื่นๆ ให้เนื้อเพลงเท่านั้น

ตอบเป็นเนื้อเพลงเท่านั้น ไม่ต้องมีคำอธิบายหรือข้อความอื่น`

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: audioBase64
              }
            }
          ]
        }
      ]
    })

    const lyrics = response.text?.trim() || ''

    if (!lyrics) {
      throw new Error('Failed to transcribe audio')
    }

    console.log('[Transcribe] Success, lyrics length:', lyrics.length)

    return NextResponse.json({
      success: true,
      lyrics
    })

  } catch (error: any) {
    console.error('[Transcribe Error]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}
