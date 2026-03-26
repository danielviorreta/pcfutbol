import { buildSeasonFixtures } from '../data/seedData'
import { estimatePlayerHappiness, estimatePlayerValue, estimateReleaseClause } from './playerMarket'
import { simulateAiContractRenewals, simulateAiTransferWindow } from './transfers'
import type { FinanceBreakdownItem, IncomingTransferOffer, LeagueState, PendingRenewalOffer, Player, PlayoffTie, Position, PromisedRole, Tactic, Team, TrainingFocus } from '../types/game'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function weeklyPayroll(team: Team): number {
  return team.players.reduce((sum, player) => sum + player.wage, 0) / 52
}

function estimatePlayerAge(player: Player): number {
  if (typeof player.age === 'number' && Number.isFinite(player.age)) {
    return clamp(Math.round(player.age), 16, 40)
  }

  // Fallback when legacy saves do not store age in first-team players.
  if (player.overall >= 88) return 29
  if (player.overall >= 84) return 27
  if (player.overall >= 79) return 25
  if (player.overall >= 73) return 23
  return 21
}

function estimateSquadRole(team: Team, playerId: string): PromisedRole {
  const ordered = team.players
    .slice()
    .sort((a, b) => b.overall - a.overall)
    .map((item) => item.id)

  const index = ordered.indexOf(playerId)
  if (index < 0) return 'rotacion'
  if (index <= 2) return 'estrella'
  if (index <= 10) return 'titular'
  if (index <= 17) return 'rotacion'
  return 'banquillo'
}

function estimateRecentMinutesShare(team: Team, player: Player, role: PromisedRole): number {
  if (Array.isArray(player.recentMinutes) && player.recentMinutes.length > 0) {
    const sample = player.recentMinutes.slice(-5)
    const avg = sample.reduce((sum, value) => sum + value, 0) / sample.length
    return Math.min(0.98, Math.max(0.02, avg / 90))
  }

  if (player.injuryWeeks > 0 || player.suspensionWeeks > 0) {
    return 0.02
  }

  const roleBase = role === 'estrella'
    ? 0.92
    : role === 'titular'
      ? 0.78
      : role === 'rotacion'
        ? 0.46
        : 0.18

  const fitnessMod = player.fatigue >= 80
    ? -0.20
    : player.fatigue >= 65
      ? -0.12
      : player.fatigue <= 30
        ? 0.05
        : 0

  const formMod = player.form >= 85
    ? 0.08
    : player.form >= 75
      ? 0.04
      : player.form <= 58
        ? -0.08
        : 0

  const overallGap = team.players.length > 0
    ? Math.max(...team.players.map((p) => p.overall)) - player.overall
    : 0
  const qualityMod = overallGap <= 2
    ? 0.04
    : overallGap >= 10
      ? -0.06
      : 0

  return Math.min(0.98, Math.max(0.02, roleBase + fitnessMod + formMod + qualityMod))
}

