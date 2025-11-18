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

    const { theme } = await request.json()

    if (!theme) {
      return NextResponse.json({ error: 'Theme is required' }, { status: 400 })
    }

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['ai_api_key', 'ai_provider', 'ai_model'])

    const settingsMap = settings?.reduce((acc: any, s: any) => {
      acc[s.key] = s.value
      return acc
    }, {})

    const aiApiKey = settingsMap?.ai_api_key || process.env.AI_API_KEY
    const aiProvider = settingsMap?.ai_provider || process.env.AI_PROVIDER || 'openai'
    const aiModel = settingsMap?.ai_model || process.env.AI_MODEL || 'gpt-4o-mini'

    if (!aiApiKey) {
      return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 })
    }

    const prompt = `คุณคือนักแต่งเพลงมืออาชีพ กำลังแต่งเพลงสำหรับ Suno AI v5

INPUT:
- ธีม: ${theme}

REQUIREMENTS:

1. ชื่อเพลง (TITLE):
   - สร้างสรรค์ น่าสนใจ จดจำง่าย
   - ใช้ภาษาตามเนื้อเพลง (ไทย/อังกฤษ)

2. เนื้อเพลง (LYRICS):
   - โครงสร้างสำหรับ Suno v5: [INTRO], [VERSE 1], [PRE-CHORUS], [CHORUS], [VERSE 2], [PRE-CHORUS], [CHORUS], [BRIDGE], [CHORUS], [OUTRO]
   - ใส่รายละเอียดดนตรีเป็นภาษาอังกฤษใน [ ] เช่น [INTRO, gentle piano melody]
   - เขียนเนื้อเพลงที่มีสัมผัส กลอนสวย ใช้คำที่นิยม ความหมายลึกซึ้ง
   - **ความยาว: เนื้อเพลงต้องยาว เพื่อให้เพลงยาวอย่างน้อย 2-3 นาที**
   - แต่ละ VERSE มี 4-6 บรรทัด
   - แต่ละ CHORUS มี 4-6 บรรทัด และต้องซ้ำกัน
   - เพิ่ม PRE-CHORUS เพื่อเชื่อม VERSE กับ CHORUS
   - BRIDGE มี 4 บรรทัด
   - รวมแล้วเนื้อเพลงต้องมีอย่างน้อย 30-40 บรรทัด

3. สไตล์เพลง (STYLE):
   - เขียนเป็นภาษาอังกฤษเท่านั้น คั่นด้วย comma
   - ระบุ genre, mood, instruments เช่น "indie pop, dreamy, acoustic guitar"

ให้ตอบกลับมาในรูปแบบ JSON object เดียว:
{
  "title": "ชื่อเพลง",
  "lyrics": "เนื้อเพลงพร้อม structure tags (ยาวมาก)",
  "style": "music style, genre, mood"
}

Generate now:`

    let result

    if (aiProvider === 'openai') {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: aiModel,
          messages: [
            {
              role: 'system',
              content: 'You are a creative music producer. Always respond with valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.8,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Authorization': `Bearer ${aiApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const content = response.data.choices[0].message.content
      result = JSON.parse(content)
    } else if (aiProvider === 'anthropic') {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: aiModel,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        },
        {
          headers: {
            'x-api-key': aiApiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
        }
      )

      const content = response.data.content[0].text
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        // Fallback if no JSON found
        result = {
          title: 'Generated Song',
          lyrics: content,
          style: 'pop, melodic',
        }
      }
    } else if (aiProvider === 'gemini') {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${aiApiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const content = response.data.candidates[0].content.parts[0].text
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        result = {
          title: 'Generated Song',
          lyrics: content,
          style: 'pop, melodic',
        }
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error generating lyrics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate lyrics' },
      { status: 500 }
    )
  }
}
