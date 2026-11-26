/** Weekly club management: training, AI market, finances and season rollover. */
import { applySeasonPlayerChanges } from './seasonPlayers'
import { buildSeasonRecord } from './seasonHistory'
import { buildSeasonFixtures } from '../fixtures'
import { simulateAiContractRenewals, simulateAiTransferWindow } from '../transfers'
import { weeklyPayroll, UPGRADE_SEATS, MAX_CAPACITY } from './helpers'
import { applyTrainingToTeam } from './training'
import { buildStandingsIndex, resetSeasonStats, applyPromotionRelegation } from './promotion'
import type { FinanceBreakdownItem, IncomingTransferOffer, LeagueState } from '../../types/game'

export function applyWeeklyClubManagement(
  state: LeagueState,
  managerTeamId: string,
  existingIncomingOffers: IncomingTransferOffer[] = [],
): { nextState: LeagueState; headlines: string[]; incomingOffers: IncomingTransferOffer[]; financeBreakdown: FinanceBreakdownItem[] } {
  const standings = buildStandingsIndex(state.teams)
  const isSeasonOver = state.currentRound > state.totalRounds
  const midSeasonRound = Math.floor(state.totalRounds / 2)
  const isMidSeasonCheckpoint = state.currentRound === midSeasonRound + 1

  const headlines: string[] = []
  const financeBreakdown: FinanceBreakdownItem[] = []

  if (isMidSeasonCheckpoint) {
    headlines.push('Comite de competicion: se perdonan 2 amarillas a todos los jugadores.')
  }

  if (isSeasonOver) {
    headlines.push('Fin de temporada: historial disciplinario reiniciado (amarillas a cero).')
  }

  const nextTeams = state.teams.map((team) => {
    const payroll = Math.round(weeklyPayroll(team))
    let budget = team.budget + team.sponsor.weeklyIncome - payroll
    financeBreakdown.push({
      teamId: team.id,
      category: 'sponsor',
      amount: team.sponsor.weeklyIncome,
      description: `Sponsor ${team.sponsor.name}`,
    })
    financeBreakdown.push({
      teamId: team.id,
      category: 'salary',
      amount: -payroll,
      description: 'Nómina semanal',
    })

    let sponsor = { ...team.sponsor }
    const rank = standings.get(team.id) ?? 99

    if (isSeasonOver && !sponsor.seasonBonusPaid && rank <= sponsor.targetRank) {
      budget += sponsor.seasonBonus
      sponsor = { ...sponsor, seasonBonusPaid: true }
      financeBreakdown.push({
        teamId: team.id,
        category: 'sponsor',
        amount: sponsor.seasonBonus,
        description: `Bonus final de sponsor ${sponsor.name}`,
      })
      headlines.push(`${team.name} cobra bonus del sponsor (${sponsor.name}).`)
    }

    const cardReduction = isSeasonOver ? Number.POSITIVE_INFINITY : isMidSeasonCheckpoint ? 2 : 0

    const nextPlayers = team.players.map((player) => {
      if (cardReduction <= 0 || player.yellowCards <= 0) {
        return player
      }

      return {
        ...player,
        yellowCards: Math.max(0, player.yellowCards - cardReduction),
      }
    })

    const trained = applyTrainingToTeam({
      ...team,
      players: nextPlayers,
    })

    let { stadium } = trained
    const weeksLeft = stadium.upgradeWeeksRemaining ?? 0

    if (weeksLeft > 0) {
      const remaining = weeksLeft - 1
      const newCapacity = remaining === 0
        ? Math.min(MAX_CAPACITY, stadium.capacity + UPGRADE_SEATS)
        : stadium.capacity

      stadium = { ...stadium, capacity: newCapacity, upgradeWeeksRemaining: remaining }

      if (remaining === 0) {
        headlines.push(`Obras terminadas en ${stadium.name}. Nuevo aforo: ${newCapacity.toLocaleString('es-ES')} plazas.`)
      }
    }

    return {
      ...trained,
      budget,
      sponsor,
      stadium,
    }
  })

  let managedState: LeagueState = {
    ...state,
    teams: nextTeams,
  }
  let incomingOffers: IncomingTransferOffer[] = []

  return {
    nextState: (() => {
      if (!isSeasonOver) {
        const renewedState = simulateAiContractRenewals(managedState, managerTeamId)
        headlines.push(...renewedState.headlines)
        managedState = renewedState.nextState

        const aiWindow = simulateAiTransferWindow(
          managedState,
          managerTeamId,
          existingIncomingOffers,
        )
        headlines.push(...aiWindow.headlines)
        incomingOffers = aiWindow.incomingOffers
        managedState = aiWindow.nextState

        return {
          ...managedState,
        }
      }

      const { teams: transitionedTeams, headlines: transitionHeadlines, bracket } = applyPromotionRelegation(nextTeams)
      headlines.push(...transitionHeadlines)

      const seasonRecord = buildSeasonRecord(nextTeams, transitionedTeams, managerTeamId)
      const seasonChanges = applySeasonPlayerChanges(transitionedTeams, managerTeamId)
      headlines.push(...seasonChanges.headlines)

      const resetTeams = seasonChanges.teams.map(resetSeasonStats)
      const { fixtures, totalRounds } = buildSeasonFixtures(resetTeams)

      return {
        ...state,
        currentRound: 1,
        totalRounds,
        teams: resetTeams,
        fixtures,
        lastResults: [],
        promotionSummary: transitionHeadlines,
        promotionBracket: bracket,
        seasonHistory: [...(state.seasonHistory ?? []), seasonRecord],
      }
    })(),
    headlines,
    incomingOffers,
    financeBreakdown,
  }
}
