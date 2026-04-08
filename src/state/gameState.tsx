/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react'
import {
  promoteYouthPlayer,
  submitRenewalOffer,
  setStadiumTicketPrice,
  setTeamTactic,
  setTeamTrainingFocus,
  upgradeDisciplineStaff,
  upgradeMedicalStaff,
  upgradeStadium as upgradeStadiumEngine,
} from '../engine/club'
import { appendFinanceEntries, createFinanceEntry, getTeamBudget } from '../engine/finance'
import { buildGame, getCurrentManagerFixture, getManagerTeam, syncManagerLineup, syncManagerSquadOrder } from '../engine/gameUtils'
import { processRound } from '../engine/roundProcessing'
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
import { sortLeagueTable } from '../engine/simulation'
import {
  canToggleInLineup,
  getDefaultLineup,
  getFormationSlots,
  isPlayerAvailable,
} from '../engine/squad'
import { acceptIncomingTransferOffer, getTransferTargets, setPlayerTransferStatus } from '../engine/transfers'
import type {
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
      const result = processRound(prev, prev.managerLineup)

      if (result.renewalMessages.length > 0) {
        setNotice(result.renewalMessages.join(' | '))
      } else {
        setNotice('Jornada completada. Partida guardada automaticamente.')
      }

      return {
        ...prev,
        seasonStartYear: result.seasonRolledOver ? prev.seasonStartYear + 1 : prev.seasonStartYear,
        financeEntries: result.financeEntries,
        leagueState: result.stateAfterOutgoing,
        pendingTransferOffers: result.pendingTransferOffers,
        pendingRenewalOffers: (prev.pendingRenewalOffers ?? []).filter(
          (o) => !result.resolvedRenewalOffers.some(resolved => resolved.id === o.id)
        ),
        pendingOutgoingTransfers: prev.pendingOutgoingTransfers.filter(
          (o) => !result.resolvedOutgoingIds.has(o.id)
        ),
        managerLineup: syncManagerLineup(result.nextManagerTeamFinal, prev.managerLineup),
        managerSquadOrder: syncManagerSquadOrder(result.nextManagerTeamFinal, prev.managerSquadOrder),
      }
    })
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

    const result = processRound(game, game.managerLineup)

    const nextGame: ManagerGameState = {
      ...game,
      updatedAt: new Date().toISOString(),
      seasonStartYear: result.seasonRolledOver ? game.seasonStartYear + 1 : game.seasonStartYear,
      financeEntries: result.financeEntries,
      leagueState: result.stateAfterOutgoing,
      pendingTransferOffers: result.pendingTransferOffers,
      pendingRenewalOffers: (game.pendingRenewalOffers ?? []).filter(
        (o) => !result.resolvedRenewalOffers.some(resolved => resolved.id === o.id)
      ),
      pendingOutgoingTransfers: game.pendingOutgoingTransfers.filter(
        (o) => !result.resolvedOutgoingIds.has(o.id)
      ),
      managerLineup: syncManagerLineup(result.nextManagerTeamFinal, game.managerLineup),
      managerSquadOrder: syncManagerSquadOrder(result.nextManagerTeamFinal, game.managerSquadOrder),
    }

    const nextGames = games.map((candidate) =>
      candidate.id === nextGame.id ? nextGame : candidate,
    )

    persistCollection(nextGames, nextGame.id)
    const noticeParts = [
      ...(result.renewalMessages.length > 0 ? result.renewalMessages : ['Jornada completada. Partida guardada automaticamente.']),
      ...(result.outgoingNotice ? [result.outgoingNotice] : []),
    ]
    setNotice(noticeParts.join(' | '))

    const matchResult = result.stateAfterOutgoing.lastResults.find((item) => item.fixtureId === matchPresentation.fixtureId)
    const homeTeamAfterMatch = result.stateAfterOutgoing.teams.find((team) => team.id === matchPresentation.homeTeamId)
    const awayTeamAfterMatch = result.stateAfterOutgoing.teams.find((team) => team.id === matchPresentation.awayTeamId)
    const stats = matchResult
      ? buildMatchStats(
        homeTeamBeforeMatch,
        awayTeamBeforeMatch,
        matchPresentation.homeLineup,
        matchPresentation.awayLineup,
        matchResult.homeGoals,
        matchResult.awayGoals,
      )
      : undefined
    const goals = matchResult
      ? [
        ...buildGoalRecords(homeTeamBeforeMatch, matchPresentation.homeLineup, matchResult.homeGoals, homeTeamBeforeMatch.id),
        ...buildGoalRecords(awayTeamBeforeMatch, matchPresentation.awayLineup, matchResult.awayGoals, awayTeamBeforeMatch.id, 4),
      ].sort((a, b) => a.minute - b.minute)
      : undefined
    const incidents = matchResult && homeTeamAfterMatch && awayTeamAfterMatch
      ? buildMatchIncidents(homeTeamBeforeMatch, awayTeamBeforeMatch, homeTeamAfterMatch, awayTeamAfterMatch)
      : undefined
    const substitutions = matchResult && incidents
      ? buildMatchSubstitutions(
        homeTeamBeforeMatch,
        awayTeamBeforeMatch,
        matchPresentation.homeLineup,
        matchPresentation.awayLineup,
        incidents,
      )
      : undefined
    const tacticalChanges = matchResult
      ? buildMatchTacticalChanges(homeTeamBeforeMatch, awayTeamBeforeMatch, matchResult.homeGoals, matchResult.awayGoals)
      : undefined
    const commentary = matchResult && stats && goals
      ? buildMatchCommentary(
        homeTeamBeforeMatch,
        awayTeamBeforeMatch,
        matchResult.homeGoals,
        matchResult.awayGoals,
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
      result: matchResult,
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
