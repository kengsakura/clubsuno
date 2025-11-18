'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Profile } from '@/lib/types'

export default function AdminPage() {
  const [students, setStudents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [creditsToAdd, setCreditsToAdd] = useState<{ [key: string]: number }>({})
  const [creditsPerSong, setCreditsPerSong] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newCredits, setNewCredits] = useState(10)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    loadStudents()
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

  const loadStudents = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading students:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      // ไม่ alert ถ้าเป็นแค่ RLS error เพราะอาจจะยังไม่มี student
      if (error.message && !error.message.includes('infinite recursion')) {
        console.log('Note: This might be because there are no students yet or RLS policy issue')
      }
    } else {
      console.log('Students loaded:', data?.length || 0, 'students')
      setStudents(data || [])
    }
    setLoading(false)
  }

  const loadSettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'credits_per_song')
      .single()

    if (data) {
      setCreditsPerSong(parseInt(data.value))
    }
  }

  const addCredits = async (studentId: string) => {
    const amount = creditsToAdd[studentId]
    if (!amount || amount <= 0) return

    const response = await fetch('/api/credits/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        amount,
        reason: 'เติมเครดิตจากครู',
      }),
    })

    if (response.ok) {
      setCreditsToAdd({ ...creditsToAdd, [studentId]: 0 })
      loadStudents()
    } else {
      const error = await response.json()
      alert('เกิดข้อผิดพลาด: ' + error.error)
    }
  }

  const createUser = async () => {
    if (!newUsername) {
      alert('กรุณากรอกชื่อผู้ใช้')
      return
    }

    const response = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newUsername,
        full_name: newFullName,
        initial_credits: newCredits,
      }),
    })

    if (response.ok) {
      const result = await response.json()
      alert(`สร้างผู้ใช้สำเร็จ!\nชื่อผู้ใช้: ${result.user.username}\nรหัสผ่าน: ${result.user.password}\n\n⚠️ กรุณาจดรหัสผ่านไว้เพื่อส่งให้นักเรียน`)
      setShowCreateModal(false)
      setNewUsername('')
      setNewFullName('')
      setNewCredits(10)
      loadStudents()
    } else {
      const error = await response.json()
      alert('เกิดข้อผิดพลาด: ' + error.error)
    }
  }

  const approveUser = async (userId: string, approved: boolean) => {
    const response = await fetch('/api/admin/users/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        approved,
      }),
    })

    if (response.ok) {
      alert(approved ? 'อนุมัติผู้ใช้แล้ว' : 'ปฏิเสธผู้ใช้แล้ว')
      loadStudents()
    } else {
      const error = await response.json()
      alert('เกิดข้อผิดพลาด: ' + error.error)
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
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold mb-2">การตั้งค่า</h2>
              <p className="text-gray-600">
                เครดิตต่อเพลง: <span className="font-bold">{creditsPerSong}</span> เครดิต
              </p>
            </div>
            <a
              href="/admin/settings"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              ⚙️ ตั้งค่า API Keys
            </a>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">รายชื่อผู้ใช้ทั้งหมด</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              + สร้างผู้ใช้นักเรียน
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-gray-500">ยังไม่มีผู้ใช้ในระบบ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      ชื่อผู้ใช้
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      ชื่อ-นามสกุล
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      บทบาท
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      สถานะ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      เครดิต
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      เติมเครดิต
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {student.username || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {student.full_name || 'ไม่ระบุชื่อ'}
                        </div>
                        <div className="text-xs text-gray-500">{student.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          student.role === 'teacher' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {student.role === 'teacher' ? 'ครู' : 'นักเรียน'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          student.approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {student.approved ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          {student.credits}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.role === 'student' && (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="1"
                              value={creditsToAdd[student.id] || ''}
                              onChange={(e) =>
                                setCreditsToAdd({
                                  ...creditsToAdd,
                                  [student.id]: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                              placeholder="0"
                            />
                            <button
                              onClick={() => addCredits(student.id)}
                              disabled={!creditsToAdd[student.id] || creditsToAdd[student.id] <= 0}
                              className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                              เติม
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.role === 'student' && (
                          <div className="flex items-center space-x-2">
                            {!student.approved ? (
                              <button
                                onClick={() => approveUser(student.id, true)}
                                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                              >
                                อนุมัติ
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (confirm('คุณต้องการยกเลิกการอนุมัติผู้ใช้นี้หรือไม่?')) {
                                    approveUser(student.id, false)
                                  }
                                }}
                                className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                              >
                                ยกเลิกการอนุมัติ
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">สร้างผู้ใช้นักเรียนใหม่</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อผู้ใช้ (Username) *
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="เช่น student01"
                  pattern="[a-zA-Z0-9_]+"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  ใช้เป็นรหัสผ่านเริ่มต้น (นักเรียนสามารถเปลี่ยนได้ภายหลัง)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ-นามสกุล
                </label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="เช่น นายสมชาย ใจดี"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เครดิตเริ่มต้น
                </label>
                <input
                  type="number"
                  value={newCredits}
                  onChange={(e) => setNewCredits(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  min="0"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={createUser}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                สร้างผู้ใช้
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewUsername('')
                  setNewFullName('')
                  setNewCredits(10)
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
