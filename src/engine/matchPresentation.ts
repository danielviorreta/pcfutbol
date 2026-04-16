import { getOperationalCapacity } from './stadium'
import { getLineupIssues, getTeamRatings } from './squad'
import type {
  MatchCommentaryEvent,
  MatchGoalRecord,
  MatchIncidentRecord,
  MatchStats,
  MatchSubstitutionRecord,
  MatchTacticalChangeRecord,
  Player,
  Team,
} from '../types/game'

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function buildLineupWarning(team: Team, lineup: string[]): string | null {
  const issues = getLineupIssues(team, lineup)
  if (issues.length === 0) {
    return null
  }

  const unavailablePlayers = issues
    .filter((issue) => issue.type === 'unavailable-player' && issue.playerName)
    .map((issue) => issue.playerName)

  const messages: string[] = []
  if (issues.some((issue) => issue.type === 'missing-players')) {
    messages.push('tu once titular no tiene 11 jugadores asignados')
  }
  if (issues.some((issue) => issue.type === 'missing-goalkeeper')) {
    messages.push('falta un portero en el once')
  }
  if (unavailablePlayers.length > 0) {
    messages.push(`hay jugadores no disponibles: ${unavailablePlayers.join(', ')}`)
  }

  return `Revisa la alineacion antes de empezar: ${messages.join(' · ')}.`
}

export function buildMatchStats(
  homeTeam: Team,
  awayTeam: Team,
  homeLineup: string[],
  awayLineup: string[],
  homeGoals: number,
  awayGoals: number,
): MatchStats {
  const homeRatings = getTeamRatings(homeTeam, homeLineup)
  const awayRatings = getTeamRatings(awayTeam, awayLineup)
  const homeControl = homeRatings.midfield + homeTeam.morale * 0.35
  const awayControl = awayRatings.midfield + awayTeam.morale * 0.35
  const possessionShare = clamp(homeControl / Math.max(1, homeControl + awayControl), 0.35, 0.65)
  const homePossession = Math.round(possessionShare * 100)
  const awayPossession = 100 - homePossession

  const homeShots = clamp(homeGoals + 5 + Math.round(homeRatings.attack / 18), 4, 22)
  const awayShots = clamp(awayGoals + 5 + Math.round(awayRatings.attack / 18), 4, 22)
  const homeShotsOnTarget = clamp(homeGoals + 2 + Math.round(homeShots * 0.35), homeGoals, homeShots)
  const awayShotsOnTarget = clamp(awayGoals + 2 + Math.round(awayShots * 0.35), awayGoals, awayShots)
  const homeBigChances = clamp(homeGoals + Math.round(homeRatings.attack / 32), 1, 7)
  const awayBigChances = clamp(awayGoals + Math.round(awayRatings.attack / 32), 1, 7)

  const priceEffect = Math.max(0, (homeTeam.stadium.ticketPrice - 35) * 0.005)
  const moraleEffect = (homeTeam.morale - 70) * 0.002
  const opponentStrength = (awayTeam.attack + awayTeam.midfield + awayTeam.defense) / 3
  const importanceEffect = (opponentStrength - 75) * 0.004
  const scoreVariance = (homeGoals + awayGoals - 2) * 0.01
  const fillRate = clamp(0.7 - priceEffect + moraleEffect + importanceEffect + scoreVariance, 0.2, 0.98)

  return {
    home: {
      possession: homePossession,
      shots: homeShots,
      shotsOnTarget: homeShotsOnTarget,
      bigChances: homeBigChances,
    },
    away: {
      possession: awayPossession,
      shots: awayShots,
      shotsOnTarget: awayShotsOnTarget,
      bigChances: awayBigChances,
    },
    attendance: Math.round(getOperationalCapacity(homeTeam.stadium) * fillRate),
  }
}

function pickLineupName(team: Team, lineup: string[], fallbackIndex = 0) {
  return team.players.find((player) => player.id === lineup[fallbackIndex])?.name
    ?? team.players[0]?.name
    ?? team.name
}

function getLineupPlayers(team: Team, lineup: string[]): Player[] {
  return lineup
    .map((playerId) => team.players.find((player) => player.id === playerId))
    .filter((player): player is Player => Boolean(player))
}

