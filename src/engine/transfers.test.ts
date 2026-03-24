import { describe, expect, it } from 'vitest'
import { buyPlayer, getTransferTargets } from './transfers'
import type { LeagueState, Player, Team } from '../types/game'

function makePlayer(id: string, name: string, overall: number, value: number): Player {
  return {
    id,
    name,
    position: 'MID',
    naturalPositions: ['CM'],
    overall,
    value,
    wage: 1_000_000,
    stamina: 80,
    form: 70,
    fatigue: 20,
    injuryWeeks: 0,
    suspensionWeeks: 0,
    yellowCards: 0,
    contractYears: 1,
  }
}

function makeTeam(id: string, name: string, budget: number, players: Player[]): Team {
  return {
    id,
    name,
    division: 'Segunda',
    regionalGroup: 'Grupo 1',
    tactic: '4-3-3',
    stadium: {
      name: `${name} Arena`,
      capacity: 20_000,
      ticketPrice: 30,
      upgradeWeeksRemaining: 0,
    },
    budget,
    morale: 75,
    attack: 70,
    midfield: 70,
    defense: 70,
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
      name: 'Patrocinador Test',
      weeklyIncome: 100_000,
      targetRank: 10,
      seasonBonus: 500_000,
      seasonBonusPaid: false,
    },
    staff: {
      medicalLevel: 1,
      disciplineLevel: 1,
    },
    trainingFocus: 'midfield',
  }
}

function makeState(teams: Team[]): LeagueState {
  return {
    currentRound: 1,
    totalRounds: 38,
    teams,
    fixtures: [],
    lastResults: [],
    news: [],
    promotionSummary: [],
    promotionBracket: null,
  }
}

describe('transfers engine', () => {
  it('returns market targets sorted by overall and excluding manager team', () => {
    const managerTeam = makeTeam('mgr', 'Manager FC', 10_000_000, [
      makePlayer('mgr-1', 'Manager Player', 75, 2_000_000),
    ])
    const rivalA = makeTeam('a', 'Rival A', 8_000_000, [
      makePlayer('a-1', 'A Top', 85, 6_000_000),
      makePlayer('a-2', 'A Mid', 73, 2_000_000),
    ])
    const rivalB = makeTeam('b', 'Rival B', 9_000_000, [
      makePlayer('b-1', 'B Good', 80, 4_000_000),
    ])

    const targets = getTransferTargets(makeState([managerTeam, rivalA, rivalB]), 'mgr')

    expect(targets.map((target) => target.player.id)).toEqual(['a-1', 'b-1', 'a-2'])
    expect(targets.some((target) => target.sellerTeamId === 'mgr')).toBe(false)
  })

  it('transfers player and updates budgets, morale and news on success', () => {
    const buyer = makeTeam('mgr', 'Manager FC', 12_000_000, [
      makePlayer('mgr-1', 'Manager Player', 75, 2_000_000),
    ])
    const sellerPlayer = makePlayer('a-1', 'A Top', 85, 6_000_000)
    const seller = makeTeam('a', 'Rival A', 4_000_000, [sellerPlayer])

    const state = makeState([buyer, seller])
    const result = buyPlayer(state, 'mgr', 'a-1')

    expect(result.ok).toBe(true)

    const nextBuyer = result.nextState.teams.find((team) => team.id === 'mgr')!
    const nextSeller = result.nextState.teams.find((team) => team.id === 'a')!
    const price = Math.round(sellerPlayer.value * 1.15)

    expect(nextBuyer.players.some((player) => player.id === 'a-1')).toBe(true)
    expect(nextSeller.players.some((player) => player.id === 'a-1')).toBe(false)
    expect(nextBuyer.budget).toBe(buyer.budget - price)
    expect(nextSeller.budget).toBe(seller.budget + price)
    expect(nextBuyer.morale).toBe(76)
    expect(nextSeller.morale).toBe(74)
    expect(result.nextState.news[0]).toContain('Fichaje cerrado: A Top llega a Manager FC.')
  })

  it('rejects transfer when manager budget is insufficient', () => {
    const buyer = makeTeam('mgr', 'Manager FC', 1_000_000, [
      makePlayer('mgr-1', 'Manager Player', 75, 2_000_000),
    ])
    const seller = makeTeam('a', 'Rival A', 4_000_000, [
      makePlayer('a-1', 'A Top', 85, 6_000_000),
    ])

    const state = makeState([buyer, seller])
    const result = buyPlayer(state, 'mgr', 'a-1')

    expect(result.ok).toBe(false)
    expect(result.message).toContain('No hay presupuesto suficiente')
    expect(result.nextState).toBe(state)
  })
})
