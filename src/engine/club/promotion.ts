/** End of season: standings, play-offs, promotion and relegation. */
import { random } from '../random'
import { clamp } from './helpers'
import type { LeagueState, PlayoffTie, Team } from '../../types/game'

export function buildStandingsIndex(teams: Team[]): Map<string, number> {
  const ordered = [...teams].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points
    }

    const gdA = a.goalsFor - a.goalsAgainst
    const gdB = b.goalsFor - b.goalsAgainst
    if (gdB !== gdA) {
      return gdB - gdA
    }

    return b.goalsFor - a.goalsFor
  })

  return new Map(ordered.map((team, index) => [team.id, index + 1]))
}

function rankDivisionTeams(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points
    }

    const gdA = a.goalsFor - a.goalsAgainst
    const gdB = b.goalsFor - b.goalsAgainst
    if (gdB !== gdA) {
      return gdB - gdA
    }

    if (b.goalsFor !== a.goalsFor) {
      return b.goalsFor - a.goalsFor
    }

    return b.budget - a.budget
  })
}

export function resetSeasonStats(team: Team): Team {
  return {
    ...team,
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    sponsor: {
      ...team.sponsor,
      seasonBonusPaid: false,
    },
    players: team.players.map((player) => ({
      ...player,
      injuryWeeks: 0,
      suspensionWeeks: 0,
      yellowCards: 0,
      fatigue: clamp(player.fatigue - 12, 0, 100),
    })),
  }
}

function getPlayoffStrength(team: Team): number {
  return team.attack * 1.05 + team.midfield + team.defense * 0.98 + team.morale * 0.45
}

function samplePlayoffGoals(home: Team, away: Team): { homeGoals: number; awayGoals: number } {
  const homeEdge = getPlayoffStrength(home) - getPlayoffStrength(away)
  const awayEdge = -homeEdge
  const homeBase = 1.2 + homeEdge / 35 + 0.18
  const awayBase = 0.95 + awayEdge / 35

  return {
    homeGoals: clamp(Math.round(homeBase + (random() * 1.6 - 0.8)), 0, 4),
    awayGoals: clamp(Math.round(awayBase + (random() * 1.6 - 0.8)), 0, 4),
  }
}

function simulateTwoLegTie(label: string, higherSeed: Team, lowerSeed: Team): { tie: PlayoffTie; winner: Team } {
  const firstLegScore = samplePlayoffGoals(lowerSeed, higherSeed)
  const secondLegScore = samplePlayoffGoals(higherSeed, lowerSeed)

  const aggregateHigher = firstLegScore.awayGoals + secondLegScore.homeGoals
  const aggregateLower = firstLegScore.homeGoals + secondLegScore.awayGoals

  const winner = aggregateHigher >= aggregateLower ? higherSeed : lowerSeed

  return {
    tie: {
      label,
      teamA: higherSeed.name,
      teamB: lowerSeed.name,
      legs: [
        {
          homeTeam: lowerSeed.name,
          awayTeam: higherSeed.name,
          homeGoals: firstLegScore.homeGoals,
          awayGoals: firstLegScore.awayGoals,
        },
        {
          homeTeam: higherSeed.name,
          awayTeam: lowerSeed.name,
          homeGoals: secondLegScore.homeGoals,
          awayGoals: secondLegScore.awayGoals,
        },
      ],
      winner: winner.name,
    },
    winner,
  }
}

/**
 * Promoted clubs can come from either Primera Federacion group, while relegated
 * clubs join their regional group, so group sizes can drift. Move newly
 * relegated clubs (then any club) from the larger group until both are equal.
 */
function balanceFederacionGroups(teams: Team[], newlyRelegatedIds: Set<string>): void {
  const inGroup = (group: 'Grupo 1' | 'Grupo 2') =>
    teams.filter((team) => team.division === 'Primera Federacion' && team.group === group)

  for (;;) {
    const groupOne = inGroup('Grupo 1')
    const groupTwo = inGroup('Grupo 2')
    if (Math.abs(groupOne.length - groupTwo.length) <= 1) {
      return
    }
    const [larger, target] = groupOne.length > groupTwo.length
      ? [groupOne, 'Grupo 2' as const]
      : [groupTwo, 'Grupo 1' as const]
    const mover = larger.find((team) => newlyRelegatedIds.has(team.id)) ?? larger[larger.length - 1]
    mover.group = target
  }
}

