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
export type Division = 'Primera' | 'Segunda' | 'Primera Federacion'
export type CompetitionGroup = 'Grupo 1' | 'Grupo 2'
export type PromisedRole = 'estrella' | 'titular' | 'rotacion' | 'banquillo'

export interface Player {
  id: string
  name: string
  age?: number
  position: Position
  naturalPositions?: RolePosition[]
  overall: number
  value: number
  wage: number
  releaseClause: number
  transferListed: boolean
  askingPrice: number
  happiness: number
  stamina: number
  form: number
  fatigue: number
  injuryWeeks: number
  suspensionWeeks: number
  yellowCards: number
  contractYears: number
  recentMinutes?: number[]
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
  division: Division
  group?: CompetitionGroup
  regionalGroup?: CompetitionGroup
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

export interface PendingRenewalOffer {
  id: string
  playerId: string
  playerName: string
  wageOffer: number
  contractYears: number
  signingBonus: number
  createdRound: number
}

export interface IncomingTransferOffer {
  id: string
  buyerTeamId: string
  buyerTeamName: string
  playerId: string
  playerName: string
  transferFee: number
  releaseClause: number
  wageOffer: number
  signingBonus: number
  contractYears: number
  promisedRole: PromisedRole
  createdRound: number
}

export interface MatchPresentation {
  phase: 'preview' | 'result'
  round: number
  fixtureId: string
  homeTeamId: string
  awayTeamId: string
  homeLineup: string[]
  awayLineup: string[]
  result?: MatchResult
  stats?: MatchStats
  commentary?: MatchCommentaryEvent[]
  goals?: MatchGoalRecord[]
  incidents?: MatchIncidentRecord[]
  substitutions?: MatchSubstitutionRecord[]
  tacticalChanges?: MatchTacticalChangeRecord[]
}

export interface MatchStatsSide {
  possession: number
  shots: number
  shotsOnTarget: number
  bigChances: number
}

export interface MatchStats {
  home: MatchStatsSide
  away: MatchStatsSide
  attendance: number
}

export interface MatchCommentaryEvent {
  minute: number
  text: string
  kind?: 'general' | 'goal' | 'incident' | 'substitution' | 'tactical' | 'final'
  teamId?: string
  scoreHome?: number
  scoreAway?: number
}

export interface MatchGoalRecord {
  minute: number
  teamId: string
  scorer: string
  assist?: string
}

export interface MatchIncidentRecord {
  minute: number
  teamId: string
  player: string
  type: 'yellow' | 'red' | 'injury'
  detail?: string
}

export interface MatchSubstitutionRecord {
  minute: number
  teamId: string
  playerOut: string
  playerIn: string
  reason: 'tactical' | 'injury' | 'fatigue'
}

export interface MatchTacticalChangeRecord {
  minute: number
  teamId: string
  summary: string
}

export interface PlayoffLeg {
  homeTeam: string
  awayTeam: string
  homeGoals: number
  awayGoals: number
}

export interface PlayoffTie {
  label: string
  teamA: string
  teamB: string
  legs: PlayoffLeg[]
  winner: string
}

export interface PromotionBracket {
  segundaToPrimera: {
    directPromotions: string[]
    playoffTeams: string[]
    semiFinals: PlayoffTie[]
    final?: PlayoffTie | null
    playoffWinner?: string
    relegatedFromPrimera: string[]
  }
  federacionToSegunda: {
    directPromotions: string[]
    playoffTeams: string[]
    quarterFinals: PlayoffTie[]
    semiFinals: PlayoffTie[]
    final?: PlayoffTie | null
    playoffWinners: string[]
    relegatedFromSegunda: string[]
  }
}

export interface LeagueState {
  currentRound: number
  totalRounds: number
  teams: Team[]
  fixtures: Fixture[]
  lastResults: MatchResult[]
  news: string[]
  promotionSummary: string[]
  promotionBracket: PromotionBracket | null
}

export interface ManagerGameState {
  id: string
  saveName: string
  createdAt: string
  updatedAt: string
  seasonStartYear: number
  managerName: string
  managerTeamId: string
  managerLineup: string[]
  pendingTransferOffers: IncomingTransferOffer[]
  pendingRenewalOffers: PendingRenewalOffer[]
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
  sellerDivision: Division
  sellerGroup?: CompetitionGroup
  marketPrice: number
  isTransferListed: boolean
  releaseClause: number
  recommendedWage: number
  recommendedSigningBonus: number
  recommendedContractYears: number
  recommendedPromisedRole: PromisedRole
  interestLabel: string
}
