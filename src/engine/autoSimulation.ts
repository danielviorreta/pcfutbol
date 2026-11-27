/**
 * Plays several matchdays in a row ("simulate N rounds" / "to end of season").
 * Stops early when the season ends or the manager is sacked, and replaces an
 * unplayable lineup (injuries, suspensions) with the automatic one.
 */
import { leaguePosition } from './board'
import { getManagerTeam } from './gameUtils'
import { applyRoundResult, processRound } from './roundProcessing'
import { getDefaultLineup, getLineupIssues } from './squad'
import type { ManagerGameState } from '../types/game'

export interface AutoSimulationResult {
  game: ManagerGameState
  roundsPlayed: number
  summary: string
}

/** Upper bound for "to end of season": longest league plus a margin. */
export const SEASON_MAX_ROUNDS = 50

function outcomeFor(game: ManagerGameState): 'W' | 'D' | 'L' | null {
  const result = game.leagueState.lastResults.find(
    (item) => item.homeTeamId === game.managerTeamId || item.awayTeamId === game.managerTeamId,
  )
  if (!result) return null
  if (result.homeGoals === result.awayGoals) return 'D'
  return (result.homeGoals > result.awayGoals) === (result.homeTeamId === game.managerTeamId) ? 'W' : 'L'
}

export function simulateRounds(start: ManagerGameState, maxRounds: number): AutoSimulationResult {
  let game = start
  let roundsPlayed = 0
  let autoLineupUsed = false
  const record = { W: 0, D: 0, L: 0 }
  const highlights: string[] = []
  let seasonEnded = false

  while (roundsPlayed < maxRounds && game.board?.status !== 'sacked') {
    const team = getManagerTeam(game)
    if (!team) break

    let lineup = game.managerLineup
    if (getLineupIssues(team, lineup).length > 0) {
      lineup = getDefaultLineup(team)
      autoLineupUsed = true
    }

    const result = processRound({ ...game, managerLineup: lineup }, lineup)
    game = applyRoundResult({ ...game, managerLineup: lineup }, result)
    roundsPlayed += 1

    const outcome = outcomeFor(game)
    if (outcome) record[outcome] += 1
    if (result.cupNotice) highlights.push(result.cupNotice)
    if (result.outgoingNotice) highlights.push(result.outgoingNotice)
    highlights.push(...result.renewalMessages)

    if (result.seasonRolledOver) {
      seasonEnded = true
      break
    }
  }

  const team = getManagerTeam(game)
  const parts = [`Simuladas ${roundsPlayed} jornadas: ${record.W}G ${record.D}E ${record.L}P.`]
  if (seasonEnded) {
    parts.push(game.board?.lastReview ?? 'Temporada terminada.')
  } else if (team && game.board?.status !== 'sacked') {
    parts.push(`Vas ${leaguePosition(game.leagueState.teams, team)}º.`)
  }
  if (game.board?.status === 'sacked' && !seasonEnded) {
    parts.push(game.board.lastReview ?? 'Has sido destituido.')
  }
  if (autoLineupUsed) {
    parts.push('Se uso la alineacion automatica por bajas.')
  }

  return { game, roundsPlayed, summary: [...parts, ...highlights.slice(-3)].join(' | ') }
}
