'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [fullName, setFullName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'login') {
        // Check if input is email or username
        let loginEmail = email || username

        // If username provided, convert to dummy email format
        if (username && !email) {
          // First, check if this username exists and get the user's actual email
          const { data: profile, error: profileError } = await supabase
            .rpc('get_email_by_username', { username_input: username })
            .single()

          if (profileError || !profile) {
            throw new Error('ไม่พบผู้ใช้งาน')
          }

          // Check if user is approved
          // Cast profile to any to avoid TypeScript error since RPC types might not be generated yet
          if (!(profile as any).approved) {
            throw new Error('บัญชีของคุณยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ')
          }

          loginEmail = (profile as any).email
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        })

        if (error) throw error

        // Get user profile to redirect to correct dashboard
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, approved')
            .eq('id', user.id)
            .single()

          // Double-check approval status
          if (!profile?.approved) {
            await supabase.auth.signOut()
            throw new Error('บัญชีของคุณยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ')
          }

          router.push(profile?.role === 'teacher' ? '/admin' : '/student')
        }
      } else {
        // Signup mode - check if username already exists
        const { data: usernameExists } = await supabase
          .rpc('check_username_exists', { username_input: username })

        if (usernameExists) {
          throw new Error('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่อผู้ใช้อื่น')
        }

        // Create auth user
        const { data: authData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              username: username,
            },
          },
        })

        if (error) throw error

        // Update profile with username (the trigger will create profile with approved=false by default)
        if (authData.user) {
          await supabase
            .from('profiles')
            .update({ username })
            .eq('id', authData.user.id)
        }

        alert('กรุณาตรวจสอบอีเมลเพื่อยืนยันการสมัคร\nบัญชีของคุณจะต้องได้รับการอนุมัติจากผู้ดูแลระบบก่อนจึงจะสามารถใช้งานได้')
        setMode('login')
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
          Suno Music Generator
        </h1>
        <p className="text-center text-gray-600 mb-6">
          ระบบสร้างเพลงด้วย AI สำหรับครูและนักเรียน
        </p>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              mode === 'login'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            เข้าสู่ระบบ
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              mode === 'signup'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            สมัครสมาชิก
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อ-นามสกุล
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>
          )}

          {mode === 'login' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อผู้ใช้ หรืออีเมล
              </label>
              <input
                type="text"
                value={username || email}
                onChange={(e) => {
                  const value = e.target.value
                  // If contains @, treat as email, otherwise username
                  if (value.includes('@')) {
                    setEmail(value)
                    setUsername('')
                  } else {
                    setUsername(value)
                    setEmail('')
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="กรอกชื่อผู้ใช้ หรืออีเมล"
                required
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อผู้ใช้ (Username)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="ตัวอักษรและตัวเลขเท่านั้น ไม่มีช่องว่าง"
                  pattern="[a-zA-Z0-9_]+"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  อีเมล (สำหรับยืนยันตัวตน)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รหัสผ่าน
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
              minLength={6}
            />
            {mode === 'signup' && (
              <p className="text-xs text-gray-500 mt-1">รหัสผ่านอย่างน้อย 6 ตัวอักษร</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'กำลังดำเนินการ...' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="mt-4 text-xs text-gray-500 text-center">
            หมายเหตุ: บัญชีใหม่จะต้องได้รับการอนุมัติจากผู้ดูแลระบบก่อนจึงจะสามารถใช้งานได้
            <br />
            บัญชีจะถูกสร้างเป็น &quot;นักเรียน&quot; โดยอัตโนมัติ
          </p>
        )}
      </div>
    </div>
  )
}
