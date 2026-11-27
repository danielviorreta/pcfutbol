/**
 * Board expectations: a season objective based on squad strength, a confidence
 * level that moves with results, season reviews, sacking and job offers.
 */
import { competitionName } from './club/seasonHistory'
import { appendFinanceEntries, createFinanceEntry } from './finance'
import { sortLeagueTable } from './simulation'
import { getDefaultLineup } from './squad'
import type { BoardObjective, BoardState, Division, JobOffer, LeagueState, ManagerGameState, Team } from '../types/game'

const START_CONFIDENCE = 60
/** Mid-season sacking only after this share of the season, so a bad start isn't fatal. */
const SACKING_SEASON_SHARE = 0.3
const SACK_CONFIDENCE = 12
/** Missing the target by more than this many places at season end means dismissal. */
const SEASON_END_TOLERANCE = 3
const JOB_OFFER_COUNT = 3

/** Board bonus for meeting the objective, by division. */
const OBJECTIVE_BONUS: Record<Division, number> = {
  Primera: 6_000_000,
  Segunda: 1_500_000,
  'Primera Federacion': 400_000,
}
const DIVISION_TIER: Record<Division, number> = { Primera: 0, Segunda: 1, 'Primera Federacion': 2 }

function squadStrength(team: Team): number {
  const best = [...team.players].sort((a, b) => b.overall - a.overall).slice(0, 16)
  return best.reduce((sum, player) => sum + player.overall, 0) / Math.max(best.length, 1)
}

function competitionTeams(teams: Team[], team: Team): Team[] {
  const name = competitionName(team)
  return teams.filter((candidate) => competitionName(candidate) === name)
}

/** Rank (1 = strongest) of a team's squad within its competition. */
function strengthRank(teams: Team[], team: Team): number {
  const ranked = [...competitionTeams(teams, team)].sort((a, b) => squadStrength(b) - squadStrength(a))
  return ranked.findIndex((candidate) => candidate.id === team.id) + 1
}

export function leaguePosition(teams: Team[], team: Team): number {
  return sortLeagueTable(competitionTeams(teams, team)).findIndex((candidate) => candidate.id === team.id) + 1
}

/** What the board expects this season, from how the squad compares with its rivals. */
export function setObjective(teams: Team[], team: Team): BoardObjective {
  const rank = strengthRank(teams, team)
  const size = competitionTeams(teams, team).length

  if (team.division === 'Primera') {
    if (rank <= 2) return { kind: 'title', targetPosition: 1, description: 'Ganar la liga' }
    if (rank <= 6) return { kind: 'europe', targetPosition: 6, description: 'Clasificarse para Europa (top 6)' }
    if (rank <= 12) return { kind: 'top-half', targetPosition: 10, description: 'Terminar en la mitad alta (top 10)' }
    return { kind: 'survival', targetPosition: size - 3, description: 'Evitar el descenso' }
  }

  if (team.division === 'Segunda') {
    if (rank <= 3) return { kind: 'promotion', targetPosition: 2, description: 'Ascenso directo (top 2)' }
    if (rank <= 8) return { kind: 'playoff', targetPosition: 6, description: 'Jugar el playoff de ascenso (top 6)' }
    return { kind: 'survival', targetPosition: size - 4, description: 'Evitar el descenso' }
  }

  if (rank <= 4) return { kind: 'playoff', targetPosition: 5, description: 'Jugar el playoff de ascenso (top 5)' }
  return { kind: 'mid-table', targetPosition: Math.ceil(size / 2) + 2, description: 'Terminar en la zona media' }
}

export function initialReputation(team: Team): number {
  return team.division === 'Primera' ? 70 : team.division === 'Segunda' ? 50 : 35
}

