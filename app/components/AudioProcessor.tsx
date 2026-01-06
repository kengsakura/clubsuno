'use client'

import { useState } from 'react'

interface AudioProcessorProps {
  file: File
  onProcessComplete: (audioUrl: string) => void
  onCancel: () => void
}

export default function AudioProcessor({ file, onProcessComplete, onCancel }: AudioProcessorProps) {
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(0) // semitones
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')

  const processAudio = async () => {
    setProcessing(true)
    setMessage('กำลังอัพโหลดและประมวลผล...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('speed', speed.toString())
      formData.append('pitch', pitch.toString())

      const response = await fetch('/api/audio/process', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setMessage('เสร็จสิ้น!')
        onProcessComplete(data.audioUrl)
      } else {
        const error = await response.json()
        setMessage('เกิดข้อผิดพลาด: ' + error.error)
      }
    } catch (e: any) {
      setMessage('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  const uploadOriginal = async () => {
    setProcessing(true)
    setMessage('กำลังอัพโหลดไฟล์เดิม...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/cover/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setMessage('เสร็จสิ้น!')
        onProcessComplete(data.audioUrl)
      } else {
        const error = await response.json()
        setMessage('เกิดข้อผิดพลาด: ' + error.error)
      }
    } catch (e: any) {
      setMessage('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
        <h3 className="text-xl font-bold mb-4">🎚️ ปรับแต่งเสียงต้นฉบับ</h3>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            <span className="font-medium">ไฟล์:</span> {file.name}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            ขนาด: {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium">ความเร็ว (Speed)</label>
                <span className="text-sm text-blue-600 font-semibold">{speed}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
                disabled={processing}
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>ช้าลง 0.5x</span>
                <span>ปกติ 1x</span>
                <span>เร็วขึ้น 2x</span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium">คีย์ (Pitch)</label>
                <span className="text-sm text-blue-600 font-semibold">
                  {pitch > 0 ? `+${pitch}` : pitch} semitones
                </span>
              </div>
              <input 
                type="range" 
                min="-12" 
                max="12" 
                step="1" 
                value={pitch}
                onChange={(e) => setPitch(parseInt(e.target.value))}
                className="w-full accent-blue-600"
                disabled={processing}
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>ต่ำลง -12</span>
                <span>ปกติ 0</span>
                <span>สูงขึ้น +12</span>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div className="mb-4 text-center text-sm text-gray-600 bg-gray-100 p-2 rounded">
            {message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button 
            onClick={uploadOriginal}
            disabled={processing}
            className="flex-1 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            ใช้ไฟล์เดิม
          </button>
          <button 
            onClick={processAudio}
            disabled={processing}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {processing ? '⏳ กำลังทำ...' : '🎵 ปรับแต่ง'}
          </button>
        </div>
      </div>
    </div>
  )
}
