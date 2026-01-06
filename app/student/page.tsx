'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Profile, Song, SongType } from '@/lib/types'
import AudioProcessor from '@/app/components/AudioProcessor'

type CreationMode = 'original' | 'cover'

export default function StudentPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState('')
  const [title, setTitle] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [style, setStyle] = useState('')
  const [vocalGender, setVocalGender] = useState<'f' | 'm'>('f')
  const [sunoModel, setSunoModel] = useState('V4_5ALL')
  const [generating, setGenerating] = useState(false)
  const [generatingLyrics, setGeneratingLyrics] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null)

  // Cover mode states
  const [creationMode, setCreationMode] = useState<CreationMode>('original')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadedAudioUrl, setDownloadedAudioUrl] = useState<string | null>(null)
  const [coverTitle, setCoverTitle] = useState('')
  const [coverStyle, setCoverStyle] = useState('')
  const [coverLyrics, setCoverLyrics] = useState('')
  const [coverInstrumental, setCoverInstrumental] = useState(false)
  const [coverVocalGender, setCoverVocalGender] = useState<'f' | 'm'>('f')
  const [coverModel, setCoverModel] = useState('V4_5ALL')
  const [generatingCover, setGeneratingCover] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  
  // Audio Processing State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showProcessor, setShowProcessor] = useState(false)

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
          model: sunoModel,
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

  const deleteSong = async (songId: string) => {
    if (!confirm('คุณต้องการลบเพลงนี้หรือไม่?')) {
      return
    }

    setDeletingSongId(songId)
    try {
      const response = await fetch(`/api/songs/${songId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadSongs()
      } else {
        const error = await response.json()
        alert('เกิดข้อผิดพลาด: ' + error.error)
      }
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setDeletingSongId(null)
    }
  }

  // Cover mode functions
  const downloadFromYoutube = async () => {
    if (!youtubeUrl.trim()) {
      alert('กรุณาใส่ YouTube URL')
      return
    }

    setDownloading(true)
    setDownloadedAudioUrl(null)

    try {
      const response = await fetch('/api/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl, pitchShift: 3 }),
      })

      if (response.ok) {
        const data = await response.json()
        setDownloadedAudioUrl(data.audioUrl)
        alert('ดาวน์โหลดเสร็จแล้ว! เสียงถูกปรับ pitch +3 semitones')
      } else {
        const error = await response.json()
        alert('เกิดข้อผิดพลาด: ' + error.error)
      }
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setDownloading(false)
    }
  }

  const transcribeLyrics = async () => {
    if (!downloadedAudioUrl) {
      alert('กรุณาอัพโหลดไฟล์เสียงก่อน')
      return
    }

    setTranscribing(true)
    try {
      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: downloadedAudioUrl }),
      })

      if (response.ok) {
        const data = await response.json()
        setCoverLyrics(data.lyrics)
        alert('แกะเนื้อเพลงเสร็จแล้ว!')
      } else {
        const error = await response.json()
        alert('เกิดข้อผิดพลาด: ' + error.error)
      }
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setTranscribing(false)
    }
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    setDownloadedAudioUrl(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/cover/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setDownloadedAudioUrl(data.audioUrl)
        alert('อัพโหลดเสร็จแล้ว!')
      } else {
        const error = await response.json()
        alert('เกิดข้อผิดพลาด: ' + error.error)
      }
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const generateCover = async () => {
    if (!downloadedAudioUrl) {
      alert('กรุณาอัพโหลดไฟล์เสียง หรือดาวน์โหลดจาก YouTube ก่อน')
      return
    }

    if (!coverTitle.trim() || !coverStyle.trim()) {
      alert('กรุณากรอกชื่อเพลงและสไตล์')
      return
    }

    if (!coverInstrumental && !coverLyrics.trim()) {
      alert('กรุณากรอกเนื้อร้อง หรือเลือก Instrumental')
      return
    }

    setGeneratingCover(true)

    try {
      const response = await fetch('/api/cover/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadUrl: downloadedAudioUrl,
          title: coverTitle,
          style: coverStyle,
          prompt: coverLyrics,
          customMode: true,
          instrumental: coverInstrumental,
          model: coverModel,
          vocalGender: coverVocalGender,
          sourceYoutubeUrl: youtubeUrl,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentTaskId(data.taskId)
        alert('เริ่มสร้าง Cover แล้ว! กรุณารอสักครู่...')

        // Reset cover form
        setYoutubeUrl('')
        setDownloadedAudioUrl(null)
        setCoverTitle('')
        setCoverStyle('')
        setCoverLyrics('')
        setCoverInstrumental(false)

        loadProfile()
        loadSongs()
      } else {
        const error = await response.json()
        alert('เกิดข้อผิดพลาด: ' + error.error)
      }
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setGeneratingCover(false)
    }
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
            {/* Mode Tabs */}
            <div className="flex mb-6 border-b border-gray-200">
              <button
                onClick={() => setCreationMode('original')}
                className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${creationMode === 'original'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                🎵 สร้างเพลงใหม่
              </button>
              <button
                onClick={() => setCreationMode('cover')}
                className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${creationMode === 'cover'
                  ? 'text-orange-600 border-b-2 border-orange-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                🎤 Cover เพลง
              </button>
            </div>

            {creationMode === 'original' ? (
              <>
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      6. เวอร์ชัน Suno
                    </label>
                    <select
                      value={sunoModel}
                      onChange={(e) => setSunoModel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="V4_5ALL">V4.5 ALL (แนะนำ - ดีที่สุด)</option>
                      <option value="V5">V5 (ใหม่ล่าสุด)</option>
                      <option value="V4_5">V4.5</option>
                      <option value="V4">V4 (คลาสสิก)</option>
                      <option value="V3_5">V3.5</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      V4.5 ALL เหมาะกับเพลงทั่วไป เสียงร้องชัดเจน คุณภาพสูงสุด
                    </p>
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
              </>
            ) : (
              /* Cover Mode Form */
              <div className="space-y-4">
                {/* File Upload or YouTube */}
                <div className="p-4 bg-orange-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    1. เลือกไฟล์เสียง
                  </label>

                  {/* File Upload */}
                  <div className="mb-3">
                    <label className="block w-full cursor-pointer">
                      <div className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-orange-300 rounded-lg hover:border-orange-500 hover:bg-orange-100 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <span className="text-2xl">📁</span>
                        <span className="text-orange-700 font-medium">
                          {uploading ? 'กำลังอัพโหลด...' : 'คลิกเพื่อเลือกไฟล์ (MP3, WAV, M4A)'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept=".mp3,.wav,.m4a,audio/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setSelectedFile(file)
                            setShowProcessor(true)
                          }
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>

                  {showProcessor && selectedFile && (
                    <AudioProcessor
                      file={selectedFile}
                      onCancel={() => {
                        setShowProcessor(false)
                        setSelectedFile(null)
                      }}
                      onProcessComplete={(audioUrl) => {
                        setDownloadedAudioUrl(audioUrl)
                        setShowProcessor(false)
                        setSelectedFile(null)
                      }}
                    />
                  )}

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 border-t border-orange-200"></div>
                    <span className="text-sm text-gray-500">หรือ</span>
                    <div className="flex-1 border-t border-orange-200"></div>
                  </div>

                  {/* YouTube URL */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      ดาวน์โหลดจาก YouTube (อาจไม่ทำงานบน Vercel)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                      <button
                        onClick={downloadFromYoutube}
                        disabled={downloading || !youtubeUrl.trim()}
                        className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                      >
                        {downloading ? '⏳...' : '⬇️'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Audio Preview */}
                {downloadedAudioUrl && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ✅ ไฟล์เสียงที่อัพโหลด
                    </label>
                    <audio controls className="w-full">
                      <source src={downloadedAudioUrl} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}

                {/* Cover Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    2. ชื่อเพลง Cover
                  </label>
                  <input
                    type="text"
                    value={coverTitle}
                    onChange={(e) => setCoverTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="ชื่อเพลง Cover"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    3. สไตล์เพลง
                  </label>
                  <input
                    type="text"
                    value={coverStyle}
                    onChange={(e) => setCoverStyle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="pop, rock, jazz, ballad..."
                  />
                </div>

                {/* Instrumental Toggle */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="instrumental"
                    checked={coverInstrumental}
                    onChange={(e) => setCoverInstrumental(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="instrumental" className="text-sm font-medium text-gray-700">
                    Instrumental (ไม่มีเนื้อร้อง)
                  </label>
                </div>

                {/* Lyrics (only if not instrumental) */}
                {!coverInstrumental && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        4. เนื้อร้อง
                      </label>
                      {downloadedAudioUrl && (
                        <button
                          onClick={transcribeLyrics}
                          disabled={transcribing}
                          className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                        >
                          {transcribing ? '⏳ กำลังแกะเนื้อเพลง...' : '🎤 แกะเนื้อเพลงด้วย AI'}
                        </button>
                      )}
                    </div>
                    <textarea
                      value={coverLyrics}
                      onChange={(e) => setCoverLyrics(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      rows={6}
                      placeholder="ใส่เนื้อร้องที่ต้องการ หรือกดปุ่ม 'แกะเนื้อเพลงด้วย AI' ด้านบน..."
                    />
                  </div>
                )}

                {/* Vocal Gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    5. เพศเสียง
                  </label>
                  <select
                    value={coverVocalGender}
                    onChange={(e) => setCoverVocalGender(e.target.value as 'f' | 'm')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="f">หญิง (Female)</option>
                    <option value="m">ชาย (Male)</option>
                  </select>
                </div>

                {/* Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    6. เวอร์ชัน Suno
                  </label>
                  <select
                    value={coverModel}
                    onChange={(e) => setCoverModel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="V4_5ALL">V4.5 ALL (แนะนำ)</option>
                    <option value="V5">V5 (ใหม่ล่าสุด)</option>
                    <option value="V4_5">V4.5</option>
                    <option value="V4">V4</option>
                  </select>
                </div>

                {/* Generate Button */}
                <button
                  onClick={generateCover}
                  disabled={generatingCover || !downloadedAudioUrl || !coverTitle || !coverStyle || (!coverInstrumental && !coverLyrics) || !profile || profile.credits < 1}
                  className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingCover ? 'กำลังสร้าง Cover...' : '🎤 สร้าง Cover (ใช้เครดิต)'}
                </button>

                {profile && profile.credits < 1 && (
                  <p className="text-sm text-red-600 text-center">
                    เครดิตไม่เพียงพอ กรุณาติดต่อครูเพื่อเติมเครดิต
                  </p>
                )}
              </div>
            )}
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
                        className={`px-2 py-1 text-xs rounded-full ${song.status === 'completed'
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

                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400">
                        สร้างเมื่อ: {new Date(song.created_at).toLocaleString('th-TH')}
                      </p>
                      <button
                        onClick={() => deleteSong(song.id)}
                        disabled={deletingSongId === song.id}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
                      >
                        {deletingSongId === song.id ? 'กำลังลบ...' : '🗑️ ลบเพลง'}
                      </button>
                    </div>
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
