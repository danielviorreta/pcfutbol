import {
  assessClubSaleDecision,
  assessTransferDecision,
  estimateReleaseClause,
  getClubAppeal,
  getRecommendedContractYears,
  getRecommendedPromisedRole,
  getRecommendedSigningBonus,
  getRecommendedWageOffer,
} from './playerMarket'
import type { IncomingTransferOffer, LeagueState, PromisedRole, Team, TransferTarget } from '../types/game'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

interface TransferOffer {
  feeOffer?: number
  wageOffer: number
  signingBonus: number
  contractYears: number
  promisedRole: PromisedRole
}

interface TransferExecutionResult {
  nextState: LeagueState
  message: string
  ok: boolean
  headline?: string
}

function getTransferFee(player: Team['players'][number]): number {
  return player.transferListed
    ? Math.max(100_000, Math.round(player.askingPrice))
    : player.releaseClause
}

function findTransferParties(state: LeagueState, managerTeamId: string, playerId: string): { buyer: Team; seller: Team; playerIndex: number } | null {
  const buyer = state.teams.find((team) => team.id === managerTeamId)

  if (!buyer) {
    return null
  }

  for (const team of state.teams) {
    if (team.id === managerTeamId) {
      continue
    }

    const idx = team.players.findIndex((player) => player.id === playerId)
    if (idx >= 0) {
      return { buyer, seller: team, playerIndex: idx }
    }
  }

  return null
}

function executeTransfer(
  state: LeagueState,
  buyerId: string,
  playerId: string,
  offer: TransferOffer,
): TransferExecutionResult {
  const parties = findTransferParties(state, buyerId, playerId)

  if (!parties) {
    return {
      nextState: state,
      message: 'El jugador ya no esta disponible en el mercado.',
      ok: false,
    }
  }

  const { buyer, seller, playerIndex } = parties
  const player = seller.players[playerIndex]
  const marketPrice = getTransferFee(player)
  const offeredFee = Number.isFinite(offer.feeOffer) && (offer.feeOffer as number) > 0
    ? Math.round(offer.feeOffer as number)
    : marketPrice
  const price = offeredFee
  const totalImmediateCost = price + offer.signingBonus
  const decision = assessTransferDecision(player, buyer, seller, offer)

  if (offeredFee < marketPrice) {
    const clubDecision = assessClubSaleDecision(player, marketPrice, offeredFee)
    if (!clubDecision.accepted) {
      return {
        nextState: state,
        message: `${seller.name} rechaza la oferta de traspaso. ${clubDecision.reason}`,
        ok: false,
      }
    }
  }

  if (!Number.isFinite(offer.wageOffer) || offer.wageOffer <= 0) {
    return {
      nextState: state,
      message: 'La oferta salarial no es valida.',
      ok: false,
    }
  }

  if (!Number.isFinite(offer.signingBonus) || offer.signingBonus < 0) {
    return {
      nextState: state,
      message: 'La prima de fichaje no es valida.',
      ok: false,
    }
  }

  if (offer.contractYears < 2 || offer.contractYears > 5) {
    return {
      nextState: state,
      message: 'La duracion del contrato debe estar entre 2 y 5 anos.',
      ok: false,
    }
  }

  if (buyer.budget < totalImmediateCost) {
    return {
      nextState: state,
      message: `No hay presupuesto suficiente para pagar ${offeredFee < marketPrice ? 'el traspaso ofrecido' : player.transferListed ? 'traspaso' : 'clausula'} y prima.`,
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

  if (!decision.accepted) {
    return {
      nextState: state,
      message: `${player.name} rechaza la oferta. ${decision.reason}`,
      ok: false,
    }
  }

  const transferredPlayer = {
    ...player,
    wage: Math.round(offer.wageOffer),
    happiness: clamp(64 + Math.round((decision.score - 50) * 0.8), 52, 95),
    contractYears: offer.contractYears,
    transferListed: false,
    form: Math.max(player.form, 60),
  }
  transferredPlayer.releaseClause = estimateReleaseClause(transferredPlayer, buyer, transferredPlayer.happiness)
  transferredPlayer.askingPrice = transferredPlayer.releaseClause

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
        budget: team.budget - totalImmediateCost,
        morale: clamp(team.morale + 1, 50, 99),
      }
    }

    return team
  })

  const headline = `Mercado: ${player.name} deja ${seller.name} y firma por ${buyer.name}.`

  return {
    nextState: {
      ...state,
      teams: nextTeams,
      news: [headline, ...state.news].slice(0, 12),
    },
    headline,
    message: `Has fichado a ${player.name} pagando ${formatCurrency(price)} ${offeredFee < marketPrice ? '(oferta al club)' : player.transferListed ? 'de traspaso' : 'de clausula'}, ${formatCurrency(offer.signingBonus)} de prima y ${formatCurrency(offer.wageOffer)} de salario con contrato de ${offer.contractYears} anos.`,
    ok: true,
  }
}

