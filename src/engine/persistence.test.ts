import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSaveStorage, saveSaveStorage } from './persistence'
import type { ManagerGameState } from '../types/game'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
}

let storage: MemoryStorage

function makeGame(id: string): ManagerGameState {
  return {
    id,
    saveName: `Save ${id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    seasonStartYear: 2026,
    managerName: 'Manager',
    managerTeamId: 'team',
    managerLineup: [],
    managerSquadOrder: [],
    financeEntries: [],
    pendingTransferOffers: [],
    pendingRenewalOffers: [],
    pendingOutgoingTransfers: [],
    leagueState: {
      currentRound: 1,
      totalRounds: 38,
      teams: [],
      fixtures: [],
      lastResults: [],
      news: [],
      promotionSummary: [],
      promotionBracket: null,
    },
  } as ManagerGameState
}

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
})

describe('save storage', () => {
  it('round-trips games through one key per game', () => {
    const result = saveSaveStorage({ games: [makeGame('a'), makeGame('b')], activeGameId: 'b' })

    expect(result.ok).toBe(true)
    expect(storage.getItem('pcfutbol-save:a')).not.toBeNull()
    expect(storage.getItem('pcfutbol-save:b')).not.toBeNull()

    const loaded = loadSaveStorage()
    expect(loaded.games.map((game) => game.id)).toEqual(['a', 'b'])
    expect(loaded.activeGameId).toBe('b')
  })

  it('writes only the games marked as changed', () => {
    saveSaveStorage({ games: [makeGame('a'), makeGame('b')], activeGameId: 'a' })
    const setItem = vi.spyOn(storage, 'setItem')

    saveSaveStorage({ games: [makeGame('a'), makeGame('b')], activeGameId: 'a' }, ['b'])

    const writtenKeys = setItem.mock.calls.map(([key]) => key)
    expect(writtenKeys).toContain('pcfutbol-save:b')
    expect(writtenKeys).not.toContain('pcfutbol-save:a')
  })

  it('removes the key of a deleted game', () => {
    saveSaveStorage({ games: [makeGame('a'), makeGame('b')], activeGameId: 'a' })
    saveSaveStorage({ games: [makeGame('a')], activeGameId: 'a' }, [])

    expect(storage.getItem('pcfutbol-save:b')).toBeNull()
    expect(loadSaveStorage().games.map((game) => game.id)).toEqual(['a'])
  })

  it('migrates the single-key v1 layout', () => {
    storage.setItem('pcfutbol-legacy-saves', JSON.stringify({ games: [makeGame('old')], activeGameId: 'old' }))

    const loaded = loadSaveStorage()

    expect(loaded.games.map((game) => game.id)).toEqual(['old'])
    expect(storage.getItem('pcfutbol-legacy-saves')).toBeNull()
    expect(storage.getItem('pcfutbol-save:old')).not.toBeNull()
  })

  it('reports a full storage instead of throwing', () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    const result = saveSaveStorage({ games: [makeGame('a')], activeGameId: 'a' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/almacenamiento/)
    }
  })
})
