/** Season summary saved at each rollover: champions, top scorers, promotions and the manager's finish. */
import { sortLeagueTable } from '../simulation'
import type { CompetitionSeasonRecord, Division, SeasonLeader, SeasonRecord, Team } from '../../types/game'

const DIVISION_RANK: Record<Division, number> = { Primera: 0, Segunda: 1, 'Primera Federacion': 2 }

export function competitionName(team: Pick<Team, 'division' | 'group'>): string {
  return team.group ? `${team.division} - ${team.group}` : team.division
}

function competitionsOf(teams: Team[]): Map<string, Team[]> {
  const byCompetition = new Map<string, Team[]>()
  for (const team of teams) {
    const key = competitionName(team)
    byCompetition.set(key, [...(byCompetition.get(key) ?? []), team])
  }
  return byCompetition
}

/** Best player in a competition by a season stat (ties: fewer appearances wins). */
export function seasonLeader(teams: Team[], stat: 'goals' | 'assists'): SeasonLeader | null {
  let best: { playerName: string; teamName: string; value: number; appearances: number } | null = null
  for (const team of teams) {
    for (const player of team.players) {
      const value = player.seasonStats?.[stat] ?? 0
      const appearances = player.seasonStats?.appearances ?? 0
      if (value > 0 && (!best || value > best.value || (value === best.value && appearances < best.appearances))) {
        best = { playerName: player.name, teamName: team.name, value, appearances }
      }
    }
  }
  return best ? { playerName: best.playerName, teamName: best.teamName, value: best.value } : null
}

/**
 * @param finalTeams teams at the end of the season, before promotion/relegation
 * @param nextTeams the same teams after promotion/relegation
 */
export function buildSeasonRecord(finalTeams: Team[], nextTeams: Team[], managerTeamId: string): SeasonRecord {
  const competitions: CompetitionSeasonRecord[] = [...competitionsOf(finalTeams).entries()].map(([competition, teams]) => ({
    competition,
    champion: sortLeagueTable(teams)[0]?.name ?? '',
    topScorer: seasonLeader(teams, 'goals'),
    topAssister: seasonLeader(teams, 'assists'),
  }))

  const nextDivision = new Map(nextTeams.map((team) => [team.id, team.division]))
  const promoted: string[] = []
  const relegated: string[] = []
  for (const team of finalTeams) {
    const next = nextDivision.get(team.id)
    if (!next || next === team.division) continue
    if (DIVISION_RANK[next] < DIVISION_RANK[team.division]) promoted.push(team.name)
    else relegated.push(team.name)
  }

  const manager = finalTeams.find((team) => team.id === managerTeamId)
  const managerCompetition = manager ? competitionName(manager) : ''
  const managerTable = sortLeagueTable(competitionsOf(finalTeams).get(managerCompetition) ?? [])

  return {
    label: '',
    competitions,
    promoted,
    relegated,
    managerTeamName: manager?.name ?? '',
    managerCompetition,
    managerPosition: managerTable.findIndex((team) => team.id === managerTeamId) + 1,
  }
}
