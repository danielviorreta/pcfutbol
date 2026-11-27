import { describe, expect, it } from 'vitest'
import { createInitialLeagueState } from '../data/seedData'
import { CUP_SCHEDULE, createCup, findManagerCupTie, playCupRound } from './cup'
import { buildGame } from './gameUtils'
import { withSeed } from './random'
import { applyRoundResult, processRound } from './roundProcessing'
import type { ManagerGameState } from '../types/game'

describe('Copa del Rey', () => {
  it('starts with a first round of the weakest clubs and byes for the rest', () => {
    const { teams } = createInitialLeagueState()
    const cup = withSeed(1, () => createCup(teams)).value
    const firstRound = cup.rounds[0]

    expect(firstRound.ties).toHaveLength(18)
    expect(cup.byeTeamIds).toHaveLength(46)
    const division = (id: string) => teams.find((team) => team.id === id)!.division
    expect(firstRound.ties.flatMap((tie) => [tie.homeTeamId, tie.awayTeamId]).every((id) => division(id) === 'Primera Federacion')).toBe(true)
    expect(teams.filter((team) => team.division !== 'Primera Federacion').every((team) => cup.byeTeamIds.includes(team.id))).toBe(true)
  })

  it('plays a round only on its scheduled matchday and draws the next one', () => {
    const state = { ...createInitialLeagueState() }
    const offDay = playCupRound(state, 1, 'rma', [])
    expect(offDay.state).toBe(state)

    const played = withSeed(3, () => playCupRound(state, CUP_SCHEDULE[0].afterLeagueRound, 'rma', [])).value
    const [first, second] = played.state.cup!.rounds
    expect(first.ties.every((tie) => tie.winnerId)).toBe(true)
    expect(second.ties).toHaveLength(32)
    expect(played.finance).toHaveLength(18)
  })

  it('crowns a winner during the season and records it in the history', async () => {
    let game: ManagerGameState = { ...(await buildGame({ saveName: 'S', managerName: 'M', managerTeamId: 'rma' })), rngSeed: 12 }
    let winnerName: string | undefined

    for (let i = 0; i < 60 && !game.leagueState.seasonHistory?.length; i += 1) {
      game = applyRoundResult(game, processRound(game, game.managerLineup))
      const cup = game.leagueState.cup
      if (cup?.winnerId) {
        winnerName = game.leagueState.teams.find((team) => team.id === cup.winnerId)?.name
        expect(cup.rounds.map((round) => round.ties.length)).toEqual([18, 32, 16, 8, 4, 2, 1])
      }
    }

    expect(winnerName).toBeDefined()
    expect(game.leagueState.seasonHistory![0].cupWinner).toBe(winnerName)
    // A fresh cup is drawn for the new season.
    expect(game.leagueState.cup?.winnerId).toBeNull()
    expect(game.leagueState.cup?.rounds).toHaveLength(1)
    expect(findManagerCupTie(game.leagueState.cup, 'rma')).toBeNull()
  }, 30_000)
})
