export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'
export type TrainingFocus = 'fitness' | 'attack' | 'midfield' | 'defense'

export interface Player {
  id: string
  name: string
  position: Position
  overall: number
  value: number
  wage: number
  stamina: number
  form: number
  fatigue: number
  injuryWeeks: number
  suspensionWeeks: number
  contractYears: number
}

export interface YouthPlayer {
  id: string
  name: string
  position: Position
  age: number
  overall: number
  potential: number
  progress: number
}

export interface SponsorDeal {
  name: string
  weeklyIncome: number
  targetRank: number
  seasonBonus: number
  seasonBonusPaid: boolean
}

export interface Team {
  id: string
  name: string
  budget: number
  morale: number
  attack: number
  midfield: number
  defense: number
  points: number
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  players: Player[]
  youthPlayers: YouthPlayer[]
  sponsor: SponsorDeal
  trainingFocus: TrainingFocus
}

export interface Fixture {
  id: string
  round: number
  homeTeamId: string
  awayTeamId: string
  played: boolean
  homeGoals?: number
  awayGoals?: number
}

export interface MatchResult {
  fixtureId: string
  homeTeamId: string
  awayTeamId: string
  homeGoals: number
  awayGoals: number
}

export interface LeagueState {
  currentRound: number
  totalRounds: number
  teams: Team[]
  fixtures: Fixture[]
  lastResults: MatchResult[]
  news: string[]
}

export interface ManagerGameState {
  id: string
  saveName: string
  createdAt: string
  updatedAt: string
  managerName: string
  managerTeamId: string
  managerLineup: string[]
  leagueState: LeagueState
}

export interface GameSummary {
  id: string
  saveName: string
  managerName: string
  managerTeamId: string
  managerTeamName: string
  currentRound: number
  totalRounds: number
  updatedAt: string
}

export interface TransferTarget {
  player: Player
  sellerTeamId: string
  sellerTeamName: string
  askingPrice: number
}
