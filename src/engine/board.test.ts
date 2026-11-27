import { describe, expect, it } from 'vitest'
import { createInitialLeagueState } from '../data/seedData'
import {
  applyBoardAfterRound,
  buildJobOffers,
  createBoardState,
  reviewSeason,
  setObjective,
  shouldSackMidSeason,
  takeJob,
  updateConfidence,
} from './board'
import { buildGame } from './gameUtils'
import type { BoardState, ManagerGameState } from '../types/game'

const league = () => createInitialLeagueState()
const teamById = (id: string) => league().teams.find((team) => team.id === id)!

function board(overrides: Partial<BoardState> = {}): BoardState {
  return {
    objective: { kind: 'top-half', targetPosition: 10, description: 'top 10' },
    confidence: 60,
    reputation: 60,
    status: 'employed',
    jobOffers: [],
    ...overrides,
  }
}

describe('board objectives', () => {
  it('asks big clubs for the title and small Primera clubs to survive', () => {
    const { teams } = league()
    expect(setObjective(teams, teams.find((team) => team.id === 'rma')!).kind).toBe('title')
    const weakest = teams
      .filter((team) => team.division === 'Primera')
      .sort((a, b) => a.players[0].overall - b.players[0].overall)
    const survivalCount = weakest.filter((team) => setObjective(teams, team).kind === 'survival').length
    expect(survivalCount).toBeGreaterThanOrEqual(5)
  })

  it('gives Segunda clubs promotion or survival targets', () => {
    const { teams } = league()
    const kinds = new Set(teams.filter((team) => team.division === 'Segunda').map((team) => setObjective(teams, team).kind))
    expect(kinds).toEqual(new Set(['promotion', 'playoff', 'survival']))
  })
})

describe('board confidence', () => {
  it('rises when on target and falls when far off it', () => {
    expect(updateConfidence(board(), 4, 'win', 0.5)).toBeGreaterThan(60)
    expect(updateConfidence(board(), 18, 'loss', 0.5)).toBeLessThan(60)
  })

  it('only sacks mid-season after the first part of the season', () => {
    expect(shouldSackMidSeason(5, 0.1)).toBe(false)
    expect(shouldSackMidSeason(5, 0.5)).toBe(true)
    expect(shouldSackMidSeason(40, 0.9)).toBe(false)
  })
})

describe('season review', () => {
  it('pays a bonus when the objective is met', () => {
    const verdict = reviewSeason(board(), 8, false, 'Primera')
    expect(verdict).toMatchObject({ met: true, sacked: false })
    expect(verdict.bonus).toBeGreaterThan(0)
  })

  it('forgives a near miss but sacks on a big miss or relegation', () => {
    expect(reviewSeason(board(), 12, false, 'Primera').sacked).toBe(false)
    expect(reviewSeason(board(), 15, false, 'Primera').sacked).toBe(true)
    expect(reviewSeason(board({ objective: { kind: 'survival', targetPosition: 17, description: 'x' } }), 18, true, 'Primera').sacked).toBe(true)
  })
})

describe('sacking and new jobs', () => {
  it('offers jobs at clubs the reputation allows', () => {
    const state = league()
    const lowRep = buildJobOffers(state, 'rma', 30)
    expect(lowRep.length).toBeGreaterThan(0)
    expect(lowRep.every((offer) => offer.competition.startsWith('Primera Federacion'))).toBe(true)
    expect(buildJobOffers(state, 'rma', 80).some((offer) => offer.competition === 'Primera')).toBe(true)
  })

  it('dismisses a manager whose confidence collapses, then lets them take a job', async () => {
    const game = await buildGame({ saveName: 'S', managerName: 'Mister', managerTeamId: 'rma' })
    const struggling: ManagerGameState = {
      ...game,
      board: board({ confidence: 13, objective: { kind: 'title', targetPosition: 1, description: 'liga' } }),
      leagueState: {
        ...game.leagueState,
        currentRound: 20,
        // Everyone else is well ahead, so the manager's club is bottom.
        teams: game.leagueState.teams.map((team) => (team.id === 'rma' ? { ...team, played: 19 } : { ...team, points: 30 })),
        lastResults: [{ fixtureId: 'f', homeTeamId: 'rma', awayTeamId: 'bar', homeGoals: 0, awayGoals: 3 }],
      },
    }

    const after = applyBoardAfterRound(struggling, struggling, false)
    expect(after.board?.status).toBe('sacked')
    expect(after.board?.jobOffers.length).toBeGreaterThan(0)

    const offer = after.board!.jobOffers[0]
    const hired = takeJob(after, offer)
    expect(hired.managerTeamId).toBe(offer.teamId)
    expect(hired.board?.status).toBe('employed')
    expect(hired.managerLineup).toHaveLength(11)
  })

  it('creates a board for saves that did not have one', () => {
    const team = teamById('get')
    expect(createBoardState(league().teams, team).status).toBe('employed')
  })
})
