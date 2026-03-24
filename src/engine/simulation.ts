import type { Fixture, LeagueState, MatchResult, Team } from '../types/game'
import { getDefaultLineup, getTeamRatings, isPlayerAvailable, normalizeLineup } from './squad'

interface PlayRoundOptions {
  managerTeamId: string
  managerLineup: string[]
}

interface MatchPack {
  fixture: Fixture
  result: MatchResult
  homeLineup: string[]
  awayLineup: string[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function recoverAvailability(team: Team): Team {
  return {
    ...team,
    players: team.players.map((player) => ({
      ...player,
      injuryWeeks: Math.max(0, player.injuryWeeks - 1),
      suspensionWeeks: Math.max(0, player.suspensionWeeks - 1),
      fatigue: clamp(player.fatigue - 5, 0, 100),
    })),
  }
}

function sampleGoals(offenseScore: number, defenseScore: number): number {
  const edge = offenseScore - defenseScore
  const base = 1.15 + edge / 52
  const withVariance = base + (Math.random() * 1.8 - 0.9)

  return clamp(Math.round(withVariance), 0, 6)
}

function getLineupForTeam(team: Team, options: PlayRoundOptions): string[] {
  if (team.id === options.managerTeamId) {
    return normalizeLineup(team, options.managerLineup)
  }

  return getDefaultLineup(team)
}

function getMatchPack(
  fixture: Fixture,
  teamsById: Map<string, Team>,
  options: PlayRoundOptions,
): MatchPack {
  const homeTeam = teamsById.get(fixture.homeTeamId)
  const awayTeam = teamsById.get(fixture.awayTeamId)

  if (!homeTeam || !awayTeam) {
    throw new Error(`Fixture references unknown teams: ${fixture.id}`)
  }

  const homeLineup = getLineupForTeam(homeTeam, options)
  const awayLineup = getLineupForTeam(awayTeam, options)

  const homeRatings = getTeamRatings(homeTeam, homeLineup)
  const awayRatings = getTeamRatings(awayTeam, awayLineup)

  const homeAttack = homeRatings.attack + homeTeam.morale * 0.16 + 4
  const awayAttack = awayRatings.attack + awayTeam.morale * 0.16

  const homeDefense = awayRatings.defense + awayRatings.midfield * 0.18
  const awayDefense = homeRatings.defense + homeRatings.midfield * 0.18

  const homeGoals = sampleGoals(homeAttack, homeDefense)
  const awayGoals = sampleGoals(awayAttack, awayDefense)

  return {
    fixture,
    homeLineup,
    awayLineup,
    result: {
      fixtureId: fixture.id,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      homeGoals,
      awayGoals,
    },
  }
}

function updateTeamTable(teams: Team[], results: MatchResult[]): Team[] {
  const nextTeams = teams.map((team) => ({ ...team }))
  const teamsById = new Map(nextTeams.map((team) => [team.id, team]))

  for (const result of results) {
    const home = teamsById.get(result.homeTeamId)
    const away = teamsById.get(result.awayTeamId)

    if (!home || !away) {
      continue
    }

    home.played += 1
    away.played += 1

    home.goalsFor += result.homeGoals
    home.goalsAgainst += result.awayGoals

    away.goalsFor += result.awayGoals
    away.goalsAgainst += result.homeGoals

    if (result.homeGoals > result.awayGoals) {
      home.wins += 1
      away.losses += 1
      home.points += 3
      home.morale = clamp(home.morale + 2, 50, 99)
      away.morale = clamp(away.morale - 2, 50, 99)
    } else if (result.homeGoals < result.awayGoals) {
      away.wins += 1
      home.losses += 1
      away.points += 3
      away.morale = clamp(away.morale + 2, 50, 99)
      home.morale = clamp(home.morale - 2, 50, 99)
    } else {
      home.draws += 1
      away.draws += 1
      home.points += 1
      away.points += 1
    }
  }

  return nextTeams
}

function applyLineupEffects(teams: Team[], packs: MatchPack[]): Team[] {
  const lineupsByTeam = new Map<string, string[]>()
  const outcomesByTeam = new Map<string, 'win' | 'draw' | 'loss'>()

  for (const pack of packs) {
    lineupsByTeam.set(pack.fixture.homeTeamId, pack.homeLineup)
    lineupsByTeam.set(pack.fixture.awayTeamId, pack.awayLineup)

    if (pack.result.homeGoals > pack.result.awayGoals) {
      outcomesByTeam.set(pack.fixture.homeTeamId, 'win')
      outcomesByTeam.set(pack.fixture.awayTeamId, 'loss')
    } else if (pack.result.homeGoals < pack.result.awayGoals) {
      outcomesByTeam.set(pack.fixture.homeTeamId, 'loss')
      outcomesByTeam.set(pack.fixture.awayTeamId, 'win')
    } else {
      outcomesByTeam.set(pack.fixture.homeTeamId, 'draw')
      outcomesByTeam.set(pack.fixture.awayTeamId, 'draw')
    }
  }

  return teams.map((team) => {
    const lineup = lineupsByTeam.get(team.id)
    const outcome = outcomesByTeam.get(team.id)

    if (!lineup) {
      return {
        ...team,
        players: team.players.map((player) => ({
          ...player,
          fatigue: clamp(player.fatigue - 6, 0, 100),
          form: clamp(player.form + 1, 40, 99),
        })),
      }
    }

    const lineupSet = new Set(lineup)

    return {
      ...team,
      players: team.players.map((player) => {
        if (!lineupSet.has(player.id)) {
          return {
            ...player,
            fatigue: clamp(player.fatigue - 8, 0, 100),
            form: clamp(player.form + 1, 40, 99),
          }
        }

        const fatigueInc = 9 + Math.floor(Math.random() * 7) - Math.floor(player.stamina / 22)
        const fatigue = clamp(player.fatigue + fatigueInc, 0, 100)

        const formDelta = outcome === 'win' ? 2 : outcome === 'loss' ? -2 : 0
        const form = clamp(player.form + formDelta, 35, 99)

        const injuryChance = 0.012 + fatigue / 2400
        const suspensionChance = 0.03

        const injuryWeeks = isPlayerAvailable(player) && Math.random() < injuryChance
          ? 1 + Math.floor(Math.random() * 3)
          : player.injuryWeeks

        const suspensionWeeks = isPlayerAvailable(player) && Math.random() < suspensionChance
          ? 1
          : player.suspensionWeeks

        return {
          ...player,
          fatigue,
          form,
          injuryWeeks,
          suspensionWeeks,
        }
      }),
    }
  })
}

function makeRoundHeadline(results: MatchResult[], teamNames: Map<string, string>): string {
  if (results.length === 0) {
    return 'Jornada sin partidos.'
  }

  const bestGame = [...results].sort((a, b) => b.homeGoals + b.awayGoals - (a.homeGoals + a.awayGoals))[0]

  const homeName = teamNames.get(bestGame.homeTeamId) ?? bestGame.homeTeamId
  const awayName = teamNames.get(bestGame.awayTeamId) ?? bestGame.awayTeamId

  return `Partidazo: ${homeName} ${bestGame.homeGoals}-${bestGame.awayGoals} ${awayName}`
}

function makeMedicalHeadline(teams: Team[]): string | null {
  for (const team of teams) {
    const unavailable = team.players.find((player) => player.injuryWeeks > 0 || player.suspensionWeeks > 0)

    if (unavailable) {
      if (unavailable.injuryWeeks > 0) {
        return `Parte medico: ${unavailable.name} (${team.name}) sera baja ${unavailable.injuryWeeks} semanas.`
      }

      if (unavailable.suspensionWeeks > 0) {
        return `Disciplina: ${unavailable.name} (${team.name}) cumplira sancion la proxima jornada.`
      }
    }
  }

  return null
}

export function playCurrentRound(state: LeagueState, options: PlayRoundOptions): LeagueState {
  if (state.currentRound > state.totalRounds) {
    return state
  }

  const recoveredTeams = state.teams.map(recoverAvailability)

  const roundFixtures = state.fixtures.filter(
    (fixture) => fixture.round === state.currentRound && !fixture.played,
  )

  const teamsById = new Map(recoveredTeams.map((team) => [team.id, team]))
  const packs = roundFixtures.map((fixture) => getMatchPack(fixture, teamsById, options))
  const results = packs.map((pack) => pack.result)

  const updatedTableTeams = updateTeamTable(recoveredTeams, results)
  const updatedTeams = applyLineupEffects(updatedTableTeams, packs)

  const updatedFixtures = state.fixtures.map((fixture) => {
    const result = results.find((item) => item.fixtureId === fixture.id)

    if (!result) {
      return fixture
    }

    return {
      ...fixture,
      played: true,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
    }
  })

  const teamNames = new Map(updatedTeams.map((team) => [team.id, team.name]))
  const headline = makeRoundHeadline(results, teamNames)
  const medicalHeadline = makeMedicalHeadline(updatedTeams)

  return {
    ...state,
    currentRound: state.currentRound + 1,
    teams: updatedTeams,
    fixtures: updatedFixtures,
    lastResults: results,
    news: [medicalHeadline, headline, ...state.news].filter(Boolean).slice(0, 12) as string[],
  }
}

export function sortLeagueTable(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points
    }

    const goalDiffA = a.goalsFor - a.goalsAgainst
    const goalDiffB = b.goalsFor - b.goalsAgainst

    if (goalDiffB !== goalDiffA) {
      return goalDiffB - goalDiffA
    }

    if (b.goalsFor !== a.goalsFor) {
      return b.goalsFor - a.goalsFor
    }

    return b.budget - a.budget
  })
}
