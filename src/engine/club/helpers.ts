/** Shared helpers for club management. */
import type { Player, PromisedRole, Team } from '../../types/game'

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function weeklyPayroll(team: Team): number {
  return team.players.reduce((sum, player) => sum + player.wage, 0) / 52
}

export function estimatePlayerAge(player: Player): number {
  if (typeof player.age === 'number' && Number.isFinite(player.age)) {
    return clamp(Math.round(player.age), 16, 40)
  }

  // Fallback when legacy saves do not store age in first-team players.
  if (player.overall >= 88) return 29
  if (player.overall >= 84) return 27
  if (player.overall >= 79) return 25
  if (player.overall >= 73) return 23
  return 21
}

export function estimateSquadRole(team: Team, playerId: string): PromisedRole {
  const ordered = team.players
    .slice()
    .sort((a, b) => b.overall - a.overall)
    .map((item) => item.id)

  const index = ordered.indexOf(playerId)
  if (index < 0) return 'rotacion'
  if (index <= 2) return 'estrella'
  if (index <= 10) return 'titular'
  if (index <= 17) return 'rotacion'
  return 'banquillo'
}

export function estimateRecentMinutesShare(team: Team, player: Player, role: PromisedRole): number {
  if (Array.isArray(player.recentMinutes) && player.recentMinutes.length > 0) {
    const sample = player.recentMinutes.slice(-5)
    const avg = sample.reduce((sum, value) => sum + value, 0) / sample.length
    return Math.min(0.98, Math.max(0.02, avg / 90))
  }

  if (player.injuryWeeks > 0 || player.suspensionWeeks > 0) {
    return 0.02
  }

  const roleBase = role === 'estrella'
    ? 0.92
    : role === 'titular'
      ? 0.78
      : role === 'rotacion'
        ? 0.46
        : 0.18

  const fitnessMod = player.fatigue >= 80
    ? -0.20
    : player.fatigue >= 65
      ? -0.12
      : player.fatigue <= 30
        ? 0.05
        : 0

  const formMod = player.form >= 85
    ? 0.08
    : player.form >= 75
      ? 0.04
      : player.form <= 58
        ? -0.08
        : 0

  const overallGap = team.players.length > 0
    ? Math.max(...team.players.map((p) => p.overall)) - player.overall
    : 0
  const qualityMod = overallGap <= 2
    ? 0.04
    : overallGap >= 10
      ? -0.06
      : 0

  return Math.min(0.98, Math.max(0.02, roleBase + fitnessMod + formMod + qualityMod))
}

// Stadium expansion
export const UPGRADE_SEATS = 5_000
export const MAX_CAPACITY = 120_000
export const UPGRADE_WEEKS = 4
