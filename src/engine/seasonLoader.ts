/**
 * Lazily loads the season data (squads for every club), so it is fetched
 * only when a game is created or reset, not as part of the main bundle.
 */
type SeasonModule = typeof import('../data/seedData')

let seasonModule: Promise<SeasonModule> | null = null

export function loadSeason(): Promise<SeasonModule> {
  seasonModule ??= import('../data/seedData')
  return seasonModule
}