export function applyPromotionRelegation(teams: Team[]): { teams: Team[]; headlines: string[]; bracket: LeagueState['promotionBracket'] } {
  const primera = rankDivisionTeams(teams.filter((team) => team.division === 'Primera'))
  const segunda = rankDivisionTeams(teams.filter((team) => team.division === 'Segunda'))
  const primeraFederacionGroupOne = rankDivisionTeams(
    teams.filter((team) => team.division === 'Primera Federacion' && team.group === 'Grupo 1'),
  )
  const primeraFederacionGroupTwo = rankDivisionTeams(
    teams.filter((team) => team.division === 'Primera Federacion' && team.group === 'Grupo 2'),
  )

  const relegatedFromPrimera = primera.slice(-3)
  const promotedFromSegundaDirect = segunda.slice(0, 2)
  const segundaPlayoffTeams = segunda.slice(2, 6)
  const segundaSemiOne = segundaPlayoffTeams[0] && segundaPlayoffTeams[3]
    ? simulateTwoLegTie('Semi 1', segundaPlayoffTeams[0], segundaPlayoffTeams[3])
    : null
  const segundaSemiTwo = segundaPlayoffTeams[1] && segundaPlayoffTeams[2]
    ? simulateTwoLegTie('Semi 2', segundaPlayoffTeams[1], segundaPlayoffTeams[2])
    : null
  const segundaFinal = segundaSemiOne && segundaSemiTwo
    ? simulateTwoLegTie('Final', segundaSemiOne.winner, segundaSemiTwo.winner)
    : null
  const segundaPlayoffWinner = segundaFinal?.winner ?? segundaSemiOne?.winner ?? segundaSemiTwo?.winner ?? null
  const promotedFromSegunda = segundaPlayoffWinner
    ? [...promotedFromSegundaDirect, segundaPlayoffWinner]
    : [...promotedFromSegundaDirect, segunda[2]].filter(Boolean) as Team[]

  const relegatedFromSegunda = segunda.slice(-4)
  const promotedFromPrimeraFederacionDirect = [
    primeraFederacionGroupOne[0],
    primeraFederacionGroupTwo[0],
  ].filter(Boolean) as Team[]
  const primeraFederacionPlayoffTeams = [
    ...primeraFederacionGroupOne.slice(1, 5),
    ...primeraFederacionGroupTwo.slice(1, 5),
  ]
  const federacionQuarterFinals = [
    primeraFederacionGroupOne[1] && primeraFederacionGroupTwo[4]
      ? simulateTwoLegTie('Cuartos 1', primeraFederacionGroupOne[1], primeraFederacionGroupTwo[4])
      : null,
    primeraFederacionGroupTwo[1] && primeraFederacionGroupOne[4]
      ? simulateTwoLegTie('Cuartos 2', primeraFederacionGroupTwo[1], primeraFederacionGroupOne[4])
      : null,
    primeraFederacionGroupOne[2] && primeraFederacionGroupTwo[3]
      ? simulateTwoLegTie('Cuartos 3', primeraFederacionGroupOne[2], primeraFederacionGroupTwo[3])
      : null,
    primeraFederacionGroupTwo[2] && primeraFederacionGroupOne[3]
      ? simulateTwoLegTie('Cuartos 4', primeraFederacionGroupTwo[2], primeraFederacionGroupOne[3])
      : null,
  ].filter((item): item is { tie: PlayoffTie; winner: Team } => item !== null)
  const federacionSemiOne = federacionQuarterFinals[0] && federacionQuarterFinals[3]
    ? simulateTwoLegTie('Semi 1', federacionQuarterFinals[0].winner, federacionQuarterFinals[3].winner)
    : null
  const federacionSemiTwo = federacionQuarterFinals[1] && federacionQuarterFinals[2]
    ? simulateTwoLegTie('Semi 2', federacionQuarterFinals[1].winner, federacionQuarterFinals[2].winner)
    : null
  const federacionFinal = federacionSemiOne && federacionSemiTwo
    ? simulateTwoLegTie('Final', federacionSemiOne.winner, federacionSemiTwo.winner)
    : null
  const federacionPlayoffWinnerOne = federacionSemiOne?.winner ?? null
  const federacionPlayoffWinnerTwo = federacionSemiTwo?.winner ?? null
  const promotedFromPrimeraFederacion = [
    ...promotedFromPrimeraFederacionDirect,
    ...(federacionPlayoffWinnerOne ? [federacionPlayoffWinnerOne] : []),
    ...(federacionPlayoffWinnerTwo ? [federacionPlayoffWinnerTwo] : []),
  ]

  const relegatedPrimeraIds = new Set(relegatedFromPrimera.map((team) => team.id))
  const promotedSegundaIds = new Set(promotedFromSegunda.map((team) => team.id))
  const relegatedSegundaIds = new Set(relegatedFromSegunda.map((team) => team.id))
  const promotedFederacionIds = new Set(promotedFromPrimeraFederacion.map((team) => team.id))

  const transitioned = teams.map((team) => {
    let division = team.division

    if (relegatedPrimeraIds.has(team.id)) {
      division = 'Segunda'
    } else if (promotedSegundaIds.has(team.id)) {
      division = 'Primera'
    } else if (relegatedSegundaIds.has(team.id)) {
      division = 'Primera Federacion'
    } else if (promotedFederacionIds.has(team.id)) {
      division = 'Segunda'
    }

    let group = team.group
    if (relegatedSegundaIds.has(team.id)) {
      group = team.regionalGroup ?? 'Grupo 1'
    }

    if (promotedFederacionIds.has(team.id) || division !== 'Primera Federacion') {
      group = undefined
    }

    return {
      ...team,
      division,
      group,
    }
  })
  balanceFederacionGroups(transitioned, relegatedSegundaIds)

  const headlines = [
    segundaPlayoffTeams.length > 0
      ? `Playoff Segunda: ${segundaPlayoffTeams.map((team) => team.name).join(', ')}.`
      : null,
    segundaPlayoffWinner ? `${segundaPlayoffWinner.name} gana el playoff de ascenso a Primera.` : null,
    ...promotedFromSegunda.map((team) => `${team.name} asciende a Primera.`),
    ...relegatedFromPrimera.map((team) => `${team.name} desciende a Segunda.`),
    primeraFederacionPlayoffTeams.length > 0
      ? `Playoff 1a RFEF: ${primeraFederacionPlayoffTeams.map((team) => `${team.name}${team.group ? ` (${team.group})` : ''}`).join(', ')}.`
      : null,
    promotedFromPrimeraFederacionDirect[0] ? `${promotedFromPrimeraFederacionDirect[0].name} asciende directo como campeon del Grupo 1.` : null,
    promotedFromPrimeraFederacionDirect[1] ? `${promotedFromPrimeraFederacionDirect[1].name} asciende directo como campeon del Grupo 2.` : null,
    federacionPlayoffWinnerOne ? `${federacionPlayoffWinnerOne.name} gana una plaza del playoff de ascenso a Segunda.` : null,
    federacionPlayoffWinnerTwo ? `${federacionPlayoffWinnerTwo.name} gana una plaza del playoff de ascenso a Segunda.` : null,
    ...promotedFromPrimeraFederacion.map((team) => `${team.name} asciende a Segunda.`),
    ...relegatedFromSegunda.map((team) => `${team.name} desciende a Primera Federacion.`),
  ].filter(Boolean) as string[]

  const bracket: LeagueState['promotionBracket'] = {
    segundaToPrimera: {
      directPromotions: promotedFromSegundaDirect.map((team) => team.name),
      playoffTeams: segundaPlayoffTeams.map((team) => team.name),
      semiFinals: [segundaSemiOne?.tie, segundaSemiTwo?.tie].filter((item): item is PlayoffTie => Boolean(item)),
      final: segundaFinal?.tie ?? null,
      playoffWinner: segundaPlayoffWinner?.name,
      relegatedFromPrimera: relegatedFromPrimera.map((team) => team.name),
    },
    federacionToSegunda: {
      directPromotions: promotedFromPrimeraFederacionDirect.map((team) => `${team.name}${team.group ? ` (${team.group})` : ''}`),
      playoffTeams: primeraFederacionPlayoffTeams.map((team) => `${team.name}${team.group ? ` (${team.group})` : ''}`),
      quarterFinals: federacionQuarterFinals.map((item) => item.tie),
      semiFinals: [federacionSemiOne?.tie, federacionSemiTwo?.tie].filter((item): item is PlayoffTie => Boolean(item)),
      final: federacionFinal?.tie ?? null,
      playoffWinners: [federacionPlayoffWinnerOne, federacionPlayoffWinnerTwo]
        .filter(Boolean)
        .map((team) => `${team!.name}${team!.group ? ` (${team!.group})` : ''}`),
      relegatedFromSegunda: relegatedFromSegunda.map((team) => `${team.name}${team.regionalGroup ? ` -> ${team.regionalGroup}` : ''}`),
    },
  }

  return {
    teams: transitioned,
    headlines,
    bracket,
  }
}
