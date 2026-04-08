import { describe, expect, it } from 'vitest'
import {
  buildGoalRecords,
  buildLineupWarning,
  buildMatchCommentary,
  buildMatchIncidents,
  buildMatchStats,
  buildMatchSubstitutions,
  buildMatchTacticalChanges,
} from './matchPresentation'
import type { MatchIncidentRecord, MatchStats, Player, Team } from '../types/game'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makePlayer(id: string, position: Player['position'], overall = 75, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `P-${id}`,
    position,
    naturalPositions:
      position === 'GK' ? ['GK'] :
      position === 'DEF' ? ['CB', 'RB'] :
      position === 'MID' ? ['CM', 'DM'] :
      ['ST', 'CF'],
    overall,
    value: 1_000_000,
    wage: 50_000,
    releaseClause: 2_000_000,
    transferListed: false,
    askingPrice: 2_000_000,
    happiness: 70,
    stamina: 80,
    form: 70,
    fatigue: 20,
    injuryWeeks: 0,
    suspensionWeeks: 0,
    yellowCards: 0,
    contractYears: 3,
    ...overrides,
  }
}

function makeLineup(team: Team): string[] {
  // GK + 4 DEF + 3 MID + 3 FWD = 11
  const gk = team.players.find((p) => p.position === 'GK')
  const defs = team.players.filter((p) => p.position === 'DEF').slice(0, 4)
  const mids = team.players.filter((p) => p.position === 'MID').slice(0, 3)
  const fwds = team.players.filter((p) => p.position === 'FWD').slice(0, 3)
  return [gk, ...defs, ...mids, ...fwds].filter(Boolean).map((p) => p!.id)
}

function makeTeam(id: string, name: string, overrides: Partial<Team> = {}): Team {
  const starters: Player[] = [
    makePlayer(`${id}-gk`, 'GK'),
    makePlayer(`${id}-d1`, 'DEF'),
    makePlayer(`${id}-d2`, 'DEF'),
    makePlayer(`${id}-d3`, 'DEF'),
    makePlayer(`${id}-d4`, 'DEF'),
    makePlayer(`${id}-m1`, 'MID'),
    makePlayer(`${id}-m2`, 'MID'),
    makePlayer(`${id}-m3`, 'MID'),
    makePlayer(`${id}-f1`, 'FWD', 80),
    makePlayer(`${id}-f2`, 'FWD', 80),
    makePlayer(`${id}-f3`, 'FWD', 80),
  ]
  const bench: Player[] = [
    makePlayer(`${id}-b1`, 'GK'),
    makePlayer(`${id}-b2`, 'DEF'),
    makePlayer(`${id}-b3`, 'MID'),
    makePlayer(`${id}-b4`, 'FWD'),
  ]

  return {
    id,
    name,
    division: 'Primera',
    tactic: '4-3-3',
    stadium: { name: `${name} Stadium`, capacity: 50_000, ticketPrice: 35 },
    budget: 30_000_000,
    morale: 70,
    attack: 75,
    midfield: 75,
    defense: 75,
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    players: [...starters, ...bench],
    youthPlayers: [],
    sponsor: { name: 'Sponsor', weeklyIncome: 100_000, targetRank: 10, seasonBonus: 500_000, seasonBonusPaid: false },
    staff: { medicalLevel: 1, disciplineLevel: 1 },
    trainingFocus: 'fitness',
    ...overrides,
  }
}

function makeStats(overrides: Partial<MatchStats> = {}): MatchStats {
  return {
    home: { possession: 55, shots: 12, shotsOnTarget: 5, bigChances: 3 },
    away: { possession: 45, shots: 9, shotsOnTarget: 3, bigChances: 2 },
    attendance: 35_000,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildLineupWarning
// ---------------------------------------------------------------------------

describe('buildLineupWarning', () => {
  it('returns null for a valid 11-player lineup with a GK', () => {
    const team = makeTeam('home', 'Home FC')
    const lineup = makeLineup(team)
    expect(buildLineupWarning(team, lineup)).toBeNull()
  })

  it('returns a warning when lineup has fewer than 11 players', () => {
    const team = makeTeam('home', 'Home FC')
    const lineup = makeLineup(team).slice(0, 6)
    const warning = buildLineupWarning(team, lineup)
    expect(warning).not.toBeNull()
    expect(warning).toContain('11 jugadores')
  })

  it('returns a warning when an injured player is in the lineup', () => {
    const team = makeTeam('home', 'Home FC')
    const injuredId = `home-f1`
    const injured = team.players.find((p) => p.id === injuredId)!
    team.players = team.players.map((p) =>
      p.id === injuredId ? { ...injured, injuryWeeks: 2 } : p,
    )
    const lineup = makeLineup(team)
    const warning = buildLineupWarning(team, lineup)
    expect(warning).not.toBeNull()
    expect(warning).toContain('no disponibles')
    expect(warning).toContain('P-home-f1')
  })
})

// ---------------------------------------------------------------------------
// buildMatchStats
// ---------------------------------------------------------------------------

describe('buildMatchStats', () => {
  it('possession sums to 100', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const homeLineup = makeLineup(home)
    const awayLineup = makeLineup(away)
    const stats = buildMatchStats(home, away, homeLineup, awayLineup, 1, 0)
    expect(stats.home.possession + stats.away.possession).toBe(100)
  })

  it('shotsOnTarget is between goals and shots', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const homeLineup = makeLineup(home)
    const awayLineup = makeLineup(away)
    const homeGoals = 2
    const awayGoals = 1
    const stats = buildMatchStats(home, away, homeLineup, awayLineup, homeGoals, awayGoals)
    expect(stats.home.shotsOnTarget).toBeGreaterThanOrEqual(homeGoals)
    expect(stats.home.shotsOnTarget).toBeLessThanOrEqual(stats.home.shots)
    expect(stats.away.shotsOnTarget).toBeGreaterThanOrEqual(awayGoals)
    expect(stats.away.shotsOnTarget).toBeLessThanOrEqual(stats.away.shots)
  })

  it('attendance is positive', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const stats = buildMatchStats(home, away, makeLineup(home), makeLineup(away), 0, 0)
    expect(stats.attendance).toBeGreaterThan(0)
  })

  it('possession is clamped between 35 and 65', () => {
    // Make away team far stronger to push possession to extreme
    const home = makeTeam('h', 'Home', { morale: 50, midfield: 40 })
    const away = makeTeam('a', 'Away', { morale: 99, midfield: 99 })
    const stats = buildMatchStats(home, away, makeLineup(home), makeLineup(away), 0, 3)
    expect(stats.home.possession).toBeGreaterThanOrEqual(35)
    expect(stats.home.possession).toBeLessThanOrEqual(65)
  })
})

