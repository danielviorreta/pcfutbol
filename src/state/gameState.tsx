/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react'
import { createInitialLeagueState } from '../data/seedData'
import {
  applyWeeklyClubManagement,
  promoteYouthPlayer,
  resolveRenewalOffers,
  submitRenewalOffer,
  setStadiumTicketPrice,
  setTeamTactic,
  setTeamTrainingFocus,
  upgradeDisciplineStaff,
  upgradeMedicalStaff,
  upgradeStadium as upgradeStadiumEngine,
} from '../engine/club'
import { loadSaveStorage, saveSaveStorage, toGameSummaries } from '../engine/persistence'
import { playCurrentRound, sortLeagueTable } from '../engine/simulation'
import { getOperationalCapacity } from '../engine/stadium'
import {
  canToggleInLineup,
  getDefaultLineup,
  getFormationSlots,
  getLineupIssues,
  getTeamRatings,
  isPlayerAvailable,
  sanitizeLineupSelection,
} from '../engine/squad'
import { acceptIncomingTransferOffer, buyPlayer, getTransferTargets, setPlayerTransferStatus } from '../engine/transfers'
import type {
  FinanceCategory,
  FinanceBreakdownItem,
  FinanceEntry,
  GameSummary,
  IncomingTransferOffer,
  MatchCommentaryEvent,
  MatchGoalRecord,
  MatchIncidentRecord,
  MatchPresentation,
  MatchStats,
  MatchSubstitutionRecord,
  MatchTacticalChangeRecord,
  ManagerGameState,
  PendingOutgoingTransferOffer,
  PendingRenewalOffer,
  Player,
  PromisedRole,
  Tactic,
  Team,
  TrainingFocus,
  TransferTarget,
} from '../types/game'

interface CreateGameInput {
  saveName: string
  managerName: string
  managerTeamId: string
}

interface GameContextValue {
  game: ManagerGameState | null
  managerTeam: Team | null
  matchPresentation: MatchPresentation | null
  table: Team[]
  transferTargets: TransferTarget[]
  pendingTransferOffers: IncomingTransferOffer[]
  pendingOutgoingTransfers: PendingOutgoingTransferOffer[]
  pendingRenewalOffers: PendingRenewalOffer[]
  savedGames: GameSummary[]
  notice: string | null
  setManagerName: (value: string) => void
  setSaveName: (value: string) => void
  createGame: (input: CreateGameInput) => void
  selectGame: (gameId: string) => void
  deleteGame: (gameId: string) => void
  playRound: () => void
  prepareMatchPresentation: () => boolean
  confirmMatchPresentation: () => void
  clearMatchPresentation: () => void
  resetGame: () => void
  toggleLineupPlayer: (playerId: string) => void
  setLineupSlotPlayer: (slotIndex: number, playerId: string) => void
  reorderSquadPlayer: (sourcePlayerId: string, targetPlayerId: string) => void
  autoPickLineup: () => void
  purchasePlayer: (playerId: string, wageOffer: number, signingBonus: number, contractYears: number, promisedRole: PromisedRole, feeOffer?: number) => void
  cancelOutgoingTransfer: (offerId: string) => void
  listPlayerForTransfer: (playerId: string, askingPrice: number) => void
  removePlayerFromTransferList: (playerId: string) => void
  acceptTransferOffer: (offerId: string) => void
  rejectTransferOffer: (offerId: string) => void
  saveCurrentGame: () => void
  setTrainingFocus: (focus: TrainingFocus) => void
  setTactic: (tactic: Tactic) => void
  renewContract: (playerId: string, wageOffer?: number, contractYears?: number) => void
  cancelRenewalOffer: (offerId: string) => void
  promoteYouth: (youthId: string) => void
  setTicketPrice: (price: number) => void
  upgradeStadium: () => void
  improveMedicalStaff: () => void
  improveDisciplineStaff: () => void
  clearNotice: () => void
}

const GameContext = createContext<GameContextValue | null>(null)
const DEFAULT_SEASON_START_YEAR = 2025
const MAX_FINANCE_ENTRIES = 160

function createFinanceEntry(
  round: number,
  teamId: string,
  category: FinanceCategory,
  amount: number,
  description: string,
): FinanceEntry {
  return {
    id: `fin-${teamId}-${round}-${Math.round(Math.random() * 1_000_000)}`,
    round,
    teamId,
    category,
    amount,
    description,
  }
}

function appendFinanceEntries(prev: ManagerGameState, entries: FinanceEntry[]): FinanceEntry[] {
  return [...entries.filter((entry) => entry.amount !== 0), ...(prev.financeEntries ?? [])].slice(0, MAX_FINANCE_ENTRIES)
}

function getTeamBudget(teams: Team[], teamId: string): number {
  return teams.find((team) => team.id === teamId)?.budget ?? 0
}

function mapBreakdownToEntries(
  round: number,
  items: FinanceBreakdownItem[] | undefined,
  managerTeamId: string,
): FinanceEntry[] {
  return (items ?? [])
    .filter((item) => item.teamId === managerTeamId && item.amount !== 0)
    .map((item) => createFinanceEntry(round, item.teamId, item.category, item.amount, item.description))
}

function getManagerTeam(game: ManagerGameState | null): Team | null {
  if (!game) {
    return null
  }

  return game.leagueState.teams.find((team) => team.id === game.managerTeamId) ?? game.leagueState.teams[0] ?? null
}

