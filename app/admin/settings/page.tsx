'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminSettingsPage() {
  const [sunoApiKey, setSunoApiKey] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiProvider, setAiProvider] = useState('openai')
  const [aiModel, setAiModel] = useState('gpt-4o-mini')
  const [creditsPerSong, setCreditsPerSong] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
          case 'ai_api_key':
            setAiApiKey(setting.value || '')
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
        }
      })
    }
    setLoading(false)
  }

  const saveSettings = async () => {
    setSaving(true)

    const settings = [
      { key: 'suno_api_key', value: sunoApiKey },
      { key: 'ai_api_key', value: aiApiKey },
      { key: 'ai_provider', value: aiProvider },
      { key: 'ai_model', value: aiModel },
      { key: 'credits_per_song', value: creditsPerSong },
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
                  AI Provider
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="ใส่ API Key"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {aiProvider === 'openai' && 'สมัครได้ที่: https://platform.openai.com'}
                  {aiProvider === 'anthropic' && 'สมัครได้ที่: https://console.anthropic.com'}
                  {aiProvider === 'gemini' && 'สมัครได้ที่: https://ai.google.dev'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="เช่น gpt-4o-mini, claude-3-5-sonnet-20241022, gemini-1.5-flash"
                />
                <p className="text-xs text-gray-500 mt-1">
                  แนะนำ:
                  {aiProvider === 'openai' && ' gpt-4o-mini (ถูก), gpt-4o (แม่นยำ), gpt-4-turbo (เร็ว)'}
                  {aiProvider === 'anthropic' && ' claude-3-5-haiku-20241022 (ถูก), claude-3-5-sonnet-20241022 (แม่นยำ)'}
                  {aiProvider === 'gemini' && ' gemini-1.5-flash (ถูก), gemini-1.5-pro (แม่นยำ)'}
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