function getAttackingPool(team: Team, lineup: string[]): Player[] {
  const players = getLineupPlayers(team, lineup)
  const forwards = players.filter((player) => player.position === 'FWD')
  const midfielders = players.filter((player) => player.position === 'MID')
  const defenders = players.filter((player) => player.position === 'DEF')
  const goalkeepers = players.filter((player) => player.position === 'GK')

  return [...forwards, ...forwards, ...midfielders, ...midfielders, ...defenders, ...goalkeepers]
}

function getSupportPool(team: Team, lineup: string[], scorerName?: string): Player[] {
  return getLineupPlayers(team, lineup)
    .filter((player) => player.name !== scorerName)
    .sort((a, b) => {
      const weight = (player: Player) =>
        player.position === 'MID' ? 3 : player.position === 'FWD' ? 2 : player.position === 'DEF' ? 1 : 0

      return weight(b) - weight(a)
    })
}

function buildGoalMinutes(totalGoals: number) {
  const baseMinutes = [12, 24, 37, 54, 68, 83]
  return baseMinutes.slice(0, totalGoals).map((minute, index) => minute + index)
}

export function buildGoalRecords(
  team: Team,
  lineup: string[],
  totalGoals: number,
  teamId: string,
  minuteOffset = 0,
): MatchGoalRecord[] {
  const minutes = buildGoalMinutes(totalGoals).map((minute) => minute + minuteOffset)
  const attackers = getAttackingPool(team, lineup)

  return minutes.map((minute, index) => {
    const scorer = attackers[index % Math.max(attackers.length, 1)]?.name ?? pickLineupName(team, lineup, 8)
    const supportPool = getSupportPool(team, lineup, scorer)
    const assist = supportPool[index % Math.max(supportPool.length, 1)]?.name

    return {
      minute,
      teamId,
      scorer,
      assist,
    }
  })
}

function buildTeamIncidents(teamBefore: Team, teamAfter: Team, teamId: string): MatchIncidentRecord[] {
  const minutePool = [19, 33, 47, 62, 71, 79, 86]
  const incidents: MatchIncidentRecord[] = []
  let incidentIndex = 0

  teamBefore.players.forEach((beforePlayer) => {
    const afterPlayer = teamAfter.players.find((player) => player.id === beforePlayer.id)
    if (!afterPlayer) {
      return
    }

    const nextMinute = () => minutePool[Math.min(incidentIndex++, minutePool.length - 1)]
    const bookedByAccumulation = beforePlayer.yellowCards === 4 && afterPlayer.suspensionWeeks > beforePlayer.suspensionWeeks
    const gainedYellow = afterPlayer.yellowCards > beforePlayer.yellowCards || bookedByAccumulation

    if (gainedYellow) {
      incidents.push({
        minute: nextMinute(),
        teamId,
        player: beforePlayer.name,
        type: 'yellow',
      })
    }

    if (afterPlayer.suspensionWeeks > beforePlayer.suspensionWeeks && beforePlayer.yellowCards < 4) {
      incidents.push({
        minute: nextMinute(),
        teamId,
        player: beforePlayer.name,
        type: 'red',
        detail: 'Terminara suspendido para la proxima jornada.',
      })
    }

    if (afterPlayer.injuryWeeks > beforePlayer.injuryWeeks) {
      incidents.push({
        minute: nextMinute(),
        teamId,
        player: beforePlayer.name,
        type: 'injury',
        detail: `${afterPlayer.injuryWeeks} semana${afterPlayer.injuryWeeks === 1 ? '' : 's'} de baja`,
      })
    }
  })

  return incidents
}

export function buildMatchIncidents(
  homeTeamBefore: Team,
  awayTeamBefore: Team,
  homeTeamAfter: Team,
  awayTeamAfter: Team,
): MatchIncidentRecord[] {
  return [
    ...buildTeamIncidents(homeTeamBefore, homeTeamAfter, homeTeamBefore.id),
    ...buildTeamIncidents(awayTeamBefore, awayTeamAfter, awayTeamBefore.id).map((incident, index) => ({
      ...incident,
      minute: incident.minute + (index % 2 === 0 ? 3 : 1),
    })),
  ].sort((a, b) => a.minute - b.minute)
}

