'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminSettingsPage() {
  const [sunoApiKey, setSunoApiKey] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [anthropicApiKey, setAnthropicApiKey] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [aiProvider, setAiProvider] = useState('openai')
  const [aiModel, setAiModel] = useState('gpt-4o-mini')
  const [creditsPerSong, setCreditsPerSong] = useState(1)
  const [lyricsPrompt, setLyricsPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const defaultLyricsPrompt = `จินตนาการว่าตนเองเป็นนักแต่งเพลงมืออาชีพระดับโลก

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

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    loadSettings()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'teacher') {
      router.push('/student')
    }
  }

  const loadSettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value')

    if (data) {
      data.forEach((setting: any) => {
        switch (setting.key) {
          case 'suno_api_key':
            setSunoApiKey(setting.value || '')
            break
          case 'openai_api_key':
            setOpenaiApiKey(setting.value || '')
            break
          case 'anthropic_api_key':
            setAnthropicApiKey(setting.value || '')
            break
          case 'gemini_api_key':
            setGeminiApiKey(setting.value || '')
            break
          case 'ai_provider':
            setAiProvider(setting.value || 'openai')
            break
          case 'ai_model':
            setAiModel(setting.value || 'gpt-4o-mini')
            break
          case 'credits_per_song':
            setCreditsPerSong(parseInt(setting.value) || 1)
            break
          case 'lyrics_prompt':
            setLyricsPrompt(setting.value || '')
            break
        }
      })
    }
    setLoading(false)
  }

  const saveSettings = async () => {
    setSaving(true)

    const settings = [
      { key: 'suno_api_key', value: sunoApiKey },
      { key: 'openai_api_key', value: openaiApiKey },
      { key: 'anthropic_api_key', value: anthropicApiKey },
      { key: 'gemini_api_key', value: geminiApiKey },
      { key: 'ai_provider', value: aiProvider },
      { key: 'ai_model', value: aiModel },
      { key: 'credits_per_song', value: creditsPerSong },
      { key: 'lyrics_prompt', value: lyricsPrompt || defaultLyricsPrompt },
    ]

    try {
      for (const setting of settings) {
        const { error } = await supabase
          .from('settings')
          .upsert({
            key: setting.key,
            value: setting.value,
          }, {
            onConflict: 'key'
          })

        if (error) {
          throw error
        }
      }

      alert('บันทึกการตั้งค่าสำเร็จ!')
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                ← กลับ
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าระบบ</h1>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 space-y-6">

          {/* Suno API */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Suno AI API (Kie.AI)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Suno API Key
                </label>
                <input
                  type="password"
                  value={sunoApiKey}
                  onChange={(e) => setSunoApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="ใส่ API Key จาก kie.ai"
                />
                <p className="text-xs text-gray-500 mt-1">
                  สมัครได้ที่: <a href="https://kie.ai" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">https://kie.ai</a>
                </p>
              </div>
            </div>
          </div>

          <hr />

          {/* AI API */}
          <div>
            <h2 className="text-lg font-semibold mb-4">AI สำหรับเจนเนื้อเพลง</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AI Provider ที่ใช้งาน
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => {
                    setAiProvider(e.target.value)
                    // Set default model for each provider
                    if (e.target.value === 'openai') setAiModel('gpt-4o-mini')
                    else if (e.target.value === 'anthropic') setAiModel('claude-3-5-haiku-20241022')
                    else if (e.target.value === 'gemini') setAiModel('gemini-2.5-flash')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="openai">OpenAI (GPT)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {aiProvider === 'openai' && (
                    <>
                      <option value="gpt-4o-mini">GPT-4o Mini (ถูก, เร็ว)</option>
                      <option value="gpt-4o">GPT-4o (แม่นยำ)</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (ถูกที่สุด)</option>
                    </>
                  )}
                  {aiProvider === 'anthropic' && (
                    <>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (ถูก, เร็ว)</option>
                      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (แม่นยำ)</option>
                      <option value="claude-3-opus-20240229">Claude 3 Opus (ดีที่สุด)</option>
                    </>
                  )}
                  {aiProvider === 'gemini' && (
                    <>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (ใหม่ล่าสุด!)</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (เสถียร)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (แม่นยำ)</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          <hr />

          {/* API Keys - แยกแต่ละเจ้า */}
          <div>
            <h2 className="text-lg font-semibold mb-4">API Keys</h2>
            <div className="space-y-4">
              {/* OpenAI */}
              <div className={`p-4 rounded-lg border-2 ${aiProvider === 'openai' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    OpenAI API Key
                  </label>
                  {aiProvider === 'openai' && (
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">กำลังใช้งาน</span>
                  )}
                </div>
                <input
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="sk-..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  สมัครได้ที่: <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">https://platform.openai.com</a>
                </p>
              </div>

              {/* Anthropic */}
              <div className={`p-4 rounded-lg border-2 ${aiProvider === 'anthropic' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Anthropic API Key
                  </label>
                  {aiProvider === 'anthropic' && (
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">กำลังใช้งาน</span>
                  )}
                </div>
                <input
                  type="password"
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="sk-ant-..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  สมัครได้ที่: <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">https://console.anthropic.com</a>
                </p>
              </div>

              {/* Gemini */}
              <div className={`p-4 rounded-lg border-2 ${aiProvider === 'gemini' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Google Gemini API Key
                  </label>
                  {aiProvider === 'gemini' && (
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">กำลังใช้งาน</span>
                  )}
                </div>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="AIza..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  สมัครได้ที่: <a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">https://ai.google.dev</a> (มี Free tier!)
                </p>
              </div>
            </div>
          </div>

          <hr />

          {/* Credits */}
          <div>
            <h2 className="text-lg font-semibold mb-4">ระบบเครดิต</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เครดิตต่อการสร้างเพลง 1 เพลง
              </label>
              <input
                type="number"
                min="1"
                value={creditsPerSong}
                onChange={(e) => setCreditsPerSong(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <hr />

          {/* Lyrics Prompt */}
          <div>
            <h2 className="text-lg font-semibold mb-4">🎵 Prompt สำหรับเจนเนื้อเพลง</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Custom Prompt (ปรับแต่งได้)
                  </label>
                  <button
                    type="button"
                    onClick={() => setLyricsPrompt(defaultLyricsPrompt)}
                    className="text-xs text-purple-600 hover:underline"
                  >
                    รีเซ็ตเป็นค่าเริ่มต้น
                  </button>
                </div>
                <textarea
                  value={lyricsPrompt || defaultLyricsPrompt}
                  onChange={(e) => setLyricsPrompt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  rows={15}
                  placeholder="ใส่ prompt สำหรับ AI..."
                />
                <p className="text-xs text-gray-500 mt-2">
                  💡 <strong>ตัวแปรที่ใช้ได้:</strong><br/>
                  • <code className="bg-gray-100 px-1 rounded">{'{theme}'}</code> - ธีมที่ผู้ใช้ใส่<br/>
                  • <code className="bg-gray-100 px-1 rounded">{'{language}'}</code> - ภาษาที่ตรวจจับได้ (English/Thai)
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end space-x-3 pt-4">
            <Link
              href="/admin"
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ยกเลิก
            </Link>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
