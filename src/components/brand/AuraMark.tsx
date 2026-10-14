export function AuraMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="10" fill="#121821" />
      <path
        d="M8 22.5 16 8.5l8 14"
        fill="none"
        stroke="#4CC9A8"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.2 22.5h7.6"
        fill="none"
        stroke="#7AA2FF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
