/**
 * End-of-season player changes: ageing, development and decline, contract
 * expiry, retirements, free agents and refilling squads from the academy.
 * Runs once per season rollover, after promotion and relegation.
 */
import { random, randomInt } from '../random'
import { estimatePlayerHappiness, estimatePlayerValue, estimateReleaseClause } from '../playerMarket'
import { clamp } from './helpers'
import type { Player, Position, Team, YouthPlayer } from '../../types/game'

/** AI squads are topped up to this size; the manager squad only to the minimum. */
const AI_SQUAD_SIZE = 22
const MIN_SQUAD_SIZE = 18
const MAX_AGE = 40
const OVERALL_RANGE = { min: 40, max: 95 }
/** Headlines about other clubs' retirements only for players at least this good. */
const NOTABLE_OVERALL = 82

const REGEN_FIRST_NAMES = [
  'Hugo', 'Mateo', 'Martin', 'Lucas', 'Leo', 'Daniel', 'Alejandro', 'Pablo', 'Manuel', 'Alvaro',
  'Adrian', 'Mario', 'Diego', 'Enzo', 'Marco', 'Izan', 'Bruno', 'Oliver', 'Thiago', 'Nico',
  'Aitor', 'Unai', 'Iker', 'Jon', 'Pol', 'Marc', 'Arnau', 'Xabi', 'Oier', 'Gael',
]
const REGEN_LAST_NAMES = [
  'Garcia', 'Rodriguez', 'Gonzalez', 'Fernandez', 'Lopez', 'Martinez', 'Sanchez', 'Perez', 'Gomez', 'Martin',
  'Jimenez', 'Ruiz', 'Hernandez', 'Diaz', 'Moreno', 'Munoz', 'Alvarez', 'Romero', 'Navarro', 'Torres',
  'Dominguez', 'Vazquez', 'Ramos', 'Gil', 'Serrano', 'Blanco', 'Molina', 'Castro', 'Ortiz', 'Rubio',
  'Etxeberria', 'Aguirre', 'Iglesias', 'Vidal', 'Pujol', 'Ferrer', 'Soler', 'Castillo', 'Prieto', 'Herrera',
]
/** Position needed most when a squad has a gap, in slot-shape proportions. */
const SQUAD_SHAPE: Record<Position, number> = { GK: 2, DEF: 8, MID: 7, FWD: 5 }

export interface SeasonPlayerChanges {
  teams: Team[]
  /** News for the manager's club (always) and notable events elsewhere. */
  headlines: string[]
}

/** Yearly rating change by age (after the birthday). */
function developmentDelta(age: number): number {
  const roll = random()
  if (age <= 20) return 1 + Math.floor(roll * 4) // +1..+4
  if (age <= 23) return Math.floor(roll * 4) // 0..+3
  if (age <= 27) return Math.floor(roll * 3) - 1 // -1..+1
  if (age <= 30) return Math.floor(roll * 2) - 1 // -1..0
  if (age <= 33) return Math.floor(roll * 3) - 3 // -3..-1
  return Math.floor(roll * 3) - 5 // -5..-3
}

function retirementChance(age: number): number {
  if (age >= MAX_AGE) return 1
  if (age >= 38) return 0.8
  if (age === 37) return 0.55
  if (age === 36) return 0.35
  if (age === 35) return 0.2
  if (age === 34) return 0.08
  return 0
}

/** Chance an AI club re-signs a player whose contract just ran out. */
function aiRenewalChance(player: Player, team: Team): number {
  const age = player.age ?? 27
  const squadLevel = averageOverall(team)
  const isKeyPlayer = player.overall >= squadLevel
  const base = isKeyPlayer ? 0.75 : 0.45
  return age >= 32 ? base - 0.35 : base
}

function averageOverall(team: Team): number {
  const best = [...team.players].sort((a, b) => b.overall - a.overall).slice(0, 16)
  return best.length > 0 ? best.reduce((sum, player) => sum + player.overall, 0) / best.length : 60
}

/** Recomputes market fields after rating, age or contract changed. */
function reprice(player: Player, team: Team): Player {
  const value = estimatePlayerValue(player.overall, team.division, player.age)
  const releaseClause = estimateReleaseClause({ ...player, value }, team, player.happiness)
  return {
    ...player,
    value,
    releaseClause,
    askingPrice: player.transferListed ? Math.round(releaseClause * 0.82) : releaseClause,
  }
}

function neededPosition(team: Team): Position {
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  team.players.forEach((player) => {
    counts[player.position] += 1
  })
  const positions = Object.keys(SQUAD_SHAPE) as Position[]
  return positions.reduce((most, position) =>
    counts[position] / SQUAD_SHAPE[position] < counts[most] / SQUAD_SHAPE[most] ? position : most,
  )
}

function regenName(): string {
  return `${REGEN_FIRST_NAMES[randomInt(REGEN_FIRST_NAMES.length)]} ${REGEN_LAST_NAMES[randomInt(REGEN_LAST_NAMES.length)]}`
}

function newSquadPlayer(team: Team, base: Pick<Player, 'name' | 'age' | 'position' | 'overall'>): Player {
  const contractYears = 3
  const happiness = estimatePlayerHappiness(team, contractYears, 4)
  const player: Player = {
    id: `${team.id}-n${randomInt(2_147_483_647).toString(36)}`,
    ...base,
    value: 0,
    wage: Math.round(base.overall * 9_000),
    releaseClause: 0,
    transferListed: false,
    askingPrice: 0,
    happiness,
    stamina: 74,
    form: 68,
    fatigue: 15,
    injuryWeeks: 0,
    suspensionWeeks: 0,
    yellowCards: 0,
    contractYears,
    recentMinutes: [],
  }
  return reprice(player, team)
}

