/** Club settings: staff, training focus, tactic, ticket price and stadium. */
import { clamp, MAX_CAPACITY, UPGRADE_WEEKS } from './helpers'
import type { LeagueState, Tactic, TrainingFocus } from '../../types/game'

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
