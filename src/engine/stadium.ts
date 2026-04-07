import type { Stadium } from '../types/game'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function getConstructionProgress(stadium: Stadium): number {
  const weeksRemaining = stadium.upgradeWeeksRemaining ?? 0
  return clamp(((4 - weeksRemaining) / 4) * 100, 0, 100)
}

export function getOperationalCapacity(stadium: Stadium): number {
  const weeksRemaining = stadium.upgradeWeeksRemaining ?? 0
  if (weeksRemaining <= 0) {
    return stadium.capacity
  }

  const reductionRatio = weeksRemaining >= 4
    ? 0.78
    : weeksRemaining === 3
      ? 0.82
      : weeksRemaining === 2
        ? 0.88
        : 0.94

  return Math.max(8_000, Math.round(stadium.capacity * reductionRatio))
}
