import type { Fixture, LeagueState, MatchResult, Player, Team } from '../types/game'
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

interface RoundIncidents {
  injuries: string[]
  bookings: string[]
  reds: string[]
  suspensions: string[]
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

function getYellowCardChance(team: Team, playerId: string, fatigue: number): number {
  const player = team.players.find((item) => item.id === playerId)
  if (!player) {
    return 0.09
  }

  const baseByPosition =
    player.position === 'DEF'
      ? 0.14
      : player.position === 'MID'
        ? 0.1
        : player.position === 'FWD'
          ? 0.07
          : 0.03

  const disciplineMod = 1 - (team.staff.disciplineLevel - 1) * 0.1

  return clamp((baseByPosition + fatigue / 700) * disciplineMod, 0.02, 0.3)
}

function getInjuryChance(team: Team, stamina: number, fatigue: number): number {
  const medicalMod = 1 - (team.staff.medicalLevel - 1) * 0.12
  return clamp((0.006 + fatigue / 1500 + (100 - stamina) / 4000) * medicalMod, 0.003, 0.16)
}

function getInjuryDuration(fatigue: number): number {
  if (fatigue >= 88) {
    return 2 + Math.floor(Math.random() * 4)
  }

  return 1 + Math.floor(Math.random() * 3)
}

function sampleHalfGoals(offenseScore: number, defenseScore: number, tempo = 1): number {
  const edge = offenseScore - defenseScore
  // Softer edge scaling avoids over-penalizing attacks against slightly stronger defenses.
  const base = 0.68 + edge / 220
  const withVariance = base * tempo + (Math.random() * 0.9 - 0.45)

  return clamp(Math.round(withVariance), 0, 4)
}

function getLineupPlayers(team: Team, lineup: string[]): Player[] {
  return lineup
    .map((id) => team.players.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player))
}

function getSubstitutionPlan(team: Team, lineup: string[]): { outgoing: Player[]; incoming: Player[] } {
  const lineupIds = new Set(lineup)
  const starters = getLineupPlayers(team, lineup)
  const bench = team.players
    .filter((player) => !lineupIds.has(player.id) && isPlayerAvailable(player))
    .sort((a, b) => b.overall - a.overall)

  if (starters.length === 0 || bench.length === 0) {
    return { outgoing: [], incoming: [] }
  }

  const outgoing = [...starters]
    .sort((a, b) => (b.fatigue + (100 - b.stamina) * 0.35) - (a.fatigue + (100 - a.stamina) * 0.35))
    .slice(0, 2)
  const incoming = bench.slice(0, Math.min(outgoing.length, 2))

  return { outgoing, incoming }
}

function estimateMinutesDistribution(team: Team, lineup: string[]): Map<string, number> {
  const minutesByPlayer = new Map<string, number>()
  const lineupSet = new Set(lineup)

  for (const player of team.players) {
    minutesByPlayer.set(player.id, lineupSet.has(player.id) ? 90 : 0)
  }

  const { outgoing, incoming } = getSubstitutionPlan(team, lineup)
  outgoing.forEach((outPlayer, idx) => {
    const inPlayer = incoming[idx]
    if (!inPlayer) return

    const subMinute = 58 + Math.floor(Math.random() * 23)
    minutesByPlayer.set(outPlayer.id, subMinute)
    minutesByPlayer.set(inPlayer.id, 90 - subMinute)
  })

  return minutesByPlayer
}

function pushRecentMinutes(history: number[] | undefined, minutes: number): number[] {
  const safe = Array.isArray(history) ? history : []
  return [...safe, clamp(Math.round(minutes), 0, 90)].slice(-5)
}

