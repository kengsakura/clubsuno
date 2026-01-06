import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import ffmpegPath from 'ffmpeg-static'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File
        const speed = parseFloat(formData.get('speed') as string) || 1.0
        const pitch = parseInt(formData.get('pitch') as string) || 0

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Validate file type
        const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/mp4', 'audio/x-m4a']
        if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a)$/i)) {
            return NextResponse.json({
                error: 'ไฟล์ไม่ถูกต้อง - รองรับเฉพาะ MP3, WAV, M4A'
            }, { status: 400 })
        }

        // Check file size (max 50MB)
        const maxSize = 50 * 1024 * 1024
        if (file.size > maxSize) {
            return NextResponse.json({
                error: 'ไฟล์ใหญ่เกินไป - ต้องไม่เกิน 50MB'
            }, { status: 400 })
        }

        console.log(`[AudioProcess] File: ${file.name}, Speed: ${speed}, Pitch: ${pitch}`)

        // Write file to temp directory
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const ext = file.name.split('.').pop() || 'mp3'
        const inputPath = join(tmpdir(), `input-${randomUUID()}.${ext}`)
        const outputPath = join(tmpdir(), `output-${randomUUID()}.mp3`)

        await writeFile(inputPath, buffer)

        // Build FFmpeg filter
        const pitchFactor = Math.pow(2, pitch / 12)
        const sampleRate = 44100
        const newRate = Math.round(sampleRate * pitchFactor)
        const tempoCorrection = 1 / pitchFactor

        // FFmpeg filter chain: asetrate for pitch, atempo for speed correction + user speed
        const filters = `asetrate=${newRate},atempo=${tempoCorrection.toFixed(4)},atempo=${speed.toFixed(2)}`

        // Run FFmpeg
        await new Promise<void>((resolve, reject) => {
            if (!ffmpegPath) {
                reject(new Error('FFmpeg not found'))
                return
            }
            const ffmpeg = spawn(ffmpegPath, [
                '-i', inputPath,
                '-filter:a', filters,
                '-y',
                outputPath
            ])

            ffmpeg.stderr.on('data', (data) => {
                console.log(`[FFmpeg] ${data}`)
            })

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve()
                } else {
                    reject(new Error(`FFmpeg exited with code ${code}`))
                }
            })

            ffmpeg.on('error', (err) => {
                reject(err)
            })
        })

        // Read output file
        const outputBuffer = await readFile(outputPath)

        // Clean up temp files
        await unlink(inputPath).catch(() => {})
        await unlink(outputPath).catch(() => {})

        // Upload to Supabase Storage
        const supabaseAdmin = createServiceClient()
        const filename = `processed-${user.id}-${Date.now()}.mp3`

        const { data: uploadData, error: uploadError } = await supabaseAdmin
            .storage
            .from('songs')
            .upload(filename, outputBuffer, {
                contentType: 'audio/mpeg',
                upsert: false
            })

        if (uploadError) {
            console.error('[Upload Error]', uploadError)
            return NextResponse.json({ error: 'อัพโหลดไฟล์ไม่สำเร็จ' }, { status: 500 })
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin
            .storage
            .from('songs')
            .getPublicUrl(filename)

        return NextResponse.json({
            audioUrl: urlData.publicUrl,
            message: 'ประมวลผลเสร็จสิ้น'
        })

    } catch (error: any) {
        console.error('[AudioProcess Error]', error)
        return NextResponse.json({
            error: error.message || 'เกิดข้อผิดพลาดในการประมวลผล'
        }, { status: 500 })
    }
}
