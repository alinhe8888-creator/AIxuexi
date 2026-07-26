export const toDateKey = (value: Date | string = new Date()): string => {
  const date = typeof value === 'string' ? new Date(value) : value
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export const addDays = (value: Date | string, days: number): string => {
  const date = typeof value === 'string' ? new Date(value) : new Date(value)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export const formatDate = (value?: string, withTime = false): string => {
  if (!value) return '暂无'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

export const isDue = (value?: string): boolean => {
  if (!value) return false
  return new Date(value).getTime() <= Date.now()
}

export const startOfWeek = (value = new Date()): Date => {
  const date = new Date(value)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  date.setHours(0, 0, 0, 0)
  return date
}
