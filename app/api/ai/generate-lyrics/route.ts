import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import axios from 'axios'
import { GoogleGenAI } from '@google/genai'

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
      .in('key', ['openai_api_key', 'anthropic_api_key', 'gemini_api_key', 'ai_provider', 'ai_model', 'lyrics_prompt'])

    const settingsMap = settings?.reduce((acc: any, s: any) => {
      acc[s.key] = s.value
      return acc
    }, {})

    const aiProvider = settingsMap?.ai_provider || process.env.AI_PROVIDER || 'openai'
    const aiModel = settingsMap?.ai_model || process.env.AI_MODEL || 'gpt-4o-mini'
    
    // Get API key based on selected provider
    let aiApiKey: string | undefined
    if (aiProvider === 'openai') {
      aiApiKey = settingsMap?.openai_api_key || process.env.OPENAI_API_KEY
    } else if (aiProvider === 'anthropic') {
      aiApiKey = settingsMap?.anthropic_api_key || process.env.ANTHROPIC_API_KEY
    } else if (aiProvider === 'gemini') {
      aiApiKey = settingsMap?.gemini_api_key || process.env.GEMINI_API_KEY
    }

    if (!aiApiKey) {
      return NextResponse.json({ error: `API key for ${aiProvider} not configured` }, { status: 500 })
    }

    // Detect language from theme
    const themeLower = theme.toLowerCase()
    
    // Check for English keywords in Thai text
    const wantsEnglish = themeLower.includes('สากล') || 
                         themeLower.includes('english') || 
                         themeLower.includes('อังกฤษ') ||
                         themeLower.includes('eng') ||
                         themeLower.includes('western') ||
                         themeLower.includes('international')
    
    // Check for Thai keywords
    const wantsThai = themeLower.includes('ไทย') || 
                      themeLower.includes('thai') ||
                      themeLower.includes('ลูกทุ่ง') ||
                      themeLower.includes('หมอลำ')
    
    // Determine language
    let language: 'english' | 'thai'
    if (wantsEnglish && !wantsThai) {
      language = 'english'
    } else if (wantsThai) {
      language = 'thai'
    } else {
      // Default: check if theme is pure English text
      const isEnglishTheme = /^[a-zA-Z0-9\s.,!?'"()\-:;]+$/.test(theme.trim())
      language = isEnglishTheme ? 'english' : 'thai'
    }
    
    console.log('Detected language:', language, 'for theme:', theme)

    // Get custom prompt from settings or use default
    const customPrompt = settingsMap?.lyrics_prompt || ''
    
    const defaultPromptTemplate = `จินตนาการว่าตนเองเป็นนักแต่งเพลงมืออาชีพระดับโลก

## กฎสำคัญ
1. **ต้นฉบับ**: สร้างเนื้อหา 100% ต้นฉบับ ห้ามลอกเลียนหรืออ้างอิงเพลงที่มีอยู่
2. **ไม่ซ้ำ**: แต่ละท่อนต้องมีเนื้อเพลงที่แตกต่างกัน ห้ามใช้คำซ้ำๆ
3. **สัมผัส**: เนื้อเพลงต้องมีสัมผัสคล้องจอง ใช้คำที่นิยมใช้และเข้าใจง่าย

## รูปแบบสำหรับ Suno
- ใส่ชื่อ Section ใน [ ] เช่น [INTRO], [VERSE], [CHORUS]
- รายละเอียดดนตรี/อารมณ์ใส่ในวงเล็บ (เป็นภาษาอังกฤษ)
- ตัวอย่าง: [INTRO, soft piano melody]

## โครงสร้างเพลง
[INTRO, (รายละเอียดดนตรี)]
[VERSE 1] - 4 บรรทัด แนะนำธีม/เรื่องราว
[PRE-CHORUS] - 2-3 บรรทัด สร้างความตื่นเต้น  
[CHORUS] - 4-5 บรรทัด ติดหู จำง่าย
[VERSE 2] - 4 บรรทัด เนื้อหาแตกต่างจาก VERSE 1
[BRIDGE] - 4 บรรทัด จุดไคลแม็กซ์หรือมุมมองใหม่
[CHORUS]
[OUTRO, (fade out description)]

## กฎสำคัญ
- ชื่อเพลงเขียนตามภาษาของเพลง
- Style เพลงเขียนเป็นภาษาอังกฤษเท่านั้น คั่นด้วย , 
- คำบรรยายดนตรีในวงเล็บเป็นภาษาอังกฤษหมด`

    // Use custom prompt if available, otherwise use default
    const basePrompt = customPrompt || defaultPromptTemplate
    
    // Replace variables in prompt
    const processedPrompt = basePrompt
      .replace(/\{theme\}/g, theme)
      .replace(/\{language\}/g, language === 'english' ? 'English' : 'Thai')

    const prompt = `${processedPrompt}

## INPUT
- Theme/Concept: ${theme}
- Target Language: ${language === 'english' ? 'English' : 'Thai'}

## LANGUAGE RULE
Write ALL lyrics in ${language === 'english' ? 'ENGLISH ONLY - Do NOT use any Thai characters' : 'THAI language'}. The title should also be in ${language === 'english' ? 'English' : 'Thai'}.

## OUTPUT FORMAT
Respond with ONLY a valid JSON object:
{
  "title": "${language === 'english' ? 'Creative English Title' : 'ชื่อเพลงภาษาไทย'}",
  "lyrics": "Full lyrics with [Section] tags, each section on new lines",
  "style": "specific genre, mood, tempo, instruments, vocal style"
}

Now create an amazing, original song:`

    let result

    if (aiProvider === 'openai') {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: aiModel,
          messages: [
            {
              role: 'system',
              content: 'You are a creative professional songwriter. You write original, emotionally resonant lyrics. Always respond with valid JSON only. Never copy existing songs.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.9,
          max_tokens: 2000,
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
          max_tokens: 2000,
          system: 'You are a creative professional songwriter. You write original, emotionally resonant lyrics. Always respond with valid JSON only. Never copy existing songs.',
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
      // Use Google GenAI SDK
      const ai = new GoogleGenAI({ apiKey: aiApiKey })
      
      // Map model names
      let geminiModel = aiModel
      if (aiModel === 'gemini-flash-latest') {
        geminiModel = 'gemini-2.5-flash'
      } else if (aiModel === 'gemini-2.0-flash') {
        geminiModel = 'gemini-2.0-flash'
      } else if (aiModel === 'gemini-1.5-flash') {
        geminiModel = 'gemini-1.5-flash'
      } else if (aiModel === 'gemini-1.5-pro') {
        geminiModel = 'gemini-1.5-pro'
      }
      
      console.log('Using Gemini model:', geminiModel)
      
      const fullPrompt = `You are a creative professional songwriter. You write original, emotionally resonant lyrics. Always respond with valid JSON only. Never copy existing songs.

${prompt}`
      
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: fullPrompt,
      })
      
      const content = response.text || ''
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
