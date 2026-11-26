import { describe, expect, it } from 'vitest'
import { buildGame } from './gameUtils'
import { applyRoundResult, processRound } from './roundProcessing'

describe('processRound', () => {
  it('is reproducible for the same save', async () => {
    const game = { ...(await buildGame({ saveName: 'Test', managerName: 'Mister', managerTeamId: 'rma' })), rngSeed: 2026 }

    const first = processRound(game, game.managerLineup)
    const second = processRound(game, game.managerLineup)

    expect(second.stateAfterOutgoing.lastResults).toEqual(first.stateAfterOutgoing.lastResults)
    expect(second.stateAfterOutgoing.teams).toEqual(first.stateAfterOutgoing.teams)
    expect(second.nextRngSeed).toBe(first.nextRngSeed)
  })

  it('stores the advanced seed and plays every fixture of the round', async () => {
    const game = { ...(await buildGame({ saveName: 'Test', managerName: 'Mister', managerTeamId: 'rma' })), rngSeed: 7 }

    const next = applyRoundResult(game, processRound(game, game.managerLineup))

    expect(next.rngSeed).not.toBe(7)
    expect(next.leagueState.currentRound).toBe(2)
    expect(next.leagueState.fixtures.filter((fixture) => fixture.round === 1).every((fixture) => fixture.played)).toBe(true)
  })
})
