/**
 * Builds the initial league from the season data file.
 *
 * Squads live in season-YYYY-YY.json (one team per line, players in slot order:
 * best XI as GK, 4 DEF, 3 MID, 3 FWD, then bench GK, 4 DEF, 4 MID, 2 FWD).
 * To update a season, replace that file; this module only derives game state from it.
 * It is loaded on demand (see engine/gameUtils.ts) to keep the data out of the main bundle.
 */
import type {
  CompetitionGroup,
  Division,
  LeagueState,
  Player,
  Position,
  RolePosition,
  Tactic,
  Team,
  TrainingFocus,
  YouthPlayer,
} from '../types/game'
import { estimatePlayerHappiness, estimatePlayerValue, estimateReleaseClause } from '../engine/playerMarket'
import { buildSeasonFixtures } from '../engine/fixtures'
import seasonData from './season-2026-27.json'

export interface SeasonPlayer {
  name: string
  position: Position
  age: number
  overall: number
}

export interface SeasonTeam {
  id: string
  name: string
  crestUrl: string
  stadium: Team['stadium']
  budget: number
  morale: number
  attack: number
  midfield: number
  defense: number
  division: Division
  group?: CompetitionGroup
  regionalGroup?: CompetitionGroup
  players: SeasonPlayer[]
}

interface SeasonFile {
  season: string
  seasonStartYear: number
  teams: SeasonTeam[]
}

const season = seasonData as SeasonFile

export const SEASON_LABEL = season.season
export const SEASON_START_YEAR = season.seasonStartYear

const trainingFocusCycle: TrainingFocus[] = ['fitness', 'attack', 'midfield', 'defense']
const tacticCycle: Tactic[] = ['4-3-3', '4-4-2', '5-4-1']

const firstNames = [
  'Iker', 'Raul', 'Pablo', 'Luis', 'Fernando', 'Miguel', 'Javier', 'Sergio', 'Diego',
  'Alvaro', 'Juan', 'Dani', 'Ruben', 'Victor', 'Cesar', 'Hector', 'Marcos', 'Ivan',
]

const lastNames = [
  'Sanchez',
  'Lopez',
  'Martin',
  'Molina',
  'Pardo',
  'Nieto',
  'Costa',
  'Torres',
  'Salas',
  'Varela',
  'Rios',
  'Nadal',
  'Campos',
  'Herrera',
  'Suarez',
  'Romero',
  'Gil',
  'Arenas',
]

const sponsors = [
  'Telefonia Nova',
  'Banco Iberico',
  'Astur Cola',
  'Viajes Orbe',
  'MotorEuropa',
  'Construcciones Arce',
  'Seguros Brio',
  'MetalSur',
]

const squadShape = [
  'GK',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'MID',
  'MID',
  'MID',
  'FWD',
  'FWD',
  'FWD',
  'GK',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'MID',
  'MID',
  'MID',
  'MID',
  'FWD',
  'FWD',
] as const

const rolePools: Record<Position, RolePosition[]> = {
  GK: ['GK'],
  DEF: ['RB', 'CB', 'CB', 'LB', 'RWB', 'LWB'],
  MID: ['DM', 'CM', 'CM', 'AM', 'RM', 'LM'],
  FWD: ['RW', 'LW', 'ST', 'CF'],
}

const secondaryRolesByPrimary: Record<RolePosition, RolePosition[]> = {
  GK: ['GK'],
  RB: ['RWB', 'LB'],
  CB: ['DM'],
  LB: ['LWB', 'RB'],
  RWB: ['RB', 'RM'],
  LWB: ['LB', 'LM'],
  DM: ['CM', 'CB'],
  CM: ['DM', 'AM'],
  AM: ['CM', 'CF'],
  RM: ['RW', 'CM'],
  LM: ['LW', 'CM'],
  RW: ['RM', 'CF'],
  LW: ['LM', 'CF'],
  CF: ['ST', 'AM'],
  ST: ['CF', 'RW'],
}

function inferNaturalPositions(basePosition: Position, playerIndex: number): RolePosition[] {
  const pool = rolePools[basePosition]
  const primary = pool[playerIndex % pool.length]

  if (basePosition === 'GK') {
    return ['GK']
  }

  const secondary = secondaryRolesByPrimary[primary][0]
  return secondary ? [primary, secondary] : [primary]
}


const youthShape = ['GK', 'DEF', 'MID', 'FWD'] as const

