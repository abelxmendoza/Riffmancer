import type { Project, SeparationJob, StemName } from '../types'

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string }
    return body.detail ?? `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

export async function listProjects(): Promise<Project[]> {
  const response = await fetch('/api/projects')
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<Project[]>
}

export function uploadProject(file: File, onProgress: (progress: number) => void): Promise<Project> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    const body = new FormData()
    body.append('file', file)
    request.open('POST', '/api/projects')
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('load', () => {
      let payload: Project | { detail?: string }
      try {
        payload = JSON.parse(request.responseText) as Project | { detail?: string }
      } catch {
        reject(new Error(`Upload failed (${request.status || 'network error'})`))
        return
      }
      if (request.status >= 200 && request.status < 300) resolve(payload as Project)
      else reject(new Error(('detail' in payload && payload.detail) || `Upload failed (${request.status})`))
    })
    request.addEventListener('error', () => reject(new Error('Could not reach the local Riffmancer service.')))
    request.send(body)
  })
}

export const audioUrl = (projectId: string): string => `/api/projects/${projectId}/audio`

export async function getSeparation(projectId: string): Promise<SeparationJob | null> {
  const response = await fetch(`/api/projects/${projectId}/separation`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<SeparationJob>
}

export async function startSeparation(projectId: string): Promise<SeparationJob> {
  const response = await fetch(`/api/projects/${projectId}/separation`, { method: 'POST' })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<SeparationJob>
}

export const stemAudioUrl = (projectId: string, stem: StemName): string =>
  `/api/projects/${projectId}/separation/stems/${stem}`

export const stemDownloadUrl = (projectId: string, stem: StemName): string =>
  `${stemAudioUrl(projectId, stem)}?download=true`

export const stemsZipUrl = (projectId: string): string =>
  `/api/projects/${projectId}/separation/download`
