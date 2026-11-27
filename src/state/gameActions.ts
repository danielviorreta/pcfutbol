/**
 * Pure game actions for the manager's active game.
 *
 * Each action takes the current game (plus arguments) and returns the next game
 * and an optional notice for the UI. Returning the same game object means
 * "nothing changed", so the provider skips saving. No React here, so actions
 * can be tested directly.
 */
import {
  promoteYouthPlayer,
  setStadiumTicketPrice,
  setTeamTactic,
  setTeamTrainingFocus,
  submitRenewalOffer,
  upgradeStadium as upgradeStadiumEngine,
} from '../engine/club'
import { takeJob } from '../engine/board'
import { appendFinanceEntries, createFinanceEntry, getTeamBudget } from '../engine/finance'
import { getManagerTeam, syncManagerLineup, syncManagerSquadOrder } from '../engine/gameUtils'
import { validatePlayerPurchase } from '../engine/purchaseValidation'
import { canToggleInLineup, getDefaultLineup, getFormationSlots, isPlayerAvailable } from '../engine/squad'
import { performStaffUpgrade } from '../engine/staffUpgrades'
import { acceptIncomingTransferOffer, setPlayerTransferStatus } from '../engine/transfers'
import type { ManagerGameState, PromisedRole, Tactic, TrainingFocus } from '../types/game'

export interface ActionResult {
  game: ManagerGameState
  notice?: string
}

/** Runs an update that may report a notice; `fixedNotice` is shown whatever the outcome. */
function collect(
  prev: ManagerGameState,
  update: (setNotice: (message: string) => void) => ManagerGameState,
  fixedNotice?: string,
): ActionResult {
  let notice = fixedNotice
  const game = update((message) => {
    notice = message
  })
  return { game: game ?? prev, notice }
}

export function setManagerName(prev: ManagerGameState, value: string): ActionResult {
  return collect(prev, () => ({ ...prev, managerName: value || 'Mister' }))
}

export function setSaveName(prev: ManagerGameState, value: string): ActionResult {
  return collect(prev, () => ({ ...prev, saveName: value.trim() || prev.saveName }))
}

export function toggleLineupPlayer(prev: ManagerGameState, playerId: string): ActionResult {
  return collect(prev, (setNotice) => {
    const currentTeam = getManagerTeam(prev)
    if (!currentTeam) {
      return prev
    }

    const lineup = prev.managerLineup
    if (!canToggleInLineup(currentTeam, lineup, playerId)) {
      setNotice('Jugador no disponible para el once titular.')
      return prev
    }

    const inLineup = lineup.includes(playerId)
    const nextLineup = inLineup ? lineup.filter((id) => id !== playerId) : [...lineup, playerId]

    return {
      ...prev,
      managerLineup: syncManagerLineup(currentTeam, nextLineup),
    }
  })
}

export function autoPickLineup(prev: ManagerGameState): ActionResult {
  return collect(prev, () => {
    const currentTeam = getManagerTeam(prev)
    if (!currentTeam) {
      return prev
    }

    return {
      ...prev,
      managerLineup: getDefaultLineup(currentTeam),
    }
  })
}

export function setLineupSlotPlayer(prev: ManagerGameState, slotIndex: number, playerId: string): ActionResult {
  return collect(prev, (setNotice) => {
    const currentTeam = getManagerTeam(prev)
    if (!currentTeam) {
      return prev
    }

    const player = currentTeam.players.find((candidate) => candidate.id === playerId)
    if (!player || !isPlayerAvailable(player)) {
      setNotice('Jugador no disponible para este rol.')
      return prev
    }

    const slots = getFormationSlots(currentTeam)
    if (slotIndex < 0 || slotIndex >= slots.length) {
      return prev
    }

    const normalized = syncManagerLineup(currentTeam, prev.managerLineup)
    const nextLineup = [...normalized]
    const existingIndex = nextLineup.findIndex((id, idx) => id === playerId && idx !== slotIndex)
    const previousAtSlot = nextLineup[slotIndex]

    nextLineup[slotIndex] = playerId
    if (existingIndex >= 0) {
      nextLineup[existingIndex] = previousAtSlot
    }

    return {
      ...prev,
      managerLineup: syncManagerLineup(currentTeam, nextLineup),
      managerSquadOrder: syncManagerSquadOrder(currentTeam, prev.managerSquadOrder),
    }
  })
}

export function reorderSquadPlayer(prev: ManagerGameState, sourcePlayerId: string, targetPlayerId: string): ActionResult {
  return collect(prev, () => {
    const currentTeam = getManagerTeam(prev)
    if (!currentTeam || sourcePlayerId === targetPlayerId) {
      return prev
    }

    const nextOrder = syncManagerSquadOrder(currentTeam, prev.managerSquadOrder)
    const sourceIndex = nextOrder.indexOf(sourcePlayerId)
    const targetIndex = nextOrder.indexOf(targetPlayerId)

    if (sourceIndex < 0 || targetIndex < 0) {
      return prev
    }

    const reordered = [...nextOrder]
    const [sourcePlayer] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, sourcePlayer)

    return {
      ...prev,
      managerSquadOrder: reordered,
    }
  })
}

