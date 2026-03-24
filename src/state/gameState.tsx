/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react'
import { createInitialLeagueState } from '../data/seedData'
import {
  applyWeeklyClubManagement,
  promoteYouthPlayer,
  renewPlayerContract,
  setTeamTactic,
  setTeamTrainingFocus,
} from '../engine/club'
import { loadSaveStorage, saveSaveStorage, toGameSummaries } from '../engine/persistence'
import { playCurrentRound, sortLeagueTable } from '../engine/simulation'
import {
  canToggleInLineup,
  getDefaultLineup,
  getFormationSlots,
  isPlayerAvailable,
  normalizeLineup,
} from '../engine/squad'
import { buyPlayer, getTransferTargets } from '../engine/transfers'
import type {
  GameSummary,
  ManagerGameState,
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
  table: Team[]
  transferTargets: TransferTarget[]
  savedGames: GameSummary[]
  notice: string | null
  setManagerName: (value: string) => void
  setSaveName: (value: string) => void
  createGame: (input: CreateGameInput) => void
  selectGame: (gameId: string) => void
  deleteGame: (gameId: string) => void
  playRound: () => void
  resetGame: () => void
  toggleLineupPlayer: (playerId: string) => void
  setLineupSlotPlayer: (slotIndex: number, playerId: string) => void
  autoPickLineup: () => void
  purchasePlayer: (playerId: string) => void
  saveCurrentGame: () => void
  setTrainingFocus: (focus: TrainingFocus) => void
  setTactic: (tactic: Tactic) => void
  renewContract: (playerId: string) => void
  promoteYouth: (youthId: string) => void
  clearNotice: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

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
    managerName: input.managerName.trim() || 'Mister',
    managerTeamId: managerTeam.id,
    managerLineup: getDefaultLineup(managerTeam),
    leagueState,
  }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const initialStorage = loadSaveStorage()
  const [games, setGames] = useState<ManagerGameState[]>(initialStorage.games)
  const [activeGameId, setActiveGameId] = useState<string | null>(initialStorage.activeGameId)
  const [notice, setNotice] = useState<string | null>(null)

  const game = useMemo(
    () => games.find((candidate) => candidate.id === activeGameId) ?? null,
    [games, activeGameId],
  )
  const managerTeam = useMemo(() => getManagerTeam(game), [game])
  const table = useMemo(() => (game ? sortLeagueTable(game.leagueState.teams) : []), [game])
  const transferTargets = useMemo(
    () => (game ? getTransferTargets(game.leagueState, game.managerTeamId) : []),
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
    setNotice(`Nueva partida creada con ${getManagerTeam(nextGame)?.name ?? 'tu club'}.`)
  }

  const selectGame = (gameId: string) => {
    const existing = games.find((candidate) => candidate.id === gameId)
    if (!existing) {
      return
    }

    persistCollection(games, gameId)
    setNotice(`Partida activa: ${existing.saveName}.`)
  }

  const deleteGame = (gameId: string) => {
    const nextGames = games.filter((candidate) => candidate.id !== gameId)
    const nextActive = activeGameId === gameId ? nextGames[0]?.id ?? null : activeGameId
    persistCollection(nextGames, nextActive)
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

      const { nextState, headlines } = applyWeeklyClubManagement(simulatedState)
      const withWeeklyNews = {
        ...nextState,
        news: [...headlines, ...nextState.news].slice(0, 12),
      }

      const nextManagerTeam =
        withWeeklyNews.teams.find((team) => team.id === prev.managerTeamId) ?? withWeeklyNews.teams[0]

      return {
        ...prev,
        leagueState: withWeeklyNews,
        managerLineup: normalizeLineup(nextManagerTeam, prev.managerLineup),
      }
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
        managerLineup: normalizeLineup(currentTeam, nextLineup),
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

      const normalized = normalizeLineup(currentTeam, prev.managerLineup)
      const nextLineup = [...normalized]
      const existingIndex = nextLineup.findIndex((id, idx) => id === playerId && idx !== slotIndex)
      const previousAtSlot = nextLineup[slotIndex]

      nextLineup[slotIndex] = playerId
      if (existingIndex >= 0) {
        nextLineup[existingIndex] = previousAtSlot
      }

      return {
        ...prev,
        managerLineup: normalizeLineup(currentTeam, nextLineup),
      }
    })
  }

  const purchasePlayer = (playerId: string) => {
    updateActiveGame((prev) => {
      const { nextState, message, ok } = buyPlayer(prev.leagueState, prev.managerTeamId, playerId)
      setNotice(message)

      if (!ok) {
        return prev
      }

      const managerTeamAfterTransfer =
        nextState.teams.find((team) => team.id === prev.managerTeamId) ?? nextState.teams[0]

      return {
        ...prev,
        leagueState: nextState,
        managerLineup: normalizeLineup(managerTeamAfterTransfer, prev.managerLineup),
      }
    })
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
        managerLineup: normalizeLineup(nextManagerTeam, prev.managerLineup),
      }
    })
    setNotice(`Tactica actualizada: ${tactic}.`)
  }

  const renewContract = (playerId: string) => {
    updateActiveGame((prev) => {
      const { nextState, ok, message } = renewPlayerContract(prev.leagueState, prev.managerTeamId, playerId)
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
        managerLineup: normalizeLineup(managerTeamAfter, prev.managerLineup),
      }
    })
  }

  const clearNotice = () => setNotice(null)

  const value: GameContextValue = {
    game,
    managerTeam,
    table,
    transferTargets,
    savedGames,
    notice,
    setManagerName,
    setSaveName,
    createGame,
    selectGame,
    deleteGame,
    playRound,
    resetGame,
    toggleLineupPlayer,
    setLineupSlotPlayer,
    autoPickLineup,
    purchasePlayer,
    saveCurrentGame,
    setTrainingFocus,
    setTactic,
    renewContract,
    promoteYouth,
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
