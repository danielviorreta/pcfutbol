import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useGame } from '../state/gameState'
import { assessClubSaleDecision, assessTransferDecision } from '../engine/playerMarket'
import type { PromisedRole } from '../types/game'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

const promisedRoleLabels: Record<PromisedRole, string> = {
  estrella: 'Estrella',
  titular: 'Titular',
  rotacion: 'Rotacion',
  banquillo: 'Banquillo',
}

export function TransferOfferPage() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const { game, managerTeam, transferTargets, purchasePlayer, pendingOutgoingTransfers } = useGame()

  const target = transferTargets.find((candidate) => candidate.player.id === playerId)
  const [wageOffer, setWageOffer] = useState(String(target?.recommendedWage ?? '0'))
  const [signingBonus, setSigningBonus] = useState(String(target?.recommendedSigningBonus ?? '0'))
  const [contractYears, setContractYears] = useState(String(target?.recommendedContractYears ?? '3'))
  const [promisedRole, setPromisedRole] = useState<PromisedRole>(target?.recommendedPromisedRole ?? 'rotacion')
  const [feeInput, setFeeInput] = useState(String(target?.marketPrice ?? '0'))

  if (!managerTeam || !target) {
    return <Navigate to="/transfers" replace />
  }

  const parsedWage = Number.parseInt(wageOffer, 10)
  const parsedBonus = Number.parseInt(signingBonus, 10)
  const parsedYears = Number.parseInt(contractYears, 10)
  const parsedFee = Number.parseInt(feeInput, 10)
  const effectiveWage = Number.isFinite(parsedWage) ? parsedWage : target.recommendedWage
  const effectiveBonus = Number.isFinite(parsedBonus) ? parsedBonus : target.recommendedSigningBonus
  const effectiveYears = Number.isFinite(parsedYears) ? parsedYears : target.recommendedContractYears
  const effectiveFee = Number.isFinite(parsedFee) && parsedFee > 0 ? parsedFee : target.marketPrice
  const totalImmediateCost = effectiveFee + effectiveBonus
  const hasPendingOffer = pendingOutgoingTransfers.some((o) => o.playerId === target.player.id)

  const clubDecision = effectiveFee < target.marketPrice
    ? assessClubSaleDecision(target.player, target.marketPrice, effectiveFee)
    : { accepted: true, minAcceptablePrice: 0, reason: '' }

  // Calculate player decision based on current inputs
  const sellerTeam = !game ? null : game.leagueState.teams.find((t) => t.id === target.sellerTeamId)
  const playerDecision = !game || !sellerTeam || !managerTeam ? { accepted: false, reason: '', score: 0 }
    : assessTransferDecision(
      target.player,
      managerTeam,
      sellerTeam,
      {
        wageOffer: effectiveWage,
        signingBonus: effectiveBonus,
        contractYears: effectiveYears,
        promisedRole,
      },
    )

  return (
    <section className="page-grid">
      <article className="panel">
        <h2>Oferta de Fichaje</h2>
        <p>
          Jugador: <strong>{target.player.name}</strong>
        </p>
        <p>Club actual: {target.sellerTeamName}</p>
        <p>Posicion: {target.player.position} · GRL {target.player.overall}</p>
        <p>Felicidad actual: {target.player.happiness}</p>
        <p>Estado mercado: <strong>{target.isTransferListed ? 'En venta' : 'Solo clausula'}</strong></p>
        <p>Interes inicial: <strong>{target.interestLabel}</strong></p>
      </article>

      <article className="panel">
        <h2>Condiciones</h2>
        <p>Precio de salida: <strong>{formatCurrency(target.marketPrice)}</strong></p>
        <p>Clausula: <strong>{formatCurrency(target.releaseClause)}</strong></p>
        <p>Sueldo recomendado: <strong>{formatCurrency(target.recommendedWage)}</strong></p>
        <p>Prima sugerida: <strong>{formatCurrency(target.recommendedSigningBonus)}</strong></p>
        <p>Contrato sugerido: <strong>{target.recommendedContractYears} anos</strong></p>
        <p>Rol sugerido: <strong>{promisedRoleLabels[target.recommendedPromisedRole]}</strong></p>
      </article>

      <article className="panel full-span">
        <h2>Negociacion</h2>
        <div className="transfer-form-grid">
          <label>
            Cuantia al club vendedor
            <input
              type="number"
              min={100000}
              step={100000}
              value={feeInput}
              onChange={(event) => setFeeInput(event.target.value)}
            />
          </label>
          <label>
            Salario anual
            <input
              type="number"
              min={target.recommendedWage}
              step={10000}
              value={wageOffer}
              onChange={(event) => setWageOffer(event.target.value)}
            />
          </label>
          <label>
            Prima de fichaje
            <input
              type="number"
              min={0}
              step={50000}
              value={signingBonus}
              onChange={(event) => setSigningBonus(event.target.value)}
            />
          </label>
          <label>
            Anos de contrato
            <select value={contractYears} onChange={(event) => setContractYears(event.target.value)}>
              {[2, 3, 4, 5].map((years) => (
                <option key={years} value={years}>
                  {years}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rol prometido
            <select value={promisedRole} onChange={(event) => setPromisedRole(event.target.value as PromisedRole)}>
              {Object.entries(promisedRoleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="transfer-offer-summary">
          <p>Cuantia al club: <strong>{formatCurrency(effectiveFee)}</strong>
            {effectiveFee < target.marketPrice && (
              <span className={`fee-verdict ${clubDecision.accepted ? 'is-ok' : 'is-rejected'}`}>
                {' '}{clubDecision.accepted ? '✓ El club probablemente acepte' : `✗ ${clubDecision.reason}`}
              </span>
            )}
          </p>
          <p>Coste total (cuantia + prima): <strong>{formatCurrency(totalImmediateCost)}</strong></p>
          <p>Presupuesto actual: <strong>{formatCurrency(managerTeam.budget)}</strong></p>
          <p style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            Respuesta del jugador: 
            <span className={`fee-verdict ${playerDecision.accepted ? 'is-ok' : 'is-rejected'}`}>
              {' '}{playerDecision.accepted
                ? '✓ Aceptaría traspasarse'
                : `✗ ${playerDecision.reason}`}
            </span>
          </p>
        </div>

        <div className="actions">
          {hasPendingOffer ? (
            <p><strong>Oferta pendiente · el club responderá en la próxima jornada</strong></p>
          ) : (
            <button
              onClick={() => {
                purchasePlayer(target.player.id, effectiveWage, effectiveBonus, effectiveYears, promisedRole, effectiveFee)
                navigate('/transfers')
              }}
              disabled={managerTeam.budget < totalImmediateCost || !playerDecision.accepted}
            >
              Enviar oferta
            </button>
          )}
          <button className="secondary" onClick={() => navigate('/transfers')}>
            Volver
          </button>
        </div>
      </article>
    </section>
  )
}
