import type { Player, Position, RolePosition, Tactic, Team } from '../types/game'

const formationSlots: Record<Tactic, RolePosition[]> = {
  '4-3-3': ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'ST', 'LW'],
  '4-4-2': ['GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'ST', 'ST'],
  '5-4-1': ['GK', 'RWB', 'CB', 'CB', 'CB', 'LWB', 'RM', 'CM', 'CM', 'LM', 'ST'],
}

function getTeamTactic(team: Team): Tactic {
  return team.tactic ?? '4-3-3'
}

export function getFormationSlots(team: Team): RolePosition[] {
  return formationSlots[getTeamTactic(team)]
}

function roleToLine(role: RolePosition): Position {
  if (role === 'GK') {
    return 'GK'
  }

  if (['RB', 'CB', 'LB', 'RWB', 'LWB'].includes(role)) {
    return 'DEF'
  }

  if (['DM', 'CM', 'AM', 'RM', 'LM'].includes(role)) {
    return 'MID'
  }

  return 'FWD'
}

function fallbackNaturalPositions(position: Position): RolePosition[] {
  switch (position) {
    case 'GK':
      return ['GK']
    case 'DEF':
      return ['CB', 'RB']
    case 'MID':
      return ['CM', 'DM']
    case 'FWD':
      return ['ST', 'CF']
    default:
      return ['CM']
  }
}

function getNaturalPositions(player: Player): RolePosition[] {
  return player.naturalPositions && player.naturalPositions.length > 0
    ? player.naturalPositions
    : fallbackNaturalPositions(player.position)
}

export function getRoleFit(player: Player, targetRole: RolePosition): number {
  const natural = getNaturalPositions(player)

  if (natural[0] === targetRole) {
    return 1
  }

  if (natural.includes(targetRole)) {
    return 0.92
  }

  const playerLine = roleToLine(natural[0])
  const targetLine = roleToLine(targetRole)

  if (playerLine === targetLine) {
    return 0.82
  }

  const lineDistance =
    Math.abs(
      ['DEF', 'MID', 'FWD'].indexOf(playerLine) -
      ['DEF', 'MID', 'FWD'].indexOf(targetLine),
    )

  if (playerLine === 'GK' || targetLine === 'GK') {
    return 0.55
  }

  return lineDistance <= 1 ? 0.68 : 0.52
}

export function getEffectiveOverall(player: Player, targetRole: RolePosition): number {
  return Math.round(player.overall * getRoleFit(player, targetRole))
}

function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.overall + b.form - (a.overall + a.form))
}

export function isPlayerAvailable(player: Player): boolean {
  return player.injuryWeeks <= 0 && player.suspensionWeeks <= 0
}

function pickBestLineupForSlots(team: Team, slots: RolePosition[]): Player[] {
  const available = sortPlayers(team.players).filter((player) => isPlayerAvailable(player))
  const selected: Player[] = []
  const used = new Set<string>()

  for (const slot of slots) {
    let best: Player | null = null
    let bestScore = Number.NEGATIVE_INFINITY

    for (const player of available) {
      if (used.has(player.id)) {
        continue
      }

      const fit = getRoleFit(player, slot)
      const score = player.overall * fit + player.form * 0.18 - player.fatigue * 0.08

      if (score > bestScore) {
        bestScore = score
        best = player
      }
    }

    if (!best) {
      continue
    }

    selected.push(best)
    used.add(best.id)
  }

  if (selected.length < 11) {
    for (const player of available) {
      if (used.has(player.id)) {
        continue
      }
      selected.push(player)
      used.add(player.id)
      if (selected.length === 11) {
        break
      }
    }
  }

  return selected.slice(0, 11)
}

export function getDefaultLineup(team: Team): string[] {
  const slots = getFormationSlots(team)
  return pickBestLineupForSlots(team, slots).map((player) => player.id)
}

export function normalizeLineup(team: Team, lineupIds: string[]): string[] {
  const uniqueIds = [...new Set(lineupIds)]
  const validIds = uniqueIds.filter((playerId) =>
    team.players.some((player) => player.id === playerId && isPlayerAvailable(player)),
  )

  if (validIds.length !== 11) {
    return getDefaultLineup(team)
  }

  const hasGoalkeeper = validIds.some((id) => {
    const player = team.players.find((candidate) => candidate.id === id)
    return player ? getNaturalPositions(player).includes('GK') : false
  })

  return hasGoalkeeper ? validIds : getDefaultLineup(team)
}

export function canToggleInLineup(team: Team, lineupIds: string[], playerId: string): boolean {
  const player = team.players.find((item) => item.id === playerId)
  if (!player || !isPlayerAvailable(player)) {
    return false
  }

  if (lineupIds.includes(playerId)) {
    return true
  }

  return lineupIds.length < 11
}

export function getLineupPlayers(team: Team, lineupIds: string[]): Player[] {
  const normalized = normalizeLineup(team, lineupIds)

  return normalized
    .map((id) => team.players.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player))
}

export interface LineupAssignment {
  slotIndex: number
  role: RolePosition
  player: Player | null
  fit: number
  effectiveOverall: number
}

export function getLineupAssignments(team: Team, lineupIds: string[]): LineupAssignment[] {
  const slots = getFormationSlots(team)
  const normalized = normalizeLineup(team, lineupIds)

  return slots.map((role, slotIndex) => {
    const playerId = normalized[slotIndex]
    const player = team.players.find((candidate) => candidate.id === playerId) ?? null
    const fit = player ? getRoleFit(player, role) : 0

    return {
      slotIndex,
      role,
      player,
      fit,
      effectiveOverall: player ? getEffectiveOverall(player, role) : 0,
    }
  })
}

export function getTeamRatings(
  team: Team,
  lineupIds: string[],
): {
  attack: number
  midfield: number
  defense: number
} {
  const assignments = getLineupAssignments(team, lineupIds)

  const aggregate = assignments.reduce(
    (acc, item) => {
      const { player, role, fit } = item
      if (!player) {
        return acc
      }

      const fatiguePenalty = player.fatigue * 0.25
      const baseScore =
        player.overall * 0.72 + player.form * 0.22 + player.stamina * 0.12 - fatiguePenalty
      const score = baseScore * fit
      const line = roleToLine(role)

      if (line === 'FWD') {
        acc.attack += score
      }

      if (line === 'MID') {
        acc.midfield += score
      }

      if (line === 'DEF' || line === 'GK') {
        acc.defense += score
      }

      return acc
    },
    { attack: 0, midfield: 0, defense: 0 },
  )

  const attack = team.attack * 0.55 + aggregate.attack / 3.2
  const midfield = team.midfield * 0.55 + aggregate.midfield / 3
  const defense = team.defense * 0.55 + aggregate.defense / 4

  return {
    attack: Math.round(attack),
    midfield: Math.round(midfield),
    defense: Math.round(defense),
  }
}
