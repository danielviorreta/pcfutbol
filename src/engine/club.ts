import type { LeagueState, Position, Tactic, Team, TrainingFocus } from '../types/game'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function weeklyPayroll(team: Team): number {
  return team.players.reduce((sum, player) => sum + player.wage, 0) / 52
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

    const baseGrowth = growthRoll > 0.86 ? 1 : 0
    const overall = clamp(player.overall + baseGrowth + focusBonus, 50, 95)

    const value = Math.round(overall * overall * 14_500)

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

export function applyWeeklyClubManagement(
  state: LeagueState,
  _managerTeamId?: string,
): { nextState: LeagueState; headlines: string[] } {
  const standings = buildStandingsIndex(state.teams)
  const isSeasonOver = state.currentRound > state.totalRounds

  const headlines: string[] = []

  const nextTeams = state.teams.map((team) => {
    const payroll = Math.round(weeklyPayroll(team))
    let budget = team.budget + team.sponsor.weeklyIncome - payroll

    let sponsor = { ...team.sponsor }
    const rank = standings.get(team.id) ?? 99

    if (isSeasonOver && !sponsor.seasonBonusPaid && rank <= sponsor.targetRank) {
      budget += sponsor.seasonBonus
      sponsor = { ...sponsor, seasonBonusPaid: true }
      headlines.push(`${team.name} cobra bonus del sponsor (${sponsor.name}).`)
    }

    const trained = applyTrainingToTeam(team)

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

  return {
    nextState: {
      ...state,
      teams: nextTeams,
    },
    headlines,
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

export function renewPlayerContract(
  state: LeagueState,
  managerTeamId: string,
  playerId: string,
): { nextState: LeagueState; message: string; ok: boolean } {
  const team = state.teams.find((item) => item.id === managerTeamId)
  const player = team?.players.find((item) => item.id === playerId)

  if (!team || !player) {
    return { nextState: state, message: 'Jugador no encontrado.', ok: false }
  }

  const signingBonus = Math.round(player.wage * 8)

  if (team.budget < signingBonus) {
    return {
      nextState: state,
      message: 'No hay presupuesto para renovar el contrato.',
      ok: false,
    }
  }

  const nextTeams = state.teams.map((item) => {
    if (item.id !== managerTeamId) {
      return item
    }

    return {
      ...item,
      budget: item.budget - signingBonus,
      players: item.players.map((candidate) =>
        candidate.id === playerId
          ? {
              ...candidate,
              contractYears: clamp(candidate.contractYears + 2, 1, 6),
              wage: Math.round(candidate.wage * 1.08),
            }
          : candidate,
      ),
    }
  })

  return {
    nextState: {
      ...state,
      teams: nextTeams,
      news: [`Renovado: ${player.name} firma dos temporadas mas.`, ...state.news].slice(0, 12),
    },
    message: `Contrato renovado para ${player.name}.`,
    ok: true,
  }
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
    position: youth.position,
    overall: youth.overall,
    value: Math.round(youth.overall * youth.overall * 13_500),
    wage: Math.round(130_000 + youth.overall * 3200),
    stamina: 74,
    form: 68,
    fatigue: 18,
    injuryWeeks: 0,
    suspensionWeeks: 0,
    contractYears: 3,
  }

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
