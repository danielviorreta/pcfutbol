import type { Division, Player, PromisedRole, Team } from '../types/game'

type ClubSnapshot = Pick<Team, 'division' | 'attack' | 'midfield' | 'defense' | 'morale' | 'budget'>
type MarketPlayerSnapshot = Pick<Player, 'overall' | 'value' | 'wage' | 'contractYears' | 'happiness' | 'transferListed'>
type ContractOffer = {
  wageOffer: number
  signingBonus: number
  contractYears: number
  promisedRole: PromisedRole
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getDivisionAppeal(division: Division): number {
  switch (division) {
    case 'Primera':
      return 26
    case 'Segunda':
      return 12
    case 'Primera Federacion':
      return 0
    default:
      return 0
  }
}

const TARGET_VALUE_CURVES: Record<Division, Array<{ overall: number; value: number }>> = {
  Primera: [
    { overall: 65, value: 1_100_000 },
    { overall: 70, value: 2_400_000 },
    { overall: 75, value: 4_800_000 },
    { overall: 80, value: 9_500_000 },
    { overall: 85, value: 18_000_000 },
    { overall: 90, value: 32_000_000 },
  ],
  Segunda: [
    { overall: 65, value: 300_000 },
    { overall: 70, value: 850_000 },
    { overall: 75, value: 1_900_000 },
    { overall: 80, value: 3_800_000 },
    { overall: 85, value: 7_000_000 },
    { overall: 90, value: 12_000_000 },
  ],
  'Primera Federacion': [
    { overall: 65, value: 120_000 },
    { overall: 70, value: 320_000 },
    { overall: 75, value: 750_000 },
    { overall: 80, value: 1_600_000 },
    { overall: 85, value: 3_000_000 },
    { overall: 90, value: 5_000_000 },
  ],
}

function interpolateTargetValue(overall: number, division: Division): number {
  const curve = TARGET_VALUE_CURVES[division]
  const clampedOverall = clamp(overall, curve[0].overall, curve[curve.length - 1].overall)

  for (let index = 0; index < curve.length - 1; index += 1) {
    const current = curve[index]
    const next = curve[index + 1]

    if (clampedOverall <= next.overall) {
      const ratio = (clampedOverall - current.overall) / (next.overall - current.overall)
      return Math.round(current.value + (next.value - current.value) * ratio)
    }
  }

  return curve[curve.length - 1].value
}

export function getClubAppeal(team: ClubSnapshot): number {
  const sportingLevel = (team.attack + team.midfield + team.defense) / 3
  const budgetFactor = clamp(Math.log10(Math.max(team.budget, 1)) * 4 - 18, 0, 18)

  return getDivisionAppeal(team.division) + sportingLevel * 0.55 + team.morale * 0.18 + budgetFactor
}

export function estimatePlayerHappiness(
  team: Pick<Team, 'division' | 'morale'>,
  contractYears: number,
  seedBias = 0,
): number {
  const divisionBonus = team.division === 'Primera' ? 10 : team.division === 'Segunda' ? 4 : 0

  return clamp(
    Math.round(52 + divisionBonus + team.morale * 0.18 + contractYears * 2 + seedBias),
    45,
    92,
  )
}

export function estimatePlayerValue(
  overall: number,
  division: Division,
  age?: number,
): number {
  const qualityFactor = overall >= 84 ? 1.08 : overall >= 78 ? 1.02 : overall >= 72 ? 0.96 : 0.88
  const ageFactor =
    typeof age !== 'number'
      ? 1
      : age <= 21
        ? 1.12
        : age <= 24
          ? 1.06
          : age >= 33
            ? 0.76
            : age >= 29
              ? 0.9
              : 1

  const baseValue = interpolateTargetValue(overall, division)
  const scaledValue = baseValue * qualityFactor * ageFactor

  return Math.max(120_000, Math.round(scaledValue))
}

export function estimateReleaseClause(
  player: Pick<Player, 'value' | 'overall' | 'wage' | 'contractYears'>,
  team: ClubSnapshot,
  happiness: number,
): number {
  const divisionClauseBase =
    team.division === 'Primera'
      ? 1.42
      : team.division === 'Segunda'
        ? 1.18
        : 1.05
  const sportingFactor = ((team.attack + team.midfield + team.defense) / 3 - 70) / 260
  const happinessFactor = 1 + (happiness - 60) / 180
  const contractFactor = 1 + player.contractYears * 0.05
  const qualityFactor = 1 + Math.max(0, player.overall - 75) / 180
  const multiplier = clamp((divisionClauseBase + sportingFactor) * happinessFactor * contractFactor * qualityFactor, 1.05, team.division === 'Primera' ? 3.2 : team.division === 'Segunda' ? 2.35 : 1.75)

  return Math.round(player.value * multiplier)
}

export function getRecommendedWageOffer(
  player: MarketPlayerSnapshot,
  buyer: ClubSnapshot,
  seller: ClubSnapshot,
): number {
  const appealDelta = getClubAppeal(buyer) - getClubAppeal(seller)
  const listedDiscount = player.transferListed ? 0.08 : 0
  const multiplier = clamp(
    1.06
      + Math.max(0, player.overall - 70) / 180
      + Math.max(0, 68 - player.happiness) / 140
      + Math.max(0, -appealDelta) / 160
      - listedDiscount,
    1.05,
    1.7,
  )

  return Math.round(player.wage * multiplier)
}

export function getRecommendedSigningBonus(
  player: MarketPlayerSnapshot,
  buyer: ClubSnapshot,
  seller: ClubSnapshot,
): number {
  const appealDelta = getClubAppeal(buyer) - getClubAppeal(seller)
  const listedDiscount = player.transferListed ? 0.05 : 0
  const multiplier = clamp(0.18 + Math.max(0, -appealDelta) / 120 + Math.max(0, 70 - player.happiness) / 220 - listedDiscount, 0.12, 0.45)
  return Math.round(player.value * multiplier)
}

export function getRecommendedContractYears(player: MarketPlayerSnapshot): number {
  return clamp(player.contractYears <= 1 ? 4 : player.contractYears === 2 ? 3 : 2, 2, 5)
}

export function getRecommendedPromisedRole(
  player: MarketPlayerSnapshot,
  buyer: ClubSnapshot,
): PromisedRole {
  const clubLevel = (buyer.attack + buyer.midfield + buyer.defense) / 3

  if (player.overall >= clubLevel + 7) {
    return 'estrella'
  }

  if (player.overall >= clubLevel + 2) {
    return 'titular'
  }

  if (player.overall >= clubLevel - 4) {
    return 'rotacion'
  }

  return 'banquillo'
}

function getPromisedRoleScore(
  player: MarketPlayerSnapshot,
  buyer: ClubSnapshot,
  promisedRole: PromisedRole,
): { score: number; reason?: string } {
  const expectedRole = getRecommendedPromisedRole(player, buyer)
  const scale: Record<PromisedRole, number> = {
    banquillo: 0,
    rotacion: 1,
    titular: 2,
    estrella: 3,
  }
  const diff = scale[promisedRole] - scale[expectedRole]

  if (diff >= 1) {
    return { score: Math.min(12, 4 + diff * 3) }
  }

  if (diff === 0) {
    return { score: 4 }
  }

  return {
    score: Math.max(-14, diff * 5),
    reason: 'No le convence el rol prometido.',
  }
}

export function assessClubSaleDecision(
  player: Pick<Player, 'contractYears' | 'happiness' | 'transferListed'>,
  marketPrice: number,
  feeOffer: number,
): { accepted: boolean; minAcceptablePrice: number; reason: string } {
  const ratio = feeOffer / Math.max(marketPrice, 1)

  // Non-listed players: clause is a fixed price, club resists heavily
  // Transfer-listed players: club wants to sell, much more flexible
  let minRatio = player.transferListed ? 0.72 : 0.90

  if (player.contractYears <= 1) {
    minRatio -= 0.08
  } else if (player.contractYears === 2) {
    minRatio -= 0.04
  }

  if (player.happiness < 55) {
    minRatio -= 0.06
  } else if (player.happiness < 65) {
    minRatio -= 0.03
  }

  minRatio = clamp(minRatio, player.transferListed ? 0.45 : 0.72, 0.97)

  const minAcceptablePrice = Math.round(marketPrice * minRatio)
  const accepted = feeOffer >= minAcceptablePrice

  let reason = ''
  if (!accepted) {
    if (ratio < 0.5) {
      reason = 'La oferta es irrisoria, no la van a considerar.'
    } else if (!player.transferListed && ratio < 0.90) {
      reason = 'El jugador no esta en venta; el club no acepta menos de la clausula salvo contrato corto.'
    } else {
      reason = `El club no acepta esa cantidad. Minimo requerido: ~${Math.round(minRatio * 100)}% del precio de salida.`
    }
  }

  return { accepted, minAcceptablePrice, reason }
}

export function assessTransferDecision(
  player: MarketPlayerSnapshot,
  buyer: ClubSnapshot,
  seller: ClubSnapshot,
  offer: ContractOffer,
): {
  accepted: boolean
  score: number
  requiredWage: number
  requiredSigningBonus: number
  suggestedContractYears: number
  suggestedPromisedRole: PromisedRole
  interestLabel: string
  reason: string
} {
  const { wageOffer, signingBonus, contractYears, promisedRole } = offer
  const requiredWage = getRecommendedWageOffer(player, buyer, seller)
  const requiredSigningBonus = getRecommendedSigningBonus(player, buyer, seller)
  const suggestedContractYears = getRecommendedContractYears(player)
  const suggestedPromisedRole = getRecommendedPromisedRole(player, buyer)
  const appealDelta = getClubAppeal(buyer) - getClubAppeal(seller)
  const wageScore = clamp(((wageOffer / Math.max(requiredWage, 1)) - 1) * 45, -24, 20)
  const bonusScore = clamp(((signingBonus / Math.max(requiredSigningBonus, 1)) - 1) * 28, -16, 14)
  const clubScore = clamp(appealDelta / 2.5, -22, 22)
  const happinessScore = clamp((66 - player.happiness) * 0.55, -14, 18)
  const contractScore = clamp((contractYears - suggestedContractYears) * 3 + (player.contractYears <= 1 ? 6 : player.contractYears === 2 ? 2 : -3), -8, 12)
  const promisedRoleScore = getPromisedRoleScore(player, buyer, promisedRole)
  const listedScore = player.transferListed ? 10 : 0
  const score = Math.round(34 + wageScore + bonusScore + clubScore + happinessScore + contractScore + promisedRoleScore.score + listedScore)

  let interestLabel = 'Poco interesado'
  if (score >= 60) {
    interestLabel = 'Muy interesado'
  } else if (score >= 50) {
    interestLabel = 'Abierto a negociar'
  } else if (score >= 42) {
    interestLabel = 'Tiene dudas'
  }

  let reason = 'No ve claro el cambio de club.'
  if (wageOffer < requiredWage * 0.9) {
    reason = 'La oferta salarial no le convence.'
  } else if (signingBonus < requiredSigningBonus * 0.85) {
    reason = 'La prima de fichaje es demasiado baja.'
  } else if (appealDelta < -10 && player.happiness >= 72) {
    reason = 'No quiere dejar un club que considera mejor.'
  } else if (player.transferListed) {
    reason = 'Quiere salir y esta abierto al traspaso.'
  } else if (player.happiness >= 80 && player.contractYears >= 3) {
    reason = 'Esta contento y bien asentado en su club actual.'
  } else if (promisedRoleScore.reason) {
    reason = promisedRoleScore.reason
  }

  return {
    accepted: score >= 50,
    score,
    requiredWage,
    requiredSigningBonus,
    suggestedContractYears,
    suggestedPromisedRole,
    interestLabel,
    reason,
  }
}
