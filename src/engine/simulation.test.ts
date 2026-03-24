import { afterEach, describe, expect, it, vi } from 'vitest'
import { playCurrentRound } from './simulation'
import type { Fixture, LeagueState, Player, Team } from '../types/game'

function makePlayer(id: string, position: Player['position'], overall: number): Player {
  return {
    id,
    name: `Player ${id}`,
    position,
    naturalPositions:
      position === 'GK'
        ? ['GK']
        : position === 'DEF'
          ? ['CB', 'RB']
          : position === 'MID'
            ? ['CM', 'DM']
            : ['ST', 'CF'],
    overall,
    value: overall * overall * 10_000,
    wage: 500_000,
    stamina: 80,
    form: 70,
    fatigue: 25,
    injuryWeeks: 0,
    suspensionWeeks: 0,
    yellowCards: 0,
    contractYears: 3,
  }
}

function makeSquad(prefix: string, starterOverall: number, benchOverall: number): Player[] {
  const positions: Player['position'][] = [
    'GK',
    'DEF', 'DEF', 'DEF', 'DEF',
    'MID', 'MID', 'MID',
    'FWD', 'FWD', 'FWD',
    'GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD',
  ]

  return positions.map((position, index) => {
    const overall = index <= 10 ? starterOverall : benchOverall
    return makePlayer(`${prefix}-${index + 1}`, position, overall)
  })
}

function makeTeam(id: string, name: string, starterOverall: number, benchOverall: number): Team {
  const players = makeSquad(id, starterOverall, benchOverall)

  return {
    id,
    name,
    division: 'Primera',
    tactic: '4-3-3',
    stadium: {
      name: `${name} Stadium`,
      capacity: 45_000,
      ticketPrice: 35,
      upgradeWeeksRemaining: 0,
    },
    budget: 40_000_000,
    morale: 74,
    attack: starterOverall,
    midfield: starterOverall,
    defense: starterOverall,
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    players,
    youthPlayers: [],
    sponsor: {
      name: 'Sponsor Test',
      weeklyIncome: 200_000,
      targetRank: 8,
      seasonBonus: 1_000_000,
      seasonBonusPaid: false,
    },
    staff: {
      medicalLevel: 1,
      disciplineLevel: 1,
    },
    trainingFocus: 'fitness',
  }
}

function makeState(homeTeam: Team, awayTeam: Team): { state: LeagueState; fixture: Fixture } {
  const fixture: Fixture = {
    id: 'f1',
    round: 1,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    played: false,
  }

  return {
    fixture,
    state: {
      currentRound: 1,
      totalRounds: 38,
      teams: [homeTeam, awayTeam],
      fixtures: [fixture],
      lastResults: [],
      news: [],
      promotionSummary: [],
      promotionBracket: null,
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('simulation engine', () => {
  it('applies stronger bench impact in second half under identical randomness', () => {
    const away = makeTeam('away', 'Away FC', 76, 70)

    const weakBenchHome = makeTeam('home', 'Home FC', 70, 58)
    const strongBenchHome = makeTeam('home', 'Home FC', 70, 88)

    const weakSetup = makeState(weakBenchHome, away)
    const strongSetup = makeState(strongBenchHome, away)

    const managerLineup = weakBenchHome.players.slice(0, 11).map((player) => player.id)

    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const weakResult = playCurrentRound(weakSetup.state, {
      managerTeamId: 'home',
      managerLineup,
    })

    vi.restoreAllMocks()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const strongResult = playCurrentRound(strongSetup.state, {
      managerTeamId: 'home',
      managerLineup,
    })

    const weakMatch = weakResult.lastResults[0]
    const strongMatch = strongResult.lastResults[0]

    expect(strongMatch.homeGoals).toBeGreaterThanOrEqual(weakMatch.homeGoals)
    expect(strongMatch.awayGoals).toBeLessThanOrEqual(weakMatch.awayGoals)
  })

  it('marks fixtures as played and advances round after simulation', () => {
    const home = makeTeam('home', 'Home FC', 72, 68)
    const away = makeTeam('away', 'Away FC', 72, 68)
    const { state, fixture } = makeState(home, away)

    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const nextState = playCurrentRound(state, {
      managerTeamId: 'home',
      managerLineup: home.players.slice(0, 11).map((player) => player.id),
    })

    expect(nextState.currentRound).toBe(2)
    expect(nextState.lastResults).toHaveLength(1)

    const playedFixture = nextState.fixtures.find((item) => item.id === fixture.id)
    expect(playedFixture?.played).toBe(true)
    expect(typeof playedFixture?.homeGoals).toBe('number')
    expect(typeof playedFixture?.awayGoals).toBe('number')
  })
})
