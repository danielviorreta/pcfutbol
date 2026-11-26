/** Contract renewals for the manager team. */
import { random } from '../random'
import { estimateReleaseClause } from '../playerMarket'
import { clamp, estimatePlayerAge, estimateSquadRole, estimateRecentMinutesShare } from './helpers'
import type { LeagueState, PendingRenewalOffer, Player, Team } from '../../types/game'

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

  return random() < Math.min(0.97, Math.max(0.05, chance))
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
