import { useMemo } from 'react'
import { getLineupPlayers } from '../engine/squad'
import { useGame } from '../state/gameState'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function SquadPage() {
  const { game, managerTeam, toggleLineupPlayer, autoPickLineup } = useGame()
  const selectedSet = useMemo(() => new Set(game?.managerLineup ?? []), [game?.managerLineup])

  if (!game || !managerTeam) {
    return null
  }

  const lineupPlayers = getLineupPlayers(managerTeam, game.managerLineup)
  const unavailableCount = managerTeam.players.filter(
    (player) => player.injuryWeeks > 0 || player.suspensionWeeks > 0,
  ).length

  const averageOverall =
    lineupPlayers.length > 0
      ? Math.round(
          lineupPlayers.reduce((sum, player) => sum + player.overall, 0) / lineupPlayers.length,
        )
      : 0

  return (
    <section className="page-grid squad-grid">
      <article className="panel">
        <h2>Once Titular</h2>
        <p>
          Jugadores seleccionados: <strong>{lineupPlayers.length}</strong> / 11
        </p>
        <p>Media del once: {averageOverall}</p>
        <p>Bajas actuales: {unavailableCount}</p>
        <div className="actions">
          <button className="secondary" onClick={autoPickLineup}>
            Auto Alinear
          </button>
        </div>
      </article>

      <article className="panel table-panel full-span">
        <h2>Plantilla de {managerTeam.name}</h2>
        <table>
          <thead>
            <tr>
              <th>XI</th>
              <th>Jugador</th>
              <th>Pos</th>
              <th>GRL</th>
              <th>Forma</th>
              <th>Fatiga</th>
              <th>Estado</th>
              <th>Contrato</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {managerTeam.players
              .slice()
              .sort((a, b) => b.overall - a.overall)
              .map((player) => {
                const selected = selectedSet.has(player.id)

                return (
                  <tr key={player.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleLineupPlayer(player.id)}
                        disabled={player.injuryWeeks > 0 || player.suspensionWeeks > 0}
                      />
                    </td>
                    <td>{player.name}</td>
                    <td>{player.position}</td>
                    <td>{player.overall}</td>
                    <td>{player.form}</td>
                    <td>{player.fatigue}</td>
                    <td>
                      {player.injuryWeeks > 0
                        ? `Lesionado (${player.injuryWeeks})`
                        : player.suspensionWeeks > 0
                          ? `Sancionado (${player.suspensionWeeks})`
                          : 'Disponible'}
                    </td>
                    <td>{player.contractYears}</td>
                    <td>{formatCurrency(player.value)}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </article>
    </section>
  )
}
