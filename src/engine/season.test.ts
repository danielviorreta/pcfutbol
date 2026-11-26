import { describe, expect, it } from 'vitest'
import { buildGame } from './gameUtils'
import { applyRoundResult, processRound } from './roundProcessing'
import type { ManagerGameState } from '../types/game'

describe('full season', () => {
  it('plays every fixture, rolls over and keeps the leagues consistent', async () => {
    let game: ManagerGameState = { ...(await buildGame({ saveName: 'S', managerName: 'M', managerTeamId: 'rma' })), rngSeed: 2026 }
    const totalRounds = game.leagueState.totalRounds
    let rolledOver = false

    for (let round = 0; round < totalRounds + 1 && !rolledOver; round += 1) {
      const result = processRound(game, game.managerLineup)
      rolledOver = result.seasonRolledOver
      if (!rolledOver) {
        expect(result.stateAfterOutgoing.fixtures.filter((f) => f.round <= round + 1).every((f) => f.played)).toBe(true)
      }
      game = applyRoundResult(game, result)
    }

    expect(rolledOver).toBe(true)
    expect(game.seasonStartYear).toBe(2027)

    const { teams, fixtures, currentRound } = game.leagueState
    expect(currentRound).toBe(1)
    expect(fixtures.every((fixture) => !fixture.played)).toBe(true)
    expect(teams.filter((team) => team.division === 'Primera')).toHaveLength(20)
    expect(teams.filter((team) => team.division === 'Segunda')).toHaveLength(22)
    expect(teams.filter((team) => team.division === 'Primera Federacion')).toHaveLength(40)
    expect(teams.every((team) => Number.isFinite(team.budget) && team.players.length >= 11)).toBe(true)
  }, 30_000)
})