function estimateSubstitutionImpact(team: Team, lineup: string[]): { attack: number; defense: number } {
  const { outgoing, incoming } = getSubstitutionPlan(team, lineup)

  if (outgoing.length === 0 || incoming.length === 0) {
    return { attack: 0, defense: 0 }
  }

  const outgoingAvg = outgoing.reduce((sum, player) => sum + player.overall, 0) / outgoing.length
  const incomingAvg = incoming.reduce((sum, player) => sum + player.overall, 0) / incoming.length
  const delta = incomingAvg - outgoingAvg

  const attackingIncoming = incoming.filter((player) => player.position === 'FWD' || player.position === 'MID').length
  const defensiveIncoming = incoming.filter((player) => player.position === 'DEF' || player.position === 'GK').length

  return {
    attack: clamp(delta / 70 + attackingIncoming * 0.03, -0.12, 0.2),
    defense: clamp(delta / 90 + defensiveIncoming * 0.025, -0.1, 0.16),
  }
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

  const homeFirstHalfGoals = sampleHalfGoals(homeAttack * 0.98, homeDefense, 1)
  const awayFirstHalfGoals = sampleHalfGoals(awayAttack * 0.95, awayDefense, 0.98)

  const homeSubImpact = estimateSubstitutionImpact(homeTeam, homeLineup)
  const awaySubImpact = estimateSubstitutionImpact(awayTeam, awayLineup)

  const homeTrailing = homeFirstHalfGoals < awayFirstHalfGoals
  const awayTrailing = awayFirstHalfGoals < homeFirstHalfGoals
  const homeLeading = homeFirstHalfGoals > awayFirstHalfGoals
  const awayLeading = awayFirstHalfGoals > homeFirstHalfGoals

  const homeAttackTactical = homeTrailing ? 1.12 : homeLeading ? 0.94 : 1.03
  const awayAttackTactical = awayTrailing ? 1.12 : awayLeading ? 0.94 : 1.03
  const homeDefenseTactical = homeTrailing ? 0.95 : homeLeading ? 1.07 : 1
  const awayDefenseTactical = awayTrailing ? 0.95 : awayLeading ? 1.07 : 1

  const homeSecondHalfAttack = homeAttack * homeAttackTactical * (1 + homeSubImpact.attack)
  const awaySecondHalfDefense = homeDefense * awayDefenseTactical * (1 + awaySubImpact.defense)
  const awaySecondHalfAttack = awayAttack * awayAttackTactical * (1 + awaySubImpact.attack)
  const homeSecondHalfDefense = awayDefense * homeDefenseTactical * (1 + homeSubImpact.defense)

  const homeSecondHalfGoals = sampleHalfGoals(homeSecondHalfAttack, awaySecondHalfDefense, 1.04)
  const awaySecondHalfGoals = sampleHalfGoals(awaySecondHalfAttack, homeSecondHalfDefense, 1.04)

  const homeGoals = clamp(homeFirstHalfGoals + homeSecondHalfGoals, 0, 6)
  const awayGoals = clamp(awayFirstHalfGoals + awaySecondHalfGoals, 0, 6)

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

function applyMatchDayRevenue(teams: Team[], results: MatchResult[]): Team[] {
  const teamsById = new Map(teams.map((t) => [t.id, t]))
  const revenueByTeamId = new Map<string, number>()

  for (const result of results) {
    const homeTeam = teamsById.get(result.homeTeamId)
    const awayTeam = teamsById.get(result.awayTeamId)

    if (!homeTeam) {
      continue
    }

    const { stadium } = homeTeam

    // Price elasticity: -0.5% per € above optimal €35
    const priceEffect = Math.max(0, (stadium.ticketPrice - 35) * 0.005)
    // Morale: ±0.2% per point from 70
    const moraleEffect = (homeTeam.morale - 70) * 0.002
    // Game importance: stronger opponent draws bigger crowd
    const opponentStrength = awayTeam
      ? (awayTeam.attack + awayTeam.midfield + awayTeam.defense) / 3
      : 75
    const importanceEffect = (opponentStrength - 75) * 0.004
    // Random match-day variance ±3%
    const variance = (Math.random() - 0.5) * 0.06

    const fillRate = clamp(0.70 - priceEffect + moraleEffect + importanceEffect + variance, 0.20, 0.98)
    const revenue = Math.round(stadium.capacity * fillRate * stadium.ticketPrice)

    revenueByTeamId.set(result.homeTeamId, revenue)
  }

  return teams.map((team) => {
    const revenue = revenueByTeamId.get(team.id)

    return revenue !== undefined ? { ...team, budget: team.budget + revenue } : team
  })
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

function applyLineupEffects(teams: Team[], packs: MatchPack[]): { teams: Team[]; incidents: RoundIncidents } {
  const lineupsByTeam = new Map<string, string[]>()
  const outcomesByTeam = new Map<string, 'win' | 'draw' | 'loss'>()
  const teamsById = new Map(teams.map((team) => [team.id, team]))
  const minutesByTeam = new Map<string, Map<string, number>>()
  const incidents: RoundIncidents = {
    injuries: [],
    bookings: [],
    reds: [],
    suspensions: [],
  }

  for (const pack of packs) {
    lineupsByTeam.set(pack.fixture.homeTeamId, pack.homeLineup)
    lineupsByTeam.set(pack.fixture.awayTeamId, pack.awayLineup)

    const homeTeam = teamsById.get(pack.fixture.homeTeamId)
    const awayTeam = teamsById.get(pack.fixture.awayTeamId)
    if (homeTeam) {
      minutesByTeam.set(homeTeam.id, estimateMinutesDistribution(homeTeam, pack.homeLineup))
    }
    if (awayTeam) {
      minutesByTeam.set(awayTeam.id, estimateMinutesDistribution(awayTeam, pack.awayLineup))
    }

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

  const nextTeams = teams.map((team) => {
    const lineup = lineupsByTeam.get(team.id)
    const outcome = outcomesByTeam.get(team.id)
    const teamMinutes = minutesByTeam.get(team.id)

    if (!lineup) {
      return {
        ...team,
        players: team.players.map((player) => ({
          ...player,
          fatigue: clamp(player.fatigue - 6, 0, 100),
          form: clamp(player.form + 1, 40, 99),
          happiness: clamp(player.happiness + 1, 35, 99),
          recentMinutes: pushRecentMinutes(player.recentMinutes, 0),
        })),
      }
    }

    return {
      ...team,
      players: team.players.map((player) => {
        const minutesPlayed = teamMinutes?.get(player.id) ?? 0
        if (minutesPlayed <= 0) {
          return {
            ...player,
            fatigue: clamp(player.fatigue - 9, 0, 100),
            form: clamp(player.form + 1, 40, 99),
            happiness: clamp(player.happiness - 1, 35, 99),
            recentMinutes: pushRecentMinutes(player.recentMinutes, 0),
          }
        }

        const minuteShare = minutesPlayed / 90
        const fatigueInc =
          3
          + Math.round(5 * minuteShare)
          + Math.floor(Math.random() * 5)
          + Math.max(0, Math.floor((100 - player.stamina) / 18))
          + Math.max(0, Math.floor((player.fatigue - 60) / 12))
        const fatigue = clamp(player.fatigue + fatigueInc, 0, 100)

        const formDelta = outcome === 'win' ? 2 : outcome === 'loss' ? -2 : 0
        const form = clamp(player.form + formDelta, 35, 99)
        const happinessDelta = outcome === 'win' ? 1 : outcome === 'loss' ? -2 : 0

        const injuryChance = getInjuryChance(team, player.stamina, fatigue)
        const yellowChance = getYellowCardChance(team, player.id, fatigue)
        const redChance = clamp((0.004 + fatigue / 5000) * (1 - (team.staff.disciplineLevel - 1) * 0.1), 0.002, 0.035)
        const participationFactor = 0.25 + minuteShare * 0.75

        const gotYellow = isPlayerAvailable(player) && Math.random() < yellowChance * participationFactor
        const gotRed = isPlayerAvailable(player) && Math.random() < redChance * participationFactor

        let yellowCards = gotYellow ? player.yellowCards + 1 : player.yellowCards
        if (gotRed) {
          yellowCards += 1
        }

        if (gotYellow) {
          incidents.bookings.push(`${player.name} (${team.name}) vio amarilla.`)
        }

        if (gotRed) {
          incidents.reds.push(`${player.name} (${team.name}) fue expulsado.`)
        }

        let suspensionWeeks = player.suspensionWeeks
        if (yellowCards >= 5) {
          suspensionWeeks = Math.max(suspensionWeeks, 1)
          yellowCards -= 5
          incidents.suspensions.push(`${player.name} (${team.name}) cumplira 1 partido por acumulacion.`)
        }

        if (gotRed) {
          suspensionWeeks = Math.max(suspensionWeeks, 1)
          incidents.suspensions.push(`${player.name} (${team.name}) quedo sancionado para la proxima jornada.`)
        }

        const injuryWeeks = isPlayerAvailable(player) && Math.random() < injuryChance * participationFactor
          ? getInjuryDuration(fatigue)
          : player.injuryWeeks

        if (injuryWeeks > player.injuryWeeks) {
          incidents.injuries.push(`${player.name} (${team.name}) se lesiona: ${injuryWeeks} semanas.`)
        }

        return {
          ...player,
          fatigue,
          form,
          happiness: clamp(player.happiness + happinessDelta, 35, 99),
          injuryWeeks,
          suspensionWeeks,
          yellowCards,
          recentMinutes: pushRecentMinutes(player.recentMinutes, minutesPlayed),
        }
      }),
    }
  })

  return {
    teams: nextTeams,
    incidents,
  }
}

function makeIncidentHeadlines(incidents: RoundIncidents): string[] {
  return [
    ...incidents.injuries.slice(0, 2),
    ...incidents.suspensions.slice(0, 2),
    ...incidents.reds.slice(0, 1),
    ...incidents.bookings.slice(0, 1),
  ]
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
  const revenueTeams = applyMatchDayRevenue(updatedTableTeams, results)
  const { teams: updatedTeams, incidents } = applyLineupEffects(revenueTeams, packs)

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
  const incidentHeadlines = makeIncidentHeadlines(incidents)

  return {
    ...state,
    currentRound: state.currentRound + 1,
    teams: updatedTeams,
    fixtures: updatedFixtures,
    lastResults: results,
    news: [...incidentHeadlines, medicalHeadline, headline, ...state.news].filter(Boolean).slice(0, 12) as string[],
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
