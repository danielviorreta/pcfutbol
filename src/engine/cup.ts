/**
 * Copa del Rey: a single-match knockout for every club, played midweek
 * after selected league matchdays. Lower-division clubs host ties; draws go
 * to penalties. The 36 weakest clubs play a first round so the rest of the
 * bracket is a clean 64.
 */
import { random } from './random'
import { simulateMatch } from './simulation'
import type { CupRound, CupState, CupTie, Division, FinanceBreakdownItem, LeagueState, Team } from '../types/game'

/** League matchday after which each cup round is played. */
export const CUP_SCHEDULE: { name: string; afterLeagueRound: number; prize: number }[] = [
  { name: 'Primera ronda', afterLeagueRound: 3, prize: 60_000 },
  { name: 'Treintaidosavos', afterLeagueRound: 8, prize: 150_000 },
  { name: 'Dieciseisavos', afterLeagueRound: 13, prize: 300_000 },
  { name: 'Octavos', afterLeagueRound: 18, prize: 600_000 },
  { name: 'Cuartos', afterLeagueRound: 23, prize: 1_200_000 },
  { name: 'Semifinal', afterLeagueRound: 28, prize: 2_500_000 },
  { name: 'Final', afterLeagueRound: 33, prize: 5_000_000 },
]
const MAIN_BRACKET_SIZE = 64

const DIVISION_TIER: Record<Division, number> = { Primera: 0, Segunda: 1, 'Primera Federacion': 2 }

