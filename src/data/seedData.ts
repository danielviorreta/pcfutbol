import type {
  LeagueState,
  Player,
  Team,
  TrainingFocus,
  YouthPlayer,
} from '../types/game'

type TeamSeed = Omit<
  Team,
  | 'points'
  | 'played'
  | 'wins'
  | 'draws'
  | 'losses'
  | 'goalsFor'
  | 'goalsAgainst'
  | 'players'
  | 'youthPlayers'
  | 'sponsor'
  | 'trainingFocus'
>

const baseTeams: TeamSeed[] = [
  { id: 'mad', name: 'Real Madrid', budget: 95_000_000, morale: 76, attack: 87, midfield: 84, defense: 85 },
  { id: 'bar', name: 'FC Barcelona', budget: 92_000_000, morale: 78, attack: 86, midfield: 88, defense: 80 },
  { id: 'atm', name: 'Atletico Madrid', budget: 75_000_000, morale: 72, attack: 79, midfield: 81, defense: 84 },
  { id: 'val', name: 'Valencia CF', budget: 58_000_000, morale: 71, attack: 76, midfield: 77, defense: 75 },
  { id: 'dep', name: 'Deportivo', budget: 47_000_000, morale: 68, attack: 73, midfield: 72, defense: 71 },
  { id: 'sev', name: 'Sevilla FC', budget: 52_000_000, morale: 70, attack: 74, midfield: 75, defense: 74 },
  { id: 'ath', name: 'Athletic Club', budget: 50_000_000, morale: 69, attack: 72, midfield: 74, defense: 75 },
  { id: 'bet', name: 'Real Betis', budget: 44_000_000, morale: 67, attack: 71, midfield: 71, defense: 70 },
]

const trainingFocusCycle: TrainingFocus[] = ['fitness', 'attack', 'midfield', 'defense']

const firstNames = [
  'Iker', 'Raul', 'Pablo', 'Luis', 'Fernando', 'Miguel', 'Javier', 'Sergio', 'Diego',
  'Alvaro', 'Juan', 'Dani', 'Ruben', 'Victor', 'Cesar', 'Hector', 'Marcos', 'Ivan',
]

const lastNames = [
  'Sanchez', 'Lopez', 'Martin', 'Molina', 'Pardo', 'Nieto', 'Costa', 'Torres', 'Salas',
  'Varela', 'Rios', 'Nadal', 'Campos', 'Herrera', 'Suarez', 'Romero', 'Gil', 'Arenas',
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
  'GK',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'MID',
  'MID',
  'MID',
  'MID',
  'MID',
  'FWD',
  'FWD',
  'FWD',
  'FWD',
] as const

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

function buildPlayer(team: TeamSeed, teamIndex: number, playerIndex: number): Player {
  const position = squadShape[playerIndex]
  const seed = hashText(`${team.id}-${playerIndex}`)

  const baseByPosition = {
    GK: team.defense,
    DEF: team.defense,
    MID: team.midfield,
    FWD: team.attack,
  }

  const rawOverall = baseByPosition[position] - 8 + (seed % 15)
  const overall = Math.max(58, Math.min(92, rawOverall))

  return {
    id: `${team.id}-p${playerIndex + 1}`,
    name: buildPlayerName(seed + teamIndex * 10),
    position,
    overall,
    value: Math.round(overall * overall * 14_500),
    wage: Math.round(overall * 12_000 + (seed % 90_000)),
    stamina: 72 + (seed % 24),
    form: 63 + ((seed >> 3) % 30),
    fatigue: 18 + (seed % 20),
    injuryWeeks: 0,
    suspensionWeeks: 0,
    contractYears: 1 + (seed % 5),
  }
}

function buildYouth(team: TeamSeed, index: number): YouthPlayer {
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

function toTeam(base: TeamSeed, teamIndex: number): Team {
  const players = squadShape.map((_, idx) => buildPlayer(base, teamIndex, idx))

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
    sponsor: {
      name: sponsors[teamIndex % sponsors.length],
      weeklyIncome: 320_000 + teamIndex * 28_000,
      targetRank: Math.min(6, 2 + Math.floor(teamIndex / 2)),
      seasonBonus: 2_800_000 - teamIndex * 180_000,
      seasonBonusPaid: false,
    },
    trainingFocus: trainingFocusCycle[teamIndex % trainingFocusCycle.length],
  }
}

function rotate<T>(arr: T[]): T[] {
  if (arr.length <= 2) {
    return arr
  }

  const [fixed, ...others] = arr
  const last = others.pop()
  if (last === undefined) {
    return arr
  }

  return [fixed, last, ...others]
}

function generateRoundRobin(teamIds: string[]): LeagueState['fixtures'] {
  const isOdd = teamIds.length % 2 === 1
  const workingIds = isOdd ? [...teamIds, 'bye'] : [...teamIds]
  const roundsPerLeg = workingIds.length - 1

  let rotation = [...workingIds]
  const firstLeg: LeagueState['fixtures'] = []

  for (let roundIndex = 0; roundIndex < roundsPerLeg; roundIndex += 1) {
    const round = roundIndex + 1

    for (let i = 0; i < workingIds.length / 2; i += 1) {
      const home = rotation[i]
      const away = rotation[workingIds.length - 1 - i]

      if (home !== 'bye' && away !== 'bye') {
        const shouldSwap = roundIndex % 2 === 1
        firstLeg.push({
          id: `r${round}-${home}-${away}`,
          round,
          homeTeamId: shouldSwap ? away : home,
          awayTeamId: shouldSwap ? home : away,
          played: false,
        })
      }
    }

    rotation = rotate(rotation)
  }

  const secondLeg = firstLeg.map((fixture) => ({
    ...fixture,
    id: `r${fixture.round + roundsPerLeg}-${fixture.awayTeamId}-${fixture.homeTeamId}`,
    round: fixture.round + roundsPerLeg,
    homeTeamId: fixture.awayTeamId,
    awayTeamId: fixture.homeTeamId,
    played: false,
  }))

  return [...firstLeg, ...secondLeg]
}

export function createInitialLeagueState(): LeagueState {
  const teams = baseTeams.map(toTeam)
  const fixtures = generateRoundRobin(teams.map((team) => team.id))

  return {
    currentRound: 1,
    totalRounds: teams.length % 2 === 0 ? (teams.length - 1) * 2 : teams.length * 2,
    teams,
    fixtures,
    lastResults: [],
    news: ['Temporada iniciada: la prensa espera una liga muy igualada.'],
  }
}
