import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createInitialLeagueState } from '../data/seedData'
import { useGame } from '../state/gameState'
import { ClubBadge } from '../components/ClubBadge'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function GamesPage() {
  const { game, savedGames, createGame, selectGame, deleteGame } = useGame()
  const navigate = useNavigate()
  const clubs = useMemo(() => createInitialLeagueState().teams, [])

  const [saveName, setSaveName] = useState('Carrera 1')
  const [managerName, setManagerName] = useState('Mister')
  const [managerTeamId, setManagerTeamId] = useState(clubs[0]?.id ?? '')
  const selectedClub = clubs.find((club) => club.id === managerTeamId) ?? null

  const submitGame = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createGame({ saveName, managerName, managerTeamId })
    navigate('/dashboard')
  }

  const loadGame = (gameId: string) => {
    selectGame(gameId)
    navigate('/dashboard')
  }

  return (
    <section className="page-grid games-grid">
      <article className="panel">
        <h2>Nueva Partida</h2>
        <form className="game-form" onSubmit={submitGame}>
          <label>
            Nombre del guardado
            <input value={saveName} onChange={(event) => setSaveName(event.target.value)} />
          </label>
          <label>
            Nombre del manager
            <input value={managerName} onChange={(event) => setManagerName(event.target.value)} />
          </label>
          <label>
            Club inicial
            <select value={managerTeamId} onChange={(event) => setManagerTeamId(event.target.value)}>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>
          {selectedClub && (
            <div className="selected-club-preview" aria-live="polite">
              <ClubBadge teamName={selectedClub.name} crestUrl={selectedClub.crestUrl} />
              <strong>{selectedClub.name}</strong>
            </div>
          )}
          <button type="submit">Crear Carrera</button>
        </form>
      </article>

      <article className="panel full-span">
        <h2>Partidas Guardadas</h2>
        {savedGames.length === 0 ? (
          <p>No hay partidas todavia. Crea una carrera eligiendo club.</p>
        ) : (
          <div className="save-list">
            {savedGames.map((save) => (
              <div
                key={save.id}
                className={`save-card ${game?.id === save.id ? 'is-active' : ''}`}
              >
                <div>
                  <h3>{save.saveName}</h3>
                  <p>Manager: {save.managerName}</p>
                  <p>Club: {save.managerTeamName}</p>
                  <p>Jornada: {save.currentRound}/{save.totalRounds}</p>
                  <p>Actualizado: {formatDate(save.updatedAt)}</p>
                </div>
                <div className="actions">
                  <button onClick={() => loadGame(save.id)}>
                    {game?.id === save.id ? 'Activa' : 'Cargar'}
                  </button>
                  <button className="secondary" onClick={() => deleteGame(save.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}
