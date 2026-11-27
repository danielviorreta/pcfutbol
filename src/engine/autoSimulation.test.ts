import { describe, expect, it } from 'vitest'
import { SEASON_MAX_ROUNDS, simulateRounds } from './autoSimulation'
import { buildGame } from './gameUtils'

describe('simulateRounds', () => {
  it('plays the requested number of matchdays', async () => {
    const game = { ...(await buildGame({ saveName: 'S', managerName: 'M', managerTeamId: 'bet' })), rngSeed: 4 }

    const result = simulateRounds(game, 5)

    expect(result.roundsPlayed).toBe(5)
    expect(result.game.leagueState.currentRound).toBe(6)
    expect(result.summary).toMatch(/^Simuladas 5 jornadas: \d+G \d+E \d+P\./)
  })

  it('stops at the end of the season', async () => {
    const game = { ...(await buildGame({ saveName: 'S', managerName: 'M', managerTeamId: 'rma' })), rngSeed: 8 }

    const result = simulateRounds(game, SEASON_MAX_ROUNDS)

    expect(result.roundsPlayed).toBe(game.leagueState.totalRounds)
    expect(result.game.seasonStartYear).toBe(2027)
    expect(result.game.leagueState.currentRound).toBe(1)
  }, 30_000)

  it('uses the automatic lineup when a starter is unavailable', async () => {
    const game = { ...(await buildGame({ saveName: 'S', managerName: 'M', managerTeamId: 'bar' })), rngSeed: 2 }
    const team = game.leagueState.teams.find((item) => item.id === 'bar')!
    const injured = team.players.find((player) => player.id === game.managerLineup[0])!
    injured.injuryWeeks = 10

    const result = simulateRounds(game, 1)

    expect(result.game.managerLineup).not.toContain(injured.id)
    expect(result.summary).toContain('alineacion automatica')
  })
})