function youthToPlayer(team: Team, youth: YouthPlayer): Player {
  return newSquadPlayer(team, { name: youth.name, age: youth.age, position: youth.position, overall: youth.overall })
}

/** Ages, develops and expires contracts; returns the remaining squad and who left. */
function updateSquad(team: Team, isManager: boolean): { team: Team; retired: Player[]; freeAgents: Player[] } {
  const retired: Player[] = []
  const freeAgents: Player[] = []
  const kept: Player[] = []

  for (const player of team.players) {
    const age = (player.age ?? 27) + 1
    if (random() < retirementChance(age)) {
      retired.push({ ...player, age })
      continue
    }

    const overall = clamp(player.overall + developmentDelta(age), OVERALL_RANGE.min, OVERALL_RANGE.max)
    let next: Player = { ...player, age, overall, contractYears: player.contractYears - 1 }

    if (next.contractYears <= 0) {
      if (!isManager && random() < aiRenewalChance(next, team)) {
        next = { ...next, contractYears: 1 + randomInt(3) }
      } else {
        freeAgents.push({ ...next, contractYears: 0, transferListed: false })
        continue
      }
    }

    kept.push(reprice(next, team))
  }

  const youthPlayers = team.youthPlayers.map((youth) => ({ ...youth, age: youth.age + 1 }))

  return { team: { ...team, players: kept, youthPlayers }, retired, freeAgents }
}

/** Fills gaps: best academy players first, then new youngsters near the squad's level. */
function refillSquad(team: Team, targetSize: number): { team: Team; promoted: string[] } {
  let current = team
  const promoted: string[] = []

  while (current.players.length < targetSize) {
    const position = neededPosition(current)
    const youth = [...current.youthPlayers]
      .filter((candidate) => candidate.position === position)
      .sort((a, b) => b.overall - a.overall)[0]

    if (youth) {
      promoted.push(youth.name)
      current = {
        ...current,
        players: [...current.players, youthToPlayer(current, youth)],
        youthPlayers: current.youthPlayers.filter((candidate) => candidate.id !== youth.id),
      }
      continue
    }

    const overall = clamp(Math.round(averageOverall(current) - 5 + random() * 6), 50, 85)
    const player = newSquadPlayer(current, { name: regenName(), age: 18 + randomInt(4), position, overall })
    promoted.push(player.name)
    current = { ...current, players: [...current.players, player] }
  }

  return { team: current, promoted }
}

/** Free agents join the AI club with free squad places whose level best matches theirs. */
function signFreeAgents(teams: Team[], freeAgents: Player[], managerTeamId: string): { teams: Team[]; headlines: string[] } {
  const byId = new Map(teams.map((team) => [team.id, team]))
  const headlines: string[] = []

  for (const agent of [...freeAgents].sort((a, b) => b.overall - a.overall)) {
    const candidates = [...byId.values()].filter(
      (team) => team.id !== managerTeamId && team.players.length < AI_SQUAD_SIZE,
    )
    if (candidates.length === 0) {
      break
    }
    const club = candidates.reduce((best, team) =>
      Math.abs(averageOverall(team) - agent.overall) < Math.abs(averageOverall(best) - agent.overall) ? team : best,
    )
    const signed = newSquadPlayer(club, agent)
    byId.set(club.id, { ...club, players: [...club.players, { ...signed, id: agent.id }] })
    if (agent.overall >= NOTABLE_OVERALL) {
      headlines.push(`${agent.name} ficha como agente libre por el ${club.name}.`)
    }
  }

  return { teams: teams.map((team) => byId.get(team.id) ?? team), headlines }
}

export function applySeasonPlayerChanges(teams: Team[], managerTeamId: string): SeasonPlayerChanges {
  const headlines: string[] = []
  const freeAgents: Player[] = []

  let nextTeams = teams.map((team) => {
    const isManager = team.id === managerTeamId
    const result = updateSquad(team, isManager)
    freeAgents.push(...result.freeAgents)

    if (isManager) {
      result.retired.forEach((player) => headlines.push(`${player.name} se retira a los ${player.age} años.`))
      result.freeAgents.forEach((player) => headlines.push(`${player.name} termina contrato y deja el club.`))
    } else {
      result.retired
        .filter((player) => player.overall >= NOTABLE_OVERALL)
        .forEach((player) => headlines.push(`${player.name} (${team.name}) anuncia su retirada.`))
    }

    return result.team
  })

  const signing = signFreeAgents(nextTeams, freeAgents, managerTeamId)
  nextTeams = signing.teams
  headlines.push(...signing.headlines)

  nextTeams = nextTeams.map((team) => {
    const isManager = team.id === managerTeamId
    const { team: filled, promoted } = refillSquad(team, isManager ? MIN_SQUAD_SIZE : AI_SQUAD_SIZE)
    if (isManager && promoted.length > 0) {
      headlines.push(`Suben de la cantera para completar la plantilla: ${promoted.join(', ')}.`)
    }
    return filled
  })

  return { teams: nextTeams, headlines }
}
