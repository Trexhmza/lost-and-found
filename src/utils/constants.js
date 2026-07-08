export const POST_LIMIT_PER_SECTION = 3
export const MATCH_THRESHOLD = 0.7
export const GREY_ZONE_MIN = 0.5
export const GREY_ZONE_MAX = 0.75
export const ALLOWED_DOMAIN = 'umt.edu.pk'
export const CATEGORIES = [
  'Phone', 'Wallet', 'ID Card', 'Keys', 'Bag/Backpack',
  'Laptop/Tablet', 'Books', 'Clothing', 'Bottle', 'Accessories', 'Other'
]

export function timeAgo(dateStr) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const sec = Math.floor((now - then) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}