export function getTransferTargets(
  state: LeagueState,
  managerTeamId: string,
  limit = 20,
): TransferTarget[] {
  const buyer = state.teams.find((team) => team.id === managerTeamId)
  if (!buyer) {
    return []
  }

  return state.teams
    .filter((team) => team.id !== managerTeamId)
    .flatMap((team) =>
      team.players.map((player) => {
        const preview = assessTransferDecision(
          player,
          buyer,
          team,
          {
            wageOffer: getRecommendedWageOffer(player, buyer, team),
            signingBonus: getRecommendedSigningBonus(player, buyer, team),
            contractYears: getRecommendedContractYears(player),
            promisedRole: getRecommendedPromisedRole(player, buyer),
          },
        )

        return {
          player,
          sellerTeamId: team.id,
          sellerTeamName: team.name,
          sellerDivision: team.division,
          sellerGroup: team.group,
          marketPrice: getTransferFee(player),
          isTransferListed: player.transferListed,
          releaseClause: player.releaseClause,
          recommendedWage: preview.requiredWage,
          recommendedSigningBonus: preview.requiredSigningBonus,
          recommendedContractYears: preview.suggestedContractYears,
          recommendedPromisedRole: preview.suggestedPromisedRole,
          interestLabel: preview.interestLabel,
        }
      }),
    )
    .sort((a, b) => {
      if (a.isTransferListed !== b.isTransferListed) {
        return a.isTransferListed ? -1 : 1
      }

      return b.player.overall - a.player.overall
    })
    .slice(0, limit)
}

export function buyPlayer(
  state: LeagueState,
  managerTeamId: string,
  playerId: string,
  wageOffer: number,
  signingBonus: number,
  contractYears: number,
  promisedRole: PromisedRole,
  feeOffer?: number,
): { nextState: LeagueState; message: string; ok: boolean } {
  return executeTransfer(state, managerTeamId, playerId, {
    feeOffer,
    wageOffer,
    signingBonus,
    contractYears,
    promisedRole,
  })
}

export function acceptIncomingTransferOffer(
  state: LeagueState,
  offer: IncomingTransferOffer,
): { nextState: LeagueState; message: string; ok: boolean } {
  return executeTransfer(state, offer.buyerTeamId, offer.playerId, {
    wageOffer: offer.wageOffer,
    signingBonus: offer.signingBonus,
    contractYears: offer.contractYears,
    promisedRole: offer.promisedRole,
  })
}

export function setPlayerTransferStatus(
  state: LeagueState,
  managerTeamId: string,
  playerId: string,
  transferListed: boolean,
  askingPrice?: number,
): { nextState: LeagueState; message: string; ok: boolean } {
  const managerTeam = state.teams.find((team) => team.id === managerTeamId)
  if (!managerTeam) {
    return {
      nextState: state,
      message: 'No se encontro el club del manager.',
      ok: false,
    }
  }

  const player = managerTeam.players.find((item) => item.id === playerId)
  if (!player) {
    return {
      nextState: state,
      message: 'No se encontro el jugador seleccionado.',
      ok: false,
    }
  }

  const nextAskingPrice = transferListed
    ? Math.max(100_000, Math.round(Number.isFinite(askingPrice) ? askingPrice ?? player.releaseClause : player.releaseClause))
    : player.releaseClause

  const nextTeams = state.teams.map((team) => {
    if (team.id !== managerTeamId) {
      return team
    }

    return {
      ...team,
      players: team.players.map((item) =>
        item.id === playerId
          ? {
              ...item,
              transferListed,
              askingPrice: nextAskingPrice,
            }
          : item,
      ),
    }
  })

  return {
    nextState: {
      ...state,
      teams: nextTeams,
    },
    message: transferListed
      ? `${player.name} esta en venta por ${formatCurrency(nextAskingPrice)}.`
      : `${player.name} ya no esta en venta.`,
    ok: true,
  }
}

