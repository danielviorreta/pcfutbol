import { createInitialLeagueState } from '../data/seedData'
import { getDefaultLineup, sanitizeLineupSelection } from './squad'
import type { Fixture, IncomingTransferOffer, ManagerGameState, Team } from '../types/game'

const DEFAULT_SEASON_START_YEAR = 2025

interface CreateGameInput {
  saveName: string
  managerName: string
  managerTeamId: string
}

export function getManagerTeam(game: ManagerGameState | null): Team | null {
  if (!game) {
    return null
  }

  return game.leagueState.teams.find((team) => team.id === game.managerTeamId) ?? game.leagueState.teams[0] ?? null
}

export function buildGame(input: CreateGameInput): ManagerGameState {
  const leagueState = createInitialLeagueState()
  const managerTeam =
    leagueState.teams.find((team) => team.id === input.managerTeamId) ?? leagueState.teams[0]
  const now = new Date().toISOString()

  return {
    id: `game-${Date.now()}-${Math.round(Math.random() * 100_000)}`,
    saveName: input.saveName.trim() || `${input.managerName.trim() || 'Mister'} - ${managerTeam.name}`,
    createdAt: now,
    updatedAt: now,
    seasonStartYear: DEFAULT_SEASON_START_YEAR,
    managerName: input.managerName.trim() || 'Mister',
    managerTeamId: managerTeam.id,
    managerLineup: getDefaultLineup(managerTeam),
    managerSquadOrder: managerTeam.players.map((player) => player.id),
    financeEntries: [],
    pendingTransferOffers: [],
    pendingOutgoingTransfers: [],
    pendingRenewalOffers: [],
    leagueState,
  }
}

export function mergeIncomingOffers(
  currentOffers: IncomingTransferOffer[],
  nextOffers: IncomingTransferOffer[],
  managerTeam: Team | null,
  currentRound: number,
): IncomingTransferOffer[] {
  const managerPlayerIds = new Set(managerTeam?.players.map((player) => player.id) ?? [])
  const merged = [...currentOffers, ...nextOffers]
  const deduped = new Map<string, IncomingTransferOffer>()

  merged.forEach((offer) => {
    if (!managerPlayerIds.has(offer.playerId)) {
      return
    }

    if (currentRound - offer.createdRound > 2) {
      return
    }

    deduped.set(`${offer.buyerTeamId}:${offer.playerId}`, offer)
  })

  return [...deduped.values()]
}

export function getCurrentManagerFixture(game: ManagerGameState): Fixture | null {
  return game.leagueState.fixtures.find(
    (fixture) =>
      fixture.round === game.leagueState.currentRound &&
      !fixture.played &&
      (fixture.homeTeamId === game.managerTeamId || fixture.awayTeamId === game.managerTeamId),
  ) ?? null
}

export function syncManagerLineup(team: Team, lineup: string[]): string[] {
  return sanitizeLineupSelection(team, lineup)
}

export function syncManagerSquadOrder(team: Team, order: string[]): string[] {
  const validIds = new Set(team.players.map((player) => player.id))
  const normalized = [...new Set(order)].filter((playerId) => validIds.has(playerId))
  const missing = team.players.map((player) => player.id).filter((playerId) => !normalized.includes(playerId))

  return [...normalized, ...missing]
}