function buildTeamSubstitutions(team: Team, lineup: string[], incidents: MatchIncidentRecord[]): MatchSubstitutionRecord[] {
  const lineupPlayers = getLineupPlayers(team, lineup)
  const lineupIds = new Set(lineup)
  const bench = team.players.filter((player) => !lineupIds.has(player.id))
  const usedOut = new Set<string>()
  const substitutions: MatchSubstitutionRecord[] = []

  const injuryIncidents = incidents.filter((incident) => incident.teamId === team.id && incident.type === 'injury')
  injuryIncidents.forEach((incident) => {
    const replacement = bench.find((candidate) => !substitutions.some((sub) => sub.playerIn === candidate.name))
    if (!replacement || usedOut.has(incident.player)) {
      return
    }

    substitutions.push({
      minute: clamp(incident.minute + 1, 1, 90),
      teamId: team.id,
      playerOut: incident.player,
      playerIn: replacement.name,
      reason: 'injury',
    })
    usedOut.add(incident.player)
  })

  const fatigueCandidate = [...lineupPlayers]
    .filter((player) => !usedOut.has(player.name))
    .sort((a, b) => (b.fatigue + (100 - b.stamina) * 0.4) - (a.fatigue + (100 - a.stamina) * 0.4))[0]
  const fatigueReplacement = bench.find((candidate) => !substitutions.some((sub) => sub.playerIn === candidate.name))

  if (fatigueCandidate && fatigueReplacement) {
    substitutions.push({
      minute: 67,
      teamId: team.id,
      playerOut: fatigueCandidate.name,
      playerIn: fatigueReplacement.name,
      reason: 'fatigue',
    })
    usedOut.add(fatigueCandidate.name)
  }

  const tacticalOut = lineupPlayers.find((player) => !usedOut.has(player.name) && player.position !== 'GK')
  const tacticalIn = bench.find(
    (candidate) =>
      !substitutions.some((sub) => sub.playerIn === candidate.name) &&
      (tacticalOut ? candidate.position === tacticalOut.position || candidate.position === 'FWD' : true),
  )

  if (tacticalOut && tacticalIn) {
    substitutions.push({
      minute: 76,
      teamId: team.id,
      playerOut: tacticalOut.name,
      playerIn: tacticalIn.name,
      reason: 'tactical',
    })
  }

  return substitutions.sort((a, b) => a.minute - b.minute)
}

export function buildMatchSubstitutions(
  homeTeam: Team,
  awayTeam: Team,
  homeLineup: string[],
  awayLineup: string[],
  incidents: MatchIncidentRecord[],
): MatchSubstitutionRecord[] {
  return [
    ...buildTeamSubstitutions(homeTeam, homeLineup, incidents),
    ...buildTeamSubstitutions(awayTeam, awayLineup, incidents).map((sub) => ({
      ...sub,
      minute: clamp(sub.minute + 2, 1, 90),
    })),
  ].sort((a, b) => a.minute - b.minute)
}

export function buildMatchTacticalChanges(
  homeTeam: Team,
  awayTeam: Team,
  homeGoals: number,
  awayGoals: number,
): MatchTacticalChangeRecord[] {
  const homeLosing = homeGoals < awayGoals
  const awayLosing = awayGoals < homeGoals

  const homeSummary = homeLosing
    ? 'Ajuste ofensivo: bloque mas alto y extremos muy abiertos para buscar el empate.'
    : homeGoals > awayGoals
      ? 'Ajuste conservador: lineas juntas y prioridad al orden defensivo.'
      : 'Ajuste de mediocampo: mas pausa para controlar el ritmo.'

  const awaySummary = awayLosing
    ? 'Ajuste ofensivo: presion tras perdida y laterales lanzados al ataque.'
    : awayGoals > homeGoals
      ? 'Ajuste conservador: repliegue medio y transiciones rapidas.'
      : 'Ajuste de mediocampo: circulacion corta y control de segundas jugadas.'

  return [
    { minute: 58, teamId: homeTeam.id, summary: homeSummary },
    { minute: 63, teamId: awayTeam.id, summary: awaySummary },
  ]
}

