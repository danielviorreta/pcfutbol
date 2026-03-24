import { useGame } from '../state/gameState'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function TransfersPage() {
  const { managerTeam, transferTargets, purchasePlayer } = useGame()

  if (!managerTeam) {
    return null
  }

  return (
    <section className="page-grid">
      <article className="panel">
        <h2>Mercado</h2>
        <p>
          Competicion: <span className="competition-badge">{managerTeam.division}{managerTeam.group ? ` - ${managerTeam.group}` : ''}</span>
        </p>
        <p>
          Presupuesto actual: <strong>{formatCurrency(managerTeam.budget)}</strong>
        </p>
        <p>
          Plantilla: {managerTeam.players.length} jugadores.
        </p>
      </article>

      <article className="panel table-panel full-span">
        <h2>Jugadores Disponibles</h2>
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Pos</th>
              <th>GRL</th>
              <th>Club</th>
              <th>Precio</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {transferTargets.map((target) => (
              <tr key={target.player.id}>
                <td>{target.player.name}</td>
                <td>{target.player.position}</td>
                <td>{target.player.overall}</td>
                <td>{target.sellerTeamName}</td>
                <td>{formatCurrency(target.askingPrice)}</td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => purchasePlayer(target.player.id)}
                    disabled={managerTeam.budget < target.askingPrice}
                  >
                    Fichar
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
