import { estimatePlayerHappiness, estimatePlayerValue, estimateReleaseClause } from './playerMarket'
import type { GameSummary, ManagerGameState } from '../types/game'
import { PLAYER_REAL_AGES } from '../data/playerRealData'

interface SaveStorage {
  games: ManagerGameState[]
  activeGameId: string | null
}

const STORAGE_KEY = 'pcfutbol-legacy-saves'
const LEGACY_STORAGE_KEY = 'pcfutbol-legacy-save'
const DEFAULT_SEASON_START_YEAR = 2025

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hashText(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function estimateMissingPlayerAge(
  player: { id: string; name?: string; position: string; overall: number; contractYears?: number },
  division?: string,
): number {
  const byName = player.name ? PLAYER_REAL_AGES[player.name] : undefined
  if (typeof byName === 'number') {
    return clamp(Math.round(byName), 16, 40)
  }

  const seed = hashText(player.id)
  const positionBase =
    player.position === 'GK'
      ? 29
      : player.position === 'DEF'
        ? 27
        : player.position === 'MID'
          ? 26
          : 25
  const divisionBias = division === 'Primera' ? 1 : division === 'Segunda' ? 0 : -1
  const qualityBias = player.overall >= 88 ? 2 : player.overall >= 82 ? 1 : player.overall <= 70 ? -2 : 0
  const contractBias = (player.contractYears ?? 3) >= 4 ? -1 : (player.contractYears ?? 3) <= 1 ? 2 : 0
  const variance = (seed % 7) - 3

  return clamp(positionBase + divisionBias + qualityBias + contractBias + variance, 17, 38)
}

const SEGUNDA_REGIONAL_GROUPS: Record<string, 'Grupo 1' | 'Grupo 2'> = {
  lev: 'Grupo 2',
  eib: 'Grupo 1',
  ten: 'Grupo 2',
  zar: 'Grupo 1',
  ovi: 'Grupo 1',
  spo: 'Grupo 1',
  rac: 'Grupo 1',
  alb: 'Grupo 2',
  bur: 'Grupo 1',
  car: 'Grupo 2',
  mir: 'Grupo 1',
  dep: 'Grupo 1',
  hue: 'Grupo 1',
  and: 'Grupo 2',
  pon: 'Grupo 1',
  lug: 'Grupo 1',
  cas: 'Grupo 2',
  fer: 'Grupo 1',
  eld: 'Grupo 2',
  leg: 'Grupo 2',
}

function isValidGame(game: Partial<ManagerGameState>): game is ManagerGameState {
  return (
    typeof game.id === 'string' &&
    typeof game.saveName === 'string' &&
    typeof game.createdAt === 'string' &&
    typeof game.updatedAt === 'string' &&
    typeof game.managerName === 'string' &&
    typeof game.managerTeamId === 'string' &&
    Array.isArray(game.managerLineup) &&
    (game.managerSquadOrder === undefined || Array.isArray(game.managerSquadOrder)) &&
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
    seasonStartYear: DEFAULT_SEASON_START_YEAR,
    managerName: legacy.managerName,
    managerTeamId: legacy.managerTeamId,
    managerLineup: legacy.managerLineup,
    managerSquadOrder: managerTeam?.players.map((player) => player.id) ?? [],
    financeEntries: [],
    pendingTransferOffers: [],
    pendingRenewalOffers: [],
    pendingOutgoingTransfers: [],
    leagueState: legacy.leagueState,
  }
}

function normalizeManagerSquadOrder(game: ManagerGameState): string[] {
  const managerTeam = game.leagueState.teams.find((team) => team.id === game.managerTeamId)
  if (!managerTeam) {
    return []
  }

  const validIds = new Set(managerTeam.players.map((player) => player.id))
  const rawOrder = Array.isArray((game as Partial<ManagerGameState>).managerSquadOrder)
    ? (game as Partial<ManagerGameState>).managerSquadOrder as string[]
    : []
  const normalized = [...new Set(rawOrder)].filter((playerId) => validIds.has(playerId))
  const missing = managerTeam.players.map((player) => player.id).filter((playerId) => !normalized.includes(playerId))

  return [...normalized, ...missing]
}

function persistStorage(storage: SaveStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
}

function normalizeSponsor(team: { division?: string; sponsor: { name: string; weeklyIncome: number; targetRank: number; seasonBonus: number; seasonBonusPaid: boolean } }): typeof team.sponsor {
  const isPrimera = team.division === 'Primera'
  const isSegunda = team.division === 'Segunda'
  const current = team.sponsor
  // Cap inflated weekly income from old saves
  const maxWeekly = isPrimera ? 840_000 : isSegunda ? 230_000 : 90_000
  const minWeekly = isPrimera ? 200_000 : isSegunda ? 60_000 : 28_000
  const maxBonus = isPrimera ? 1_800_000 : isSegunda ? 450_000 : 160_000
  const minBonus = isPrimera ? 400_000 : isSegunda ? 80_000 : 50_000

  const weeklyIncome = clamp(current.weeklyIncome, minWeekly, maxWeekly)
  const seasonBonus = current.seasonBonusPaid
    ? current.seasonBonus
    : clamp(current.seasonBonus, minBonus, maxBonus)

  return { ...current, weeklyIncome, seasonBonus }
}

function normalizeGame(game: ManagerGameState): ManagerGameState {
  const primeraFederacionTeams = game.leagueState.teams.filter((team) => team.division === 'Primera Federacion')
  const groupOneIds = new Set(primeraFederacionTeams.slice(0, 20).map((team) => team.id))

  return {
    ...game,
    seasonStartYear:
      typeof (game as Partial<ManagerGameState>).seasonStartYear === 'number'
        ? (game as Partial<ManagerGameState>).seasonStartYear as number
        : DEFAULT_SEASON_START_YEAR,
    pendingTransferOffers: Array.isArray((game as Partial<ManagerGameState>).pendingTransferOffers)
      ? (game as Partial<ManagerGameState>).pendingTransferOffers ?? []
      : [],
    pendingRenewalOffers: Array.isArray((game as Partial<ManagerGameState>).pendingRenewalOffers)
      ? (game as Partial<ManagerGameState>).pendingRenewalOffers ?? []
      : [],
    financeEntries: Array.isArray((game as Partial<ManagerGameState>).financeEntries)
      ? (game as Partial<ManagerGameState>).financeEntries ?? []
      : [],
    pendingOutgoingTransfers: Array.isArray((game as Partial<ManagerGameState>).pendingOutgoingTransfers)
      ? (game as Partial<ManagerGameState>).pendingOutgoingTransfers ?? []
      : [],
    managerSquadOrder: normalizeManagerSquadOrder(game),
    leagueState: {
      ...game.leagueState,
      promotionSummary: game.leagueState.promotionSummary ?? [],
      promotionBracket: game.leagueState.promotionBracket ?? null,
      teams: game.leagueState.teams.map((team) => ({
        ...team,
        division: team.division ?? 'Primera',
        group:
          team.division === 'Primera Federacion'
            ? (team.group ?? (groupOneIds.has(team.id) ? 'Grupo 1' : 'Grupo 2'))
            : undefined,
        regionalGroup:
          team.regionalGroup ??
          (team.division === 'Segunda'
            ? SEGUNDA_REGIONAL_GROUPS[team.id]
            : team.division === 'Primera Federacion'
            ? (team.group ?? (groupOneIds.has(team.id) ? 'Grupo 1' : 'Grupo 2'))
            : undefined),
        staff: team.staff ?? { medicalLevel: 1, disciplineLevel: 1 },
        sponsor: normalizeSponsor(team),
        players: team.players.map((player) => {
          const age =
            typeof player.age === 'number'
              ? clamp(Math.round(player.age), 16, 40)
              : estimateMissingPlayerAge(player, team.division)
          const contractYears = player.contractYears ?? 3
          const happiness =
            typeof player.happiness === 'number'
              ? player.happiness
              : estimatePlayerHappiness(team, contractYears)
          const value = estimatePlayerValue(player.overall, team.division ?? 'Primera', age)
          const releaseClause = estimateReleaseClause(
            {
              value,
              overall: player.overall,
              wage: player.wage,
              contractYears,
            },
            team,
            happiness,
          )
          const transferListed = Boolean((player as Partial<typeof player>).transferListed)
          const askingPriceFloor = team.division === 'Primera' ? 300_000 : team.division === 'Segunda' ? 180_000 : 90_000
          const askingPrice = transferListed
            ? Math.max(askingPriceFloor, Math.round(releaseClause * 0.82))
            : releaseClause

          return {
            ...player,
            age,
            value,
            yellowCards: player.yellowCards ?? 0,
            happiness,
            releaseClause,
            transferListed,
            askingPrice,
            contractYears,
          }
        }),
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