export function buildMatchCommentary(
  homeTeam: Team,
  awayTeam: Team,
  homeGoals: number,
  awayGoals: number,
  stats: MatchStats,
  goals: MatchGoalRecord[],
  incidents: MatchIncidentRecord[],
  substitutions: MatchSubstitutionRecord[],
  tacticalChanges: MatchTacticalChangeRecord[],
): MatchCommentaryEvent[] {
  const events: MatchCommentaryEvent[] = [
    {
      minute: 1,
      kind: 'general',
      text: `Arranca el partido en ${homeTeam.stadium.name}. ${homeTeam.name} busca imponer su ritmo desde el inicio.`,
    },
    {
      minute: 7,
      kind: 'general',
      text: `${homeTeam.name} y ${awayTeam.name} comienzan con ritmo alto y mucha presion sobre la salida de balon.`,
    },
    {
      minute: 14,
      kind: 'general',
      text: `Primer tramo intenso: ${homeTeam.name} remata ${stats.home.shotsOnTarget} veces a puerta frente a ${stats.away.shotsOnTarget} de ${awayTeam.name} al final del partido.`,
    },
  ]

  let scoreHome = 0
  let scoreAway = 0

  goals.forEach((goal) => {
    const teamName = goal.teamId === homeTeam.id ? homeTeam.name : awayTeam.name
    const assistText = goal.assist ? `, asistencia de ${goal.assist}` : ''
    if (goal.teamId === homeTeam.id) {
      scoreHome += 1
    } else {
      scoreAway += 1
    }

    events.push({
      minute: goal.minute,
      kind: 'goal',
      teamId: goal.teamId,
      scoreHome,
      scoreAway,
      text: `Gol de ${teamName}. Marca ${goal.scorer}${assistText}.`,
    })
  })

  incidents.forEach((incident) => {
    const teamName = incident.teamId === homeTeam.id ? homeTeam.name : awayTeam.name

    if (incident.type === 'yellow') {
      events.push({
        minute: incident.minute,
        kind: 'incident',
        teamId: incident.teamId,
        text: `Amarilla para ${incident.player} en ${teamName}. Llega tarde al cruce y el arbitro no duda.`,
      })
      return
    }

    if (incident.type === 'red') {
      events.push({
        minute: incident.minute,
        kind: 'incident',
        teamId: incident.teamId,
        text: `Tarjeta roja para ${incident.player} en ${teamName}. ${incident.detail ?? 'El equipo queda condicionado.'}`,
      })
      return
    }

    events.push({
      minute: incident.minute,
      kind: 'incident',
      teamId: incident.teamId,
      text: `${incident.player} no puede seguir en ${teamName}. ${incident.detail ?? 'Se marcha tocado tras una accion dura.'}`,
    })
  })

  substitutions.forEach((substitution) => {
    const teamName = substitution.teamId === homeTeam.id ? homeTeam.name : awayTeam.name
    const reasonText = substitution.reason === 'injury'
      ? 'por lesion'
      : substitution.reason === 'fatigue'
        ? 'por fatiga'
        : 'ajuste tactico'

    events.push({
      minute: substitution.minute,
      kind: 'substitution',
      teamId: substitution.teamId,
      text: `Cambio en ${teamName}: entra ${substitution.playerIn} por ${substitution.playerOut} (${reasonText}).`,
    })
  })

  tacticalChanges.forEach((change) => {
    const teamName = change.teamId === homeTeam.id ? homeTeam.name : awayTeam.name
    events.push({
      minute: change.minute,
      kind: 'tactical',
      teamId: change.teamId,
      text: `${teamName} modifica su planteamiento. ${change.summary}`,
    })
  })

  events.push({
    minute: 45,
    kind: 'general',
    text: `Descanso: ${homeTeam.name} ${homeGoals > awayGoals ? 'manda' : awayGoals > homeGoals ? 'sufre' : 'iguala'} un partido con ${stats.home.possession}% de posesion local.`,
  })
  events.push({
    minute: 61,
    kind: 'general',
    text: `La posesion marca diferencias: ${homeTeam.name} maneja el ${stats.home.possession}% por el ${stats.away.possession}% de ${awayTeam.name}.`,
  })
  events.push({
    minute: 74,
    kind: 'general',
    text: `Las ocasiones claras van ${stats.home.bigChances}-${stats.away.bigChances}. El partido sigue completamente abierto.`,
  })
  events.push({
    minute: 88,
    kind: 'general',
    text: `La asistencia oficial es de ${stats.attendance.toLocaleString('es-ES')} espectadores. El ambiente aprieta en el tramo final.`,
  })
  events.push({
    minute: 90,
    kind: 'final',
    scoreHome: homeGoals,
    scoreAway: awayGoals,
    text: `Final del encuentro: ${homeTeam.name} ${homeGoals}-${awayGoals} ${awayTeam.name}.`,
  })

  return events.sort((a, b) => a.minute - b.minute)
}
