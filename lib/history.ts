import type { HistoryItem } from '@/types'

const HISTORY_KEY = 'bp_cuisine_render_history'
const MAX_ITEMS = 10

export function getHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as HistoryItem[]) : []
  } catch {
    return []
  }
}

export function addToHistory(item: HistoryItem): void {
  if (typeof window === 'undefined') return
  try {
    const existing = getHistory()
    const updated = [item, ...existing.filter((h) => h.id !== item.id)].slice(0, MAX_ITEMS)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  } catch {
    // localStorage quota or unavailable — silently ignore
  }
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(HISTORY_KEY)
}