function isTransferWindow(round: number, totalRounds: number): boolean {
  const midSeasonRound = Math.floor(totalRounds / 2)
  return round <= 4 || (round >= midSeasonRound - 1 && round <= midSeasonRound + 2)
}

function refreshAiTransferListings(
  state: LeagueState,
  managerTeamId: string,
): { nextState: LeagueState; headlines: string[] } {
  const headlines: string[] = []

  const nextTeams = state.teams.map((team) => {
    if (team.id === managerTeamId) {
      return team
    }

    const teamAverage = (team.attack + team.midfield + team.defense) / 3
    let listedCount = 0
    let newListings = 0

    const players = team.players.map((player) => {
      if (player.transferListed) {
        listedCount += 1

        const shouldDelist =
          player.contractYears >= 3
          && player.happiness >= 72
          && player.overall >= teamAverage
          && Math.random() < 0.16

        if (!shouldDelist) {
          return player
        }

        listedCount = Math.max(0, listedCount - 1)
        return {
          ...player,
          transferListed: false,
          askingPrice: player.releaseClause,
        }
      }

      const shortContract = player.contractYears <= 1
      const unhappy = player.happiness <= 60
      const expendable = player.overall <= teamAverage - 1
      const veteran = typeof player.age === 'number' ? player.age >= 31 : false

      if (!shortContract && !unhappy && !expendable && !veteran) {
        return player
      }

      if (listedCount >= 4 && !shortContract && !unhappy) {
        return player
      }

      let listingChance = 0.05
      if (shortContract) {
        listingChance += 0.24
      }
      if (unhappy) {
        listingChance += 0.18
      }
      if (expendable) {
        listingChance += 0.1
      }
      if (veteran) {
        listingChance += 0.06
      }
      if (player.overall >= teamAverage + 5 && !shortContract && !unhappy) {
        listingChance -= 0.12
      }

      if (Math.random() >= clamp(listingChance, 0.03, 0.55)) {
        return player
      }

      listedCount += 1
      newListings += 1

      const saleFactor = shortContract ? 0.72 : unhappy ? 0.78 : 0.84

      return {
        ...player,
        transferListed: true,
        askingPrice: Math.max(150_000, Math.round(player.releaseClause * saleFactor)),
      }
    })

    if (newListings > 0) {
      headlines.push(`Mercado: ${team.name} coloca ${newListings} jugador${newListings === 1 ? '' : 'es'} en venta.`)
    }

    return {
      ...team,
      players,
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

export function simulateAiTransferWindow(
  state: LeagueState,
  managerTeamId: string,
  existingIncomingOffers: IncomingTransferOffer[] = [],
): { nextState: LeagueState; headlines: string[]; incomingOffers: IncomingTransferOffer[] } {
  const listingUpdate = refreshAiTransferListings(state, managerTeamId)

  if (!isTransferWindow(state.currentRound, state.totalRounds)) {
    return { nextState: listingUpdate.nextState, headlines: listingUpdate.headlines, incomingOffers: [] }
  }

  let workingState = listingUpdate.nextState
  const headlines: string[] = [...listingUpdate.headlines]
  const incomingOffers: IncomingTransferOffer[] = []
  const maxTransfers = Math.random() > 0.72 ? 2 : 1
  const existingOfferKeys = new Set(existingIncomingOffers.map((offer) => `${offer.buyerTeamId}:${offer.playerId}`))

  for (let transferIndex = 0; transferIndex < maxTransfers; transferIndex += 1) {
    if (Math.random() > 0.42) {
      continue
    }

    const buyers = [...workingState.teams]
      .filter((team) => team.id !== managerTeamId && team.players.length < 24 && team.budget > 8_000_000)
      .sort((a, b) => getClubAppeal(b) - getClubAppeal(a))

    const buyer = buyers.find(() => Math.random() > 0.18)
    if (!buyer) {
      continue
    }

    const candidates = workingState.teams
      .filter((seller) => seller.id !== buyer.id && seller.players.length > 18)
      .flatMap((seller) =>
        seller.players.map((player) => {
          const appealDelta = getClubAppeal(buyer) - getClubAppeal(seller)
          const recommendedWage = getRecommendedWageOffer(player, buyer, seller)
          const recommendedSigningBonus = getRecommendedSigningBonus(player, buyer, seller)
          const transferFee = getTransferFee(player)
          const totalCost = transferFee + recommendedSigningBonus
          const score = player.overall * 1.4 + Math.max(0, 72 - player.happiness) + appealDelta * 1.3 - totalCost / 1_000_000

          return {
            seller,
            player,
            score,
            transferFee,
            recommendedWage,
            recommendedSigningBonus,
          }
        }),
      )
      .filter((item) => item.transferFee + item.recommendedSigningBonus <= buyer.budget * 0.55)
      .sort((a, b) => b.score - a.score)

    const target = candidates[0]
    if (!target) {
      continue
    }

    const offer: TransferOffer = {
      wageOffer: target.recommendedWage,
      signingBonus: target.recommendedSigningBonus,
      contractYears: getRecommendedContractYears(target.player),
      promisedRole: getRecommendedPromisedRole(target.player, buyer),
    }

    if (target.seller.id === managerTeamId) {
      const offerKey = `${buyer.id}:${target.player.id}`
      if (existingOfferKeys.has(offerKey)) {
        continue
      }

      const preview = assessTransferDecision(target.player, buyer, target.seller, offer)
      if (!preview.accepted && preview.score < 43) {
        continue
      }

      existingOfferKeys.add(offerKey)
      incomingOffers.push({
        id: `offer-${buyer.id}-${target.player.id}-${state.currentRound}`,
        buyerTeamId: buyer.id,
        buyerTeamName: buyer.name,
        playerId: target.player.id,
        playerName: target.player.name,
        transferFee: target.transferFee,
        releaseClause: target.player.releaseClause,
        wageOffer: offer.wageOffer,
        signingBonus: offer.signingBonus,
        contractYears: offer.contractYears,
        promisedRole: offer.promisedRole,
        createdRound: state.currentRound,
      })
      headlines.push(`Oferta recibida: ${buyer.name} quiere fichar a ${target.player.name}.`)
      continue
    }

    const result = executeTransfer(workingState, buyer.id, target.player.id, offer)
    if (!result.ok) {
      continue
    }

    workingState = result.nextState
    if (result.headline) {
      headlines.push(result.headline)
    }
  }

  return { nextState: workingState, headlines, incomingOffers }
}

export function simulateAiContractRenewals(
  state: LeagueState,
  managerTeamId: string,
): { nextState: LeagueState; headlines: string[] } {
  const headlines: string[] = []

  const nextTeams = state.teams.map((team) => {
    if (team.id === managerTeamId) {
      return team
    }

    let budget = team.budget
    let changed = false

    const players = team.players.map((player) => {
      const teamAverage = (team.attack + team.midfield + team.defense) / 3
      const shouldRenew =
        player.contractYears <= 1
        && player.overall >= teamAverage - 2
        && budget > player.wage * 2.2
        && (player.happiness >= 60 || player.overall >= teamAverage + 4)
        && Math.random() > 0.38

      if (!shouldRenew) {
        return player
      }

      const nextContractYears = clamp(player.contractYears + 2, 2, 5)
      const nextWage = Math.round(player.wage * 1.1)
      const renewalCost = Math.round(nextWage * 0.6)

      if (budget < renewalCost) {
        return player
      }

      budget -= renewalCost
      changed = true
      const nextHappiness = clamp(player.happiness + 6, 35, 99)
      headlines.push(`Renovacion: ${team.name} blinda a ${player.name}.`)

      return {
        ...player,
        wage: nextWage,
        contractYears: nextContractYears,
        happiness: nextHappiness,
        releaseClause: estimateReleaseClause(
          {
            value: player.value,
            overall: player.overall,
            wage: nextWage,
            contractYears: nextContractYears,
          },
          team,
          nextHappiness,
        ),
      }
    })

    return changed
      ? {
          ...team,
          budget,
          players,
        }
      : team
  })

  return {
    nextState: {
      ...state,
      teams: nextTeams,
    },
    headlines,
  }
}
