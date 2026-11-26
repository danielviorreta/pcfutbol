/** Youth academy promotions. */
import { estimatePlayerHappiness, estimatePlayerValue, estimateReleaseClause } from '../playerMarket'
import { clamp } from './helpers'
import type { LeagueState } from '../../types/game'

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