function applyTrainingToTeam(team: Team): Team {
  const nextPlayers = team.players.map((player) => {
    const growthRoll = Math.random()
    const focusBonus =
      (team.trainingFocus === 'attack' && player.position === 'FWD') ||
      (team.trainingFocus === 'midfield' && player.position === 'MID') ||
      (team.trainingFocus === 'defense' && (player.position === 'DEF' || player.position === 'GK'))
        ? 1
        : 0

    const fitnessDelta = team.trainingFocus === 'fitness' ? -5 : -2
    const fatigue = clamp(player.fatigue + fitnessDelta + Math.floor(Math.random() * 5), 0, 100)

    const formBoost =
      team.trainingFocus === 'fitness' ? 1 : focusBonus > 0 ? 2 : 1

    const form = clamp(player.form + formBoost - (fatigue > 70 ? 2 : 0), 45, 99)

    const age = estimatePlayerAge(player)
    const role = estimateSquadRole(team, player.id)
    const minutesShare = estimateRecentMinutesShare(team, player, role)
    const softCap = age <= 20
      ? Math.min(94, player.overall + 14)
      : age <= 23
        ? Math.min(92, player.overall + 9)
        : age <= 27
          ? Math.min(90, player.overall + 5)
          : Math.min(88, player.overall + 2)
    const growthRoom = Math.max(0, softCap - player.overall)

    const ageFactor = age <= 20 ? 1.25 : age <= 23 ? 1 : age <= 27 ? 0.72 : age <= 30 ? 0.45 : 0.2
    const roomFactor = growthRoom >= 10 ? 1.15 : growthRoom >= 6 ? 0.9 : growthRoom >= 3 ? 0.55 : 0.2
    const performanceFactor = form >= 80 ? 1.1 : form <= 58 ? 0.8 : 1
    const focusFactor = focusBonus > 0 ? 1.08 : 1

    // Weekly gains are intentionally conservative to avoid +8/+10 in half a season.
    const growthChance = clamp(0.035 * ageFactor * roomFactor * performanceFactor * focusFactor * (0.6 + minutesShare), 0.005, 0.14)
    const baseGrowth = growthRoll < growthChance ? 1 : 0
    const overall = clamp(player.overall + baseGrowth, 50, Math.max(player.overall, softCap))

    const value = estimatePlayerValue(overall, team.division, player.age)

    return {
      ...player,
      fatigue,
      form,
      overall,
      value,
    }
  })

  const nextYouth = team.youthPlayers.map((prospect) => {
    const progressInc = 8 + Math.floor(Math.random() * 15)
    const progress = prospect.progress + progressInc
    const jump = progress >= 100 ? 1 : 0

    return {
      ...prospect,
      progress: jump > 0 ? progress - 100 : progress,
      overall: clamp(prospect.overall + jump, 45, prospect.potential),
    }
  })

  if (Math.random() > 0.94 && nextYouth.length < 6) {
    const positionPool: Position[] = ['GK', 'DEF', 'MID', 'FWD']
    const position = positionPool[Math.floor(Math.random() * positionPool.length)]
    const seed = Math.floor(Math.random() * 9000)

    nextYouth.push({
      id: `${team.id}-y${Date.now()}-${seed}`,
      name: `Canterano ${seed}`,
      position,
      age: 16,
      overall: 53 + Math.floor(Math.random() * 8),
      potential: 72 + Math.floor(Math.random() * 12),
      progress: 0,
    })
  }

  return {
    ...team,
    players: nextPlayers,
    youthPlayers: nextYouth,
  }
}

