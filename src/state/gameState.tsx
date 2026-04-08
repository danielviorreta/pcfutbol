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
import {
  buildGoalRecords,
  buildLineupWarning,
  buildMatchCommentary,
  buildMatchIncidents,
  buildMatchStats,
  buildMatchSubstitutions,
  buildMatchTacticalChanges,
} from '../engine/matchPresentation'
import { loadSaveStorage, parseSaveStorage, saveSaveStorage, serializeSaveStorage, toGameSummaries } from '../engine/persistence'
import { playCurrentRound, sortLeagueTable } from '../engine/simulation'
import {
  canToggleInLineup,
  getDefaultLineup,
  getFormationSlots,
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
  MatchPresentation,
  ManagerGameState,
  PendingOutgoingTransferOffer,
  PendingRenewalOffer,
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
  exportSaves: () => string
  importSaves: (raw: string) => boolean
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

function syncManagerLineup(team: Team, lineup: string[]): string[] {
  return sanitizeLineupSelection(team, lineup)
}

function syncManagerSquadOrder(team: Team, order: string[]): string[] {
  const validIds = new Set(team.players.map((player) => player.id))
  const normalized = [...new Set(order)].filter((playerId) => validIds.has(playerId))
  const missing = team.players.map((player) => player.id).filter((playerId) => !normalized.includes(playerId))

  return [...normalized, ...missing]
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

  const exportSaves = (): string => serializeSaveStorage({ games, activeGameId })

  const importSaves = (raw: string): boolean => {
    let parsedStorage

    try {
      parsedStorage = parseSaveStorage(raw)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo importar el archivo.'
      setNotice(message)
      return false
    }

    if (parsedStorage.games.length === 0) {
      setNotice('El archivo no contiene partidas validas.')
      return false
    }

    const mergedGames = new Map(games.map((item) => [item.id, item]))
    parsedStorage.games.forEach((item) => {
      mergedGames.set(item.id, item)
    })

    const nextGames = [...mergedGames.values()]
    const nextActiveGameId =
      parsedStorage.activeGameId && mergedGames.has(parsedStorage.activeGameId)
        ? parsedStorage.activeGameId
        : activeGameId && mergedGames.has(activeGameId)
          ? activeGameId
          : nextGames[0]?.id ?? null

    persistCollection(nextGames, nextActiveGameId)
    setMatchPresentation(null)
    setNotice(`Importadas ${parsedStorage.games.length} partidas desde copia local.`)

    return true
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
    exportSaves,
    importSaves,
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
