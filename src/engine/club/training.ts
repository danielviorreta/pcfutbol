/** Weekly training: player growth, fatigue and youth academy progress. */
import { random, randomInt } from '../random'
import { estimatePlayerValue } from '../playerMarket'
import { clamp, estimatePlayerAge, estimateSquadRole, estimateRecentMinutesShare } from './helpers'
import type { Position, Team } from '../../types/game'

export function applyTrainingToTeam(team: Team): Team {
  const nextPlayers = team.players.map((player) => {
    const growthRoll = random()
    const focusBonus =
      (team.trainingFocus === 'attack' && player.position === 'FWD') ||
      (team.trainingFocus === 'midfield' && player.position === 'MID') ||
      (team.trainingFocus === 'defense' && (player.position === 'DEF' || player.position === 'GK'))
        ? 1
        : 0

    const fitnessDelta = team.trainingFocus === 'fitness' ? -5 : -2
    const fatigue = clamp(player.fatigue + fitnessDelta + Math.floor(random() * 5), 0, 100)

    const formBoost =
      team.trainingFocus === 'fitness' ? 1 : focusBonus > 0 ? 2 : 1

    const form = clamp(player.form + formBoost - (fatigue > 70 ? 2 : 0), 45, 99)

    const age = estimatePlayerAge(player)
    const role = estimateSquadRole(team, player.id)
    const minutesShare = estimateRecentMinutesShare(team, player, role)
    const softCap = age <= 20
      ? Math.min(94, player.overall + 14)
      : age <= 23
        ? Math.min(92, player.overall + 9)
        : age <= 27
          ? Math.min(90, player.overall + 5)
          : Math.min(88, player.overall + 2)
    const growthRoom = Math.max(0, softCap - player.overall)

    const ageFactor = age <= 20 ? 1.25 : age <= 23 ? 1 : age <= 27 ? 0.72 : age <= 30 ? 0.45 : 0.2
    const roomFactor = growthRoom >= 10 ? 1.15 : growthRoom >= 6 ? 0.9 : growthRoom >= 3 ? 0.55 : 0.2
    const performanceFactor = form >= 80 ? 1.1 : form <= 58 ? 0.8 : 1
    const focusFactor = focusBonus > 0 ? 1.08 : 1

    // Weekly gains are intentionally conservative to avoid +8/+10 in half a season.
    const growthChance = clamp(0.035 * ageFactor * roomFactor * performanceFactor * focusFactor * (0.6 + minutesShare), 0.005, 0.14)
    const baseGrowth = growthRoll < growthChance ? 1 : 0
    const overall = clamp(player.overall + baseGrowth, 50, Math.max(player.overall, softCap))

    const value = estimatePlayerValue(overall, team.division, player.age)

    return {
      ...player,
      fatigue,
      form,
      overall,
      value,
    }
  })

  const nextYouth = team.youthPlayers.map((prospect) => {
    const progressInc = 8 + Math.floor(random() * 15)
    const progress = prospect.progress + progressInc
    const jump = progress >= 100 ? 1 : 0

    return {
      ...prospect,
      progress: jump > 0 ? progress - 100 : progress,
      overall: clamp(prospect.overall + jump, 45, prospect.potential),
    }
  })

  if (random() > 0.94 && nextYouth.length < 6) {
    const positionPool: Position[] = ['GK', 'DEF', 'MID', 'FWD']
    const position = positionPool[Math.floor(random() * positionPool.length)]
    const seed = Math.floor(random() * 9000)

    nextYouth.push({
      id: `${team.id}-y${randomInt(2_147_483_647).toString(36)}-${seed}`,
      name: `Canterano ${seed}`,
      position,
      age: 16,
      overall: 53 + Math.floor(random() * 8),
      potential: 72 + Math.floor(random() * 12),
      progress: 0,
    })
  }

  return {
    ...team,
    players: nextPlayers,
    youthPlayers: nextYouth,
  }
}
