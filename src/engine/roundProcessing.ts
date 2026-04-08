import {
  applyWeeklyClubManagement,
  resolveRenewalOffers,
} from './club'
import {
  appendFinanceEntries,
  createFinanceEntry,
  mapBreakdownToEntries,
} from './finance'
import {
  mergeIncomingOffers,
} from './gameUtils'
import { playCurrentRound } from './simulation'
import { buyPlayer } from './transfers'
import type {
  IncomingTransferOffer,
  LeagueState,
  ManagerGameState,
  PendingRenewalOffer,
  Team,
} from '../types/game'

export interface RoundProcessingResult {
  stateAfterOutgoing: LeagueState
  seasonRolledOver: boolean
  pendingTransferOffers: IncomingTransferOffer[]
  renewalMessages: string[]
  outgoingFinanceEntries: ReturnType<typeof createFinanceEntry>[]
  outgoingNotice: string
  financeEntries: ReturnType<typeof appendFinanceEntries>
  resolvedRenewalOffers: PendingRenewalOffer[]
  resolvedOutgoingIds: Set<string>
  nextManagerTeamFinal: Team
  initialSimulatedState: LeagueState
}

/**
 * Processes a complete game round: simulation, club management, renewals, and transfers.
 * Extracted shared logic from playRound and confirmMatchPresentation.
 */
export function processRound(
  game: ManagerGameState,
  managerLineup: string[],
): RoundProcessingResult {
  const simulatedState = playCurrentRound(game.leagueState, {
    managerTeamId: game.managerTeamId,
    managerLineup,
  })
  const seasonRolledOver = simulatedState.currentRound > simulatedState.totalRounds

  const { nextState, headlines, incomingOffers, financeBreakdown } =
    applyWeeklyClubManagement(
      simulatedState,
      game.managerTeamId,
      game.pendingTransferOffers,
    )

  const withWeeklyNews = {
    ...nextState,
    news: [...headlines, ...nextState.news].slice(0, 12),
  }

  const { nextState: afterRenewals, messages: renewalMessages, resolvedIds } =
    resolveRenewalOffers(
      withWeeklyNews,
      game.managerTeamId,
      game.pendingRenewalOffers ?? [],
    )

  const nextManagerTeam =
    afterRenewals.teams.find((team) => team.id === game.managerTeamId) ??
    afterRenewals.teams[0]

  const pendingTransferOffers = mergeIncomingOffers(
    game.pendingTransferOffers,
    incomingOffers,
    nextManagerTeam,
    afterRenewals.currentRound,
  )

  const resolvedRenewalOffers = (game.pendingRenewalOffers ?? []).filter(
    (o) => resolvedIds.includes(o.id),
  )

  // Resolve outgoing transfer offers submitted in a previous round
  const dueOutgoing = game.pendingOutgoingTransfers.filter(
    (o) => o.createdRound < afterRenewals.currentRound,
  )

  let stateAfterOutgoing = afterRenewals
  const outgoingFinanceEntries: ReturnType<typeof createFinanceEntry>[] = []
  let outgoingNotice = ''

  for (const pending of dueOutgoing) {
    const { nextState: afterBuy, message, ok } = buyPlayer(
      stateAfterOutgoing,
      game.managerTeamId,
      pending.playerId,
      pending.wageOffer,
      pending.signingBonus,
      pending.contractYears,
      pending.promisedRole,
      pending.transferFee,
    )

    if (ok) {
      stateAfterOutgoing = afterBuy
      const spent = pending.transferFee + pending.signingBonus
      outgoingFinanceEntries.push(
        createFinanceEntry(
          afterRenewals.currentRound,
          game.managerTeamId,
          'transfer-in',
          -spent,
          `Fichaje de ${pending.playerName}`,
        ),
      )
      outgoingNotice = `${pending.playerName} ha llegado a tu equipo.`
    } else {
      outgoingNotice = message
    }
  }

  const resolvedOutgoingIds = new Set(dueOutgoing.map((o) => o.id))
  const nextManagerTeamFinal =
    stateAfterOutgoing.teams.find((team) => team.id === game.managerTeamId) ??
    stateAfterOutgoing.teams[0]

  const financeEntries = appendFinanceEntries(game, [
    ...mapBreakdownToEntries(
      game.leagueState.currentRound,
      simulatedState.financeBreakdown,
      game.managerTeamId,
    ),
    ...mapBreakdownToEntries(
      game.leagueState.currentRound,
      financeBreakdown,
      game.managerTeamId,
    ),
    ...resolvedRenewalOffers.map((offer) =>
      createFinanceEntry(
        game.leagueState.currentRound,
        game.managerTeamId,
        'renewal',
        -offer.signingBonus,
        `Renovación de ${offer.playerName}`,
      ),
    ),
    ...outgoingFinanceEntries,
  ])

  return {
    stateAfterOutgoing,
    seasonRolledOver,
    pendingTransferOffers,
    renewalMessages,
    outgoingFinanceEntries,
    outgoingNotice,
    financeEntries,
    resolvedRenewalOffers,
    resolvedOutgoingIds,
    nextManagerTeamFinal,
    initialSimulatedState: simulatedState,
  }
}
