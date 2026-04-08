import {
  upgradeMedicalStaff,
  upgradeDisciplineStaff,
} from './club'
import { getTeamBudget } from './finance'
import type { ManagerGameState, LeagueState } from '../types/game'

export type StaffUpgradeType = 'medical' | 'discipline'

export interface StaffUpgradeResult {
  success: boolean
  message: string
  cost?: number
  nextLeagueState?: LeagueState
}

/**
 * Performs a staff upgrade (medical or discipline) and calculates the cost.
 * Returns the upgrade result with cost calculation for finance tracking.
 */
export function performStaffUpgrade(
  game: ManagerGameState,
  upgradeType: StaffUpgradeType,
): StaffUpgradeResult {
  const upgradeFn = upgradeType === 'medical' ? upgradeMedicalStaff : upgradeDisciplineStaff
  const { nextState, message, ok } = upgradeFn(game.leagueState, game.managerTeamId)

  if (!ok) {
    return { success: false, message }
  }

  const oldBudget = getTeamBudget(game.leagueState.teams, game.managerTeamId)
  const newBudget = getTeamBudget(nextState.teams, game.managerTeamId)
  const cost = oldBudget - newBudget

  return {
    success: true,
    message,
    cost,
    nextLeagueState: nextState,
  }
}
