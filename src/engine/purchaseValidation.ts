import { getTeamBudget } from './finance'
import type {
  LeagueState,
  PendingOutgoingTransferOffer,
  PromisedRole,
  Team,
  Player,
} from '../types/game'

export interface PlayerPurchaseValidation {
  valid: boolean
  error?: string
  sellerTeam?: Team
  player?: Player
}

export interface TransferFeeCalculation {
  transferFee: number
  totalCost: number
}

export interface BudgetValidation {
  sufficient: boolean
  budget: number
  required: number
}

/**
 * Validates that a player purchase offer is not already pending for the given player.
 */
export function validateNoPendingOffer(
  playerId: string,
  pendingOutgoing: PendingOutgoingTransferOffer[],
): { valid: boolean; error?: string } {
  if (pendingOutgoing.some((o) => o.playerId === playerId)) {
    return {
      valid: false,
      error: 'Ya hay una oferta pendiente para este jugador.',
    }
  }
  return { valid: true }
}

/**
 * Finds the selling team and player in the league state.
 */
export function validatePlayerAvailability(
  playerId: string,
  leagueState: LeagueState,
  managerTeamId: string,
): PlayerPurchaseValidation {
  const sellerTeam = leagueState.teams.find(
    (team) =>
      team.id !== managerTeamId && team.players.some((p) => p.id === playerId),
  )

  if (!sellerTeam) {
    return {
      valid: false,
      error: 'El jugador ya no está disponible.',
    }
  }

  const player = sellerTeam.players.find((p) => p.id === playerId)
  if (!player) {
    return {
      valid: false,
      error: 'El jugador ya no está disponible.',
    }
  }

  return {
    valid: true,
    sellerTeam,
    player,
  }
}

/**
 * Calculates the effective transfer fee based on player status.
 * If player is transfer listed, uses asking price; otherwise uses release clause.
 * feeOffer overrides both if provided.
 */
export function calculateTransferFee(
  player: Player,
  signingBonus: number,
  feeOffer?: number,
): TransferFeeCalculation {
  const transferFee =
    feeOffer ??
    (player.transferListed
      ? Math.max(100_000, Math.round(player.askingPrice))
      : player.releaseClause)

  const totalCost = transferFee + signingBonus
  return { transferFee, totalCost }
}

/**
 * Validates that the manager has sufficient budget for the purchase.
 */
export function validateBudgetSufficiency(
  leagueState: LeagueState,
  managerTeamId: string,
  requiredBudget: number,
): BudgetValidation {
  const budget = getTeamBudget(leagueState.teams, managerTeamId)
  return {
    sufficient: budget >= requiredBudget,
    budget,
    required: requiredBudget,
  }
}

/**
 * Builds the pending outgoing transfer offer object.
 */
export function buildPendingTransferOffer(
  playerId: string,
  playerName: string,
  sellerTeamId: string,
  sellerTeamName: string,
  transferFee: number,
  wageOffer: number,
  signingBonus: number,
  contractYears: number,
  promisedRole: PromisedRole,
  currentRound: number,
): PendingOutgoingTransferOffer {
  return {
    id: `out-${playerId}-${currentRound}`,
    playerId,
    playerName,
    sellerTeamId,
    sellerTeamName,
    transferFee,
    wageOffer,
    signingBonus,
    contractYears,
    promisedRole,
    createdRound: currentRound,
  }
}

/**
 * Comprehensive validation for player purchase.
 * Returns validation status and details needed to proceed.
 */
export function validatePlayerPurchase(
  playerId: string,
  wageOffer: number,
  signingBonus: number,
  contractYears: number,
  promisedRole: PromisedRole,
  feeOffer: number | undefined,
  leagueState: LeagueState,
  managerTeamId: string,
  pendingOutgoing: PendingOutgoingTransferOffer[],
): {
  valid: boolean
  error?: string
  offer?: PendingOutgoingTransferOffer
} {
  // Check no pending offer
  const noPendingCheck = validateNoPendingOffer(playerId, pendingOutgoing)
  if (!noPendingCheck.valid) {
    return { valid: false, error: noPendingCheck.error }
  }

  // Validate player availability
  const playerCheck = validatePlayerAvailability(playerId, leagueState, managerTeamId)
  if (!playerCheck.valid) {
    return { valid: false, error: playerCheck.error }
  }

  const { sellerTeam, player } = playerCheck
  if (!sellerTeam || !player) {
    return { valid: false, error: 'No se pudo validar el jugador.' }
  }

  // Calculate fees
  const { transferFee, totalCost } = calculateTransferFee(
    player,
    signingBonus,
    feeOffer,
  )

  // Check budget
  const budgetCheck = validateBudgetSufficiency(leagueState, managerTeamId, totalCost)
  if (!budgetCheck.sufficient) {
    return { valid: false, error: 'Presupuesto insuficiente para esta oferta.' }
  }

  // Build offer
  const offer = buildPendingTransferOffer(
    playerId,
    player.name,
    sellerTeam.id,
    sellerTeam.name,
    transferFee,
    wageOffer,
    signingBonus,
    contractYears,
    promisedRole,
    leagueState.currentRound,
  )

  return { valid: true, offer }
}
