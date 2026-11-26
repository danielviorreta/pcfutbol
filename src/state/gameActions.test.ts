import { describe, expect, it } from 'vitest'
import { buildGame } from '../engine/gameUtils'
import { acceptTransferOffer, rejectTransferOffer, setTactic } from './gameActions'

describe('game actions', () => {
  it('returns the same game and a notice when the action does nothing', async () => {
    const game = await buildGame({ saveName: 'Test', managerName: 'Mister', managerTeamId: 'bar' })

    const result = acceptTransferOffer(game, 'missing-offer')

    expect(result.game).toBe(game)
    expect(result.notice).toBe('La oferta ya no esta disponible.')
  })

  it('returns an updated game with its notice', async () => {
    const game = await buildGame({ saveName: 'Test', managerName: 'Mister', managerTeamId: 'bar' })

    const result = setTactic(game, '5-4-1')

    expect(result.game).not.toBe(game)
    expect(result.game.leagueState.teams.find((team) => team.id === 'bar')?.tactic).toBe('5-4-1')
    expect(result.notice).toBe('Tactica actualizada: 5-4-1.')
    expect(rejectTransferOffer(game, 'x').notice).toBe('Oferta rechazada.')
  })
})
