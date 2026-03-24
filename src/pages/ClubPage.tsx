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
  const { managerTeam, setTrainingFocus, renewContract, promoteYouth } = useGame()

  if (!managerTeam) {
    return null
  }

  const payroll = Math.round(
    managerTeam.players.reduce((sum, player) => sum + player.wage, 0) / 52,
  )

  return (
    <section className="page-grid">
      <article className="panel">
        <h2>Finanzas y Sponsor</h2>
        <p>Presupuesto: <strong>{formatCurrency(managerTeam.budget)}</strong></p>
        <p>Nomina semanal: {formatCurrency(payroll)}</p>
        <p>Sponsor: {managerTeam.sponsor.name}</p>
        <p>Ingreso semanal sponsor: {formatCurrency(managerTeam.sponsor.weeklyIncome)}</p>
        <p>
          Objetivo sponsor: Top {managerTeam.sponsor.targetRank} (bonus {formatCurrency(managerTeam.sponsor.seasonBonus)})
        </p>
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
