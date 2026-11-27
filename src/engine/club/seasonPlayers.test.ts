import { describe, expect, it } from 'vitest'
import { createInitialLeagueState } from '../../data/seedData'
import { withSeed } from '../random'
import { applySeasonPlayerChanges } from './seasonPlayers'
import type { Team } from '../../types/game'

const MANAGER = 'rma'

function run(teams: Team[], seed = 1) {
  return withSeed(seed, () => applySeasonPlayerChanges(teams, MANAGER)).value
}

describe('applySeasonPlayerChanges', () => {
  it('ages every player who stays and counts contracts down', () => {
    const before = createInitialLeagueState().teams
    const manager = before.find((team) => team.id === MANAGER)!
    const after = run(before).teams.find((team) => team.id === MANAGER)!

    for (const player of after.players) {
      const original = manager.players.find((candidate) => candidate.id === player.id)
      if (original) {
        expect(player.age).toBe((original.age ?? 0) + 1)
        expect(player.contractYears).toBe(original.contractYears - 1)
      }
    }
  })

  it('lets the manager lose players whose contract ends, with news', () => {
    const teams = createInitialLeagueState().teams
    const manager = teams.find((team) => team.id === MANAGER)!
    const leaving = manager.players[3]
    leaving.contractYears = 1
    leaving.age = 25

    const result = run(teams)
    const after = result.teams.find((team) => team.id === MANAGER)!

    expect(after.players.some((player) => player.id === leaving.id)).toBe(false)
    expect(result.headlines).toContain(`${leaving.name} termina contrato y deja el club.`)
  })

  it('retires players at the age limit', () => {
    const teams = createInitialLeagueState().teams
    const veteran = teams.find((team) => team.id === 'bar')!.players[0]
    veteran.age = 39

    const after = run(teams)

    expect(after.teams.flatMap((team) => team.players).some((player) => player.id === veteran.id)).toBe(false)
  })

  it('keeps squads full and player ids unique', () => {
    const after = run(createInitialLeagueState().teams, 7).teams

    for (const team of after) {
      expect(team.players.length).toBeGreaterThanOrEqual(team.id === MANAGER ? 18 : 22)
    }
    const ids = after.flatMap((team) => team.players.map((player) => player.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('stays realistic over ten seasons', () => {
    let teams = createInitialLeagueState().teams
    for (let season = 0; season < 10; season += 1) {
      teams = run(teams, season + 100).teams
    }
    const players = teams.flatMap((team) => team.players)
    const ages = players.map((player) => player.age ?? 0)
    const averageAge = ages.reduce((sum, age) => sum + age, 0) / ages.length

    expect(Math.max(...ages)).toBeLessThanOrEqual(40)
    expect(averageAge).toBeGreaterThan(23)
    expect(averageAge).toBeLessThan(29)
    expect(Math.max(...players.map((player) => player.overall))).toBeLessThanOrEqual(95)
  })
})
