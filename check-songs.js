const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSongs() {
  console.log('🔍 กำลังตรวจสอบข้อมูลเพลงในฐานข้อมูล...\n')

  const { data: songs, error } = await supabase
    .from('songs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  if (!songs || songs.length === 0) {
    console.log('ℹ️  ไม่มีเพลงในฐานข้อมูล')
    return
  }

  console.log(`📊 พบเพลงทั้งหมด ${songs.length} เพลง:\n`)

  songs.forEach((song, index) => {
    console.log(`\n${index + 1}. 🎵 ${song.title}`)
    console.log(`   ID: ${song.id}`)
    console.log(`   Task ID: ${song.task_id}`)
    console.log(`   Status: ${song.status}`)
    console.log(`   Audio URL: ${song.audio_url || 'ไม่มี'}`)
    console.log(`   Audio Path: ${song.audio_path || 'ไม่มี'}`)
    console.log(`   Duration: ${song.duration || 'ไม่มี'}`)
    console.log(`   Credits Used: ${song.credits_used}`)
    console.log(`   Error: ${song.error_message || 'ไม่มี'}`)
    console.log(`   Created: ${new Date(song.created_at).toLocaleString('th-TH')}`)
    console.log(`   Updated: ${new Date(song.updated_at).toLocaleString('th-TH')}`)
  })

  console.log('\n')

  // สรุปสถานะ
  const statusCounts = songs.reduce((acc, song) => {
    acc[song.status] = (acc[song.status] || 0) + 1
    return acc
  }, {})

  console.log('📈 สรุปสถานะ:')
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count} เพลง`)
  })
}

checkSongs()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
