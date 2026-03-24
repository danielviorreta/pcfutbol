import type { GameSummary, ManagerGameState } from '../types/game'

interface SaveStorage {
  games: ManagerGameState[]
  activeGameId: string | null
}

const STORAGE_KEY = 'pcfutbol-legacy-saves'
const LEGACY_STORAGE_KEY = 'pcfutbol-legacy-save'

function isValidGame(game: Partial<ManagerGameState>): game is ManagerGameState {
  return (
    typeof game.id === 'string' &&
    typeof game.saveName === 'string' &&
    typeof game.createdAt === 'string' &&
    typeof game.updatedAt === 'string' &&
    typeof game.managerName === 'string' &&
    typeof game.managerTeamId === 'string' &&
    Array.isArray(game.managerLineup) &&
    typeof game.leagueState === 'object' &&
    game.leagueState !== null
  )
}

function makeMigratedLegacyGame(legacy: Partial<ManagerGameState>): ManagerGameState | null {
  if (
    typeof legacy.managerName !== 'string' ||
    typeof legacy.managerTeamId !== 'string' ||
    !Array.isArray(legacy.managerLineup) ||
    typeof legacy.leagueState !== 'object' ||
    legacy.leagueState === null
  ) {
    return null
  }

  const now = new Date().toISOString()
  const managerTeam = legacy.leagueState.teams.find((team) => team.id === legacy.managerTeamId)

  return {
    id: `legacy-${Date.now()}`,
    saveName: `${legacy.managerName} - ${managerTeam?.name ?? 'Carrera'}`,
    createdAt: now,
    updatedAt: now,
    managerName: legacy.managerName,
    managerTeamId: legacy.managerTeamId,
    managerLineup: legacy.managerLineup,
    leagueState: legacy.leagueState,
  }
}

function persistStorage(storage: SaveStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
}

function normalizeGame(game: ManagerGameState): ManagerGameState {
  return {
    ...game,
    leagueState: {
      ...game.leagueState,
      teams: game.leagueState.teams.map((team) => ({
        ...team,
        staff: team.staff ?? { medicalLevel: 1, disciplineLevel: 1 },
        players: team.players.map((player) => ({
          ...player,
          yellowCards: player.yellowCards ?? 0,
        })),
      })),
    },
  }
}

export function loadSaveStorage(): SaveStorage {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SaveStorage>
      const games = Array.isArray(parsed.games)
        ? parsed.games
          .filter((game): game is ManagerGameState => isValidGame(game))
          .map(normalizeGame)
        : []
      const activeGameId =
        typeof parsed.activeGameId === 'string' && games.some((game) => game.id === parsed.activeGameId)
          ? parsed.activeGameId
          : games[0]?.id ?? null

      return { games, activeGameId }
    } catch {
      return { games: [], activeGameId: null }
    }
  }

  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacyRaw) {
    return { games: [], activeGameId: null }
  }

  try {
    const parsedLegacy = JSON.parse(legacyRaw) as Partial<ManagerGameState>
    const migrated = makeMigratedLegacyGame(parsedLegacy)

    if (!migrated) {
      return { games: [], activeGameId: null }
    }

    const normalized = normalizeGame(migrated)

    const storage = {
      games: [normalized],
      activeGameId: normalized.id,
    }

    persistStorage(storage)
    localStorage.removeItem(LEGACY_STORAGE_KEY)

    return storage
  } catch {
    return { games: [], activeGameId: null }
  }
}

export function saveSaveStorage(storage: SaveStorage): void {
  persistStorage(storage)
}

export function toGameSummaries(games: ManagerGameState[]): GameSummary[] {
  return [...games]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((game) => ({
      id: game.id,
      saveName: game.saveName,
      managerName: game.managerName,
      managerTeamId: game.managerTeamId,
      managerTeamName:
        game.leagueState.teams.find((team) => team.id === game.managerTeamId)?.name ?? game.managerTeamId,
      currentRound: Math.min(game.leagueState.currentRound, game.leagueState.totalRounds),
      totalRounds: game.leagueState.totalRounds,
      updatedAt: game.updatedAt,
    }))
}
