const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

export function formatFullDate(date: Date): string {
  return dateFormatter.format(date)
}

export function formatTime(date: Date): string {
  return timeFormatter.format(date)
}

export function formatGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}
