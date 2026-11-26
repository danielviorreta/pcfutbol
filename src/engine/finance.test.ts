import { describe, expect, it } from 'vitest'
import { MAX_FINANCE_ENTRIES, appendFinanceEntries, createFinanceEntry, mapBreakdownToEntries } from './finance'
import type { ManagerGameState } from '../types/game'

const gameWith = (count: number) =>
  ({ financeEntries: Array.from({ length: count }, (_, i) => createFinanceEntry(1, 'mgr', 'sponsor', i + 1, `old ${i}`)) }) as ManagerGameState

describe('finance', () => {
  it('puts new entries first and drops zero amounts', () => {
    const entries = appendFinanceEntries(gameWith(2), [
      createFinanceEntry(2, 'mgr', 'ticketing', 500, 'new'),
      createFinanceEntry(2, 'mgr', 'ticketing', 0, 'zero'),
    ])

    expect(entries.map((entry) => entry.description)).toEqual(['new', 'old 0', 'old 1'])
  })

  it('caps the history length', () => {
    const entries = appendFinanceEntries(gameWith(MAX_FINANCE_ENTRIES), [createFinanceEntry(2, 'mgr', 'ticketing', 1, 'new')])

    expect(entries).toHaveLength(MAX_FINANCE_ENTRIES)
    expect(entries[0].description).toBe('new')
  })

  it('keeps only the manager team breakdown items', () => {
    const entries = mapBreakdownToEntries(3, [
      { teamId: 'mgr', category: 'ticketing', amount: 100, description: 'gate' },
      { teamId: 'other', category: 'ticketing', amount: 100, description: 'gate' },
      { teamId: 'mgr', category: 'salary', amount: 0, description: 'none' },
    ], 'mgr')

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ round: 3, teamId: 'mgr', amount: 100 })
  })
})
