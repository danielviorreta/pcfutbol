import { describe, expect, it, vi } from 'vitest'
import { buyPlayer, getTransferTargets, simulateAiTransferWindow } from './transfers'
import { estimatePlayerValue, estimateReleaseClause } from './playerMarket'
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
    releaseClause: Math.round(value * 2),
    transferListed: false,
    askingPrice: Math.round(value * 2),
    happiness: 60,
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
  it('scales base player value down for lower divisions', () => {
    const primeraValue = estimatePlayerValue(74, 'Primera', 24)
    const segundaValue = estimatePlayerValue(74, 'Segunda', 24)
    const federacionValue = estimatePlayerValue(74, 'Primera Federacion', 24)

    expect(segundaValue).toBeLessThan(primeraValue)
    expect(federacionValue).toBeLessThan(segundaValue)
    expect(primeraValue).toBeGreaterThan(4_000_000)
    expect(primeraValue).toBeLessThan(5_500_000)
    expect(segundaValue).toBeGreaterThan(1_400_000)
    expect(segundaValue).toBeLessThan(2_300_000)
    expect(federacionValue).toBeGreaterThan(500_000)
    expect(federacionValue).toBeLessThan(950_000)
  })

  it('keeps Primera Federacion release clauses in a realistic range', () => {
    const team = makeTeam('pf', 'Federacion FC', 2_500_000, [])
    team.division = 'Primera Federacion'
    team.attack = 74
    team.midfield = 73
    team.defense = 72

    const value = estimatePlayerValue(78, 'Primera Federacion', 24)
    const clause = estimateReleaseClause(
      {
        value,
        overall: 78,
        wage: 420_000,
        contractYears: 5,
      },
      team,
      74,
    )

    expect(clause).toBeLessThan(4_500_000)
  })

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
    expect(targets[0].releaseClause).toBe(rivalA.players[0].releaseClause)
    expect(targets[0].recommendedContractYears).toBeGreaterThanOrEqual(2)
  })

  it('transfers player and updates budgets, morale and news on success', () => {
    const buyer = makeTeam('mgr', 'Manager FC', 16_000_000, [
      makePlayer('mgr-1', 'Manager Player', 75, 2_000_000),
    ])
    buyer.division = 'Primera'
    buyer.attack = 84
    buyer.midfield = 84
    buyer.defense = 82
    const sellerPlayer = makePlayer('a-1', 'A Top', 85, 6_000_000)
    sellerPlayer.happiness = 54
    sellerPlayer.contractYears = 1
    sellerPlayer.transferListed = true
    sellerPlayer.askingPrice = 8_000_000
    const seller = makeTeam('a', 'Rival A', 4_000_000, [sellerPlayer])

    const state = makeState([buyer, seller])
    const signingBonus = 1_000_000
    const result = buyPlayer(state, 'mgr', 'a-1', 1_350_000, signingBonus, 4, 'titular')

    expect(result.ok).toBe(true)

    const nextBuyer = result.nextState.teams.find((team) => team.id === 'mgr')!
    const nextSeller = result.nextState.teams.find((team) => team.id === 'a')!
    const price = sellerPlayer.askingPrice

    expect(nextBuyer.players.some((player) => player.id === 'a-1')).toBe(true)
    expect(nextSeller.players.some((player) => player.id === 'a-1')).toBe(false)
    expect(nextBuyer.budget).toBe(buyer.budget - price - signingBonus)
    expect(nextSeller.budget).toBe(seller.budget + price)
    expect(nextBuyer.morale).toBe(76)
    expect(nextSeller.morale).toBe(74)
    expect(result.nextState.news[0]).toContain('Mercado: A Top deja Rival A y firma por Manager FC.')
  })

  it('rejects transfer when manager budget is insufficient', () => {
    const buyer = makeTeam('mgr', 'Manager FC', 1_000_000, [
      makePlayer('mgr-1', 'Manager Player', 75, 2_000_000),
    ])
    const seller = makeTeam('a', 'Rival A', 4_000_000, [
      makePlayer('a-1', 'A Top', 85, 6_000_000),
    ])

    const state = makeState([buyer, seller])
    const result = buyPlayer(state, 'mgr', 'a-1', 1_200_000, 400_000, 3, 'titular')

    expect(result.ok).toBe(false)
    expect(result.message).toContain('No hay presupuesto suficiente')
    expect(result.nextState).toBe(state)
  })

  it('rejects transfer when the player does not want to join despite paying the clause', () => {
    const buyer = makeTeam('mgr', 'Manager FC', 30_000_000, [
      makePlayer('mgr-1', 'Manager Player', 75, 2_000_000),
    ])
    buyer.division = 'Primera Federacion'
    buyer.attack = 62
    buyer.midfield = 62
    buyer.defense = 61
    buyer.morale = 66

    const sellerPlayer = makePlayer('a-1', 'A Top', 85, 6_000_000)
    sellerPlayer.happiness = 86
    sellerPlayer.contractYears = 4
    const seller = makeTeam('a', 'Rival A', 40_000_000, [sellerPlayer])
    seller.division = 'Primera'
    seller.attack = 87
    seller.midfield = 86
    seller.defense = 84

    const state = makeState([buyer, seller])
    const result = buyPlayer(state, 'mgr', 'a-1', 1_050_000, 250_000, 2, 'banquillo')

    expect(result.ok).toBe(false)
    expect(result.message).toContain('rechaza la oferta')
    expect(result.nextState).toBe(state)
  })

  it('lets AI clubs complete signings during transfer windows', () => {
    const manager = makeTeam('mgr', 'Manager FC', 15_000_000, [
      makePlayer('mgr-1', 'Manager Player', 75, 2_000_000),
    ])
    const buyer = makeTeam('buy', 'Buyer FC', 90_000_000, [
      makePlayer('buy-1', 'Buyer Mid', 76, 4_000_000),
    ])
    buyer.division = 'Primera'
    buyer.attack = 86
    buyer.midfield = 86
    buyer.defense = 84
    const sellerStar = makePlayer('sell-1', 'Sell Star', 84, 8_000_000)
    sellerStar.happiness = 50
    sellerStar.contractYears = 1
    const filler = Array.from({ length: 18 }, (_, index) => makePlayer(`sell-${index + 2}`, `Extra ${index}`, 68, 1_500_000))
    const seller = makeTeam('sell', 'Seller FC', 8_000_000, [sellerStar, ...filler])
    seller.division = 'Segunda'
    seller.attack = 70
    seller.midfield = 69
    seller.defense = 68

    const state = makeState([manager, buyer, seller])
    state.currentRound = 2

    const random = vi.spyOn(Math, 'random').mockReturnValue(0.3)

    const result = simulateAiTransferWindow(state, 'mgr')
    random.mockRestore()

    const nextBuyer = result.nextState.teams.find((team) => team.id === 'buy')!
    const nextSeller = result.nextState.teams.find((team) => team.id === 'sell')!

    expect(result.headlines.length).toBeGreaterThan(0)
    expect(nextBuyer.players.some((player) => player.id === 'sell-1')).toBe(true)
    expect(nextSeller.players.some((player) => player.id === 'sell-1')).toBe(false)
  })

  it('lets AI list players for sale even outside transfer windows', () => {
    const manager = makeTeam('mgr', 'Manager FC', 15_000_000, [
      makePlayer('mgr-1', 'Manager Player', 75, 2_000_000),
    ])

    const aiPlayer = makePlayer('ai-1', 'Contract Risk', 74, 3_500_000)
    aiPlayer.contractYears = 1
    aiPlayer.happiness = 57

    const aiTeam = makeTeam('ai', 'AI FC', 14_000_000, [
      aiPlayer,
      ...Array.from({ length: 18 }, (_, index) => makePlayer(`ai-${index + 2}`, `AI Extra ${index}`, 69, 1_800_000)),
    ])

    const state = makeState([manager, aiTeam])
    state.currentRound = 6

    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = simulateAiTransferWindow(state, 'mgr')
    random.mockRestore()

    const nextAiTeam = result.nextState.teams.find((team) => team.id === 'ai')
    const listedCount = nextAiTeam?.players.filter((player) => player.transferListed).length ?? 0

    expect(listedCount).toBeGreaterThan(0)
    expect(result.headlines.some((headline) => headline.includes('en venta'))).toBe(true)
    expect(result.incomingOffers).toHaveLength(0)
  })
})
