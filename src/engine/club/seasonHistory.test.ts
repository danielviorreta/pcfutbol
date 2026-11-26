import { describe, expect, it } from 'vitest'
import { buildGame } from '../gameUtils'
import { applyRoundResult, processRound } from '../roundProcessing'
import type { ManagerGameState } from '../../types/game'

describe('season stats and history', () => {
  it('tracks goals consistently and records the finished season', async () => {
    let game: ManagerGameState = { ...(await buildGame({ saveName: 'S', managerName: 'M', managerTeamId: 'rma' })), rngSeed: 99 }

    // After one round, goals credited to players equal goals in the results.
    game = applyRoundResult(game, processRound(game, game.managerLineup))
    const resultGoals = game.leagueState.lastResults.reduce((sum, r) => sum + r.homeGoals + r.awayGoals, 0)
    const playerGoals = game.leagueState.teams.flatMap((t) => t.players).reduce((sum, p) => sum + (p.seasonStats?.goals ?? 0), 0)
    expect(playerGoals).toBe(resultGoals)

    for (let i = 0; i < 60 && !(game.leagueState.seasonHistory?.length); i += 1) {
      game = applyRoundResult(game, processRound(game, game.managerLineup))
    }

    const [record] = game.leagueState.seasonHistory ?? []
    expect(record.label).toBe('2026/27')
    expect(record.competitions.map((c) => c.competition).sort()).toEqual(
      ['Primera', 'Primera Federacion - Grupo 1', 'Primera Federacion - Grupo 2', 'Segunda'],
    )
    expect(record.competitions.every((c) => c.champion && c.topScorer && c.topScorer.value > 5)).toBe(true)
    expect(record.promoted).toHaveLength(7)
    expect(record.relegated).toHaveLength(7)
    expect(record.managerTeamName).toBe('Real Madrid')
    expect(record.managerPosition).toBeGreaterThan(0)

    // Stats start again from zero in the new season.
    expect(game.leagueState.teams.flatMap((t) => t.players).every((p) => (p.seasonStats?.goals ?? 0) === 0)).toBe(true)
  }, 30_000)
})
