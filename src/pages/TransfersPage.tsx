import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../state/gameState'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function TransfersPage() {
  const {
    managerTeam,
    transferTargets,
    pendingTransferOffers,
    pendingOutgoingTransfers,
    acceptTransferOffer,
    rejectTransferOffer,
    cancelOutgoingTransfer,
  } = useGame()
  const navigate = useNavigate()
  const [selectedSellerTeamId, setSelectedSellerTeamId] = useState<string>('')
  const [interestFilter, setInterestFilter] = useState<string>('')

  if (!managerTeam) {
    return null
  }

  const allListedTargets = transferTargets.filter((target) => target.isTransferListed)
  const interestOptions = [...new Set(allListedTargets.map((t) => t.interestLabel))].sort()
  const listedTargets = interestFilter
    ? allListedTargets.filter((target) => target.interestLabel === interestFilter)
    : allListedTargets
  const sellerTeams = transferTargets
    .reduce<Array<{ id: string; name: string; division: string; group?: string }>>((acc, target) => {
      if (acc.some((team) => team.id === target.sellerTeamId)) {
        return acc
      }

      return [...acc, {
        id: target.sellerTeamId,
        name: target.sellerTeamName,
        division: target.sellerDivision,
        group: target.sellerGroup,
      }]
    }, [])
    .sort((a, b) => {
      const divisionOrder = (division: string) => {
        if (division === 'Primera') {
          return 0
        }

        if (division === 'Segunda') {
          return 1
        }

        return 2
      }

      const aOrder = divisionOrder(a.division)
      const bOrder = divisionOrder(b.division)
      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }

      const groupCompare = (a.group ?? '').localeCompare(b.group ?? '', 'es')
      if (groupCompare !== 0) {
        return groupCompare
      }

      return a.name.localeCompare(b.name, 'es')
    })

  const visibleTeamTargets = selectedSellerTeamId
    ? transferTargets.filter((target) => target.sellerTeamId === selectedSellerTeamId)
    : []

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
        <p>Mercado en dos vistas: listado global de en venta y exploracion completa por equipo.</p>
        <p>
          Plantilla: {managerTeam.players.length} jugadores.
        </p>
        <p>Jugadores disponibles: en venta (listado global) y por equipo. Gestiona tus ventas desde la seccion Club.</p>
      </article>

      <article className="panel full-span">
        <h2>Jugadores En Venta (Global)</h2>
        <div className="actions compact-actions" style={{ marginBottom: '0.75rem' }}>
          <label>
            Filtrar por interés
            <select value={interestFilter} onChange={(e) => setInterestFilter(e.target.value)}>
              <option value="">Todos</option>
              {interestOptions.map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Pos</th>
              <th>GRL</th>
              <th>Club</th>
              <th>Precio</th>
              <th>Interes</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {listedTargets.map((target) => (
              <tr key={`listed-${target.player.id}`}>
                <td>{target.player.name}</td>
                <td>{target.player.position}</td>
                <td>{target.player.overall}</td>
                <td>{target.sellerTeamName}</td>
                <td>{formatCurrency(target.marketPrice)}</td>
                <td>{target.interestLabel}</td>
                <td>
                  <button className="secondary" onClick={() => navigate(`/transfers/offer/${target.player.id}`)}>
                    Preparar oferta
                  </button>
                </td>
              </tr>
            ))}
            {listedTargets.length === 0 && (
              <tr>
                <td colSpan={7}>No hay jugadores en venta ahora mismo.</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>

      <article className="panel full-span">
        <h2>Ofertas Enviadas (Pendientes)</h2>
        {pendingOutgoingTransfers.length === 0 ? (
          <p>No hay ofertas pendientes de respuesta.</p>
        ) : (
          <div className="offer-list">
            {pendingOutgoingTransfers.map((offer) => (
              <div className="offer-card" key={offer.id}>
                <div>
                  <p className="offer-card-title">
                    Oferta por <strong>{offer.playerName}</strong> · <span style={{ opacity: 0.7 }}>{offer.sellerTeamName}</span>
                  </p>
                  <p>Cuantía al club: {formatCurrency(offer.transferFee)} · Prima fichaje: {formatCurrency(offer.signingBonus)}</p>
                  <p>Salario anual: {formatCurrency(offer.wageOffer)} · Contrato: {offer.contractYears} años · Rol: {offer.promisedRole}</p>
                  <p><em>Respuesta esperada en la próxima jornada</em></p>
                </div>
                <div className="actions">
                  <button className="secondary" onClick={() => cancelOutgoingTransfer(offer.id)}>Retirar oferta</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="panel full-span">
        <h2>Ofertas Recibidas</h2>
        {pendingTransferOffers.length === 0 ? (
          <p>No hay ofertas activas por tus jugadores.</p>
        ) : (
          <div className="offer-list">
            {pendingTransferOffers.map((offer) => (
              <div className="offer-card" key={offer.id}>
                <div>
                  <p className="offer-card-title">
                    <strong>{offer.buyerTeamName}</strong> quiere fichar a <strong>{offer.playerName}</strong>
                  </p>
                  <p>Precio de salida: {formatCurrency(offer.transferFee)} · Clausula: {formatCurrency(offer.releaseClause)}</p>
                  <p>Salario: {formatCurrency(offer.wageOffer)} · Prima: {formatCurrency(offer.signingBonus)}</p>
                  <p>Contrato: {offer.contractYears} anos · Rol: {offer.promisedRole}</p>
                </div>
                <div className="actions">
                  <button onClick={() => acceptTransferOffer(offer.id)}>Aceptar</button>
                  <button className="secondary" onClick={() => rejectTransferOffer(offer.id)}>Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="panel table-panel full-span">
        <h2>Explorar Por Equipo</h2>
        <div className="actions compact-actions">
          <label>
            Equipo
            <select
              value={selectedSellerTeamId}
              onChange={(event) => setSelectedSellerTeamId(event.target.value)}
            >
              <option value="">Selecciona equipo</option>
              <optgroup label="Primera">
                {sellerTeams
                  .filter((team) => team.division === 'Primera')
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Segunda">
                {sellerTeams
                  .filter((team) => team.division === 'Segunda')
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Primera Federacion - Grupo 1">
                {sellerTeams
                  .filter((team) => team.division === 'Primera Federacion' && team.group === 'Grupo 1')
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Primera Federacion - Grupo 2">
                {sellerTeams
                  .filter((team) => team.division === 'Primera Federacion' && team.group === 'Grupo 2')
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Pos</th>
              <th>GRL</th>
              <th>Felicidad</th>
              <th>Club</th>
              <th>Estado</th>
              <th>Precio</th>
              <th>Clausula</th>
              <th>Interes</th>
              <th>Sueldo pedido</th>
              <th>Prima sugerida</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {visibleTeamTargets.map((target) => (
              <tr key={target.player.id}>
                <td>{target.player.name}</td>
                <td>{target.player.position}</td>
                <td>{target.player.overall}</td>
                <td>{target.player.happiness}</td>
                <td>{target.sellerTeamName}</td>
                <td>{target.isTransferListed ? 'En venta' : 'Solo clausula'}</td>
                <td>{formatCurrency(target.marketPrice)}</td>
                <td>{formatCurrency(target.releaseClause)}</td>
                <td>{target.interestLabel}</td>
                <td>{formatCurrency(target.recommendedWage)}</td>
                <td>{formatCurrency(target.recommendedSigningBonus)}</td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => navigate(`/transfers/offer/${target.player.id}`)}
                  >
                    Preparar oferta
                  </button>
                </td>
              </tr>
            ))}
            {visibleTeamTargets.length === 0 && (
              <tr>
                <td colSpan={12}>Selecciona un equipo para ver sus jugadores disponibles para oferta.</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  )
}
