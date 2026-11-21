// Groups the sidebar's chats by how recently they were active.
// `items` must already be sorted newest first (the API does that).

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function groupLabel(isoDate, now = new Date()) {
  const daysAgo = Math.round((startOfDay(now) - startOfDay(new Date(isoDate))) / DAY_MS)
  if (daysAgo <= 0) return 'Today'
  if (daysAgo === 1) return 'Yesterday'
  if (daysAgo <= 7) return 'Previous 7 days'
  return 'Older'
}

export function groupChats(items, now = new Date()) {
  const groups = []
  for (const item of items) {
    const label = groupLabel(item.updated_at, now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.items.push(item)
    } else {
      groups.push({ label, items: [item] })
    }
  }
  return groups
}