export function purchasePlayer(prev: ManagerGameState, playerId: string, wageOffer: number, signingBonus: number, contractYears: number, promisedRole: PromisedRole, feeOffer?: number): ActionResult {
  return collect(prev, (setNotice) => {
    const validation = validatePlayerPurchase(
      playerId,
      wageOffer,
      signingBonus,
      contractYears,
      promisedRole,
      feeOffer,
      prev.leagueState,
      prev.managerTeamId,
      prev.pendingOutgoingTransfers,
    )

    if (!validation.valid) {
      setNotice(validation.error ?? 'No se pudo procesar la oferta.')
      return prev
    }

    const offer = validation.offer!
    setNotice(`Oferta enviada por ${offer.playerName}. El club responderá en la próxima jornada.`)
    return {
      ...prev,
      pendingOutgoingTransfers: [...prev.pendingOutgoingTransfers, offer],
    }
  })
}

export function cancelOutgoingTransfer(prev: ManagerGameState, offerId: string): ActionResult {
  return collect(prev, () => ({
    ...prev,
    pendingOutgoingTransfers: prev.pendingOutgoingTransfers.filter((o) => o.id !== offerId),
  }), 'Oferta retirada.')
}

export function listPlayerForTransfer(prev: ManagerGameState, playerId: string, askingPrice: number): ActionResult {
  return collect(prev, (setNotice) => {
    const { nextState, message, ok } = setPlayerTransferStatus(
      prev.leagueState,
      prev.managerTeamId,
      playerId,
      true,
      askingPrice,
    )
    setNotice(message)

    if (!ok) {
      return prev
    }

    return {
      ...prev,
      leagueState: nextState,
    }
  })
}

export function removePlayerFromTransferList(prev: ManagerGameState, playerId: string): ActionResult {
  return collect(prev, (setNotice) => {
    const { nextState, message, ok } = setPlayerTransferStatus(
      prev.leagueState,
      prev.managerTeamId,
      playerId,
      false,
    )
    setNotice(message)

    if (!ok) {
      return prev
    }

    return {
      ...prev,
      leagueState: nextState,
    }
  })
}

export function acceptTransferOffer(prev: ManagerGameState, offerId: string): ActionResult {
  return collect(prev, (setNotice) => {
    const offer = prev.pendingTransferOffers.find((item) => item.id === offerId)
    if (!offer) {
      setNotice('La oferta ya no esta disponible.')
      return prev
    }

    if (offer.createdRound >= prev.leagueState.currentRound) {
      setNotice('Debes esperar a la siguiente jornada para responder a esta oferta.')
      return prev
    }

    const { nextState, message, ok } = acceptIncomingTransferOffer(prev.leagueState, offer)
    setNotice(message)

    if (!ok) {
      return {
        ...prev,
        pendingTransferOffers: prev.pendingTransferOffers.filter((item) => item.id !== offerId),
      }
    }

    const nextManagerTeam = nextState.teams.find((team) => team.id === prev.managerTeamId) ?? nextState.teams[0]
    const income = getTeamBudget(nextState.teams, prev.managerTeamId) - getTeamBudget(prev.leagueState.teams, prev.managerTeamId)

    return {
      ...prev,
      financeEntries: appendFinanceEntries(prev, [
        createFinanceEntry(prev.leagueState.currentRound, prev.managerTeamId, 'transfer-out', income, `Venta de ${offer.playerName}`),
      ]),
      leagueState: nextState,
      pendingTransferOffers: prev.pendingTransferOffers.filter((item) => item.id !== offerId),
      managerLineup: syncManagerLineup(nextManagerTeam, prev.managerLineup),
      managerSquadOrder: syncManagerSquadOrder(nextManagerTeam, prev.managerSquadOrder),
    }
  })
}

export function rejectTransferOffer(prev: ManagerGameState, offerId: string): ActionResult {
  return collect(prev, () => ({
    ...prev,
    pendingTransferOffers: prev.pendingTransferOffers.filter((item) => item.id !== offerId),
  }), 'Oferta rechazada.')
}

export function setTrainingFocus(prev: ManagerGameState, focus: TrainingFocus): ActionResult {
  return collect(prev, () => ({
    ...prev,
    leagueState: setTeamTrainingFocus(prev.leagueState, prev.managerTeamId, focus),
  }), `Plan de entrenamiento actualizado: ${focus}.`)
}