function buildGame(input: CreateGameInput): ManagerGameState {
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

function mergeIncomingOffers(
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

function getCurrentManagerFixture(game: ManagerGameState) {
  return game.leagueState.fixtures.find(
    (fixture) =>
      fixture.round === game.leagueState.currentRound &&
      !fixture.played &&
      (fixture.homeTeamId === game.managerTeamId || fixture.awayTeamId === game.managerTeamId),
  ) ?? null
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function syncManagerLineup(team: Team, lineup: string[]): string[] {
  return sanitizeLineupSelection(team, lineup)
}

function syncManagerSquadOrder(team: Team, order: string[]): string[] {
  const validIds = new Set(team.players.map((player) => player.id))
  const normalized = [...new Set(order)].filter((playerId) => validIds.has(playerId))
  const missing = team.players.map((player) => player.id).filter((playerId) => !normalized.includes(playerId))

  return [...normalized, ...missing]
}

function buildLineupWarning(team: Team, lineup: string[]): string | null {
  const issues = getLineupIssues(team, lineup)
  if (issues.length === 0) {
    return null
  }

  const unavailablePlayers = issues
    .filter((issue) => issue.type === 'unavailable-player' && issue.playerName)
    .map((issue) => issue.playerName)

  const messages: string[] = []
  if (issues.some((issue) => issue.type === 'missing-players')) {
    messages.push('tu once titular no tiene 11 jugadores asignados')
  }
  if (issues.some((issue) => issue.type === 'missing-goalkeeper')) {
    messages.push('falta un portero en el once')
  }
  if (unavailablePlayers.length > 0) {
    messages.push(`hay jugadores no disponibles: ${unavailablePlayers.join(', ')}`)
  }

  return `Revisa la alineacion antes de empezar: ${messages.join(' · ')}.`
}

function buildMatchStats(homeTeam: Team, awayTeam: Team, homeLineup: string[], awayLineup: string[], homeGoals: number, awayGoals: number): MatchStats {
  const homeRatings = getTeamRatings(homeTeam, homeLineup)
  const awayRatings = getTeamRatings(awayTeam, awayLineup)
  const homeControl = homeRatings.midfield + homeTeam.morale * 0.35
  const awayControl = awayRatings.midfield + awayTeam.morale * 0.35
  const possessionShare = clamp(homeControl / Math.max(1, homeControl + awayControl), 0.35, 0.65)
  const homePossession = Math.round(possessionShare * 100)
  const awayPossession = 100 - homePossession

  const homeShots = clamp(homeGoals + 5 + Math.round(homeRatings.attack / 18), 4, 22)
  const awayShots = clamp(awayGoals + 5 + Math.round(awayRatings.attack / 18), 4, 22)
  const homeShotsOnTarget = clamp(homeGoals + 2 + Math.round(homeShots * 0.35), homeGoals, homeShots)
  const awayShotsOnTarget = clamp(awayGoals + 2 + Math.round(awayShots * 0.35), awayGoals, awayShots)
  const homeBigChances = clamp(homeGoals + Math.round(homeRatings.attack / 32), 1, 7)
  const awayBigChances = clamp(awayGoals + Math.round(awayRatings.attack / 32), 1, 7)

  const priceEffect = Math.max(0, (homeTeam.stadium.ticketPrice - 35) * 0.005)
  const moraleEffect = (homeTeam.morale - 70) * 0.002
  const opponentStrength = (awayTeam.attack + awayTeam.midfield + awayTeam.defense) / 3
  const importanceEffect = (opponentStrength - 75) * 0.004
  const scoreVariance = (homeGoals + awayGoals - 2) * 0.01
  const fillRate = clamp(0.7 - priceEffect + moraleEffect + importanceEffect + scoreVariance, 0.2, 0.98)

  return {
    home: {
      possession: homePossession,
      shots: homeShots,
      shotsOnTarget: homeShotsOnTarget,
      bigChances: homeBigChances,
    },
    away: {
      possession: awayPossession,
      shots: awayShots,
      shotsOnTarget: awayShotsOnTarget,
      bigChances: awayBigChances,
    },
    attendance: Math.round(getOperationalCapacity(homeTeam.stadium) * fillRate),
  }
}

function pickLineupName(team: Team, lineup: string[], fallbackIndex = 0) {
  return team.players.find((player) => player.id === lineup[fallbackIndex])?.name
    ?? team.players[0]?.name
    ?? team.name
}

function getLineupPlayers(team: Team, lineup: string[]): Player[] {
  return lineup
    .map((playerId) => team.players.find((player) => player.id === playerId))
    .filter((player): player is Player => Boolean(player))
}

function getAttackingPool(team: Team, lineup: string[]): Player[] {
  const players = getLineupPlayers(team, lineup)
  const forwards = players.filter((player) => player.position === 'FWD')
  const midfielders = players.filter((player) => player.position === 'MID')
  const defenders = players.filter((player) => player.position === 'DEF')
  const goalkeepers = players.filter((player) => player.position === 'GK')

  return [...forwards, ...forwards, ...midfielders, ...midfielders, ...defenders, ...goalkeepers]
}

function getSupportPool(team: Team, lineup: string[], scorerName?: string): Player[] {
  return getLineupPlayers(team, lineup)
    .filter((player) => player.name !== scorerName)
    .sort((a, b) => {
      const weight = (player: Player) =>
        player.position === 'MID' ? 3 : player.position === 'FWD' ? 2 : player.position === 'DEF' ? 1 : 0

      return weight(b) - weight(a)
    })
}

function buildGoalMinutes(totalGoals: number) {
  const baseMinutes = [12, 24, 37, 54, 68, 83]
  return baseMinutes.slice(0, totalGoals).map((minute, index) => minute + index)
}

function buildGoalRecords(team: Team, lineup: string[], totalGoals: number, teamId: string, minuteOffset = 0): MatchGoalRecord[] {
  const minutes = buildGoalMinutes(totalGoals).map((minute) => minute + minuteOffset)
  const attackers = getAttackingPool(team, lineup)

  return minutes.map((minute, index) => {
    const scorer = attackers[index % Math.max(attackers.length, 1)]?.name ?? pickLineupName(team, lineup, 8)
    const supportPool = getSupportPool(team, lineup, scorer)
    const assist = supportPool[index % Math.max(supportPool.length, 1)]?.name

    return {
      minute,
      teamId,
      scorer,
      assist,
    }
  })
}

function buildTeamIncidents(teamBefore: Team, teamAfter: Team, teamId: string): MatchIncidentRecord[] {
  const minutePool = [19, 33, 47, 62, 71, 79, 86]
  const incidents: MatchIncidentRecord[] = []
  let incidentIndex = 0

  teamBefore.players.forEach((beforePlayer) => {
    const afterPlayer = teamAfter.players.find((player) => player.id === beforePlayer.id)
    if (!afterPlayer) {
      return
    }

    const nextMinute = () => minutePool[Math.min(incidentIndex++, minutePool.length - 1)]
    const bookedByAccumulation = beforePlayer.yellowCards === 4 && afterPlayer.suspensionWeeks > beforePlayer.suspensionWeeks
    const gainedYellow = afterPlayer.yellowCards > beforePlayer.yellowCards || bookedByAccumulation

    if (gainedYellow) {
      incidents.push({
        minute: nextMinute(),
        teamId,
        player: beforePlayer.name,
        type: 'yellow',
      })
    }

    if (afterPlayer.suspensionWeeks > beforePlayer.suspensionWeeks && beforePlayer.yellowCards < 4) {
      incidents.push({
        minute: nextMinute(),
        teamId,
        player: beforePlayer.name,
        type: 'red',
        detail: 'Terminara suspendido para la proxima jornada.',
      })
    }

    if (afterPlayer.injuryWeeks > beforePlayer.injuryWeeks) {
      incidents.push({
        minute: nextMinute(),
        teamId,
        player: beforePlayer.name,
        type: 'injury',
        detail: `${afterPlayer.injuryWeeks} semana${afterPlayer.injuryWeeks === 1 ? '' : 's'} de baja`,
      })
    }
  })

  return incidents
}

function buildMatchIncidents(
  homeTeamBefore: Team,
  awayTeamBefore: Team,
  homeTeamAfter: Team,
  awayTeamAfter: Team,
): MatchIncidentRecord[] {
  return [
    ...buildTeamIncidents(homeTeamBefore, homeTeamAfter, homeTeamBefore.id),
    ...buildTeamIncidents(awayTeamBefore, awayTeamAfter, awayTeamBefore.id).map((incident, index) => ({
      ...incident,
      minute: incident.minute + (index % 2 === 0 ? 3 : 1),
    })),
  ].sort((a, b) => a.minute - b.minute)
}

function buildTeamSubstitutions(team: Team, lineup: string[], incidents: MatchIncidentRecord[]): MatchSubstitutionRecord[] {
  const lineupPlayers = getLineupPlayers(team, lineup)
  const lineupIds = new Set(lineup)
  const bench = team.players.filter((player) => !lineupIds.has(player.id))
  const usedOut = new Set<string>()
  const substitutions: MatchSubstitutionRecord[] = []

  const injuryIncidents = incidents.filter((incident) => incident.teamId === team.id && incident.type === 'injury')
  injuryIncidents.forEach((incident) => {
    const replacement = bench.find((candidate) => !substitutions.some((sub) => sub.playerIn === candidate.name))
    if (!replacement || usedOut.has(incident.player)) {
      return
    }

    substitutions.push({
      minute: clamp(incident.minute + 1, 1, 90),
      teamId: team.id,
      playerOut: incident.player,
      playerIn: replacement.name,
      reason: 'injury',
    })
    usedOut.add(incident.player)
  })

  const fatigueCandidate = [...lineupPlayers]
    .filter((player) => !usedOut.has(player.name))
    .sort((a, b) => (b.fatigue + (100 - b.stamina) * 0.4) - (a.fatigue + (100 - a.stamina) * 0.4))[0]
  const fatigueReplacement = bench.find((candidate) => !substitutions.some((sub) => sub.playerIn === candidate.name))

  if (fatigueCandidate && fatigueReplacement) {
    substitutions.push({
      minute: 67,
      teamId: team.id,
      playerOut: fatigueCandidate.name,
      playerIn: fatigueReplacement.name,
      reason: 'fatigue',
    })
    usedOut.add(fatigueCandidate.name)
  }

  const tacticalOut = lineupPlayers.find((player) => !usedOut.has(player.name) && player.position !== 'GK')
  const tacticalIn = bench.find(
    (candidate) =>
      !substitutions.some((sub) => sub.playerIn === candidate.name) &&
      (tacticalOut ? candidate.position === tacticalOut.position || candidate.position === 'FWD' : true),
  )

  if (tacticalOut && tacticalIn) {
    substitutions.push({
      minute: 76,
      teamId: team.id,
      playerOut: tacticalOut.name,
      playerIn: tacticalIn.name,
      reason: 'tactical',
    })
  }

  return substitutions.sort((a, b) => a.minute - b.minute)
}

function buildMatchSubstitutions(
  homeTeam: Team,
  awayTeam: Team,
  homeLineup: string[],
  awayLineup: string[],
  incidents: MatchIncidentRecord[],
): MatchSubstitutionRecord[] {
  return [
    ...buildTeamSubstitutions(homeTeam, homeLineup, incidents),
    ...buildTeamSubstitutions(awayTeam, awayLineup, incidents).map((sub) => ({
      ...sub,
      minute: clamp(sub.minute + 2, 1, 90),
    })),
  ].sort((a, b) => a.minute - b.minute)
}

function buildMatchTacticalChanges(homeTeam: Team, awayTeam: Team, homeGoals: number, awayGoals: number): MatchTacticalChangeRecord[] {
  const homeLosing = homeGoals < awayGoals
  const awayLosing = awayGoals < homeGoals

  const homeSummary = homeLosing
    ? 'Ajuste ofensivo: bloque mas alto y extremos muy abiertos para buscar el empate.'
    : homeGoals > awayGoals
      ? 'Ajuste conservador: lineas juntas y prioridad al orden defensivo.'
      : 'Ajuste de mediocampo: mas pausa para controlar el ritmo.'

  const awaySummary = awayLosing
    ? 'Ajuste ofensivo: presion tras perdida y laterales lanzados al ataque.'
    : awayGoals > homeGoals
      ? 'Ajuste conservador: repliegue medio y transiciones rapidas.'
      : 'Ajuste de mediocampo: circulacion corta y control de segundas jugadas.'

  return [
    { minute: 58, teamId: homeTeam.id, summary: homeSummary },
    { minute: 63, teamId: awayTeam.id, summary: awaySummary },
  ]
}

function buildMatchCommentary(
  homeTeam: Team,
  awayTeam: Team,
  homeGoals: number,
  awayGoals: number,
  stats: MatchStats,
  goals: MatchGoalRecord[],
  incidents: MatchIncidentRecord[],
  substitutions: MatchSubstitutionRecord[],
  tacticalChanges: MatchTacticalChangeRecord[],
): MatchCommentaryEvent[] {
  const events: MatchCommentaryEvent[] = [
    {
      minute: 1,
      kind: 'general',
      text: `Arranca el partido en ${homeTeam.stadium.name}. ${homeTeam.name} busca imponer su ritmo desde el inicio.`,
    },
    {
      minute: 7,
      kind: 'general',
      text: `${homeTeam.name} y ${awayTeam.name} comienzan con ritmo alto y mucha presion sobre la salida de balon.`,
    },
    {
      minute: 14,
      kind: 'general',
      text: `Primer tramo intenso: ${homeTeam.name} remata ${stats.home.shotsOnTarget} veces a puerta frente a ${stats.away.shotsOnTarget} de ${awayTeam.name} al final del partido.`,
    },
  ]

  let scoreHome = 0
  let scoreAway = 0

  goals.forEach((goal) => {
    const teamName = goal.teamId === homeTeam.id ? homeTeam.name : awayTeam.name
    const assistText = goal.assist ? `, asistencia de ${goal.assist}` : ''
    if (goal.teamId === homeTeam.id) {
      scoreHome += 1
    } else {
      scoreAway += 1
    }

    events.push({
      minute: goal.minute,
      kind: 'goal',
      teamId: goal.teamId,
      scoreHome,
      scoreAway,
      text: `Gol de ${teamName}. Marca ${goal.scorer}${assistText}.`,
    })
  })

  incidents.forEach((incident) => {
    const teamName = incident.teamId === homeTeam.id ? homeTeam.name : awayTeam.name

    if (incident.type === 'yellow') {
      events.push({
        minute: incident.minute,
        kind: 'incident',
        teamId: incident.teamId,
        text: `Amarilla para ${incident.player} en ${teamName}. Llega tarde al cruce y el arbitro no duda.`,
      })
      return
    }

    if (incident.type === 'red') {
      events.push({
        minute: incident.minute,
        kind: 'incident',
        teamId: incident.teamId,
        text: `Tarjeta roja para ${incident.player} en ${teamName}. ${incident.detail ?? 'El equipo queda condicionado.'}`,
      })
      return
    }

    events.push({
      minute: incident.minute,
      kind: 'incident',
      teamId: incident.teamId,
      text: `${incident.player} no puede seguir en ${teamName}. ${incident.detail ?? 'Se marcha tocado tras una accion dura.'}`,
    })
  })

  substitutions.forEach((substitution) => {
    const teamName = substitution.teamId === homeTeam.id ? homeTeam.name : awayTeam.name
    const reasonText = substitution.reason === 'injury'
      ? 'por lesion'
      : substitution.reason === 'fatigue'
        ? 'por fatiga'
        : 'ajuste tactico'

    events.push({
      minute: substitution.minute,
      kind: 'substitution',
      teamId: substitution.teamId,
      text: `Cambio en ${teamName}: entra ${substitution.playerIn} por ${substitution.playerOut} (${reasonText}).`,
    })
  })

  tacticalChanges.forEach((change) => {
    const teamName = change.teamId === homeTeam.id ? homeTeam.name : awayTeam.name
    events.push({
      minute: change.minute,
      kind: 'tactical',
      teamId: change.teamId,
      text: `${teamName} modifica su planteamiento. ${change.summary}`,
    })
  })

  events.push({
    minute: 45,
    kind: 'general',
    text: `Descanso: ${homeTeam.name} ${homeGoals > awayGoals ? 'manda' : awayGoals > homeGoals ? 'sufre' : 'iguala'} un partido con ${stats.home.possession}% de posesion local.`,
  })
  events.push({
    minute: 61,
    kind: 'general',
    text: `La posesion marca diferencias: ${homeTeam.name} maneja el ${stats.home.possession}% por el ${stats.away.possession}% de ${awayTeam.name}.`,
  })
  events.push({
    minute: 74,
    kind: 'general',
    text: `Las ocasiones claras van ${stats.home.bigChances}-${stats.away.bigChances}. El partido sigue completamente abierto.`,
  })
  events.push({
    minute: 88,
    kind: 'general',
    text: `La asistencia oficial es de ${stats.attendance.toLocaleString('es-ES')} espectadores. El ambiente aprieta en el tramo final.`,
  })
  events.push({
    minute: 90,
    kind: 'final',
    scoreHome: homeGoals,
    scoreAway: awayGoals,
    text: `Final del encuentro: ${homeTeam.name} ${homeGoals}-${awayGoals} ${awayTeam.name}.`,
  })

  return events.sort((a, b) => a.minute - b.minute)
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const initialStorage = loadSaveStorage()
  const [games, setGames] = useState<ManagerGameState[]>(initialStorage.games)
  const [activeGameId, setActiveGameId] = useState<string | null>(initialStorage.activeGameId)
  const [notice, setNotice] = useState<string | null>(null)
  const [matchPresentation, setMatchPresentation] = useState<MatchPresentation | null>(null)

  const game = useMemo(
    () => games.find((candidate) => candidate.id === activeGameId) ?? null,
    [games, activeGameId],
  )
  const managerTeam = useMemo(() => getManagerTeam(game), [game])
  const table = useMemo(() => {
    if (!game) {
      return []
    }

    const manager = game.leagueState.teams.find((team) => team.id === game.managerTeamId)
    if (!manager) {
      return sortLeagueTable(game.leagueState.teams)
    }

    return sortLeagueTable(
      game.leagueState.teams.filter((team) =>
        team.division === manager.division &&
        (manager.division !== 'Primera Federacion' || team.group === manager.group),
      ),
    )
  }, [game])
  const transferTargets = useMemo(
    () => (game ? getTransferTargets(game.leagueState, game.managerTeamId, Number.MAX_SAFE_INTEGER) : []),
    [game],
  )
  const savedGames = useMemo(() => toGameSummaries(games), [games])

  const persistCollection = (nextGames: ManagerGameState[], nextActiveGameId: string | null) => {
    saveSaveStorage({ games: nextGames, activeGameId: nextActiveGameId })
    setGames(nextGames)
    setActiveGameId(nextActiveGameId)
  }

  const updateActiveGame = (updater: (current: ManagerGameState) => ManagerGameState) => {
    if (!game) {
      return
    }

    const nextGame = {
      ...updater(game),
      updatedAt: new Date().toISOString(),
    }

    const nextGames = games.map((candidate) =>
      candidate.id === nextGame.id ? nextGame : candidate,
    )

    persistCollection(nextGames, nextGame.id)
  }

  const createGame = (input: CreateGameInput) => {
    const nextGame = buildGame(input)
    const nextGames = [...games, nextGame]
    persistCollection(nextGames, nextGame.id)
    setMatchPresentation(null)
    setNotice(`Nueva partida creada con ${getManagerTeam(nextGame)?.name ?? 'tu club'}.`)
  }

  const selectGame = (gameId: string) => {
    const existing = games.find((candidate) => candidate.id === gameId)
    if (!existing) {
      return
    }

    persistCollection(games, gameId)
    setMatchPresentation(null)
    setNotice(`Partida activa: ${existing.saveName}.`)
  }

  const deleteGame = (gameId: string) => {
    const nextGames = games.filter((candidate) => candidate.id !== gameId)
    const nextActive = activeGameId === gameId ? nextGames[0]?.id ?? null : activeGameId
    persistCollection(nextGames, nextActive)
    setMatchPresentation(null)
    setNotice('Partida eliminada.')
  }

  const setManagerName = (value: string) => {
    updateActiveGame((prev) => ({ ...prev, managerName: value || 'Mister' }))
  }

  const setSaveName = (value: string) => {
    updateActiveGame((prev) => ({ ...prev, saveName: value.trim() || prev.saveName }))
  }

  const playRound = () => {
    updateActiveGame((prev) => {
      const simulatedState = playCurrentRound(prev.leagueState, {
        managerTeamId: prev.managerTeamId,
        managerLineup: prev.managerLineup,
      })
      const seasonRolledOver = simulatedState.currentRound > simulatedState.totalRounds

      const { nextState, headlines, incomingOffers, financeBreakdown } = applyWeeklyClubManagement(
        simulatedState,
        prev.managerTeamId,
        prev.pendingTransferOffers,
      )
      const withWeeklyNews = {
        ...nextState,
        news: [...headlines, ...nextState.news].slice(0, 12),
      }

      const { nextState: afterRenewals, messages: renewalMessages, resolvedIds } = resolveRenewalOffers(
        withWeeklyNews,
        prev.managerTeamId,
        prev.pendingRenewalOffers ?? [],
      )

      const nextManagerTeam =
        afterRenewals.teams.find((team) => team.id === prev.managerTeamId) ?? afterRenewals.teams[0]
      const pendingTransferOffers = mergeIncomingOffers(
        prev.pendingTransferOffers,
        incomingOffers,
        nextManagerTeam,
        afterRenewals.currentRound,
      )

      if (renewalMessages.length > 0) {
        setNotice(renewalMessages.join(' | '))
      }

      const resolvedRenewalOffers = (prev.pendingRenewalOffers ?? []).filter((o) => resolvedIds.includes(o.id))

      // Resolve outgoing transfer offers submitted in a previous round
      const dueOutgoing = prev.pendingOutgoingTransfers.filter(
        (o) => o.createdRound < afterRenewals.currentRound,
      )
      let stateAfterOutgoing = afterRenewals
      const outgoingFinanceEntries: ReturnType<typeof createFinanceEntry>[] = []
      for (const pending of dueOutgoing) {
        const { nextState: afterBuy, message, ok } = buyPlayer(
          stateAfterOutgoing,
          prev.managerTeamId,
          pending.playerId,
          pending.wageOffer,
          pending.signingBonus,
          pending.contractYears,
          pending.promisedRole,
          pending.transferFee,
        )
        if (ok) {
          stateAfterOutgoing = afterBuy
          const spent = pending.transferFee + pending.signingBonus
          outgoingFinanceEntries.push(
            createFinanceEntry(afterRenewals.currentRound, prev.managerTeamId, 'transfer-in', -spent, `Fichaje de ${pending.playerName}`),
          )
          setNotice(`${pending.playerName} ha llegado a tu equipo.`)
        } else {
          setNotice(message)
        }
      }
      const resolvedOutgoingIds = new Set(dueOutgoing.map((o) => o.id))
      const nextManagerTeamFinal =
        stateAfterOutgoing.teams.find((team) => team.id === prev.managerTeamId) ?? stateAfterOutgoing.teams[0]

      const financeEntries = appendFinanceEntries(prev, [
        ...mapBreakdownToEntries(prev.leagueState.currentRound, simulatedState.financeBreakdown, prev.managerTeamId),
        ...mapBreakdownToEntries(prev.leagueState.currentRound, financeBreakdown, prev.managerTeamId),
        ...resolvedRenewalOffers.map((offer) => createFinanceEntry(prev.leagueState.currentRound, prev.managerTeamId, 'renewal', -offer.signingBonus, `Renovación de ${offer.playerName}`)),
        ...outgoingFinanceEntries,
      ])

      return {
        ...prev,
        seasonStartYear: seasonRolledOver ? prev.seasonStartYear + 1 : prev.seasonStartYear,
        financeEntries,
        leagueState: stateAfterOutgoing,
        pendingTransferOffers,
        pendingRenewalOffers: (prev.pendingRenewalOffers ?? []).filter((o) => !resolvedIds.includes(o.id)),
        pendingOutgoingTransfers: prev.pendingOutgoingTransfers.filter((o) => !resolvedOutgoingIds.has(o.id)),
        managerLineup: syncManagerLineup(nextManagerTeamFinal, prev.managerLineup),
        managerSquadOrder: syncManagerSquadOrder(nextManagerTeamFinal, prev.managerSquadOrder),
      }
    })
    if (!game?.pendingRenewalOffers?.length) {
      setNotice('Jornada completada. Partida guardada automaticamente.')
    }
  }

  const prepareMatchPresentation = (): boolean => {
    if (!game) {
      return false
    }

    if (game.leagueState.currentRound > game.leagueState.totalRounds) {
      setNotice('Calendario completado.')
      return false
    }

    const fixture = getCurrentManagerFixture(game)
    if (!fixture) {
      setNotice('No hay partido pendiente para esta jornada.')
      return false
    }

    const homeTeam = game.leagueState.teams.find((team) => team.id === fixture.homeTeamId)
    const awayTeam = game.leagueState.teams.find((team) => team.id === fixture.awayTeamId)

    if (!homeTeam || !awayTeam) {
      setNotice('No se pudo preparar la previa del partido.')
      return false
    }

    const managerFixtureTeam = homeTeam.id === game.managerTeamId
      ? homeTeam
      : awayTeam.id === game.managerTeamId
        ? awayTeam
        : null

    if (!managerFixtureTeam) {
      setNotice('No se pudo identificar tu alineacion para este partido.')
      return false
    }

    const lineupWarning = buildLineupWarning(managerFixtureTeam, game.managerLineup)
    if (lineupWarning) {
      setNotice(lineupWarning)
      return false
    }

    const managerLineup = syncManagerLineup(managerFixtureTeam, game.managerLineup)

    setMatchPresentation({
      phase: 'preview',
      round: game.leagueState.currentRound,
      fixtureId: fixture.id,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      homeLineup: homeTeam.id === game.managerTeamId ? managerLineup : getDefaultLineup(homeTeam),
      awayLineup: awayTeam.id === game.managerTeamId ? managerLineup : getDefaultLineup(awayTeam),
    })

    return true
  }

  const confirmMatchPresentation = () => {
    if (!game || !matchPresentation) {
      return
    }

    const homeTeamBeforeMatch = game.leagueState.teams.find((team) => team.id === matchPresentation.homeTeamId)
    const awayTeamBeforeMatch = game.leagueState.teams.find((team) => team.id === matchPresentation.awayTeamId)

    if (!homeTeamBeforeMatch || !awayTeamBeforeMatch) {
      setNotice('No se pudo resolver el partido.')
      return
    }

    const simulatedState = playCurrentRound(game.leagueState, {
      managerTeamId: game.managerTeamId,
      managerLineup: game.managerLineup,
    })
    const seasonRolledOver = simulatedState.currentRound > simulatedState.totalRounds

    const { nextState, headlines, incomingOffers, financeBreakdown } = applyWeeklyClubManagement(
      simulatedState,
      game.managerTeamId,
      game.pendingTransferOffers,
    )
    const withWeeklyNews = {
      ...nextState,
      news: [...headlines, ...nextState.news].slice(0, 12),
    }

    const { nextState: afterRenewals, messages: renewalMessages, resolvedIds } = resolveRenewalOffers(
      withWeeklyNews,
      game.managerTeamId,
      game.pendingRenewalOffers ?? [],
    )

    const nextManagerTeam =
      afterRenewals.teams.find((team) => team.id === game.managerTeamId) ?? afterRenewals.teams[0]
    const pendingTransferOffers = mergeIncomingOffers(
      game.pendingTransferOffers,
      incomingOffers,
      nextManagerTeam,
      afterRenewals.currentRound,
    )
    const resolvedRenewalOffers = (game.pendingRenewalOffers ?? []).filter((o) => resolvedIds.includes(o.id))

    // Resolve outgoing transfer offers submitted in a previous round
    const dueOutgoing = game.pendingOutgoingTransfers.filter(
      (o) => o.createdRound < afterRenewals.currentRound,
    )
    let stateAfterOutgoing = afterRenewals
    const outgoingFinanceEntries: ReturnType<typeof createFinanceEntry>[] = []
    let outgoingNotice = ''
    for (const pending of dueOutgoing) {
      const { nextState: afterBuy, message, ok } = buyPlayer(
        stateAfterOutgoing,
        game.managerTeamId,
        pending.playerId,
        pending.wageOffer,
        pending.signingBonus,
        pending.contractYears,
        pending.promisedRole,
        pending.transferFee,
      )
      if (ok) {
        stateAfterOutgoing = afterBuy
        const spent = pending.transferFee + pending.signingBonus
        outgoingFinanceEntries.push(
          createFinanceEntry(afterRenewals.currentRound, game.managerTeamId, 'transfer-in', -spent, `Fichaje de ${pending.playerName}`),
        )
        outgoingNotice = `${pending.playerName} ha llegado a tu equipo.`
      } else {
        outgoingNotice = message
      }
    }
    const resolvedOutgoingIds = new Set(dueOutgoing.map((o) => o.id))
    const nextManagerTeamFinal =
      stateAfterOutgoing.teams.find((team) => team.id === game.managerTeamId) ?? stateAfterOutgoing.teams[0]

    const financeEntries = appendFinanceEntries(game, [
      ...mapBreakdownToEntries(game.leagueState.currentRound, simulatedState.financeBreakdown, game.managerTeamId),
      ...mapBreakdownToEntries(game.leagueState.currentRound, financeBreakdown, game.managerTeamId),
      ...resolvedRenewalOffers.map((offer) => createFinanceEntry(game.leagueState.currentRound, game.managerTeamId, 'renewal', -offer.signingBonus, `Renovación de ${offer.playerName}`)),
      ...outgoingFinanceEntries,
    ])

    const nextGame: ManagerGameState = {
      ...game,
      updatedAt: new Date().toISOString(),
      seasonStartYear: seasonRolledOver ? game.seasonStartYear + 1 : game.seasonStartYear,
      financeEntries,
      leagueState: stateAfterOutgoing,
      pendingTransferOffers,
      pendingRenewalOffers: (game.pendingRenewalOffers ?? []).filter((o) => !resolvedIds.includes(o.id)),
      pendingOutgoingTransfers: game.pendingOutgoingTransfers.filter((o) => !resolvedOutgoingIds.has(o.id)),
      managerLineup: syncManagerLineup(nextManagerTeamFinal, game.managerLineup),
      managerSquadOrder: syncManagerSquadOrder(nextManagerTeamFinal, game.managerSquadOrder),
    }

    const nextGames = games.map((candidate) =>
      candidate.id === nextGame.id ? nextGame : candidate,
    )

    persistCollection(nextGames, nextGame.id)
    const noticeParts = [
      ...(renewalMessages.length > 0 ? renewalMessages : ['Jornada completada. Partida guardada automaticamente.']),
      ...(outgoingNotice ? [outgoingNotice] : []),
    ]
    setNotice(noticeParts.join(' | '))

    const result = stateAfterOutgoing.lastResults.find((item) => item.fixtureId === matchPresentation.fixtureId)
    const homeTeamAfterMatch = stateAfterOutgoing.teams.find((team) => team.id === matchPresentation.homeTeamId)
    const awayTeamAfterMatch = stateAfterOutgoing.teams.find((team) => team.id === matchPresentation.awayTeamId)
    const stats = result
      ? buildMatchStats(
        homeTeamBeforeMatch,
        awayTeamBeforeMatch,
        matchPresentation.homeLineup,
        matchPresentation.awayLineup,
        result.homeGoals,
        result.awayGoals,
      )
      : undefined
    const goals = result
      ? [
        ...buildGoalRecords(homeTeamBeforeMatch, matchPresentation.homeLineup, result.homeGoals, homeTeamBeforeMatch.id),
        ...buildGoalRecords(awayTeamBeforeMatch, matchPresentation.awayLineup, result.awayGoals, awayTeamBeforeMatch.id, 4),
      ].sort((a, b) => a.minute - b.minute)
      : undefined
    const incidents = result && homeTeamAfterMatch && awayTeamAfterMatch
      ? buildMatchIncidents(homeTeamBeforeMatch, awayTeamBeforeMatch, homeTeamAfterMatch, awayTeamAfterMatch)
      : undefined
    const substitutions = result && incidents
      ? buildMatchSubstitutions(
        homeTeamBeforeMatch,
        awayTeamBeforeMatch,
        matchPresentation.homeLineup,
        matchPresentation.awayLineup,
        incidents,
      )
      : undefined
    const tacticalChanges = result
      ? buildMatchTacticalChanges(homeTeamBeforeMatch, awayTeamBeforeMatch, result.homeGoals, result.awayGoals)
      : undefined
    const commentary = result && stats && goals
      ? buildMatchCommentary(
        homeTeamBeforeMatch,
        awayTeamBeforeMatch,
        result.homeGoals,
        result.awayGoals,
        stats,
        goals,
        incidents ?? [],
        substitutions ?? [],
        tacticalChanges ?? [],
      )
      : undefined

    setMatchPresentation({
      ...matchPresentation,
      phase: 'result',
      result,
      stats,
      commentary,
      goals,
      incidents,
      substitutions,
      tacticalChanges,
    })
  }

  const resetGame = () => {
    if (!game) {
      return
    }

    const replacement = buildGame({
      saveName: game.saveName,
      managerName: game.managerName,
      managerTeamId: game.managerTeamId,
    })
    const nextGames = games.map((candidate) => (candidate.id === game.id ? { ...replacement, id: game.id, createdAt: game.createdAt } : candidate))
    persistCollection(nextGames, game.id)
    setMatchPresentation(null)
    setNotice('Partida reiniciada conservando club y nombre de guardado.')
  }

  const toggleLineupPlayer = (playerId: string) => {
    updateActiveGame((prev) => {
      const currentTeam = getManagerTeam(prev)
      if (!currentTeam) {
        return prev
      }

      const lineup = prev.managerLineup
      if (!canToggleInLineup(currentTeam, lineup, playerId)) {
        setNotice('Jugador no disponible para el once titular.')
        return prev
      }

      const inLineup = lineup.includes(playerId)
      const nextLineup = inLineup ? lineup.filter((id) => id !== playerId) : [...lineup, playerId]

      return {
        ...prev,
        managerLineup: syncManagerLineup(currentTeam, nextLineup),
      }
    })
  }

  const autoPickLineup = () => {
    updateActiveGame((prev) => {
      const currentTeam = getManagerTeam(prev)
      if (!currentTeam) {
        return prev
      }

      return {
        ...prev,
        managerLineup: getDefaultLineup(currentTeam),
      }
    })
  }

  const setLineupSlotPlayer = (slotIndex: number, playerId: string) => {
    updateActiveGame((prev) => {
      const currentTeam = getManagerTeam(prev)
      if (!currentTeam) {
        return prev
      }

      const player = currentTeam.players.find((candidate) => candidate.id === playerId)
      if (!player || !isPlayerAvailable(player)) {
        setNotice('Jugador no disponible para este rol.')
        return prev
      }

      const slots = getFormationSlots(currentTeam)
      if (slotIndex < 0 || slotIndex >= slots.length) {
        return prev
      }

      const normalized = syncManagerLineup(currentTeam, prev.managerLineup)
      const nextLineup = [...normalized]
      const existingIndex = nextLineup.findIndex((id, idx) => id === playerId && idx !== slotIndex)
      const previousAtSlot = nextLineup[slotIndex]

      nextLineup[slotIndex] = playerId
      if (existingIndex >= 0) {
        nextLineup[existingIndex] = previousAtSlot
      }

      return {
        ...prev,
        managerLineup: syncManagerLineup(currentTeam, nextLineup),
        managerSquadOrder: syncManagerSquadOrder(currentTeam, prev.managerSquadOrder),
      }
    })
  }

  const reorderSquadPlayer = (sourcePlayerId: string, targetPlayerId: string) => {
    updateActiveGame((prev) => {
      const currentTeam = getManagerTeam(prev)
      if (!currentTeam || sourcePlayerId === targetPlayerId) {
        return prev
      }

      const nextOrder = syncManagerSquadOrder(currentTeam, prev.managerSquadOrder)
      const sourceIndex = nextOrder.indexOf(sourcePlayerId)
      const targetIndex = nextOrder.indexOf(targetPlayerId)

      if (sourceIndex < 0 || targetIndex < 0) {
        return prev
      }

      const reordered = [...nextOrder]
      const [sourcePlayer] = reordered.splice(sourceIndex, 1)
      reordered.splice(targetIndex, 0, sourcePlayer)

      return {
        ...prev,
        managerSquadOrder: reordered,
      }
    })
  }

  const purchasePlayer = (
    playerId: string,
    wageOffer: number,
    signingBonus: number,
    contractYears: number,
    promisedRole: PromisedRole,
    feeOffer?: number,
  ) => {
    updateActiveGame((prev) => {
      if (prev.pendingOutgoingTransfers.some((o) => o.playerId === playerId)) {
        setNotice('Ya hay una oferta pendiente para este jugador.')
        return prev
      }

      const sellerTeam = prev.leagueState.teams.find((team) =>
        team.id !== prev.managerTeamId && team.players.some((p) => p.id === playerId),
      )
      const player = sellerTeam?.players.find((p) => p.id === playerId)

      if (!sellerTeam || !player) {
        setNotice('El jugador ya no está disponible.')
        return prev
      }

      const transferFee = feeOffer ?? (player.transferListed
        ? Math.max(100_000, Math.round(player.askingPrice))
        : player.releaseClause)

      const totalCost = transferFee + signingBonus
      const budget = getTeamBudget(prev.leagueState.teams, prev.managerTeamId)
      if (budget < totalCost) {
        setNotice('Presupuesto insuficiente para esta oferta.')
        return prev
      }

      const offer: PendingOutgoingTransferOffer = {
        id: `out-${playerId}-${prev.leagueState.currentRound}`,
        playerId,
        playerName: player.name,
        sellerTeamId: sellerTeam.id,
        sellerTeamName: sellerTeam.name,
        transferFee,
        wageOffer,
        signingBonus,
        contractYears,
        promisedRole,
        createdRound: prev.leagueState.currentRound,
      }

      setNotice(`Oferta enviada por ${player.name}. El club responderá en la próxima jornada.`)
      return {
        ...prev,
        pendingOutgoingTransfers: [...prev.pendingOutgoingTransfers, offer],
      }
    })
  }

  const cancelOutgoingTransfer = (offerId: string) => {
    updateActiveGame((prev) => ({
      ...prev,
      pendingOutgoingTransfers: prev.pendingOutgoingTransfers.filter((o) => o.id !== offerId),
    }))
    setNotice('Oferta retirada.')
  }

  const listPlayerForTransfer = (playerId: string, askingPrice: number) => {
    updateActiveGame((prev) => {
      const { nextState, message, ok } = setPlayerTransferStatus(
        prev.leagueState,
        prev.managerTeamId,
        playerId,
        true,
        askingPrice,
      )
      setNotice(message)

      if (!ok) {
        return prev
      }

      return {
        ...prev,
        leagueState: nextState,
      }
    })
  }

  const removePlayerFromTransferList = (playerId: string) => {
    updateActiveGame((prev) => {
      const { nextState, message, ok } = setPlayerTransferStatus(
        prev.leagueState,
        prev.managerTeamId,
        playerId,
        false,
      )
      setNotice(message)

      if (!ok) {
        return prev
      }

      return {
        ...prev,
        leagueState: nextState,
      }
    })
  }

  const acceptTransferOffer = (offerId: string) => {
    updateActiveGame((prev) => {
      const offer = prev.pendingTransferOffers.find((item) => item.id === offerId)
      if (!offer) {
        setNotice('La oferta ya no esta disponible.')
        return prev
      }

      if (offer.createdRound >= prev.leagueState.currentRound) {
        setNotice('Debes esperar a la siguiente jornada para responder a esta oferta.')
        return prev
      }

      const { nextState, message, ok } = acceptIncomingTransferOffer(prev.leagueState, offer)
      setNotice(message)

      if (!ok) {
        return {
          ...prev,
          pendingTransferOffers: prev.pendingTransferOffers.filter((item) => item.id !== offerId),
        }
      }

      const nextManagerTeam = nextState.teams.find((team) => team.id === prev.managerTeamId) ?? nextState.teams[0]
      const income = getTeamBudget(nextState.teams, prev.managerTeamId) - getTeamBudget(prev.leagueState.teams, prev.managerTeamId)

      return {
        ...prev,
        financeEntries: appendFinanceEntries(prev, [
          createFinanceEntry(prev.leagueState.currentRound, prev.managerTeamId, 'transfer-out', income, `Venta de ${offer.playerName}`),
        ]),
        leagueState: nextState,
        pendingTransferOffers: prev.pendingTransferOffers.filter((item) => item.id !== offerId),
        managerLineup: syncManagerLineup(nextManagerTeam, prev.managerLineup),
        managerSquadOrder: syncManagerSquadOrder(nextManagerTeam, prev.managerSquadOrder),
      }
    })
  }

  const rejectTransferOffer = (offerId: string) => {
    updateActiveGame((prev) => ({
      ...prev,
      pendingTransferOffers: prev.pendingTransferOffers.filter((item) => item.id !== offerId),
    }))
    setNotice('Oferta rechazada.')
  }

  const saveCurrentGame = () => {
    if (!game) {
      return
    }

    const nextGames = games.map((candidate) =>
      candidate.id === game.id ? { ...candidate, updatedAt: new Date().toISOString() } : candidate,
    )
    persistCollection(nextGames, game.id)
    setNotice('Partida guardada.')
  }

  const setTrainingFocus = (focus: TrainingFocus) => {
    updateActiveGame((prev) => ({
      ...prev,
      leagueState: setTeamTrainingFocus(prev.leagueState, prev.managerTeamId, focus),
    }))
    setNotice(`Plan de entrenamiento actualizado: ${focus}.`)
  }

  const setTactic = (tactic: Tactic) => {
    updateActiveGame((prev) => {
      const nextLeagueState = setTeamTactic(prev.leagueState, prev.managerTeamId, tactic)
      const nextManagerTeam =
        nextLeagueState.teams.find((team) => team.id === prev.managerTeamId) ??
        nextLeagueState.teams[0]

      return {
        ...prev,
        leagueState: nextLeagueState,
        managerLineup: syncManagerLineup(nextManagerTeam, prev.managerLineup),
        managerSquadOrder: syncManagerSquadOrder(nextManagerTeam, prev.managerSquadOrder),
      }
    })
    setNotice(`Tactica actualizada: ${tactic}.`)
  }

  const renewContract = (playerId: string, wageOffer?: number, contractYears?: number) => {
    updateActiveGame((prev) => {
      if ((prev.pendingRenewalOffers ?? []).some((offer) => offer.playerId === playerId)) {
        setNotice('Ya hay una oferta de renovación pendiente para este jugador.')
        return prev
      }

      const { offer, ok, message } = submitRenewalOffer(
        prev.leagueState,
        prev.managerTeamId,
        playerId,
        wageOffer ?? 0,
        contractYears ?? 0,
      )
      setNotice(message)
      if (!ok || !offer) {
        return prev
      }

      return {
        ...prev,
        pendingRenewalOffers: [...(prev.pendingRenewalOffers ?? []), offer],
      }
    })
  }

  const cancelRenewalOffer = (offerId: string) => {
    updateActiveGame((prev) => ({
      ...prev,
      pendingRenewalOffers: (prev.pendingRenewalOffers ?? []).filter((o) => o.id !== offerId),
    }))
    setNotice('Oferta de renovación retirada.')
  }

  const promoteYouth = (youthId: string) => {
    updateActiveGame((prev) => {
      const { nextState, ok, message } = promoteYouthPlayer(prev.leagueState, prev.managerTeamId, youthId)
      setNotice(message)
      if (!ok) {
        return prev
      }

      const managerTeamAfter = nextState.teams.find((team) => team.id === prev.managerTeamId) ?? nextState.teams[0]

      return {
        ...prev,
        leagueState: nextState,
        managerLineup: syncManagerLineup(managerTeamAfter, prev.managerLineup),
        managerSquadOrder: syncManagerSquadOrder(managerTeamAfter, prev.managerSquadOrder),
      }
    })
  }

  const setTicketPrice = (price: number) => {
    updateActiveGame((prev) => ({
      ...prev,
      leagueState: setStadiumTicketPrice(prev.leagueState, prev.managerTeamId, price),
    }))
  }

  const upgradeStadium = () => {
    updateActiveGame((prev) => {
      const { nextState, message, ok } = upgradeStadiumEngine(prev.leagueState, prev.managerTeamId)
      setNotice(message)

      if (!ok) {
        return prev
      }

      const cost = getTeamBudget(prev.leagueState.teams, prev.managerTeamId) - getTeamBudget(nextState.teams, prev.managerTeamId)
      return {
        ...prev,
        financeEntries: appendFinanceEntries(prev, [
          createFinanceEntry(prev.leagueState.currentRound, prev.managerTeamId, 'infrastructure', -cost, 'Ampliación de estadio'),
        ]),
        leagueState: nextState,
      }
    })
  }

  const improveMedicalStaff = () => {
    updateActiveGame((prev) => {
      const { nextState, message, ok } = upgradeMedicalStaff(prev.leagueState, prev.managerTeamId)
      setNotice(message)
      if (!ok) {
        return prev
      }

      const cost = getTeamBudget(prev.leagueState.teams, prev.managerTeamId) - getTeamBudget(nextState.teams, prev.managerTeamId)
      return {
        ...prev,
        financeEntries: appendFinanceEntries(prev, [
          createFinanceEntry(prev.leagueState.currentRound, prev.managerTeamId, 'staff', -cost, 'Mejora de cuerpo médico'),
        ]),
        leagueState: nextState,
      }
    })
  }

  const improveDisciplineStaff = () => {
    updateActiveGame((prev) => {
      const { nextState, message, ok } = upgradeDisciplineStaff(prev.leagueState, prev.managerTeamId)
      setNotice(message)
      if (!ok) {
        return prev
      }

      const cost = getTeamBudget(prev.leagueState.teams, prev.managerTeamId) - getTeamBudget(nextState.teams, prev.managerTeamId)
      return {
        ...prev,
        financeEntries: appendFinanceEntries(prev, [
          createFinanceEntry(prev.leagueState.currentRound, prev.managerTeamId, 'staff', -cost, 'Mejora de disciplina'),
        ]),
        leagueState: nextState,
      }
    })
  }

  const clearNotice = () => setNotice(null)
  const clearMatchPresentation = () => setMatchPresentation(null)

  const value: GameContextValue = {
    game,
    managerTeam,
    matchPresentation,
    table,
    transferTargets,
    pendingTransferOffers: game?.pendingTransferOffers ?? [],
    pendingRenewalOffers: game?.pendingRenewalOffers ?? [],
    pendingOutgoingTransfers: game?.pendingOutgoingTransfers ?? [],
    savedGames,
    notice,
    setManagerName,
    setSaveName,
    createGame,
    selectGame,
    deleteGame,
    playRound,
    prepareMatchPresentation,
    confirmMatchPresentation,
    clearMatchPresentation,
    resetGame,
    toggleLineupPlayer,
    setLineupSlotPlayer,
    reorderSquadPlayer,
    autoPickLineup,
    purchasePlayer,
    listPlayerForTransfer,
    removePlayerFromTransferList,
    acceptTransferOffer,
    rejectTransferOffer,
    cancelOutgoingTransfer,
    saveCurrentGame,
    setTrainingFocus,
    setTactic,
    renewContract,
    cancelRenewalOffer,
    promoteYouth,
    setTicketPrice,
    upgradeStadium,
    improveMedicalStaff,
    improveDisciplineStaff,
    clearNotice,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used inside GameProvider')
  }

  return context
}
