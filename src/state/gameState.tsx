/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react'
import { buildGame, getCurrentManagerFixture, getManagerTeam, syncManagerLineup } from '../engine/gameUtils'
import { applyRoundResult, processRound } from '../engine/roundProcessing'
import * as actions from './gameActions'
import type { ActionResult } from './gameActions'
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
  getDefaultLineup,
} from '../engine/squad'
import { getTransferTargets } from '../engine/transfers'
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
  storageError: string | null
  setManagerName: (value: string) => void
  setSaveName: (value: string) => void
  createGame: (input: CreateGameInput) => Promise<void>
  selectGame: (gameId: string) => void
  deleteGame: (gameId: string) => void
  exportSaves: () => string
  importSaves: (raw: string) => boolean
  playRound: () => void
  prepareMatchPresentation: () => boolean
  confirmMatchPresentation: () => void
  clearMatchPresentation: () => void
  resetGame: () => Promise<void>
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
  acceptJobOffer: (teamId: string) => void
  clearNotice: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [initialStorage] = useState(loadSaveStorage)
  const [games, setGames] = useState<ManagerGameState[]>(initialStorage.games)
  const [activeGameId, setActiveGameId] = useState<string | null>(initialStorage.activeGameId)
  const [notice, setNotice] = useState<string | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
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
    // Only games whose object changed need rewriting; unchanged ones keep the same reference.
    const previousById = new Map(games.map((item) => [item.id, item]))
    const changedIds = nextGames.filter((item) => previousById.get(item.id) !== item).map((item) => item.id)
    const result = saveSaveStorage({ games: nextGames, activeGameId: nextActiveGameId }, changedIds)
    setStorageError(result.ok ? null : result.error)
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

  /** Wraps a pure action: shows its notice and saves only when the game actually changed. */
  const run = <Args extends unknown[]>(action: (current: ManagerGameState, ...args: Args) => ActionResult) =>
    (...args: Args) => {
      if (!game) {
        return
      }
      const result = action(game, ...args)
      if (result.notice !== undefined) {
        setNotice(result.notice)
      }
      if (result.game !== game) {
        updateActiveGame(() => result.game)
      }
    }

  const createGame = async (input: CreateGameInput) => {
    const nextGame = await buildGame(input)
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

  const setManagerName = run(actions.setManagerName)

  const setSaveName = run(actions.setSaveName)

  const playRound = () => {
    if (game?.board?.status === 'sacked') {
      setNotice('Has sido destituido. Elige una oferta de trabajo para continuar.')
      return
    }
    updateActiveGame((prev) => {
      const result = processRound(prev, prev.managerLineup)

      const messages = [...result.renewalMessages, result.cupNotice].filter(Boolean)
      setNotice(messages.length > 0 ? messages.join(' | ') : 'Jornada completada. Partida guardada automaticamente.')

      return applyRoundResult(prev, result)
    })
  }

  const prepareMatchPresentation = (): boolean => {
    if (!game) {
      return false
    }

    if (game.board?.status === 'sacked') {
      setNotice('Has sido destituido. Elige una oferta de trabajo para continuar.')
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
      ...applyRoundResult(game, result),
      updatedAt: new Date().toISOString(),
    }

    const nextGames = games.map((candidate) =>
      candidate.id === nextGame.id ? nextGame : candidate,
    )

    persistCollection(nextGames, nextGame.id)
    const noticeParts = [
      ...(result.renewalMessages.length > 0 ? result.renewalMessages : ['Jornada completada. Partida guardada automaticamente.']),
      ...(result.outgoingNotice ? [result.outgoingNotice] : []),
      ...(result.cupNotice ? [result.cupNotice] : []),
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
        ...buildGoalRecords(homeTeamBeforeMatch, matchPresentation.homeLineup, matchResult.homeGoals, homeTeamBeforeMatch.id, 0, matchResult.goals),
        ...buildGoalRecords(awayTeamBeforeMatch, matchPresentation.awayLineup, matchResult.awayGoals, awayTeamBeforeMatch.id, 4, matchResult.goals),
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

  const resetGame = async () => {
    if (!game) {
      return
    }

    const replacement = await buildGame({
      saveName: game.saveName,
      managerName: game.managerName,
      managerTeamId: game.managerTeamId,
    })
    const nextGames = games.map((candidate) => (candidate.id === game.id ? { ...replacement, id: game.id, createdAt: game.createdAt } : candidate))
    persistCollection(nextGames, game.id)
    setMatchPresentation(null)
    setNotice('Partida reiniciada conservando club y nombre de guardado.')
  }

  const toggleLineupPlayer = run(actions.toggleLineupPlayer)

  const autoPickLineup = run(actions.autoPickLineup)

  const setLineupSlotPlayer = run(actions.setLineupSlotPlayer)

  const reorderSquadPlayer = run(actions.reorderSquadPlayer)

  const purchasePlayer = run(actions.purchasePlayer)

  const cancelOutgoingTransfer = run(actions.cancelOutgoingTransfer)

  const listPlayerForTransfer = run(actions.listPlayerForTransfer)

  const removePlayerFromTransferList = run(actions.removePlayerFromTransferList)

  const acceptTransferOffer = run(actions.acceptTransferOffer)

  const rejectTransferOffer = run(actions.rejectTransferOffer)

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

  const setTrainingFocus = run(actions.setTrainingFocus)

  const setTactic = run(actions.setTactic)

  const renewContract = run(actions.renewContract)

  const cancelRenewalOffer = run(actions.cancelRenewalOffer)

  const promoteYouth = run(actions.promoteYouth)

  const setTicketPrice = run(actions.setTicketPrice)

  const upgradeStadium = run(actions.upgradeStadium)

  const improveMedicalStaff = run(actions.improveMedicalStaff)

  const improveDisciplineStaff = run(actions.improveDisciplineStaff)
  const acceptJobOffer = run(actions.acceptJobOffer)

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
    storageError,
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
    acceptJobOffer,
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
