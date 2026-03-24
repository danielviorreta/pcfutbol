import { useMemo } from 'react'
import { getLineupAssignments, getLineupPlayers, isPlayerAvailable } from '../engine/squad'
import { useGame } from '../state/gameState'
import type { Tactic } from '../types/game'

const tacticOptions: { value: Tactic; label: string }[] = [
  { value: '4-3-3', label: '4-3-3' },
  { value: '4-4-2', label: '4-4-2' },
  { value: '5-4-1', label: '5-4-1' },
]

const tacticSlotCoords: Record<Tactic, { x: number; y: number }[]> = {
  '4-3-3': [
    { x: 50, y: 92 },
    { x: 82, y: 73 },
    { x: 61, y: 74 },
    { x: 39, y: 74 },
    { x: 18, y: 73 },
    { x: 50, y: 60 },
    { x: 35, y: 49 },
    { x: 65, y: 49 },
    { x: 82, y: 25 },
    { x: 50, y: 18 },
    { x: 18, y: 25 },
  ],
  '4-4-2': [
    { x: 50, y: 92 },
    { x: 82, y: 73 },
    { x: 61, y: 74 },
    { x: 39, y: 74 },
    { x: 18, y: 73 },
    { x: 80, y: 48 },
    { x: 58, y: 49 },
    { x: 42, y: 49 },
    { x: 20, y: 48 },
    { x: 42, y: 20 },
    { x: 58, y: 20 },
  ],
  '5-4-1': [
    { x: 50, y: 92 },
    { x: 88, y: 68 },
    { x: 66, y: 75 },
    { x: 50, y: 77 },
    { x: 34, y: 75 },
    { x: 12, y: 68 },
    { x: 78, y: 48 },
    { x: 58, y: 50 },
    { x: 42, y: 50 },
    { x: 22, y: 48 },
    { x: 50, y: 20 },
  ],
}

