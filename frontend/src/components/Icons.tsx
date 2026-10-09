import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }

export function PlayIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" /></svg>
}

export function PauseIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M9 5v14M15 5v14" strokeWidth="3" /></svg>
}

export function UploadIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15v4h14v-4" /></svg>
}

export function MusicIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M9 18V5l10-2v13M9 8l10-2" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>
}

export function DownloadIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" /></svg>
}

export function MixerIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6" /><circle cx="14" cy="7" r="2" /><circle cx="7" cy="17" r="2" /></svg>
}
