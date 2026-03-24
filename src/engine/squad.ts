import type { Player, Position, Team } from '../types/game'

const defaultShape: Record<Position, number> = {
  GK: 1,
  DEF: 4,
  MID: 3,
  FWD: 3,
}

function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.overall + b.form - (a.overall + a.form))
}

export function isPlayerAvailable(player: Player): boolean {
  return player.injuryWeeks <= 0 && player.suspensionWeeks <= 0
}

function getBestAvailableByPosition(team: Team, position: Position, needed: number): Player[] {
  return sortPlayers(team.players)
    .filter((player) => player.position === position && isPlayerAvailable(player))
    .slice(0, needed)
}

export function getDefaultLineup(team: Team): string[] {
  const selected: Player[] = []

  for (const [position, needed] of Object.entries(defaultShape) as [Position, number][]) {
    selected.push(...getBestAvailableByPosition(team, position, needed))
  }

  const unique = [...new Set(selected.map((player) => player.id))]

  if (unique.length < 11) {
    const fallback = sortPlayers(team.players)
      .filter((player) => isPlayerAvailable(player) && !unique.includes(player.id))
      .slice(0, 11 - unique.length)
      .map((player) => player.id)

    return [...unique, ...fallback]
  }

  return unique.slice(0, 11)
}

export function normalizeLineup(team: Team, lineupIds: string[]): string[] {
  const uniqueIds = [...new Set(lineupIds)]
  const validIds = uniqueIds.filter((playerId) =>
    team.players.some((player) => player.id === playerId && isPlayerAvailable(player)),
  )

  if (validIds.length !== 11) {
    return getDefaultLineup(team)
  }

  const players = validIds
    .map((playerId) => team.players.find((player) => player.id === playerId))
    .filter((player): player is Player => Boolean(player))

  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  for (const player of players) {
    counts[player.position] += 1
  }

  const shapeMatches = counts.GK >= 1 && counts.DEF >= 3 && counts.MID >= 2 && counts.FWD >= 1

  return shapeMatches ? validIds : getDefaultLineup(team)
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

export function getTeamRatings(
  team: Team,
  lineupIds: string[],
): {
  attack: number
  midfield: number
  defense: number
} {
  const lineup = getLineupPlayers(team, lineupIds)

  const aggregate = lineup.reduce(
    (acc, player) => {
      const fatiguePenalty = player.fatigue * 0.25
      const score = player.overall * 0.72 + player.form * 0.22 + player.stamina * 0.12 - fatiguePenalty

      if (player.position === 'FWD') {
        acc.attack += score
      }

      if (player.position === 'MID') {
        acc.midfield += score
      }

      if (player.position === 'DEF' || player.position === 'GK') {
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