function hashText(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function buildPlayerName(seed: number): string {
  const first = firstNames[seed % firstNames.length]
  const last = lastNames[(seed * 7) % lastNames.length]
  return `${first} ${last}`
}

function estimateAge(seed: number, position: Position, overall: number, playerIndex: number, division: Division): number {
  const positionBase = position === 'GK' ? 29 : position === 'DEF' ? 27 : position === 'MID' ? 26 : 25
  const divisionBias = division === 'Primera' ? 1 : division === 'Segunda' ? 0 : -1
  const qualityBias = overall >= 88 ? 2 : overall >= 82 ? 1 : overall <= 70 ? -2 : 0
  const roleBias = playerIndex <= 10 ? 1 : playerIndex <= 16 ? 0 : -2
  const variance = (seed % 7) - 3

  return Math.max(17, Math.min(38, positionBase + divisionBias + qualityBias + roleBias + variance))
}

function buildPlayer(team: SeasonTeam, source: SeasonPlayer | undefined, teamIndex: number, playerIndex: number): Player {
  const position: Position = source?.position ?? squadShape[playerIndex] ?? 'MID'
  const seed = hashText(`${team.id}-${playerIndex}`)

  // Fallback only used if a team in the season file has fewer than 22 players.
  const baseByPosition = { GK: team.defense, DEF: team.defense, MID: team.midfield, FWD: team.attack }
  const tierOffset = playerIndex <= 10 ? 3 : playerIndex <= 16 ? -1 : -5
  const fallbackOverall = Math.max(55, Math.min(92, baseByPosition[position] + tierOffset + (seed % 5) - 2))

  const overall = source?.overall ?? fallbackOverall
  const playerName = source?.name ?? buildPlayerName(seed + teamIndex * 10)
  const age = source ? Math.max(16, Math.min(40, source.age)) : estimateAge(seed, position, overall, playerIndex, team.division)
  const naturalPositions = inferNaturalPositions(position, playerIndex)
  const value = estimatePlayerValue(overall, team.division, age)
  const wage = Math.round(overall * 12_000 + (seed % 90_000))
  const contractYears = 1 + (seed % 5)
  const happiness = estimatePlayerHappiness(team, contractYears, ((seed % 11) - 5) * 2)
  const releaseClause = estimateReleaseClause({ value, wage, overall, contractYears }, team, happiness)
  const transferListed = playerIndex >= 13 && ((seed + teamIndex) % 4 === 0 || happiness <= 58 || contractYears <= 1)
  const askingPrice = transferListed
    ? Math.max(team.division === 'Primera' ? 300_000 : team.division === 'Segunda' ? 180_000 : 90_000, Math.round(releaseClause * (0.72 + (seed % 16) / 100)))
    : releaseClause

  return {
    id: `${team.id}-p${playerIndex + 1}`,
    name: playerName,
    age,
    position,
    naturalPositions,
    overall,
    value,
    wage,
    releaseClause,
    transferListed,
    askingPrice,
    happiness,
    stamina: 72 + (seed % 24),
    form: 63 + ((seed >> 3) % 30),
    fatigue: 18 + (seed % 20),
    injuryWeeks: 0,
    suspensionWeeks: 0,
    yellowCards: 0,
    contractYears,
    recentMinutes: [],
  }
}

function buildYouth(team: Pick<SeasonTeam, 'id'>, index: number): YouthPlayer {
  const seed = hashText(`y-${team.id}-${index}`)
  const overall = 52 + (seed % 18)

  return {
    id: `${team.id}-y${index + 1}`,
    name: buildPlayerName(seed + 200),
    position: youthShape[index % youthShape.length],
    age: 16 + (seed % 3),
    overall,
    potential: Math.max(overall + 10, 68 + (seed % 16)),
    progress: seed % 55,
  }
}

function toTeam(seasonTeam: SeasonTeam, teamIndex: number): Team {
  const { players: seasonPlayers, ...base } = seasonTeam
  const players = squadShape.map((_, idx) => buildPlayer(seasonTeam, seasonPlayers[idx], teamIndex, idx))

  return {
    ...base,
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    players,
    youthPlayers: youthShape.map((_, idx) => buildYouth(base, idx)),
    sponsor: (() => {
      const divisionIndex = teamIndex % 20
      const isPrimera = base.division === 'Primera'
      const isSegunda = base.division === 'Segunda'
      // Weekly income by division:
      //   Primera:           280k–840k
      //   Segunda:           85k–230k
      //   1ª RFEF:           35k–90k
      const weeklyIncome = isPrimera
        ? 280_000 + divisionIndex * 28_000
        : isSegunda
          ? 85_000 + divisionIndex * 7_500
          : 35_000 + divisionIndex * 2_750
      // Season bonus ≈ ~4× typical weekly income for the division
      const seasonBonus = isPrimera
        ? 1_800_000 - divisionIndex * 60_000
        : isSegunda
          ? 450_000 - divisionIndex * 15_000
          : 160_000 - divisionIndex * 3_500
      return {
        name: sponsors[teamIndex % sponsors.length],
        weeklyIncome: Math.max(isPrimera ? 200_000 : isSegunda ? 60_000 : 28_000, weeklyIncome),
        targetRank: Math.min(6, 2 + Math.floor(divisionIndex / 4)),
        seasonBonus: Math.max(isPrimera ? 400_000 : isSegunda ? 80_000 : 50_000, seasonBonus),
        seasonBonusPaid: false,
      }
    })(),
    staff: {
      medicalLevel: 1,
      disciplineLevel: 1,
    },
    tactic: tacticCycle[teamIndex % tacticCycle.length],
    trainingFocus: trainingFocusCycle[teamIndex % trainingFocusCycle.length],
  }
}


export function createInitialLeagueState(): LeagueState {
  const teams = season.teams.map(toTeam)
  const { fixtures, totalRounds } = buildSeasonFixtures(teams)

  return {
    currentRound: 1,
    totalRounds,
    teams,
    fixtures,
    lastResults: [],
    news: ['Temporada iniciada: la prensa espera una liga muy igualada.'],
    promotionSummary: [],
    promotionBracket: null,
  }
}

export interface SeasonClubSummary {
  id: string
  name: string
  crestUrl: string
  division: Division
  group?: CompetitionGroup
}

/** Lightweight club list for the new-game screen (no squads built). */
export function listSeasonClubs(): SeasonClubSummary[] {
  return season.teams.map(({ id, name, crestUrl, division, group }) => ({ id, name, crestUrl, division, group }))
}
