import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGame } from '../state/gameState'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function PlayerManagementPage() {
  const { playerId } = useParams<{ playerId: string }>()
  const navigate = useNavigate()
  const {
    managerTeam,
    renewContract,
    listPlayerForTransfer,
    removePlayerFromTransferList,
    pendingRenewalOffers,
    cancelRenewalOffer,
  } = useGame()

  const player = managerTeam?.players.find((item) => item.id === playerId)
  const pendingOffer = useMemo(
    () => pendingRenewalOffers.find((item) => item.playerId === playerId),
    [pendingRenewalOffers, playerId],
  )

  const [wageInput, setWageInput] = useState<string>(player ? String(Math.round(player.wage * 1.08)) : '')
  const [yearsInput, setYearsInput] = useState<string>(player ? String(clamp(player.contractYears + 2, 1, 6)) : '3')
  const [askingPriceInput, setAskingPriceInput] = useState<string>(player ? String(player.askingPrice) : '')

  if (!managerTeam || !player) {
    return (
      <section className="page-grid">
        <article className="panel full-span">
          <h2>Jugador no encontrado</h2>
          <p>Puede haber sido transferido o no pertenece a tu plantilla actual.</p>
          <div className="actions">
            <button className="secondary" onClick={() => navigate('/club')}>
              Volver al Club
            </button>
          </div>
        </article>
      </section>
    )
  }

  const parsedWage = Number.parseInt(wageInput, 10)
  const parsedYears = Number.parseInt(yearsInput, 10)
  const parsedAskingPrice = Number.parseInt(askingPriceInput, 10)

  const effectiveWage = Number.isFinite(parsedWage) && parsedWage > 0 ? parsedWage : Math.round(player.wage * 1.08)
  const effectiveYears = Number.isFinite(parsedYears) ? parsedYears : clamp(player.contractYears + 2, 1, 6)
  const signingBonus = Math.round(effectiveWage * (effectiveYears >= 4 ? 5 : 3))
  const cannotAffordRenewal = managerTeam.budget < signingBonus

  const recent = player.recentMinutes ?? []
  const avgMinutes = recent.length > 0
    ? Math.round(recent.reduce((sum, value) => sum + value, 0) / recent.length)
    : 0
  const recentWindow = recent.slice(-5)
  const paddedRecent = [...Array(Math.max(0, 5 - recentWindow.length)).fill(0), ...recentWindow] as number[]
  const recentStartOffset = Math.max(0, 5 - recentWindow.length)
  const fatigueClass = player.fatigue >= 75
    ? 'is-fatigue-high'
    : player.fatigue >= 50
      ? 'is-fatigue-medium'
      : 'is-fatigue-low'

  return (
    <section className="page-grid">
      <article className="panel full-span">
        <div className="player-management-head">
          <div>
            <p className="eyebrow">Gestión Individual</p>
            <h2>{player.name}</h2>
            <p>
              {player.position} · GRL {player.overall} · {managerTeam.name}
            </p>
          </div>
          <div className="actions compact-actions">
            <Link className="secondary" to="/club">Volver al Club</Link>
          </div>
        </div>
      </article>

      <article className="panel">
        <h3>Estado Deportivo</h3>
        <p>Forma: <strong>{player.form}</strong></p>
        <p>Fatiga: <strong>{player.fatigue}</strong></p>
        <p>Felicidad: <strong>{player.happiness}</strong></p>
        <p>Resistencia: <strong>{player.stamina}</strong></p>
        <p>Lesión: <strong>{player.injuryWeeks > 0 ? `${player.injuryWeeks} semanas` : 'Sin lesión'}</strong></p>
        <p>Sanción: <strong>{player.suspensionWeeks > 0 ? `${player.suspensionWeeks} jornada(s)` : 'Disponible'}</strong></p>
      </article>

      <article className="panel">
        <h3>Contrato y Valor</h3>
        <p>Edad: <strong>{player.age ?? 'N/D'}</strong></p>
        <p>Sueldo actual: <strong>{formatCurrency(player.wage)}</strong></p>
        <p>Años de contrato: <strong>{player.contractYears}</strong></p>
        <p>Valor de mercado: <strong>{formatCurrency(player.value)}</strong></p>
        <p>Cláusula: <strong>{formatCurrency(player.releaseClause)}</strong></p>
        <p>Media minutos (5 partidos): <strong>{avgMinutes}/90</strong></p>
      </article>

      <article className="panel full-span">
        <h3>Mini gráfica de rendimiento</h3>
        <div className="mini-chart-wrap">
          <div className="mini-chart-head">
            <span>Minutos recientes (últimos 5 partidos)</span>
            <strong>{avgMinutes}/90</strong>
          </div>
          <div className="minutes-spark" role="img" aria-label="Minutos jugados en los últimos cinco partidos">
            {paddedRecent.map((minutes, index) => {
              const hasSample = index >= recentStartOffset
              return (
                <div key={`m-${index}`} className={`minutes-col ${hasSample ? '' : 'is-empty'}`}>
                  <div className="minutes-bar-track">
                    <div className="minutes-bar-fill" style={{ height: `${Math.max(6, (minutes / 90) * 100)}%` }} />
                  </div>
                  <span className="minutes-label">J-{4 - index}</span>
                  <span className="minutes-value">{hasSample ? minutes : '—'}</span>
                </div>
              )
            })}
          </div>
          <div className="condition-meter-grid">
            <div className="condition-meter">
              <span>Forma</span>
              <div className="condition-meter-track"><div className="condition-meter-fill is-form" style={{ width: `${player.form}%` }} /></div>
              <strong>{player.form}</strong>
            </div>
            <div className="condition-meter">
              <span>Fatiga</span>
              <div className="condition-meter-track"><div className={`condition-meter-fill ${fatigueClass}`} style={{ width: `${player.fatigue}%` }} /></div>
              <strong>{player.fatigue}</strong>
            </div>
            <div className="condition-meter">
              <span>Felicidad</span>
              <div className="condition-meter-track"><div className="condition-meter-fill is-happiness" style={{ width: `${player.happiness}%` }} /></div>
              <strong>{player.happiness}</strong>
            </div>
          </div>
        </div>
      </article>

      <article className="panel full-span">
        <h3>Renovación</h3>
        <div className="actions compact-actions">
          <input
            className="transfer-wage-input"
            type="number"
            min={player.wage}
            step={10000}
            value={wageInput}
            onChange={(event) => setWageInput(event.target.value)}
            title="Salario ofrecido"
          />
          <select value={yearsInput} onChange={(event) => setYearsInput(event.target.value)} title="Años del nuevo contrato">
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <option key={y} value={y}>{y} año{y === 1 ? '' : 's'}</option>
            ))}
          </select>
          <button
            className="secondary"
            onClick={() => renewContract(player.id, effectiveWage, effectiveYears)}
            disabled={Boolean(pendingOffer)}
            title={cannotAffordRenewal
              ? `Prima estimada: ${formatCurrency(signingBonus)} · Presupuesto insuficiente`
              : `Prima estimada: ${formatCurrency(signingBonus)}`}
          >
            {pendingOffer ? 'Esperando respuesta' : 'Enviar oferta de renovación'}
          </button>
          {pendingOffer ? (
            <>
              <span className="status-chip renewal-state-chip is-pending">Pendiente</span>
              <button onClick={() => cancelRenewalOffer(pendingOffer.id)}>Retirar oferta</button>
            </>
          ) : cannotAffordRenewal ? (
            <span className="status-chip renewal-state-chip is-blocked">Sin presupuesto</span>
          ) : (
            <span className="status-chip renewal-state-chip is-ready">Listo</span>
          )}
        </div>
      </article>

      <article className="panel full-span">
        <h3>Mercado</h3>
        <div className="actions compact-actions">
          <input
            className="transfer-wage-input"
            type="number"
            min={100000}
            step={50000}
            value={askingPriceInput}
            onChange={(event) => setAskingPriceInput(event.target.value)}
            title="Precio de salida"
          />
          {player.transferListed ? (
            <button onClick={() => removePlayerFromTransferList(player.id)}>
              Quitar de la lista de transferibles
            </button>
          ) : (
            <button
              className="secondary"
              onClick={() => listPlayerForTransfer(player.id, Number.isFinite(parsedAskingPrice) ? parsedAskingPrice : player.askingPrice)}
            >
              Poner en venta
            </button>
          )}
          <span className={`status-chip renewal-state-chip ${player.transferListed ? 'is-pending' : 'is-ready'}`}>
            {player.transferListed ? 'En venta' : 'No listado'}
          </span>
        </div>
      </article>
    </section>
  )
}
