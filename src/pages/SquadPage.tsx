import { useMemo, useState, type DragEvent } from 'react'
import { getLineupAssignments, getLineupPlayers, isPlayerAvailable } from '../engine/squad'
import { useGame } from '../state/gameState'
import type { Player, RolePosition, Tactic } from '../types/game'

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

const roleDotCoords: Record<RolePosition, { x: number; y: number }> = {
  GK: { x: 50, y: 88 },
  RB: { x: 82, y: 72 },
  CB: { x: 50, y: 74 },
  LB: { x: 18, y: 72 },
  RWB: { x: 86, y: 66 },
  LWB: { x: 14, y: 66 },
  DM: { x: 50, y: 60 },
  CM: { x: 50, y: 50 },
  AM: { x: 50, y: 38 },
  RM: { x: 78, y: 50 },
  LM: { x: 22, y: 50 },
  RW: { x: 82, y: 28 },
  LW: { x: 18, y: 28 },
  CF: { x: 50, y: 24 },
  ST: { x: 50, y: 20 },
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

function getPlayerStatusInfo(injuryWeeks: number, suspensionWeeks: number, yellowCards: number) {
  if (injuryWeeks > 0) {
    return {
      icon: '✚',
      label: `Lesionado (${injuryWeeks})`,
      className: 'status-chip is-injured',
    }
  }

  if (suspensionWeeks > 0) {
    const byAccumulation = yellowCards >= 4
    return {
      icon: byAccumulation ? '🟨🟨' : '🟥',
      label: `Sancionado (${suspensionWeeks})`,
      className: 'status-chip is-suspended',
    }
  }

  return {
    icon: '✓',
    label: 'Disponible',
    className: 'status-chip is-available',
  }
}

function getBestRole(player: Player): RolePosition {
  if (player.naturalPositions && player.naturalPositions.length > 0) {
    return player.naturalPositions[0]
  }

  switch (player.position) {
    case 'GK':
      return 'GK'
    case 'DEF':
      return 'CB'
    case 'MID':
      return 'CM'
    case 'FWD':
      return 'ST'
    default:
      return 'CM'
  }
}

function getFitTierClass(fit: number): 'is-good' | 'is-ok' | 'is-bad' {
  if (fit >= 0.92) {
    return 'is-good'
  }

  if (fit >= 0.82) {
    return 'is-ok'
  }

  return 'is-bad'
}

export function SquadPage() {
  const { game, managerTeam, setLineupSlotPlayer, autoPickLineup, setTactic } = useGame()
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null)
  const [dragOverPlayerId, setDragOverPlayerId] = useState<string | null>(null)

  const lineupPlayers = useMemo(
    () => (game && managerTeam ? getLineupPlayers(managerTeam, game.managerLineup) : []),
    [game, managerTeam],
  )
  const assignments = useMemo(
    () => (game && managerTeam ? getLineupAssignments(managerTeam, game.managerLineup) : []),
    [game, managerTeam],
  )
  const unavailableCount = managerTeam
    ? managerTeam.players.filter((player) => player.injuryWeeks > 0 || player.suspensionWeeks > 0).length
    : 0

  const tactic = (managerTeam?.tactic ?? '4-3-3') as Tactic
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

  const sortedPlayers = useMemo(() => {
    if (!managerTeam) {
      return []
    }

    const starters = assignments
      .map((slot) => slot.player)
      .filter((player): player is NonNullable<typeof player> => Boolean(player))
    const starterIds = new Set(starters.map((player) => player.id))

    const bench = managerTeam.players
      .filter((player) => !starterIds.has(player.id))
      .slice()
      .sort((a, b) => b.overall - a.overall)

    return [...starters, ...bench]
  }, [assignments, managerTeam])

  const mapCoords = tacticSlotCoords[tactic]

  if (!game || !managerTeam) {
    return null
  }

  const clearDrag = () => {
    setDraggedPlayerId(null)
    setDragOverPlayerId(null)
  }

  const onRowDragStart = (event: DragEvent<HTMLTableRowElement>, playerId: string) => {
    event.dataTransfer.setData('text/plain', playerId)
    event.dataTransfer.effectAllowed = 'move'
    setDraggedPlayerId(playerId)
  }

  const onRowDragOver = (event: DragEvent<HTMLTableRowElement>, targetPlayerId: string) => {
    if (!draggedPlayerId || draggedPlayerId === targetPlayerId) {
      return
    }

    // At least one of them must be involved in the lineup (starter ↔ bench or starter ↔ starter)
    const draggedIsStarter = roleByPlayerId.has(draggedPlayerId)
    const targetIsStarter = roleByPlayerId.has(targetPlayerId)
    if (!draggedIsStarter && !targetIsStarter) {
      return
    }

    // The player moving INTO a starter slot must be available
    const incomingToStarterSlot = draggedIsStarter ? null : draggedPlayerId
    if (incomingToStarterSlot) {
      const player = managerTeam.players.find((p) => p.id === incomingToStarterSlot)
      if (!player || !isPlayerAvailable(player)) {
        return
      }
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverPlayerId(targetPlayerId)
  }

  const onRowDrop = (event: DragEvent<HTMLTableRowElement>, targetPlayerId: string) => {
    event.preventDefault()
    const sourceId = draggedPlayerId || event.dataTransfer.getData('text/plain')
    if (!sourceId || sourceId === targetPlayerId) {
      clearDrag()
      return
    }

    const targetAssignment = roleByPlayerId.get(targetPlayerId)
    const sourceAssignment = roleByPlayerId.get(sourceId)

    if (targetAssignment) {
      // Drop onto a starter row: put source player in that slot (state handles internal swap)
      const sourcePlayer = managerTeam.players.find((p) => p.id === sourceId)
      if (sourcePlayer && isPlayerAvailable(sourcePlayer)) {
        setLineupSlotPlayer(targetAssignment.slotIndex, sourceId)
      }
    } else if (sourceAssignment) {
      // Source is a starter, target is bench: put target player in source's slot
      const targetPlayer = managerTeam.players.find((p) => p.id === targetPlayerId)
      if (targetPlayer && isPlayerAvailable(targetPlayer)) {
        setLineupSlotPlayer(sourceAssignment.slotIndex, targetPlayerId)
      }
    }

    clearDrag()
  }

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
        <h2>Pizarra Tactica — {managerTeam.tactic ?? '4-3-3'}</h2>
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

      <article className="panel table-panel full-span">
        <h2>
          Plantilla de {managerTeam.name}
          {' '}
          <span className="competition-badge inline-badge">{managerTeam.division}{managerTeam.group ? ` - ${managerTeam.group}` : ''}</span>
        </h2>
        <p className="squad-hint">
          Arrastra un jugador sobre otro para intercambiarlos. Los titulares aparecen marcados al inicio de la lista.
        </p>
        <div className="position-legend" aria-label="Leyenda de iconos de posicion">
          <span className="position-legend-item">
            <span className="position-legend-dot is-good" aria-hidden="true" />
            Posicion ideal
          </span>
          <span className="position-legend-item">
            <span className="position-legend-dot is-ok" aria-hidden="true" />
            Encaje aceptable
          </span>
          <span className="position-legend-item">
            <span className="position-legend-dot is-bad" aria-hidden="true" />
            Mal encaje
          </span>
          <span className="position-legend-item">
            <span className="position-legend-dot is-neutral" aria-hidden="true" />
            Posicion actual / suplente
          </span>
        </div>
        <p className="role-legend" aria-label="Leyenda de abreviaturas de posicion">
          GK: Portero · RB/LB: Lateral der/izq · CB: Central · RWB/LWB: Carrilero der/izq · DM: Pivote defensivo · CM: Centrocampista · AM: Mediapunta · RM/LM: Interior der/izq · RW/LW: Extremo der/izq · CF: Segundo punta · ST: Delantero centro
        </p>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Jugador</th>
              <th>Pos</th>
              <th>GRL XI</th>
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
              const bestRole = getBestRole(player)
              const isExactRole = assigned ? assigned.role === bestRole : false
              const bestRoleColorClass = assigned ? getFitTierClass(assigned.fit) : 'is-neutral'
              const status = getPlayerStatusInfo(player.injuryWeeks, player.suspensionWeeks, player.yellowCards)
              const available = isPlayerAvailable(player)
              const isDragging = draggedPlayerId === player.id
              const isDragOver = dragOverPlayerId === player.id

              return (
                <tr
                  key={player.id}
                  className={[
                    'squad-row',
                    assigned ? 'is-starter' : '',
                    !available ? 'is-unavailable' : '',
                    isDragging ? 'is-dragging' : '',
                    isDragOver ? 'is-drag-over' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  draggable={available}
                  onDragStart={(event) => onRowDragStart(event, player.id)}
                  onDragOver={(event) => onRowDragOver(event, player.id)}
                  onDragLeave={() => setDragOverPlayerId(null)}
                  onDrop={(event) => onRowDrop(event, player.id)}
                  onDragEnd={clearDrag}
                >
                  <td className="drag-handle" aria-hidden="true">⠿</td>
                  <td>
                    <span className="player-name-cell">
                      <span
                        className="player-pos-icon"
                        title={
                          assigned
                            ? isExactRole
                              ? `Posicion ideal: ${bestRole}`
                              : `Mejor: ${bestRole} | Jugando: ${assigned.role}`
                            : `Mejor posicion: ${bestRole}`
                        }
                        aria-label={
                          assigned
                            ? isExactRole
                              ? `Posicion ideal ${bestRole}`
                              : `Mejor ${bestRole}, jugando ${assigned.role}`
                            : `Mejor posicion ${bestRole}`
                        }
                      >
                        <span className="player-pos-pitch" aria-hidden="true">
                          <span className="player-pos-midline" />
                          {!assigned && (
                            <span
                              className="player-pos-dot is-neutral"
                              style={{ left: `${roleDotCoords[bestRole].x}%`, top: `${roleDotCoords[bestRole].y}%` }}
                            />
                          )}
                          {assigned && isExactRole && (
                            <span
                              className="player-pos-dot is-good"
                              style={{ left: `${roleDotCoords[assigned.role].x}%`, top: `${roleDotCoords[assigned.role].y}%` }}
                            />
                          )}
                          {assigned && !isExactRole && (
                            <>
                              <span
                                className={`player-pos-dot ${bestRoleColorClass}`}
                                style={{ left: `${roleDotCoords[bestRole].x}%`, top: `${roleDotCoords[bestRole].y}%` }}
                              />
                              <span
                                className="player-pos-dot is-neutral is-current"
                                style={{ left: `${roleDotCoords[assigned.role].x}%`, top: `${roleDotCoords[assigned.role].y}%` }}
                              />
                            </>
                          )}
                        </span>
                      </span>
                      {assigned && (
                        <span className="role-badge">{assigned.role}</span>
                      )}
                      {player.name}
                    </span>
                  </td>
                  <td>{player.position}</td>
                  <td>{assigned ? assigned.effectiveOverall : '—'}</td>
                  <td>{player.overall}</td>
                  <td>{player.form}</td>
                  <td>{player.fatigue}</td>
                  <td>{player.yellowCards}</td>
                  <td>
                    <span className={status.className}>{status.icon} {status.label}</span>
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
