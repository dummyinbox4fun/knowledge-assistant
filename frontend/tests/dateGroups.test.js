import { describe, it, expect } from 'vitest'
import { groupChats, groupLabel } from '../src/dateGroups'

// 15 Nov 2026, 10:00 local time
const NOW = new Date(2026, 10, 15, 10, 0, 0)
const daysAgo = (n, hour = 12) => new Date(2026, 10, 15 - n, hour, 0, 0).toISOString()

describe('groupLabel', () => {
  it('calls anything from earlier today "Today", whatever the hour', () => {
    expect(groupLabel(new Date(2026, 10, 15, 0, 5).toISOString(), NOW)).toBe('Today')
    expect(groupLabel(new Date(2026, 10, 15, 9, 59).toISOString(), NOW)).toBe('Today')
  })

  it('calls the previous calendar day "Yesterday", even late in the evening', () => {
    expect(groupLabel(daysAgo(1, 23), NOW)).toBe('Yesterday')
    expect(groupLabel(daysAgo(1, 0), NOW)).toBe('Yesterday')
  })

  it('covers two to seven days ago as "Previous 7 days"', () => {
    expect(groupLabel(daysAgo(2), NOW)).toBe('Previous 7 days')
    expect(groupLabel(daysAgo(7), NOW)).toBe('Previous 7 days')
  })

  it('calls anything older "Older"', () => {
    expect(groupLabel(daysAgo(8), NOW)).toBe('Older')
    expect(groupLabel(daysAgo(400), NOW)).toBe('Older')
  })
})

describe('groupChats', () => {
  it('keeps the order and starts a group whenever the label changes', () => {
    const items = [
      { id: 'a', updated_at: daysAgo(0) },
      { id: 'b', updated_at: daysAgo(0, 8) },
      { id: 'c', updated_at: daysAgo(1) },
      { id: 'd', updated_at: daysAgo(30) },
    ]
    const groups = groupChats(items, NOW)
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Older'])
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('returns no groups for no chats', () => {
    expect(groupChats([], NOW)).toEqual([])
  })
})