function shortPlayerName(name: string): string {
  const tokens = name.trim().split(/\s+/)
  if (tokens.length <= 1) {
    return name
  }

  return tokens[tokens.length - 1]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function SquadPage() {
  const { game, managerTeam, setLineupSlotPlayer, autoPickLineup, setTactic } = useGame()

  if (!game || !managerTeam) {
    return null
  }

  const lineupPlayers = getLineupPlayers(managerTeam, game.managerLineup)
  const assignments = getLineupAssignments(managerTeam, game.managerLineup)
  const unavailableCount = managerTeam.players.filter(
    (player) => player.injuryWeeks > 0 || player.suspensionWeeks > 0,
  ).length

  const selectedBySlot = assignments.map((item) => item.player?.id ?? '')
  const selectedSet = new Set(selectedBySlot.filter(Boolean))

  const tactic = (managerTeam.tactic ?? '4-3-3') as Tactic
  const roleByPlayerId = useMemo(
    () =>
      new Map(
        assignments
          .filter((item) => item.player)
          .map((item) => [item.player!.id, item]),
      ),
    [assignments],
  )

  const averageOverall =
    assignments.length > 0
      ? Math.round(
          assignments.reduce((sum, item) => sum + item.effectiveOverall, 0) / assignments.length,
        )
      : 0

  const sortedPlayers = managerTeam.players
    .slice()
    .sort((a, b) => b.overall - a.overall)

  const mapCoords = tacticSlotCoords[tactic]

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

      <article className="panel">
        <h2>Tactica</h2>
        <p>Sistema actual: <strong>{managerTeam.tactic ?? '4-3-3'}</strong></p>
        <div className="actions">
          {tacticOptions.map((option) => (
            <button
              key={option.value}
              className="secondary"
              onClick={() => setTactic(option.value)}
              disabled={(managerTeam.tactic ?? '4-3-3') === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </article>

      <article className="panel full-span">
        <h2>Mapa de la Tactica</h2>
        <div className="tactic-map">
          <span className="pitch-mark outer" aria-hidden="true" />
          <span className="pitch-mark halfway" aria-hidden="true" />
          <span className="pitch-mark center-circle" aria-hidden="true" />
          <span className="pitch-mark center-spot" aria-hidden="true" />
          <span className="pitch-mark top-penalty" aria-hidden="true" />
          <span className="pitch-mark top-six-yard" aria-hidden="true" />
          <span className="pitch-mark top-spot" aria-hidden="true" />
          <span className="pitch-mark top-arc" aria-hidden="true" />
          <span className="pitch-mark bottom-penalty" aria-hidden="true" />
          <span className="pitch-mark bottom-six-yard" aria-hidden="true" />
          <span className="pitch-mark bottom-spot" aria-hidden="true" />
          <span className="pitch-mark bottom-arc" aria-hidden="true" />
          {assignments.map((slot) => {
            const point = mapCoords[slot.slotIndex] ?? { x: 50, y: 50 }

            return (
              <div
                key={`map-${slot.slotIndex}-${slot.role}`}
                className="tactic-node"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                <span className="tactic-role">{slot.role}</span>
                <strong className="tactic-player">{slot.player ? shortPlayerName(slot.player.name) : '-'}</strong>
              </div>
            )
          })}
        </div>
      </article>

      <article className="panel full-span">
        <h2>Pizarra Tactica ({managerTeam.tactic ?? '4-3-3'})</h2>
        <div className="pitch-board">
          {assignments.map((slot) => {
            const currentId = slot.player?.id ?? ''
            const availableOptions = sortedPlayers.filter((player) => {
              if (!isPlayerAvailable(player)) {
                return false
              }

              return player.id === currentId || !selectedSet.has(player.id)
            })

            return (
              <div className="pitch-slot" key={`${slot.role}-${slot.slotIndex}`}>
                <div className="pitch-slot-head">
                  <p className="pitch-slot-role">{slot.role}</p>
                  <div className="mini-role-pitch" aria-hidden="true">
                    <span className="mini-pitch-mark mini-outer" />
                    <span className="mini-pitch-mark mini-half" />
                    <span className="mini-pitch-mark mini-circle" />
                    <span className="mini-pitch-mark mini-top-box" />
                    <span className="mini-pitch-mark mini-bottom-box" />
                    <span className="mini-pitch-mark mini-top-arc" />
                    <span className="mini-pitch-mark mini-bottom-arc" />
                    <span
                      className="mini-role-dot"
                      style={{
                        left: `${(mapCoords[slot.slotIndex]?.x ?? 50) * 0.88 + 6}%`,
                        top: `${(mapCoords[slot.slotIndex]?.y ?? 50) * 0.88 + 6}%`,
                      }}
                    />
                  </div>
                </div>
                <select
                  value={currentId}
                  onChange={(event) => setLineupSlotPlayer(slot.slotIndex, event.target.value)}
                >
                  {availableOptions.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
                {slot.player && (
                  <p className="pitch-slot-grl">
                    GRL en rol: <strong>{slot.effectiveOverall}</strong> ({Math.round(slot.fit * 100)}%)
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </article>

      <article className="panel table-panel full-span">
        <h2>Plantilla de {managerTeam.name}</h2>
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Pos</th>
              <th>Rol XI</th>
              <th>GRL XI</th>
              <th>Mejor Pos.</th>
              <th>GRL</th>
              <th>Forma</th>
              <th>Fatiga</th>
                <th>Tarjetas</th>
              <th>Estado</th>
              <th>Contrato</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player) => {
              const assigned = roleByPlayerId.get(player.id)

                return (
                  <tr key={player.id}>
                    <td>{player.name}</td>
                    <td>{player.position}</td>
                    <td>{assigned?.role ?? '-'}</td>
                    <td>{assigned ? assigned.effectiveOverall : '-'}</td>
                    <td>{player.naturalPositions?.join('/') ?? player.position}</td>
                    <td>{player.overall}</td>
                    <td>{player.form}</td>
                    <td>{player.fatigue}</td>
                    <td>{player.yellowCards}</td>
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
