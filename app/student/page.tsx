'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Profile, Song } from '@/lib/types'

export default function StudentPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState('')
  const [title, setTitle] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [style, setStyle] = useState('')
  const [vocalGender, setVocalGender] = useState<'f' | 'm'>('f')
  const [generating, setGenerating] = useState(false)
  const [generatingLyrics, setGeneratingLyrics] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    loadProfile()
    loadSongs()

    // Subscribe to song changes for real-time updates
    const channel = supabase
      .channel('songs-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'songs',
        },
        (payload) => {
          console.log('Song updated:', payload)
          // Only reload if status changed to completed
          if (payload.new && payload.new.status === 'completed') {
            loadSongs()
            loadProfile()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (currentTaskId) {
      const interval = setInterval(() => {
        checkSongStatus(currentTaskId)
      }, 10000) // Check every 10 seconds

      return () => clearInterval(interval)
    }
  }, [currentTaskId])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
    }
  }

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
    }
    setLoading(false)
  }

  const loadSongs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    console.log('loadSongs - user:', user.id)
    console.log('loadSongs - count:', data?.length)
    console.log('loadSongs - error:', error)

    // Log each song's key info
    data?.forEach((song, idx) => {
      console.log(`Song ${idx + 1}:`, {
        title: song.title,
        status: song.status,
        audio_path: song.audio_path,
        audio_url: song.audio_url
      })
    })

    if (data) {
      setSongs(data)
    }
  }

  const generateLyrics = async () => {
    if (!theme.trim()) {
      alert('กรุณาใส่ธีมหรือหัวข้อที่ต้องการ')
      return
    }

    setGeneratingLyrics(true)

    try {
      const response = await fetch('/api/ai/generate-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      })

      if (response.ok) {
        const data = await response.json()
        setTitle(data.title || '')
        setLyrics(data.lyrics || '')
        setStyle(data.style || '')
      } else {
        const error = await response.json()
        alert('เกิดข้อผิดพลาด: ' + error.error)
      }
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setGeneratingLyrics(false)
    }
  }

  const generateSong = async () => {
    if (!title.trim() || !lyrics.trim() || !style.trim()) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    setGenerating(true)

    try {
      const response = await fetch('/api/suno/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          lyrics,
          style,
          vocalGender,
          instrumental: false,
          model: 'V5',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentTaskId(data.taskId)
        alert('เริ่มสร้างเพลงแล้ว! กรุณารอสักครู่...')
        loadProfile() // Refresh to show updated credits
        loadSongs()
      } else {
        const error = await response.json()
        alert('เกิดข้อผิดพลาด: ' + error.error)
      }
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const checkSongStatus = async (taskId: string) => {
    try {
      const response = await fetch(`/api/suno/status/${taskId}`)
      if (response.ok) {
        const data = await response.json()

        if (data.status === 'completed') {
          setCurrentTaskId(null)
          loadSongs()
          loadProfile()
          alert('เพลงสร้างเสร็จแล้ว!')
        } else if (data.status === 'failed') {
          setCurrentTaskId(null)
          loadSongs()
          loadProfile()
          alert('การสร้างเพลงล้มเหลว: ' + (data.error || 'Unknown error'))
        } else if (data.status === 'generating') {
          // Still processing, just refresh to show updated status
          loadSongs()
        }
      }
    } catch (error) {
      console.error('Error checking status:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
            <div className="flex items-center space-x-4">
              {profile && (
                <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold">
                  เครดิต: {profile.credits}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Song Creation Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">สร้างเพลงใหม่</h2>

            {/* AI Generation */}
            <div className="mb-6 p-4 bg-purple-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1. เจนเนื้อเพลงด้วย AI (ไม่บังคับ)
              </label>
              <textarea
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 mb-2"
                rows={2}
                placeholder="เช่น: เพลงเกี่ยวกับธรรมชาติที่สงบ"
              />
              <button
                onClick={generateLyrics}
                disabled={generatingLyrics || !theme.trim()}
                className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingLyrics ? 'กำลังเจนเนื้อเพลง...' : 'เจนเนื้อเพลงด้วย AI'}
              </button>
            </div>

            {/* Manual Input */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  2. ชื่อเพลง
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="ชื่อเพลง"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  3. เนื้อเพลง
                </label>
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={8}
                  placeholder="[INTRO] ... [VERSE 1] ... [CHORUS] ..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  4. สไตล์เพลง
                </label>
                <input
                  type="text"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="indie pop, dreamy, acoustic"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  5. เพศเสียง
                </label>
                <select
                  value={vocalGender}
                  onChange={(e) => setVocalGender(e.target.value as 'f' | 'm')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="f">หญิง (Female)</option>
                  <option value="m">ชาย (Male)</option>
                </select>
              </div>

              <button
                onClick={generateSong}
                disabled={generating || !title || !lyrics || !style || !profile || profile.credits < 1}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'กำลังสร้างเพลง...' : 'สร้างเพลง (ใช้เครดิต)'}
              </button>

              {profile && profile.credits < 1 && (
                <p className="text-sm text-red-600 text-center">
                  เครดิตไม่เพียงพอ กรุณาติดต่อครูเพื่อเติมเครดิต
                </p>
              )}
            </div>
          </div>

          {/* Songs List */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">เพลงของฉัน</h2>

            {loading ? (
              <p className="text-gray-500 text-center">กำลังโหลด...</p>
            ) : songs.length === 0 ? (
              <p className="text-gray-500 text-center">ยังไม่มีเพลง</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {songs.map((song) => (
                  <div
                    key={song.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg">{song.title}</h3>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          song.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : song.status === 'generating'
                            ? 'bg-yellow-100 text-yellow-800'
                            : song.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {song.status === 'completed'
                          ? 'เสร็จสิ้น'
                          : song.status === 'generating'
                          ? 'กำลังสร้าง...'
                          : song.status === 'failed'
                          ? 'ล้มเหลว'
                          : 'รอดำเนินการ'}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                      สไตล์: {song.style}
                    </p>

                    {song.status === 'completed' && song.audio_path && (
                      <div className="mt-2 space-y-2">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">🎵 เวอร์ชัน 1:</p>
                          <audio controls className="w-full">
                            <source src={song.audio_path} type="audio/mpeg" />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                        {song.audio_path_2 && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1">🎵 เวอร์ชัน 2:</p>
                            <audio controls className="w-full">
                              <source src={song.audio_path_2} type="audio/mpeg" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        )}
                      </div>
                    )}

                    {song.status === 'failed' && song.error_message && (
                      <p className="text-sm text-red-600 mt-2">
                        ข้อผิดพลาด: {song.error_message}
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                      สร้างเมื่อ: {new Date(song.created_at).toLocaleString('th-TH')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
