export function formatElapsed(startTime) {
  const now = new Date()
  const start = new Date(startTime)
  const diffSeconds = Math.floor((now - start) / 1000)

  if (diffSeconds < 60) return `${diffSeconds} ث`
  const minutes = Math.floor(diffSeconds / 60)
  const seconds = diffSeconds % 60
  if (minutes < 60) return `${minutes}د ${seconds}ث`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return `${hours}س ${remainMinutes}د`
}

export function formatDuration(seconds) {
  if (seconds == null) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins === 0) return `${secs} ث`
  return `${mins}د ${secs}ث`
}

export function formatArabicDateTime() {
  return new Date().toLocaleString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatClock() {
  return new Date().toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
