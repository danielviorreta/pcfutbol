import type { LeagueState, Team, TransferTarget } from '../types/game'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function getTransferTargets(
  state: LeagueState,
  managerTeamId: string,
  limit = 20,
): TransferTarget[] {
  return state.teams
    .filter((team) => team.id !== managerTeamId)
    .flatMap((team) =>
      team.players.map((player) => ({
        player,
        sellerTeamId: team.id,
        sellerTeamName: team.name,
        askingPrice: Math.round(player.value * 1.15),
      })),
    )
    .sort((a, b) => b.player.overall - a.player.overall)
    .slice(0, limit)
}

export function buyPlayer(
  state: LeagueState,
  managerTeamId: string,
  playerId: string,
): { nextState: LeagueState; message: string; ok: boolean } {
  const buyer = state.teams.find((team) => team.id === managerTeamId)

  if (!buyer) {
    return {
      nextState: state,
      message: 'No se pudo localizar tu club.',
      ok: false,
    }
  }

  let seller: Team | undefined
  let playerIndex = -1

  for (const team of state.teams) {
    if (team.id === managerTeamId) {
      continue
    }

    const idx = team.players.findIndex((player) => player.id === playerId)
    if (idx >= 0) {
      seller = team
      playerIndex = idx
      break
    }
  }

  if (!seller || playerIndex < 0) {
    return {
      nextState: state,
      message: 'El jugador ya no esta disponible en el mercado.',
      ok: false,
    }
  }

  const player = seller.players[playerIndex]
  const transferredPlayer = {
    ...player,
    contractYears: Math.max(player.contractYears, 2),
    form: Math.max(player.form, 60),
  }
  const price = Math.round(player.value * 1.15)

  if (buyer.budget < price) {
    return {
      nextState: state,
      message: 'No hay presupuesto suficiente para cerrar el traspaso.',
      ok: false,
    }
  }

  if (buyer.players.length >= 24) {
    return {
      nextState: state,
      message: 'Plantilla completa: vende antes de fichar.',
      ok: false,
    }
  }

  const nextTeams = state.teams.map((team) => {
    if (team.id === seller.id) {
      const nextPlayers = team.players.filter((item) => item.id !== player.id)
      return {
        ...team,
        players: nextPlayers,
        budget: team.budget + price,
        morale: clamp(team.morale - 1, 50, 99),
      }
    }

    if (team.id === buyer.id) {
      return {
        ...team,
        players: [...team.players, transferredPlayer],
        budget: team.budget - price,
        morale: clamp(team.morale + 1, 50, 99),
      }
    }

    return team
  })

  return {
    nextState: {
      ...state,
      teams: nextTeams,
      news: [`Fichaje cerrado: ${player.name} llega a ${buyer.name}.`, ...state.news].slice(0, 10),
    },
    message: `Has fichado a ${player.name} por ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)}.`,
    ok: true,
  }
}