function strength(team: Team): number {
  const best = [...team.players].sort((a, b) => b.overall - a.overall).slice(0, 14)
  return best.reduce((sum, player) => sum + player.overall, 0) / Math.max(best.length, 1)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** From this round on the stronger club hosts (the real Copa switches to two legs and a neutral final). */
const FAVOURITE_HOSTS_FROM = 3

/** Pairs teams at random; early rounds are hosted by the lower-division (or weaker) club. */
function drawTies(teams: Team[], roundIndex: number): CupTie[] {
  const drawn = shuffle(teams)
  const ties: CupTie[] = []
  for (let i = 0; i + 1 < drawn.length; i += 2) {
    const [a, b] = [drawn[i], drawn[i + 1]]
    const aHosts = DIVISION_TIER[a.division] !== DIVISION_TIER[b.division]
      ? DIVISION_TIER[a.division] > DIVISION_TIER[b.division]
      : strength(a) <= strength(b)
    const underdogHosts = roundIndex < FAVOURITE_HOSTS_FROM
    const [home, away] = aHosts === underdogHosts ? [a, b] : [b, a]
    ties.push({ homeTeamId: home.id, awayTeamId: away.id })
  }
  return ties
}

function makeRound(index: number, ties: CupTie[]): CupRound {
  const { name, afterLeagueRound } = CUP_SCHEDULE[index]
  return { name, afterLeagueRound, ties }
}

/** New cup for a season: draws the first round; the strongest clubs get a bye to the round of 64. */
export function createCup(teams: Team[]): CupState {
  const byeCount = MAIN_BRACKET_SIZE - (teams.length - MAIN_BRACKET_SIZE)
  const ranked = [...teams].sort((a, b) => DIVISION_TIER[a.division] - DIVISION_TIER[b.division] || strength(b) - strength(a))
  const byes = ranked.slice(0, byeCount)
  const entrants = ranked.slice(byeCount)

  return {
    rounds: [makeRound(0, drawTies(entrants, 0))],
    byeTeamIds: byes.map((team) => team.id),
    winnerId: null,
  }
}

function penaltyWinner(home: Team, away: Team): { winnerId: string; home: number; away: number } {
  // Mostly a coin toss, slightly favouring the stronger side.
  const homeWins = random() < Math.min(0.8, Math.max(0.2, 0.5 + (strength(home) - strength(away)) / 60))
  const loserScore = 2 + Math.floor(random() * 3)
  return homeWins
    ? { winnerId: home.id, home: loserScore + 1, away: loserScore }
    : { winnerId: away.id, home: loserScore, away: loserScore + 1 }
}

export interface CupRoundOutcome {
  state: LeagueState
  headlines: string[]
  finance: FinanceBreakdownItem[]
  /** The manager's tie this round, for a notice. */
  managerTie?: { tie: CupTie; roundName: string }
}

/**
 * Plays the cup round scheduled after `leagueRound`, pays prize money to the
 * winners, and draws the next round. Does nothing on other matchdays.
 */
export function playCupRound(
  state: LeagueState,
  leagueRound: number,
  managerTeamId: string,
  managerLineup: string[],
): CupRoundOutcome {
  const cup = state.cup
  const current = cup?.rounds[cup.rounds.length - 1]
  if (!cup || !current || current.afterLeagueRound !== leagueRound || current.ties.every((tie) => tie.winnerId)) {
    return { state, headlines: [], finance: [] }
  }

  const roundIndex = cup.rounds.length - 1
  const teamsById = new Map(state.teams.map((team) => [team.id, team]))
  const prize = CUP_SCHEDULE[roundIndex].prize
  const finance: FinanceBreakdownItem[] = []
  const budgetBonus = new Map<string, number>()

  const ties = current.ties.map((tie): CupTie => {
    const home = teamsById.get(tie.homeTeamId)
    const away = teamsById.get(tie.awayTeamId)
    if (!home || !away) {
      return { ...tie, winnerId: home?.id ?? away?.id }
    }
    const match = simulateMatch(home, away, { managerTeamId, managerLineup })
    const penalties = match.homeGoals === match.awayGoals ? penaltyWinner(home, away) : undefined
    const winnerId = penalties?.winnerId ?? (match.homeGoals > match.awayGoals ? home.id : away.id)

    budgetBonus.set(winnerId, (budgetBonus.get(winnerId) ?? 0) + prize)
    finance.push({ teamId: winnerId, category: 'cup', amount: prize, description: `Copa del Rey: ${current.name}` })

    return {
      ...tie,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      penalties: penalties ? { home: penalties.home, away: penalties.away } : undefined,
      winnerId,
    }
  })

  const winners = ties.map((tie) => teamsById.get(tie.winnerId!)!).filter(Boolean)
  const isFinal = roundIndex === CUP_SCHEDULE.length - 1
  const nextEntrants = roundIndex === 0
    ? [...winners, ...cup.byeTeamIds.map((id) => teamsById.get(id)!).filter(Boolean)]
    : winners

  const playedRound = { ...current, ties }
  const rounds = [...cup.rounds.slice(0, -1), playedRound]
  if (!isFinal) {
    rounds.push(makeRound(roundIndex + 1, drawTies(nextEntrants, roundIndex + 1)))
  }

  const winnerId = isFinal ? winners[0]?.id ?? null : null
  const name = (id: string) => teamsById.get(id)?.name ?? id
  const headlines: string[] = []
  if (isFinal && winnerId) {
    const final = ties[0]
    headlines.push(`${name(winnerId)} gana la Copa del Rey (${name(final.homeTeamId)} ${final.homeGoals}-${final.awayGoals} ${name(final.awayTeamId)}).`)
  } else {
    const upsets = ties.filter((tie) => {
      const loserId = tie.winnerId === tie.homeTeamId ? tie.awayTeamId : tie.homeTeamId
      const winner = teamsById.get(tie.winnerId!)
      const loser = teamsById.get(loserId)
      return winner && loser && DIVISION_TIER[winner.division] > DIVISION_TIER[loser.division]
    })
    headlines.push(`Copa del Rey, ${current.name}: ${upsets.length > 0 ? `sorpresa de ${name(upsets[0].winnerId!)}` : 'sin sorpresas'}.`)
  }

  const managerTie = ties.find((tie) => tie.homeTeamId === managerTeamId || tie.awayTeamId === managerTeamId)

  return {
    state: {
      ...state,
      teams: state.teams.map((team) => (budgetBonus.has(team.id) ? { ...team, budget: team.budget + budgetBonus.get(team.id)! } : team)),
      cup: { ...cup, rounds, winnerId },
    },
    headlines,
    finance,
    managerTie: managerTie ? { tie: managerTie, roundName: current.name } : undefined,
  }
}

/** The manager's next unplayed cup tie, if still in the competition. */
export function findManagerCupTie(cup: CupState | undefined, managerTeamId: string): { tie: CupTie; round: CupRound } | null {
  const round = cup?.rounds[cup.rounds.length - 1]
  const tie = round?.ties.find((item) => !item.winnerId && (item.homeTeamId === managerTeamId || item.awayTeamId === managerTeamId))
  return round && tie ? { tie, round } : null
}
