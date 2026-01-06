import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

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

        console.log(`[Upload] File: ${file.name}, Size: ${file.size}, Type: ${file.type}`)

        // Read file as buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Generate filename
        const ext = file.name.split('.').pop() || 'mp3'
        const filename = `cover-${user.id}-${Date.now()}.${ext}`

        // Upload to Supabase Storage
        const supabaseAdmin = createServiceClient()

        const { error: uploadError } = await supabaseAdmin.storage
            .from('songs')
            .upload(filename, buffer, {
                contentType: file.type || 'audio/mpeg',
                upsert: true,
            })

        if (uploadError) {
            console.error('[Upload Error]', uploadError)
            throw new Error(`Failed to upload audio: ${uploadError.message}`)
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from('songs')
            .getPublicUrl(filename)

        console.log(`[Upload] Success: ${urlData.publicUrl}`)

        return NextResponse.json({
            success: true,
            audioUrl: urlData.publicUrl,
            filename,
            originalName: file.name,
        })

    } catch (error: any) {
        console.error('Error uploading file:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to upload file' },
            { status: 500 }
        )
    }
}
