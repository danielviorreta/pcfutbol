import { describe, expect, it } from 'vitest'
import { createInitialLeagueState } from '../../data/seedData'
import { withSeed } from '../random'
import { applyPromotionRelegation } from './promotion'
import type { Team } from '../../types/game'

/** Gives each team points by its order in the season file, so the expected table is known. */
function rankedTeams(): Team[] {
  const teams = createInitialLeagueState().teams
  const position = new Map<string, number>()
  for (const team of teams) {
    const key = `${team.division}-${team.group ?? ''}`
    position.set(key, (position.get(key) ?? 0) + 1)
    const rank = position.get(key)!
    team.points = 200 - rank
    team.played = 38
  }
  return teams
}

const count = (teams: Team[], division: Team['division'], group?: Team['group']) =>
  teams.filter((team) => team.division === division && (group === undefined || team.group === group)).length

describe('applyPromotionRelegation', () => {
  it('keeps every division at its size', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { value } = withSeed(seed, () => applyPromotionRelegation(rankedTeams()))
      expect(count(value.teams, 'Primera')).toBe(20)
      expect(count(value.teams, 'Segunda')).toBe(22)
      expect(count(value.teams, 'Primera Federacion')).toBe(40)
      expect(count(value.teams, 'Primera Federacion', 'Grupo 1')).toBe(20)
      expect(count(value.teams, 'Primera Federacion', 'Grupo 2')).toBe(20)
    }
  })

  it('relegates the bottom three of Primera and promotes the top two of Segunda', () => {
    const before = rankedTeams()
    const primera = before.filter((team) => team.division === 'Primera')
    const segunda = before.filter((team) => team.division === 'Segunda')

    const { value } = withSeed(9, () => applyPromotionRelegation(before))
    const divisionOf = (id: string) => value.teams.find((team) => team.id === id)?.division

    primera.slice(-3).forEach((team) => expect(divisionOf(team.id)).toBe('Segunda'))
    segunda.slice(0, 2).forEach((team) => expect(divisionOf(team.id)).toBe('Primera'))
    segunda.slice(-4).forEach((team) => expect(divisionOf(team.id)).toBe('Primera Federacion'))
  })

  it('promotes both Primera Federacion group winners', () => {
    const before = rankedTeams()
    const winners = ['Grupo 1', 'Grupo 2'].map(
      (group) => before.find((team) => team.division === 'Primera Federacion' && team.group === group)!,
    )

    const { value } = withSeed(11, () => applyPromotionRelegation(before))

    winners.forEach((winner) => expect(value.teams.find((team) => team.id === winner.id)?.division).toBe('Segunda'))
  })
})
