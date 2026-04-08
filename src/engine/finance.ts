import type { FinanceBreakdownItem, FinanceCategory, FinanceEntry, ManagerGameState, Team } from '../types/game'

export const MAX_FINANCE_ENTRIES = 160

export function createFinanceEntry(
  round: number,
  teamId: string,
  category: FinanceCategory,
  amount: number,
  description: string,
): FinanceEntry {
  return {
    id: `fin-${teamId}-${round}-${Math.round(Math.random() * 1_000_000)}`,
    round,
    teamId,
    category,
    amount,
    description,
  }
}

export function appendFinanceEntries(prev: ManagerGameState, entries: FinanceEntry[]): FinanceEntry[] {
  return [...entries.filter((entry) => entry.amount !== 0), ...(prev.financeEntries ?? [])].slice(0, MAX_FINANCE_ENTRIES)
}

export function getTeamBudget(teams: Team[], teamId: string): number {
  return teams.find((team) => team.id === teamId)?.budget ?? 0
}

export function mapBreakdownToEntries(
  round: number,
  items: FinanceBreakdownItem[] | undefined,
  managerTeamId: string,
): FinanceEntry[] {
  return (items ?? [])
    .filter((item) => item.teamId === managerTeamId && item.amount !== 0)
    .map((item) => createFinanceEntry(round, item.teamId, item.category, item.amount, item.description))
}
