import { useState } from 'react'
import { useGame } from '../state/gameState'
import type { TrainingFocus } from '../types/game'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

const focusOptions: { value: TrainingFocus; label: string }[] = [
  { value: 'fitness', label: 'Fitness' },
  { value: 'attack', label: 'Ataque' },
  { value: 'midfield', label: 'Mediocampo' },
  { value: 'defense', label: 'Defensa' },
]

export function ClubPage() {
  const {
    managerTeam,
    setTrainingFocus,
    renewContract,
    promoteYouth,
    setTicketPrice,
    upgradeStadium,
    improveMedicalStaff,
    improveDisciplineStaff,
  } = useGame()
  const [priceInput, setPriceInput] = useState<string>('')

  if (!managerTeam) {
    return null
  }

  const payroll = Math.round(
    managerTeam.players.reduce((sum, player) => sum + player.wage, 0) / 52,
  )

  const { stadium } = managerTeam
  const fillRate = Math.min(0.95, Math.max(0.55, 0.55 + managerTeam.morale / 200))
  const estimatedRevenue = Math.round(stadium.capacity * fillRate * stadium.ticketPrice)
  const upgradeCost = Math.max(5_000_000, Math.round(stadium.capacity * 100))
  const medicalUpgradeCost = 800_000 + managerTeam.staff.medicalLevel * 600_000
  const disciplineUpgradeCost = 800_000 + managerTeam.staff.disciplineLevel * 600_000
  const upgradeInProgress = (stadium.upgradeWeeksRemaining ?? 0) > 0
  const atMaxCapacity = stadium.capacity >= 120_000

  return (
    <section className="page-grid">
      <article className="panel">
        <h2>Finanzas y Sponsor</h2>
        <p>
          Competicion: <span className="competition-badge">{managerTeam.division}{managerTeam.group ? ` - ${managerTeam.group}` : ''}</span>
        </p>
        <p>Presupuesto: <strong>{formatCurrency(managerTeam.budget)}</strong></p>
        <p>Nomina semanal: {formatCurrency(payroll)}</p>
        <p>Sponsor: {managerTeam.sponsor.name}</p>
        <p>Ingreso semanal sponsor: {formatCurrency(managerTeam.sponsor.weeklyIncome)}</p>
        <p>
          Objetivo sponsor: Top {managerTeam.sponsor.targetRank} (bonus {formatCurrency(managerTeam.sponsor.seasonBonus)})
        </p>
      </article>

      <article className="panel">
        <h2>Estadio</h2>
        <p>Nombre: <strong>{stadium.name}</strong></p>
        <p>Aforo: <strong>{stadium.capacity.toLocaleString('es-ES')} plazas</strong></p>
        <p>Entrada actual: <strong>{formatCurrency(stadium.ticketPrice)}</strong></p>
        <p>Ingresos estimados por partido: <strong>{formatCurrency(estimatedRevenue)}</strong></p>
        <div className="actions" style={{ alignItems: 'center' }}>
          <input
            type="number"
            min={10}
            max={200}
            step={1}
            placeholder={String(stadium.ticketPrice)}
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            style={{ width: '80px' }}
          />
          <button
            className="secondary"
            disabled={priceInput === '' || Number(priceInput) < 10 || Number(priceInput) > 200}
            onClick={() => {
              setTicketPrice(Number(priceInput))
              setPriceInput('')
            }}
          >
            Fijar precio
          </button>
        </div>
        <p style={{ marginTop: '0.75rem' }}>
          Ampliar estadio (+5.000 plazas, 4 semanas de obras): <strong>{formatCurrency(upgradeCost)}</strong>
        </p>
        {upgradeInProgress ? (
          <p style={{ color: 'var(--accent)' }}>
            ⚙ Obras en curso — <strong>{stadium.upgradeWeeksRemaining} semana{stadium.upgradeWeeksRemaining === 1 ? '' : 's'} restante{stadium.upgradeWeeksRemaining === 1 ? '' : 's'}</strong>
          </p>
        ) : atMaxCapacity ? (
          <p>Aforo maximo alcanzado (120.000 plazas).</p>
        ) : (
          <div className="actions">
            <button
              className="secondary"
              disabled={managerTeam.budget < upgradeCost}
              onClick={upgradeStadium}
            >
              Iniciar obras
            </button>
          </div>
        )}
      </article>

      <article className="panel">
        <h2>Entrenamiento</h2>
        <p>Plan actual: <strong>{managerTeam.trainingFocus}</strong></p>
        <div className="actions">
          {focusOptions.map((option) => (
            <button
              key={option.value}
              className="secondary"
              onClick={() => setTrainingFocus(option.value)}
              disabled={managerTeam.trainingFocus === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </article>

      <article className="panel">
        <h2>Cuerpo Tecnico</h2>
        <p>Medicos: <strong>Nivel {managerTeam.staff.medicalLevel}</strong></p>
        <p>Disciplina: <strong>Nivel {managerTeam.staff.disciplineLevel}</strong></p>
        <div className="actions">
          <button
            className="secondary"
            onClick={improveMedicalStaff}
            disabled={managerTeam.staff.medicalLevel >= 5 || managerTeam.budget < medicalUpgradeCost}
          >
            Mejorar medicos ({formatCurrency(medicalUpgradeCost)})
          </button>
          <button
            className="secondary"
            onClick={improveDisciplineStaff}
            disabled={managerTeam.staff.disciplineLevel >= 5 || managerTeam.budget < disciplineUpgradeCost}
          >
            Mejorar disciplina ({formatCurrency(disciplineUpgradeCost)})
          </button>
        </div>
      </article>

      <article className="panel table-panel full-span">
        <h2>Contratos Primer Equipo</h2>
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Pos</th>
              <th>GRL</th>
              <th>Anos</th>
              <th>Sueldo</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {managerTeam.players
              .slice()
              .sort((a, b) => a.contractYears - b.contractYears || b.overall - a.overall)
              .map((player) => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  <td>{player.position}</td>
                  <td>{player.overall}</td>
                  <td>{player.contractYears}</td>
                  <td>{formatCurrency(player.wage)}</td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() => renewContract(player.id)}
                      disabled={player.contractYears >= 5}
                    >
                      Renovar
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </article>

      <article className="panel table-panel full-span">
        <h2>Cantera</h2>
        <table>
          <thead>
            <tr>
              <th>Canterano</th>
              <th>Edad</th>
              <th>Pos</th>
              <th>GRL</th>
              <th>Pot</th>
              <th>Prog%</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {managerTeam.youthPlayers.map((youth) => (
              <tr key={youth.id}>
                <td>{youth.name}</td>
                <td>{youth.age}</td>
                <td>{youth.position}</td>
                <td>{youth.overall}</td>
                <td>{youth.potential}</td>
                <td>{youth.progress}</td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => promoteYouth(youth.id)}
                    disabled={youth.overall < 60 || managerTeam.players.length >= 24}
                  >
                    Promover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  )
}