export function setTactic(prev: ManagerGameState, tactic: Tactic): ActionResult {
  return collect(prev, () => {
    const nextLeagueState = setTeamTactic(prev.leagueState, prev.managerTeamId, tactic)
    const nextManagerTeam =
      nextLeagueState.teams.find((team) => team.id === prev.managerTeamId) ??
      nextLeagueState.teams[0]

    return {
      ...prev,
      leagueState: nextLeagueState,
      managerLineup: syncManagerLineup(nextManagerTeam, prev.managerLineup),
      managerSquadOrder: syncManagerSquadOrder(nextManagerTeam, prev.managerSquadOrder),
    }
  }, `Tactica actualizada: ${tactic}.`)
}

export function renewContract(prev: ManagerGameState, playerId: string, wageOffer?: number, contractYears?: number): ActionResult {
  return collect(prev, (setNotice) => {
    if ((prev.pendingRenewalOffers ?? []).some((offer) => offer.playerId === playerId)) {
      setNotice('Ya hay una oferta de renovación pendiente para este jugador.')
      return prev
    }

    const { offer, ok, message } = submitRenewalOffer(
      prev.leagueState,
      prev.managerTeamId,
      playerId,
      wageOffer ?? 0,
      contractYears ?? 0,
    )
    setNotice(message)
    if (!ok || !offer) {
      return prev
    }

    return {
      ...prev,
      pendingRenewalOffers: [...(prev.pendingRenewalOffers ?? []), offer],
    }
  })
}

export function cancelRenewalOffer(prev: ManagerGameState, offerId: string): ActionResult {
  return collect(prev, () => ({
    ...prev,
    pendingRenewalOffers: (prev.pendingRenewalOffers ?? []).filter((o) => o.id !== offerId),
  }), 'Oferta de renovación retirada.')
}

export function promoteYouth(prev: ManagerGameState, youthId: string): ActionResult {
  return collect(prev, (setNotice) => {
    const { nextState, ok, message } = promoteYouthPlayer(prev.leagueState, prev.managerTeamId, youthId)
    setNotice(message)
    if (!ok) {
      return prev
    }

    const managerTeamAfter = nextState.teams.find((team) => team.id === prev.managerTeamId) ?? nextState.teams[0]

    return {
      ...prev,
      leagueState: nextState,
      managerLineup: syncManagerLineup(managerTeamAfter, prev.managerLineup),
      managerSquadOrder: syncManagerSquadOrder(managerTeamAfter, prev.managerSquadOrder),
    }
  })
}

export function setTicketPrice(prev: ManagerGameState, price: number): ActionResult {
  return collect(prev, () => ({
    ...prev,
    leagueState: setStadiumTicketPrice(prev.leagueState, prev.managerTeamId, price),
  }))
}

export function upgradeStadium(prev: ManagerGameState): ActionResult {
  return collect(prev, (setNotice) => {
    const { nextState, message, ok } = upgradeStadiumEngine(prev.leagueState, prev.managerTeamId)
    setNotice(message)

    if (!ok) {
      return prev
    }

    const cost = getTeamBudget(prev.leagueState.teams, prev.managerTeamId) - getTeamBudget(nextState.teams, prev.managerTeamId)
    return {
      ...prev,
      financeEntries: appendFinanceEntries(prev, [
        createFinanceEntry(prev.leagueState.currentRound, prev.managerTeamId, 'infrastructure', -cost, 'Ampliación de estadio'),
      ]),
      leagueState: nextState,
    }
  })
}

export function improveMedicalStaff(prev: ManagerGameState): ActionResult {
  return collect(prev, (setNotice) => {
    const result = performStaffUpgrade(prev, 'medical')
    setNotice(result.message)
    if (!result.success || !result.nextLeagueState) {
      return prev
    }

    return {
      ...prev,
      leagueState: result.nextLeagueState,
      financeEntries: appendFinanceEntries(prev, [
        createFinanceEntry(
          prev.leagueState.currentRound,
          prev.managerTeamId,
          'staff',
          -(result.cost ?? 0),
          'Mejora de cuerpo médico',
        ),
      ]),
    }
  })
}

export function improveDisciplineStaff(prev: ManagerGameState): ActionResult {
  return collect(prev, (setNotice) => {
    const result = performStaffUpgrade(prev, 'discipline')
    setNotice(result.message)
    if (!result.success || !result.nextLeagueState) {
      return prev
    }

    return {
      ...prev,
      leagueState: result.nextLeagueState,
      financeEntries: appendFinanceEntries(prev, [
        createFinanceEntry(
          prev.leagueState.currentRound,
          prev.managerTeamId,
          'staff',
          -(result.cost ?? 0),
          'Mejora de disciplina',
        ),
      ]),
    }
  })
}

export function acceptJobOffer(prev: ManagerGameState, teamId: string): ActionResult {
  const offer = prev.board?.jobOffers.find((item) => item.teamId === teamId)
  if (!offer) {
    return { game: prev, notice: 'Esa oferta ya no esta disponible.' }
  }
  return { game: takeJob(prev, offer), notice: `Bienvenido al ${offer.teamName}. Objetivo: ${offer.objective.description}.` }
}
