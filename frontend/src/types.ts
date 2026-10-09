export interface AudioMetadata {
  duration_seconds: number
  format_name: string
  codec_name: string
  sample_rate: number
  channels: number
  bit_rate: number | null
  size_bytes: number
}

export interface Project {
  id: string
  title: string
  original_filename: string
  stored_filename: string
  content_type: string
  sha256: string
  created_at: string
  audio: AudioMetadata
}

export type StemName = 'vocals' | 'drums' | 'bass' | 'other'
export type SeparationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'interrupted'

export interface StemMetadata {
  name: StemName
  label: string
  filename: string
  audio: AudioMetadata
}

export interface SeparationJob {
  id: string
  project_id: string
  provider: string
  status: SeparationStatus
  stage: string
  progress: number | null
  error_code: string | null
  error_message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  stems: Partial<Record<StemName, StemMetadata>>
}
