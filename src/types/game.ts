export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'
export type RolePosition =
  | 'GK'
  | 'RB'
  | 'CB'
  | 'LB'
  | 'RWB'
  | 'LWB'
  | 'DM'
  | 'CM'
  | 'AM'
  | 'RM'
  | 'LM'
  | 'RW'
  | 'LW'
  | 'CF'
  | 'ST'
export type Tactic = '4-3-3' | '4-4-2' | '5-4-1'
export type TrainingFocus = 'fitness' | 'attack' | 'midfield' | 'defense'

export interface Player {
  id: string
  name: string
  position: Position
  naturalPositions?: RolePosition[]
  overall: number
  value: number
  wage: number
  stamina: number
  form: number
  fatigue: number
  injuryWeeks: number
  suspensionWeeks: number
  yellowCards: number
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

export interface Stadium {
  name: string
  capacity: number
  ticketPrice: number
  upgradeWeeksRemaining?: number
}

export interface SponsorDeal {
  name: string
  weeklyIncome: number
  targetRank: number
  seasonBonus: number
  seasonBonusPaid: boolean
}

export interface ClubStaff {
  medicalLevel: number
  disciplineLevel: number
}

export interface Team {
  id: string
  name: string
  crestUrl?: string
  tactic: Tactic
  stadium: Stadium
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
  staff: ClubStaff
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