function buildStandingsIndex(teams: Team[]): Map<string, number> {
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

function resetSeasonStats(team: Team): Team {
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
    homeGoals: clamp(Math.round(homeBase + (Math.random() * 1.6 - 0.8)), 0, 4),
    awayGoals: clamp(Math.round(awayBase + (Math.random() * 1.6 - 0.8)), 0, 4),
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

function applyPromotionRelegation(teams: Team[]): { teams: Team[]; headlines: string[]; bracket: LeagueState['promotionBracket'] } {
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

export function applyWeeklyClubManagement(
  state: LeagueState,
  managerTeamId: string,
  existingIncomingOffers: IncomingTransferOffer[] = [],
): { nextState: LeagueState; headlines: string[]; incomingOffers: IncomingTransferOffer[]; financeBreakdown: FinanceBreakdownItem[] } {
  const standings = buildStandingsIndex(state.teams)
  const isSeasonOver = state.currentRound > state.totalRounds
  const midSeasonRound = Math.floor(state.totalRounds / 2)
  const isMidSeasonCheckpoint = state.currentRound === midSeasonRound + 1

  const headlines: string[] = []
  const financeBreakdown: FinanceBreakdownItem[] = []

  if (isMidSeasonCheckpoint) {
    headlines.push('Comite de competicion: se perdonan 2 amarillas a todos los jugadores.')
  }

  if (isSeasonOver) {
    headlines.push('Fin de temporada: historial disciplinario reiniciado (amarillas a cero).')
  }

  const nextTeams = state.teams.map((team) => {
    const payroll = Math.round(weeklyPayroll(team))
    let budget = team.budget + team.sponsor.weeklyIncome - payroll
    financeBreakdown.push({
      teamId: team.id,
      category: 'sponsor',
      amount: team.sponsor.weeklyIncome,
      description: `Sponsor ${team.sponsor.name}`,
    })
    financeBreakdown.push({
      teamId: team.id,
      category: 'salary',
      amount: -payroll,
      description: 'Nómina semanal',
    })

    let sponsor = { ...team.sponsor }
    const rank = standings.get(team.id) ?? 99

    if (isSeasonOver && !sponsor.seasonBonusPaid && rank <= sponsor.targetRank) {
      budget += sponsor.seasonBonus
      sponsor = { ...sponsor, seasonBonusPaid: true }
      financeBreakdown.push({
        teamId: team.id,
        category: 'sponsor',
        amount: sponsor.seasonBonus,
        description: `Bonus final de sponsor ${sponsor.name}`,
      })
      headlines.push(`${team.name} cobra bonus del sponsor (${sponsor.name}).`)
    }

    const cardReduction = isSeasonOver ? Number.POSITIVE_INFINITY : isMidSeasonCheckpoint ? 2 : 0

    const nextPlayers = team.players.map((player) => {
      if (cardReduction <= 0 || player.yellowCards <= 0) {
        return player
      }

      return {
        ...player,
        yellowCards: Math.max(0, player.yellowCards - cardReduction),
      }
    })

    const trained = applyTrainingToTeam({
      ...team,
      players: nextPlayers,
    })

    let { stadium } = trained
    const weeksLeft = stadium.upgradeWeeksRemaining ?? 0

    if (weeksLeft > 0) {
      const remaining = weeksLeft - 1
      const newCapacity = remaining === 0
        ? Math.min(MAX_CAPACITY, stadium.capacity + UPGRADE_SEATS)
        : stadium.capacity

      stadium = { ...stadium, capacity: newCapacity, upgradeWeeksRemaining: remaining }

      if (remaining === 0) {
        headlines.push(`Obras terminadas en ${stadium.name}. Nuevo aforo: ${newCapacity.toLocaleString('es-ES')} plazas.`)
      }
    }

    return {
      ...trained,
      budget,
      sponsor,
      stadium,
    }
  })

  let managedState: LeagueState = {
    ...state,
    teams: nextTeams,
  }
  let incomingOffers: IncomingTransferOffer[] = []

  return {
    nextState: (() => {
      if (!isSeasonOver) {
        const renewedState = simulateAiContractRenewals(managedState, managerTeamId)
        headlines.push(...renewedState.headlines)
        managedState = renewedState.nextState

        const aiWindow = simulateAiTransferWindow(
          managedState,
          managerTeamId,
          existingIncomingOffers,
        )
        headlines.push(...aiWindow.headlines)
        incomingOffers = aiWindow.incomingOffers
        managedState = aiWindow.nextState

        return {
          ...managedState,
        }
      }

      const { teams: transitionedTeams, headlines: transitionHeadlines, bracket } = applyPromotionRelegation(nextTeams)
      headlines.push(...transitionHeadlines)

      const resetTeams = transitionedTeams.map(resetSeasonStats)
      const { fixtures, totalRounds } = buildSeasonFixtures(resetTeams)

      return {
        ...state,
        currentRound: 1,
        totalRounds,
        teams: resetTeams,
        fixtures,
        lastResults: [],
        promotionSummary: transitionHeadlines,
        promotionBracket: bracket,
      }
    })(),
    headlines,
    incomingOffers,
    financeBreakdown,
  }
}

function staffUpgradeCost(level: number): number {
  return 800_000 + level * 600_000
}

export function upgradeMedicalStaff(
  state: LeagueState,
  managerTeamId: string,
): { nextState: LeagueState; message: string; ok: boolean } {
  const team = state.teams.find((item) => item.id === managerTeamId)

  if (!team) {
    return { nextState: state, message: 'Equipo no encontrado.', ok: false }
  }

  if (team.staff.medicalLevel >= 5) {
    return { nextState: state, message: 'El cuerpo medico ya esta al maximo (nivel 5).', ok: false }
  }

  const cost = staffUpgradeCost(team.staff.medicalLevel)
  if (team.budget < cost) {
    return {
      nextState: state,
      message: `No hay presupuesto para mejorar el cuerpo medico. Coste: ${cost.toLocaleString('es-ES')} €`,
      ok: false,
    }
  }

  const nextState = {
    ...state,
    teams: state.teams.map((item) =>
      item.id !== managerTeamId
        ? item
        : {
            ...item,
            budget: item.budget - cost,
            staff: {
              ...item.staff,
              medicalLevel: item.staff.medicalLevel + 1,
            },
          },
    ),
  }

  return {
    nextState,
    message: `Cuerpo medico mejorado a nivel ${team.staff.medicalLevel + 1}.`,
    ok: true,
  }
}

export function upgradeDisciplineStaff(
  state: LeagueState,
  managerTeamId: string,
): { nextState: LeagueState; message: string; ok: boolean } {
  const team = state.teams.find((item) => item.id === managerTeamId)

  if (!team) {
    return { nextState: state, message: 'Equipo no encontrado.', ok: false }
  }

  if (team.staff.disciplineLevel >= 5) {
    return { nextState: state, message: 'El preparador disciplinario ya esta al maximo (nivel 5).', ok: false }
  }

  const cost = staffUpgradeCost(team.staff.disciplineLevel)
  if (team.budget < cost) {
    return {
      nextState: state,
      message: `No hay presupuesto para mejorar disciplina. Coste: ${cost.toLocaleString('es-ES')} €`,
      ok: false,
    }
  }

  const nextState = {
    ...state,
    teams: state.teams.map((item) =>
      item.id !== managerTeamId
        ? item
        : {
            ...item,
            budget: item.budget - cost,
            staff: {
              ...item.staff,
              disciplineLevel: item.staff.disciplineLevel + 1,
            },
          },
    ),
  }

  return {
    nextState,
    message: `Equipo disciplinario mejorado a nivel ${team.staff.disciplineLevel + 1}.`,
    ok: true,
  }
}

export function setTeamTrainingFocus(
  state: LeagueState,
  managerTeamId: string,
  focus: TrainingFocus,
): LeagueState {
  return {
    ...state,
    teams: state.teams.map((team) =>
      team.id === managerTeamId ? { ...team, trainingFocus: focus } : team,
    ),
  }
}

export function setTeamTactic(
  state: LeagueState,
  managerTeamId: string,
  tactic: Tactic,
): LeagueState {
  return {
    ...state,
    teams: state.teams.map((team) =>
      team.id === managerTeamId ? { ...team, tactic } : team,
    ),
  }
}

export function setStadiumTicketPrice(
  state: LeagueState,
  managerTeamId: string,
  price: number,
): LeagueState {
  const clamped = clamp(Math.round(price), 10, 200)

  return {
    ...state,
    teams: state.teams.map((team) =>
      team.id === managerTeamId
        ? { ...team, stadium: { ...team.stadium, ticketPrice: clamped } }
        : team,
    ),
  }
}

const UPGRADE_SEATS = 5_000
const MAX_CAPACITY = 120_000
const UPGRADE_WEEKS = 4

export function upgradeStadium(
  state: LeagueState,
  managerTeamId: string,
): { nextState: LeagueState; message: string; ok: boolean } {
  const team = state.teams.find((t) => t.id === managerTeamId)

  if (!team) {
    return { nextState: state, message: 'Equipo no encontrado.', ok: false }
  }

  if (team.stadium.capacity >= MAX_CAPACITY) {
    return { nextState: state, message: 'El estadio ha alcanzado la capacidad maxima (120.000 plazas).', ok: false }
  }

  if ((team.stadium.upgradeWeeksRemaining ?? 0) > 0) {
    return { nextState: state, message: 'Ya hay obras en curso en el estadio.', ok: false }
  }

  const upgradeCost = Math.max(5_000_000, Math.round(team.stadium.capacity * 100))

  if (team.budget < upgradeCost) {
    return {
      nextState: state,
      message: `No hay presupuesto para ampliar el estadio. Coste: ${upgradeCost.toLocaleString('es-ES')} €`,
      ok: false,
    }
  }

  return {
    nextState: {
      ...state,
      teams: state.teams.map((t) =>
        t.id !== managerTeamId
          ? t
          : {
              ...t,
              budget: t.budget - upgradeCost,
              stadium: { ...t.stadium, upgradeWeeksRemaining: UPGRADE_WEEKS },
            },
      ),
    },
    message: `Obras iniciadas en ${team.stadium.name}. Finalizarán en ${UPGRADE_WEEKS} semanas.`,
    ok: true,
  }
}

export function submitRenewalOffer(
  state: LeagueState,
  managerTeamId: string,
  playerId: string,
  wageOffer: number,
  contractYears: number,
): { offer: PendingRenewalOffer | null; message: string; ok: boolean } {
  const team = state.teams.find((item) => item.id === managerTeamId)
  const player = team?.players.find((item) => item.id === playerId)

  if (!team || !player) {
    return { offer: null, message: 'Jugador no encontrado.', ok: false }
  }

  const nextWage = Number.isFinite(wageOffer) && wageOffer > 0
    ? Math.round(wageOffer)
    : Math.round(player.wage * 1.08)

  const nextYears = Number.isFinite(contractYears) && contractYears >= 1 && contractYears <= 6
    ? Math.round(contractYears)
    : clamp(player.contractYears + 2, 1, 6)

  const wageRatio = nextWage / Math.max(player.wage, 1)
  if (wageRatio < 0.92) {
    return {
      offer: null,
      message: `${player.name} no aceptará una rebaja salarial importante.`,
      ok: false,
    }
  }

  const signingBonus = Math.round(nextWage * (nextYears >= 4 ? 5 : 3))
  if (team.budget < signingBonus) {
    return {
      offer: null,
      message: `No hay presupuesto suficiente para la prima de firma (${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(signingBonus)}).`,
      ok: false,
    }
  }

  const offer: PendingRenewalOffer = {
    id: `renewal-${playerId}-${state.currentRound}`,
    playerId,
    playerName: player.name,
    wageOffer: nextWage,
    contractYears: nextYears,
    signingBonus,
    createdRound: state.currentRound,
  }

  return {
    offer,
    message: `Oferta de renovación enviada a ${player.name}. Responderá en la próxima jornada.`,
    ok: true,
  }
}

function playerAcceptsRenewal(team: Team, player: Player, wageRatio: number, contractYears: number): boolean {
  const age = estimatePlayerAge(player)
  const role = estimateSquadRole(team, player.id)
  const recentMinutesShare = estimateRecentMinutesShare(team, player, role)

  let chance = 0.50
  if (wageRatio >= 1.20) chance = 0.94
  else if (wageRatio >= 1.15) chance = 0.87
  else if (wageRatio >= 1.08) chance = 0.76
  else if (wageRatio >= 1.00) chance = 0.63
  else chance = 0.42 // 0.92-1.00: risky

  if (player.happiness >= 75) chance += 0.08
  else if (player.happiness < 45) chance -= 0.15

  if (contractYears >= 4) chance += 0.03

  if (age <= 22) {
    chance -= 0.03
    if (wageRatio >= 1.12) chance += 0.04
  } else if (age >= 30 && age <= 33) {
    chance += contractYears >= 3 ? 0.05 : 0.01
  } else if (age >= 34) {
    chance += contractYears <= 2 ? 0.06 : -0.10
  }

  if (player.overall >= 86) chance -= 0.08
  else if (player.overall >= 80) chance -= 0.04
  else if (player.overall <= 70) chance += 0.05

  if (role === 'estrella') {
    chance += wageRatio >= 1.10 ? 0.05 : -0.10
  } else if (role === 'titular') {
    chance += wageRatio >= 1.05 ? 0.03 : -0.04
  } else if (role === 'banquillo') {
    chance += wageRatio >= 1.00 ? 0.07 : -0.03
  }

  if (recentMinutesShare < 0.20) {
    chance += wageRatio >= 1.15 ? 0.05 : -0.14
  } else if (recentMinutesShare < 0.40) {
    chance += wageRatio >= 1.10 ? 0.03 : -0.08
  } else if (recentMinutesShare > 0.82) {
    chance += 0.04
  }

  return Math.random() < Math.min(0.97, Math.max(0.05, chance))
}

export function resolveRenewalOffers(
  state: LeagueState,
  managerTeamId: string,
  pendingOffers: PendingRenewalOffer[],
): { nextState: LeagueState; messages: string[]; resolvedIds: string[] } {
  const dueOffers = pendingOffers.filter((offer) => offer.createdRound < state.currentRound)
  if (dueOffers.length === 0) {
    return { nextState: state, messages: [], resolvedIds: [] }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  const messages: string[] = []
  const resolvedIds: string[] = []
  let currentState = state

  for (const offer of dueOffers) {
    resolvedIds.push(offer.id)
    const currentTeam = currentState.teams.find((t) => t.id === managerTeamId)
    const player = currentTeam?.players.find((p) => p.id === offer.playerId)

    if (!currentTeam || !player) {
      messages.push(`${offer.playerName} ya no está en el equipo. Renovación cancelada.`)
      continue
    }

    if (currentTeam.budget < offer.signingBonus) {
      messages.push(`${player.name} no puede renovar: presupuesto insuficiente para la prima.`)
      continue
    }

    const wageRatio = offer.wageOffer / Math.max(player.wage, 1)
    if (!playerAcceptsRenewal(currentTeam, player, wageRatio, offer.contractYears)) {
      messages.push(`${player.name} rechaza la oferta de renovación.`)
      continue
    }

    const happinessDelta = wageRatio >= 1.15 ? 10 : wageRatio >= 1.05 ? 6 : 3
    const nextHappiness = clamp(player.happiness + happinessDelta, 35, 99)

    currentState = {
      ...currentState,
      news: [
        `Renovado: ${player.name} firma ${offer.contractYears} temporada${offer.contractYears === 1 ? '' : 's'} más.`,
        ...currentState.news,
      ].slice(0, 12),
      teams: currentState.teams.map((t) => {
        if (t.id !== managerTeamId) return t
        return {
          ...t,
          budget: t.budget - offer.signingBonus,
          players: t.players.map((p) =>
            p.id === offer.playerId
              ? {
                  ...p,
                  contractYears: offer.contractYears,
                  wage: offer.wageOffer,
                  happiness: nextHappiness,
                  releaseClause: estimateReleaseClause(
                    { value: p.value, overall: p.overall, wage: offer.wageOffer, contractYears: offer.contractYears },
                    t,
                    nextHappiness,
                  ),
                }
              : p,
          ),
        }
      }),
    }

    messages.push(
      `${player.name} acepta la renovación: ${offer.contractYears} año${offer.contractYears === 1 ? '' : 's'} · ${fmt(offer.wageOffer)}/sem · Prima: ${fmt(offer.signingBonus)}.`,
    )
  }

  return { nextState: currentState, messages, resolvedIds }
}


export function promoteYouthPlayer(
  state: LeagueState,
  managerTeamId: string,
  youthId: string,
): { nextState: LeagueState; message: string; ok: boolean } {
  const team = state.teams.find((item) => item.id === managerTeamId)
  const youth = team?.youthPlayers.find((item) => item.id === youthId)

  if (!team || !youth) {
    return { nextState: state, message: 'Canterano no encontrado.', ok: false }
  }

  if (team.players.length >= 24) {
    return { nextState: state, message: 'Plantilla completa, no se puede promocionar.', ok: false }
  }

  if (youth.overall < 60) {
    return { nextState: state, message: 'Aun no tiene nivel para el primer equipo.', ok: false }
  }

  const promoted = {
    id: `${team.id}-p-${youth.id}`,
    name: youth.name,
    age: youth.age,
    position: youth.position,
    overall: youth.overall,
    value: estimatePlayerValue(youth.overall, team.division, youth.age),
    wage: Math.round(130_000 + youth.overall * 3200),
    releaseClause: 0,
    transferListed: false,
    askingPrice: 0,
    happiness: estimatePlayerHappiness(team, 3, 6),
    stamina: 74,
    form: 68,
    fatigue: 18,
    injuryWeeks: 0,
    suspensionWeeks: 0,
    yellowCards: 0,
    contractYears: 3,
    recentMinutes: [],
  }
  promoted.releaseClause = estimateReleaseClause(promoted, team, promoted.happiness)
  promoted.askingPrice = promoted.releaseClause

  const nextTeams = state.teams.map((item) => {
    if (item.id !== managerTeamId) {
      return item
    }

    return {
      ...item,
      players: [...item.players, promoted],
      youthPlayers: item.youthPlayers.filter((candidate) => candidate.id !== youthId),
      morale: clamp(item.morale + 1, 50, 99),
    }
  })

  return {
    nextState: {
      ...state,
      teams: nextTeams,
      news: [`Canterano promovido: ${youth.name} sube al primer equipo.`, ...state.news].slice(0, 12),
    },
    message: `${youth.name} ya es jugador del primer equipo.`,
    ok: true,
  }
}