// ---------------------------------------------------------------------------
// buildGoalRecords
// ---------------------------------------------------------------------------

describe('buildGoalRecords', () => {
  it('returns empty array for 0 goals', () => {
    const team = makeTeam('home', 'Home FC')
    expect(buildGoalRecords(team, makeLineup(team), 0, team.id)).toHaveLength(0)
  })

  it('returns one record per goal', () => {
    const team = makeTeam('home', 'Home FC')
    const records = buildGoalRecords(team, makeLineup(team), 3, team.id)
    expect(records).toHaveLength(3)
  })

  it('goal records have teamId, scorer and minute fields', () => {
    const team = makeTeam('home', 'Home FC')
    const records = buildGoalRecords(team, makeLineup(team), 2, team.id)
    for (const record of records) {
      expect(record.teamId).toBe(team.id)
      expect(typeof record.scorer).toBe('string')
      expect(record.scorer.length).toBeGreaterThan(0)
      expect(typeof record.minute).toBe('number')
    }
  })

  it('applies minuteOffset correctly', () => {
    const team = makeTeam('home', 'Home FC')
    const base = buildGoalRecords(team, makeLineup(team), 2, team.id, 0)
    const offset = buildGoalRecords(team, makeLineup(team), 2, team.id, 4)
    for (let i = 0; i < base.length; i++) {
      expect(offset[i].minute).toBe(base[i].minute + 4)
    }
  })

  it('minutes are sorted ascending', () => {
    const team = makeTeam('home', 'Home FC')
    const records = buildGoalRecords(team, makeLineup(team), 5, team.id)
    for (let i = 1; i < records.length; i++) {
      expect(records[i].minute).toBeGreaterThanOrEqual(records[i - 1].minute)
    }
  })
})

// ---------------------------------------------------------------------------
// buildMatchIncidents
// ---------------------------------------------------------------------------

describe('buildMatchIncidents', () => {
  it('returns empty array when no changes between before and after', () => {
    const team = makeTeam('h', 'Home')
    const incidents = buildMatchIncidents(team, team, team, team)
    expect(incidents).toHaveLength(0)
  })

  it('detects yellow card when yellowCards increases', () => {
    const team = makeTeam('h', 'Home')
    const playerId = `h-m1`
    const playerBefore = team.players.find((p) => p.id === playerId)!
    const teamAfter: Team = {
      ...team,
      players: team.players.map((p) =>
        p.id === playerId ? { ...playerBefore, yellowCards: playerBefore.yellowCards + 1 } : p,
      ),
    }
    const incidents = buildMatchIncidents(team, team, teamAfter, team)
    const yellow = incidents.find((i) => i.type === 'yellow' && i.player === playerBefore.name)
    expect(yellow).toBeDefined()
  })

  it('detects injury when injuryWeeks increases', () => {
    const team = makeTeam('h', 'Home')
    const playerId = `h-f1`
    const playerBefore = team.players.find((p) => p.id === playerId)!
    const teamAfter: Team = {
      ...team,
      players: team.players.map((p) =>
        p.id === playerId ? { ...playerBefore, injuryWeeks: 2 } : p,
      ),
    }
    const incidents = buildMatchIncidents(team, team, teamAfter, team)
    const injury = incidents.find((i) => i.type === 'injury' && i.player === playerBefore.name)
    expect(injury).toBeDefined()
  })

  it('incidents are sorted by minute', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const hPlayerId = `h-m1`
    const aPlayerId = `a-d1`
    const homeAfter: Team = {
      ...home,
      players: home.players.map((p) =>
        p.id === hPlayerId ? { ...p, yellowCards: p.yellowCards + 1 } : p,
      ),
    }
    const awayAfter: Team = {
      ...away,
      players: away.players.map((p) =>
        p.id === aPlayerId ? { ...p, injuryWeeks: 1 } : p,
      ),
    }
    const incidents = buildMatchIncidents(home, away, homeAfter, awayAfter)
    for (let i = 1; i < incidents.length; i++) {
      expect(incidents[i].minute).toBeGreaterThanOrEqual(incidents[i - 1].minute)
    }
  })
})

