import { describe, expect, it } from 'vitest'
import { getLineupIssues, getRoleFit, normalizeLineup, sanitizeLineupSelection } from './squad'
import type { Player, Team } from '../types/game'

function makePlayer(id: string, position: Player['position']): Player {
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
    overall: 70,
    value: 1_000_000,
    wage: 300_000,
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
  }
}

function makeTeam(players: Player[]): Team {
  return {
    id: 'team',
    name: 'Test Team',
    division: 'Primera',
    tactic: '4-3-3',
    stadium: {
      name: 'Test Stadium',
      capacity: 30_000,
      ticketPrice: 35,
      upgradeWeeksRemaining: 0,
    },
    budget: 20_000_000,
    morale: 75,
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
    players,
    youthPlayers: [],
    sponsor: {
      name: 'Sponsor',
      weeklyIncome: 100_000,
      targetRank: 4,
      seasonBonus: 500_000,
      seasonBonusPaid: false,
    },
    staff: {
      medicalLevel: 1,
      disciplineLevel: 1,
    },
    trainingFocus: 'fitness',
  }
}

describe('squad engine', () => {
  it('scores exact role fit as best match', () => {
    const defender = makePlayer('d1', 'DEF')

    const exact = getRoleFit(defender, 'CB')
    const near = getRoleFit(defender, 'DM')

    expect(exact).toBe(1)
    expect(exact).toBeGreaterThan(near)
  })

  it('normalizes lineup when there is no goalkeeper', () => {
    const players = [
      makePlayer('gk', 'GK'),
      makePlayer('d1', 'DEF'),
      makePlayer('d2', 'DEF'),
      makePlayer('d3', 'DEF'),
      makePlayer('d4', 'DEF'),
      makePlayer('m1', 'MID'),
      makePlayer('m2', 'MID'),
      makePlayer('m3', 'MID'),
      makePlayer('f1', 'FWD'),
      makePlayer('f2', 'FWD'),
      makePlayer('f3', 'FWD'),
      makePlayer('m4', 'MID'),
    ]
    const team = makeTeam(players)

    const lineupWithoutGoalkeeper = ['d1', 'd2', 'd3', 'd4', 'm1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3']
    const normalized = normalizeLineup(team, lineupWithoutGoalkeeper)

    expect(normalized).toHaveLength(11)
    expect(normalized).toContain('gk')
  })

  it('normalizes lineup when there are unavailable players', () => {
    const players = [
      { ...makePlayer('gk', 'GK'), injuryWeeks: 2 },
      makePlayer('d1', 'DEF'),
      makePlayer('d2', 'DEF'),
      makePlayer('d3', 'DEF'),
      makePlayer('d4', 'DEF'),
      makePlayer('m1', 'MID'),
      makePlayer('m2', 'MID'),
      makePlayer('m3', 'MID'),
      makePlayer('f1', 'FWD'),
      makePlayer('f2', 'FWD'),
      makePlayer('f3', 'FWD'),
      makePlayer('gk2', 'GK'),
    ]
    const team = makeTeam(players)

    const lineupWithUnavailable = ['gk', 'd1', 'd2', 'd3', 'd4', 'm1', 'm2', 'm3', 'f1', 'f2', 'f3']
    const normalized = normalizeLineup(team, lineupWithUnavailable)

    expect(normalized).toContain('gk2')
    expect(normalized).not.toContain('gk')
  })

  it('reports lineup issues without silently changing the selected players', () => {
    const players = [
      { ...makePlayer('gk', 'GK'), injuryWeeks: 1 },
      makePlayer('d1', 'DEF'),
      makePlayer('d2', 'DEF'),
      makePlayer('d3', 'DEF'),
      makePlayer('d4', 'DEF'),
      makePlayer('m1', 'MID'),
      makePlayer('m2', 'MID'),
      makePlayer('m3', 'MID'),
      makePlayer('f1', 'FWD'),
      makePlayer('f2', 'FWD'),
      makePlayer('f3', 'FWD'),
      makePlayer('gk2', 'GK'),
    ]
    const team = makeTeam(players)

    const selectedLineup = ['gk', 'd1', 'd2', 'd3', 'd4', 'm1', 'm2', 'm3', 'f1', 'f2', 'f3']

    expect(sanitizeLineupSelection(team, selectedLineup)).toEqual(selectedLineup)
    expect(getLineupIssues(team, selectedLineup)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'unavailable-player', playerId: 'gk' }),
      ]),
    )
  })
})
