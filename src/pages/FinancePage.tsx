import { useMemo } from 'react'
import { useGame } from '../state/gameState'
import type { FinanceCategory, FinanceEntry } from '../types/game'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function categoryLabel(category: FinanceCategory): string {
  switch (category) {
    case 'sponsor':
      return 'Sponsor'
    case 'ticketing':
      return 'Taquilla'
    case 'salary':
      return 'Salarios'
    case 'transfer-in':
      return 'Fichajes'
    case 'transfer-out':
      return 'Ventas'
    case 'renewal':
      return 'Renovaciones'
    case 'infrastructure':
      return 'Infraestructura'
    case 'staff':
      return 'Personal'
    default:
      return category
  }
}

function sumAmounts(entries: FinanceEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0)
}

export function FinancePage() {
  const { game, managerTeam } = useGame()

  if (!game || !managerTeam) {
    return null
  }

  const managerEntries = useMemo(
    () => (game.financeEntries ?? []).filter((entry) => entry.teamId === managerTeam.id),
    [game.financeEntries, managerTeam.id],
  )

  const currentRound = Math.min(game.leagueState.currentRound, game.leagueState.totalRounds)
  const currentWeekEntries = managerEntries.filter((entry) => entry.round === currentRound)
  const currentIncome = sumAmounts(currentWeekEntries.filter((entry) => entry.amount > 0))
  const currentExpenses = Math.abs(sumAmounts(currentWeekEntries.filter((entry) => entry.amount < 0)))
  const currentBalance = currentIncome - currentExpenses

  const weeklyRows = useMemo(() => {
    const grouped = new Map<number, FinanceEntry[]>()
    managerEntries.forEach((entry) => {
      const list = grouped.get(entry.round) ?? []
      list.push(entry)
      grouped.set(entry.round, list)
    })

    return [...grouped.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 8)
      .map(([round, entries]) => {
        const income = sumAmounts(entries.filter((entry) => entry.amount > 0))
        const expenses = Math.abs(sumAmounts(entries.filter((entry) => entry.amount < 0)))
        return {
          round,
          income,
          expenses,
          balance: income - expenses,
        }
      })
  }, [managerEntries])

  const categoryRows = useMemo(() => {
    const grouped = new Map<FinanceCategory, number>()
    managerEntries.forEach((entry) => {
      grouped.set(entry.category, (grouped.get(entry.category) ?? 0) + entry.amount)
    })

    return [...grouped.entries()]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([category, total]) => ({ category, total }))
  }, [managerEntries])

  const latestEntries = managerEntries.slice(0, 12)
  const weeklySponsor = managerTeam.sponsor.weeklyIncome
  const weeklyPayroll = Math.round(managerTeam.players.reduce((sum, player) => sum + player.wage, 0) / 52)
  const operatingMargin = weeklySponsor - weeklyPayroll
  const trendPoints = weeklyRows
    .slice()
    .reverse()
    .map((row, index) => ({ x: index, y: row.balance }))
  const maxAbsBalance = Math.max(1, ...trendPoints.map((point) => Math.abs(point.y)))
  const trendPolyline = trendPoints
    .map((point) => {
      const x = trendPoints.length <= 1 ? 50 : (point.x / (trendPoints.length - 1)) * 100
      const y = 50 - (point.y / maxAbsBalance) * 38
      return `${x},${y}`
    })
    .join(' ')

  return (
    <section className="page-grid finances-grid">
      <article className="panel full-span finances-hero">
        <div>
          <h2>Finanzas</h2>
          <p className="calendar-subtitle">Control semanal de ingresos, gastos y movimientos recientes del club.</p>
        </div>
        <span className="competition-badge">Saldo actual: {formatCurrency(managerTeam.budget)}</span>
      </article>

      <article className="panel finance-kpi-card">
        <h3>Ingresos semana</h3>
        <strong className="finance-kpi is-positive">{formatCurrency(currentIncome)}</strong>
        <p>Jornada {currentRound}</p>
      </article>

      <article className="panel finance-kpi-card">
        <h3>Gastos semana</h3>
        <strong className="finance-kpi is-negative">{formatCurrency(currentExpenses)}</strong>
        <p>Jornada {currentRound}</p>
      </article>

      <article className="panel finance-kpi-card">
        <h3>Balance semana</h3>
        <strong className={`finance-kpi ${currentBalance >= 0 ? 'is-positive' : 'is-negative'}`}>
          {formatCurrency(currentBalance)}
        </strong>
        <p>Ingresos menos gastos</p>
      </article>

      <article className="panel finance-history-panel">
        <h2>Resumen por jornada</h2>
        <table className="finance-table">
          <thead>
            <tr>
              <th>J</th>
              <th>Ingresos</th>
              <th>Gastos</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {weeklyRows.map((row) => (
              <tr key={row.round}>
                <td>{row.round}</td>
                <td className="finance-positive">{formatCurrency(row.income)}</td>
                <td className="finance-negative">{formatCurrency(row.expenses)}</td>
                <td className={row.balance >= 0 ? 'finance-positive' : 'finance-negative'}>{formatCurrency(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="panel finance-categories-panel">
        <h2>Previsión semanal</h2>
        <div className="finance-forecast-list">
          <div>
            <span>Ingreso fijo sponsor</span>
            <strong className="finance-positive">{formatCurrency(weeklySponsor)}</strong>
          </div>
          <div>
            <span>Nómina prevista</span>
            <strong className="finance-negative">{formatCurrency(weeklyPayroll)}</strong>
          </div>
          <div>
            <span>Margen operativo</span>
            <strong className={operatingMargin >= 0 ? 'finance-positive' : 'finance-negative'}>{formatCurrency(operatingMargin)}</strong>
          </div>
        </div>

        <h2>Tendencia</h2>
        <div className="finance-trend-card" aria-label="Tendencia de balance semanal">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="finance-trend-chart">
            <line x1="0" y1="50" x2="100" y2="50" className="finance-trend-axis" />
            {trendPolyline ? <polyline fill="none" points={trendPolyline} className="finance-trend-line" /> : null}
          </svg>
          <div className="finance-trend-labels">
            <span>Hace {weeklyRows.length} jornadas</span>
            <span>Ahora</span>
          </div>
        </div>

        <h2>Por categorías</h2>
        <table className="finance-table finance-table-tight">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {categoryRows.map((row) => (
              <tr key={row.category}>
                <td>{categoryLabel(row.category)}</td>
                <td className={row.total >= 0 ? 'finance-positive' : 'finance-negative'}>{formatCurrency(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="panel full-span finance-ledger-panel">
        <h2>Últimos movimientos</h2>
        <table className="finance-table">
          <thead>
            <tr>
              <th>J</th>
              <th>Concepto</th>
              <th>Detalle</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {latestEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.round}</td>
                <td>{categoryLabel(entry.category)}</td>
                <td>{entry.description}</td>
                <td className={entry.amount >= 0 ? 'finance-positive' : 'finance-negative'}>{formatCurrency(entry.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  )
}
