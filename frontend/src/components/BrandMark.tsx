export function BrandMark({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" role="img" aria-label="Riffmancer musical skull">
      <path d="M15 27C15 16.5 22.4 9 32 9s17 7.5 17 18c0 7-3.2 11.5-7.5 14v9.5l-6-3-3.5 5-3.5-5-6 3V41C18.2 38.5 15 34 15 27Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M22 27.5c3.2-2.2 7.2-.4 7.2 3.1 0 3-2.4 5-5.2 4.2-3.3-.9-4.6-5.2-2-7.3Zm20 0c-3.2-2.2-7.2-.4-7.2 3.1 0 3 2.4 5 5.2 4.2 3.3-.9 4.6-5.2 2-7.3Z" fill="currentColor" />
      <path d="m32 35-3 6h6l-3-6ZM25 42.5h14M27 47v-4.5M32 48v-5.5M37 47v-4.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10 17h10M44 17h10M9 22h8M47 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".65" />
      <path d="M18 8v13m0-11 7-2v5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15" cy="21" r="3" fill="currentColor" />
      <circle cx="22" cy="13" r="3" fill="currentColor" />
    </svg>
  )
}
