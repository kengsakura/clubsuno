export type UserRole = 'teacher' | 'student'

export type SongStatus = 'pending' | 'generating' | 'completed' | 'failed'

export type TransactionType = 'add' | 'deduct'

export interface Profile {
  id: string
  email: string
  username: string | null
  full_name: string | null
  role: UserRole
  credits: number
  approved: boolean
  created_at: string
  updated_at: string
}

export type SongType = 'original' | 'cover'

export interface Song {
  id: string
  user_id: string
  title: string
  lyrics: string
  style: string
  task_id: string | null
  status: SongStatus
  audio_url: string | null
  audio_path: string | null
  audio_url_2: string | null
  audio_path_2: string | null
  duration: number | null
  credits_used: number
  error_message: string | null
  type: SongType
  source_youtube_url: string | null
  created_at: string
  updated_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  type: TransactionType
  reason: string
  related_song_id: string | null
  created_by: string | null
  created_at: string
}

export interface Settings {
  id: string
  key: string
  value: any
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SunoGenerateRequest {
  prompt: string
  title?: string
  customMode?: boolean
  instrumental?: boolean
  model?: string
}

export interface SunoGenerateResponse {
  code: number
  msg: string
  data: {
    taskId: string
  }
}

export interface SunoTaskData {
  sunoData: Array<{
    title: string
    audioUrl: string
    duration: number
  }>
}

export interface SunoStatusResponse {
  code: number
  msg: string
  data: {
    status: 'PENDING' | 'FIRST_SUCCESS' | 'SUCCESS' | 'CREATE_TASK_FAILED' | 'GENERATE_AUDIO_FAILED' | 'CALLBACK_EXCEPTION' | 'SENSITIVE_WORD_ERROR'
    response: SunoTaskData
    errorMessage?: string
  }
}

export interface CoverGenerateRequest {
  uploadUrl: string
  title?: string
  style?: string
  prompt?: string
  customMode?: boolean
  instrumental?: boolean
  model?: 'V5' | 'V4_5PLUS' | 'V4_5' | 'V4_5ALL' | 'V4'
  vocalGender?: 'f' | 'm'
  negativeTags?: string
  styleWeight?: number
  weirdnessConstraint?: number
  audioWeight?: number
  personaId?: string
  sourceYoutubeUrl?: string
}