// ---------------------------------------------------------------------------
// buildMatchSubstitutions
// ---------------------------------------------------------------------------

describe('buildMatchSubstitutions', () => {
  it('returns substitutions sorted by minute', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const incidents: MatchIncidentRecord[] = []
    const subs = buildMatchSubstitutions(home, away, makeLineup(home), makeLineup(away), incidents)
    for (let i = 1; i < subs.length; i++) {
      expect(subs[i].minute).toBeGreaterThanOrEqual(subs[i - 1].minute)
    }
  })

  it('all substitution minutes are in range 1-90', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const incidents: MatchIncidentRecord[] = []
    const subs = buildMatchSubstitutions(home, away, makeLineup(home), makeLineup(away), incidents)
    for (const sub of subs) {
      expect(sub.minute).toBeGreaterThanOrEqual(1)
      expect(sub.minute).toBeLessThanOrEqual(90)
    }
  })

  it('makes an injury substitution when injury incident present', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const homeLineup = makeLineup(home)
    const injuredPlayerName = home.players.find((p) => p.id === homeLineup[0])?.name ?? ''
    const incidents: MatchIncidentRecord[] = [
      { minute: 30, teamId: home.id, player: injuredPlayerName, type: 'injury' },
    ]
    const subs = buildMatchSubstitutions(home, away, homeLineup, makeLineup(away), incidents)
    const injurySub = subs.find((s) => s.playerOut === injuredPlayerName && s.reason === 'injury')
    expect(injurySub).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// buildMatchTacticalChanges
// ---------------------------------------------------------------------------

describe('buildMatchTacticalChanges', () => {
  it('returns exactly two changes (one per team)', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const changes = buildMatchTacticalChanges(home, away, 1, 0)
    expect(changes).toHaveLength(2)
  })

  it('assigns correct teamId to each change', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const changes = buildMatchTacticalChanges(home, away, 0, 1)
    expect(changes.find((c) => c.teamId === home.id)).toBeDefined()
    expect(changes.find((c) => c.teamId === away.id)).toBeDefined()
  })

  it('home losing gives offensive adjustment text', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const changes = buildMatchTacticalChanges(home, away, 0, 2) // home losing
    const homeChange = changes.find((c) => c.teamId === home.id)!
    expect(homeChange.summary).toContain('ofensivo')
  })

  it('home winning gives conservative adjustment text', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const changes = buildMatchTacticalChanges(home, away, 2, 0) // home winning
    const homeChange = changes.find((c) => c.teamId === home.id)!
    expect(homeChange.summary).toContain('conservador')
  })
})

// ---------------------------------------------------------------------------
// buildMatchCommentary
// ---------------------------------------------------------------------------

describe('buildMatchCommentary', () => {
  it('includes opening, halftime and final events', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const stats = makeStats()
    const commentary = buildMatchCommentary(home, away, 1, 0, stats, [], [], [], [])

    expect(commentary.find((e) => e.minute === 1)).toBeDefined()
    expect(commentary.find((e) => e.kind === 'final')).toBeDefined()
    expect(commentary.find((e) => e.minute === 45)).toBeDefined()
  })

  it('events are sorted by minute', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const goals = buildGoalRecords(home, makeLineup(home), 2, home.id)
    const commentary = buildMatchCommentary(home, away, 2, 0, makeStats(), goals, [], [], [])
    for (let i = 1; i < commentary.length; i++) {
      expect(commentary[i].minute).toBeGreaterThanOrEqual(commentary[i - 1].minute)
    }
  })

  it('goal events have incremental score', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const goals = buildGoalRecords(home, makeLineup(home), 2, home.id)
    const commentary = buildMatchCommentary(home, away, 2, 0, makeStats(), goals, [], [], [])
    const goalEvents = commentary.filter((e) => e.kind === 'goal')
    expect(goalEvents).toHaveLength(2)
    expect(goalEvents[0].scoreHome).toBe(1)
    expect(goalEvents[1].scoreHome).toBe(2)
  })

  it('final event shows correct score', () => {
    const home = makeTeam('h', 'Home')
    const away = makeTeam('a', 'Away')
    const commentary = buildMatchCommentary(home, away, 2, 3, makeStats(), [], [], [], [])
    const final = commentary.find((e) => e.kind === 'final')!
    expect(final.scoreHome).toBe(2)
    expect(final.scoreAway).toBe(3)
  })
})
