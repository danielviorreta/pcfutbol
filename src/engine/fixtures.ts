import type { LeagueState, Team } from '../types/game'

function rotate<T>(arr: T[]): T[] {
  if (arr.length <= 2) {
    return arr
  }

  const [fixed, ...others] = arr
  const last = others.pop()
  if (last === undefined) {
    return arr
  }

  return [fixed, last, ...others]
}

export function generateRoundRobin(teamIds: string[]): LeagueState['fixtures'] {
  const isOdd = teamIds.length % 2 === 1
  const workingIds = isOdd ? [...teamIds, 'bye'] : [...teamIds]
  const roundsPerLeg = workingIds.length - 1

  let rotation = [...workingIds]
  const firstLeg: LeagueState['fixtures'] = []

  for (let roundIndex = 0; roundIndex < roundsPerLeg; roundIndex += 1) {
    const round = roundIndex + 1

    for (let i = 0; i < workingIds.length / 2; i += 1) {
      const home = rotation[i]
      const away = rotation[workingIds.length - 1 - i]

      if (home !== 'bye' && away !== 'bye') {
        const shouldSwap = roundIndex % 2 === 1
        firstLeg.push({
          id: `r${round}-${home}-${away}`,
          round,
          homeTeamId: shouldSwap ? away : home,
          awayTeamId: shouldSwap ? home : away,
          played: false,
        })
      }
    }

    rotation = rotate(rotation)
  }

  const secondLeg = firstLeg.map((fixture) => ({
    ...fixture,
    id: `r${fixture.round + roundsPerLeg}-${fixture.awayTeamId}-${fixture.homeTeamId}`,
    round: fixture.round + roundsPerLeg,
    homeTeamId: fixture.awayTeamId,
    awayTeamId: fixture.homeTeamId,
    played: false,
  }))

  return [...firstLeg, ...secondLeg]
}

function roundCountForTeamCount(teamCount: number): number {
  return teamCount % 2 === 0 ? (teamCount - 1) * 2 : teamCount * 2
}

export function buildSeasonFixtures(teams: Team[]): { fixtures: LeagueState['fixtures']; totalRounds: number } {
  const competitions = [
    teams.filter((team) => team.division === 'Primera').map((team) => team.id),
    teams.filter((team) => team.division === 'Segunda').map((team) => team.id),
    teams.filter((team) => team.division === 'Primera Federacion' && team.group === 'Grupo 1').map((team) => team.id),
    teams.filter((team) => team.division === 'Primera Federacion' && team.group === 'Grupo 2').map((team) => team.id),
  ].filter((teamIds) => teamIds.length > 0)

  const fixtures = competitions.flatMap((teamIds) => generateRoundRobin(teamIds))

  const totalRounds = Math.max(
    ...competitions.map((teamIds) => roundCountForTeamCount(teamIds.length)),
  )

  return {
    fixtures,
    totalRounds,
  }
}
