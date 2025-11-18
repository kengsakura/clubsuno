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

async function checkSchema() {
  console.log('🔍 กำลังตรวจสอบ schema ของตาราง songs...\n')

  // Try to select with new columns
  const { data, error } = await supabase
    .from('songs')
    .select('id, title, audio_url, audio_path, audio_url_2, audio_path_2')
    .limit(1)

  if (error) {
    console.log('❌ ERROR:', error.message)
    console.log('\n⚠️  ตาราง songs ยังไม่มีคอลัมน์ audio_url_2 และ audio_path_2')
    console.log('\n📝 กรุณารัน SQL migration นี้ใน Supabase Dashboard:\n')
    console.log('ALTER TABLE public.songs')
    console.log('  ADD COLUMN IF NOT EXISTS audio_url_2 text,')
    console.log('  ADD COLUMN IF NOT EXISTS audio_path_2 text;')
    console.log('\n')
    return
  }

  console.log('✅ Schema ถูกต้อง! มีคอลัมน์ audio_url_2 และ audio_path_2 แล้ว')

  if (data && data.length > 0) {
    console.log('\n📊 ตัวอย่างข้อมูล:')
    console.log(JSON.stringify(data[0], null, 2))
  }
}

checkSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