export function createBoardState(teams: Team[], team: Team): BoardState {
  return {
    objective: setObjective(teams, team),
    confidence: START_CONFIDENCE,
    reputation: initialReputation(team),
    status: 'employed',
    jobOffers: [],
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Confidence after a matchday: drifts with the gap between league position and
 * target (more as the season goes on), plus a small nudge for the result.
 */
export function updateConfidence(
  board: BoardState,
  position: number,
  outcome: 'win' | 'draw' | 'loss' | null,
  seasonProgress: number,
): number {
  const gap = board.objective.targetPosition - position
  const positionEffect = clamp(gap * 0.5, -4, 2.5) * (0.3 + seasonProgress)
  const resultEffect = outcome === 'win' ? 1.5 : outcome === 'loss' ? -1.5 : 0
  return clamp(Math.round(board.confidence + positionEffect + resultEffect), 0, 100)
}

export function shouldSackMidSeason(confidence: number, seasonProgress: number): boolean {
  return seasonProgress >= SACKING_SEASON_SHARE && confidence <= SACK_CONFIDENCE
}

export interface SeasonVerdict {
  met: boolean
  sacked: boolean
  bonus: number
  message: string
}

export function reviewSeason(board: BoardState, finalPosition: number, relegated: boolean, division: Division): SeasonVerdict {
  const { objective } = board
  const met = finalPosition <= objective.targetPosition
  const missedBy = finalPosition - objective.targetPosition

  if (met) {
    const bonus = OBJECTIVE_BONUS[division]
    return {
      met,
      sacked: false,
      bonus,
      message: `Objetivo cumplido (${objective.description}): ${finalPosition}º. La directiva aporta una prima al presupuesto.`,
    }
  }

  const sacked = relegated || missedBy > SEASON_END_TOLERANCE || board.confidence < 30
  return {
    met,
    sacked,
    bonus: 0,
    message: sacked
      ? `Objetivo fallado (${objective.description}): ${finalPosition}º${relegated ? ' y descenso' : ''}. La directiva prescinde de ti.`
      : `Objetivo no cumplido (${objective.description}): ${finalPosition}º. La directiva te da otra temporada.`,
  }
}

/**
 * Clubs willing to hire a sacked manager: those whose prestige is at or below
 * what the manager's reputation earns, preferring the strongest such clubs.
 */
export function buildJobOffers(state: LeagueState, formerTeamId: string, reputation: number): JobOffer[] {
  const maxTier = reputation >= 65 ? 0 : reputation >= 45 ? 1 : 2
  const candidates = state.teams
    .filter((team) => team.id !== formerTeamId && DIVISION_TIER[team.division] >= maxTier)
    .map((team) => ({ team, rank: strengthRank(state.teams, team) }))
    // Struggling clubs change managers: prefer those in the lower half of their squad ranking.
    .filter(({ team, rank }) => rank > competitionTeams(state.teams, team).length / 2)
    .sort((a, b) => DIVISION_TIER[a.team.division] - DIVISION_TIER[b.team.division] || a.rank - b.rank)

  return candidates.slice(0, JOB_OFFER_COUNT).map(({ team }) => ({
    teamId: team.id,
    teamName: team.name,
    competition: competitionName(team),
    objective: setObjective(state.teams, team),
  }))
}

export const BOARD_LIMITS = { SACK_CONFIDENCE, SEASON_END_TOLERANCE }

function withNews(state: LeagueState, line: string): LeagueState {
  return { ...state, news: [line, ...state.news].slice(0, 12) }
}

function dismiss(game: ManagerGameState, board: BoardState, message: string): ManagerGameState {
  const reputation = clamp(board.reputation - 8, 0, 100)
  return {
    ...game,
    board: {
      ...board,
      reputation,
      status: 'sacked',
      lastReview: message,
      jobOffers: buildJobOffers(game.leagueState, game.managerTeamId, reputation),
    },
    leagueState: withNews(game.leagueState, message),
  }
}

/**
 * Updates the board after a processed round.
 * @param before the game before the round (for the manager's old division at season end)
 * @param after the game with the round applied
 */
export function applyBoardAfterRound(before: ManagerGameState, after: ManagerGameState, seasonRolledOver: boolean): ManagerGameState {
  const teamBefore = before.leagueState.teams.find((team) => team.id === before.managerTeamId)
  const teamAfter = after.leagueState.teams.find((team) => team.id === after.managerTeamId)
  if (!teamBefore || !teamAfter) {
    return after
  }

  const board = before.board ?? createBoardState(before.leagueState.teams, teamBefore)
  if (board.status === 'sacked') {
    return { ...after, board }
  }

  if (seasonRolledOver) {
    const history = after.leagueState.seasonHistory ?? []
    const record = history[history.length - 1]
    const finalPosition = record?.managerPosition || leaguePosition(before.leagueState.teams, teamBefore)
    const relegated = record?.relegated.includes(teamBefore.name) ?? false
    const verdict = reviewSeason(board, finalPosition, relegated, teamBefore.division)

    if (verdict.sacked) {
      return dismiss(after, board, verdict.message)
    }

    const reputationGain = verdict.met ? (board.objective.kind === 'title' || board.objective.kind === 'promotion' ? 12 : 8) : -3
    const leagueState = verdict.bonus > 0
      ? {
        ...after.leagueState,
        teams: after.leagueState.teams.map((team) =>
          team.id === after.managerTeamId ? { ...team, budget: team.budget + verdict.bonus } : team,
        ),
      }
      : after.leagueState
    const financeEntries = verdict.bonus > 0
      ? appendFinanceEntries(after, [
        createFinanceEntry(1, after.managerTeamId, 'board', verdict.bonus, 'Prima de la directiva por objetivo cumplido'),
      ])
      : after.financeEntries
    const nextTeam = leagueState.teams.find((team) => team.id === after.managerTeamId) ?? teamAfter

    return {
      ...after,
      financeEntries,
      leagueState: withNews(leagueState, verdict.message),
      board: {
        ...board,
        objective: setObjective(leagueState.teams, nextTeam),
        confidence: verdict.met ? clamp(Math.max(board.confidence, START_CONFIDENCE) + 10, 0, 100) : 40,
        reputation: clamp(board.reputation + reputationGain, 0, 100),
        lastReview: verdict.message,
      },
    }
  }

  const { currentRound, lastResults } = after.leagueState
  const result = lastResults.find((item) => item.homeTeamId === teamAfter.id || item.awayTeamId === teamAfter.id)
  const outcome = !result
    ? null
    : result.homeGoals === result.awayGoals
      ? 'draw'
      : (result.homeGoals > result.awayGoals) === (result.homeTeamId === teamAfter.id) ? 'win' : 'loss'
  // Divisions have different lengths; nothing changes in weeks the club doesn't play.
  if (!outcome) {
    return { ...after, board }
  }
  const competitionSize = competitionTeams(after.leagueState.teams, teamAfter).length
  const progress = teamAfter.played / Math.max((competitionSize - 1) * 2, 1)
  const confidence = updateConfidence(board, leaguePosition(after.leagueState.teams, teamAfter), outcome, progress)

  if (shouldSackMidSeason(confidence, progress)) {
    return dismiss(after, { ...board, confidence }, `Destituido: la directiva pierde la confianza tras la jornada ${currentRound - 1}.`)
  }

  return { ...after, board: { ...board, confidence } }
}

/** Moves a sacked manager to the club whose offer they accepted. */
export function takeJob(game: ManagerGameState, offer: JobOffer): ManagerGameState {
  const team = game.leagueState.teams.find((candidate) => candidate.id === offer.teamId)
  if (!team || !game.board) {
    return game
  }
  const message = `${game.managerName} es el nuevo entrenador del ${team.name}.`
  return {
    ...game,
    managerTeamId: team.id,
    managerLineup: getDefaultLineup(team),
    managerSquadOrder: team.players.map((player) => player.id),
    pendingTransferOffers: [],
    pendingRenewalOffers: [],
    pendingOutgoingTransfers: [],
    leagueState: withNews(game.leagueState, message),
    board: {
      ...game.board,
      objective: setObjective(game.leagueState.teams, team),
      confidence: START_CONFIDENCE,
      status: 'employed',
      jobOffers: [],
      lastReview: message,
    },
  }
}
