import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { ClubPage } from './pages/ClubPage'
import { GamesPage } from './pages/GamesPage'
import { SquadPage } from './pages/SquadPage'
import { TransfersPage } from './pages/TransfersPage'
import { useGame } from './state/gameState'
import './App.css'

function App() {
  const { game, setManagerName, setSaveName, clearNotice, notice, managerTeam } = useGame()

  return (
    <main className="game-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Temporada 1996/97 - Modo Carrera</p>
          <h1>PCFutbol Legacy</h1>
        </div>
        {game && managerTeam ? (
          <div className="header-actions">
            <label className="manager-name">
              Guardado
              <input
                value={game.saveName}
                onChange={(event) => setSaveName(event.target.value)}
                maxLength={28}
              />
            </label>
            <label className="manager-name">
              Manager
              <input
                value={game.managerName}
                onChange={(event) => setManagerName(event.target.value)}
                maxLength={20}
              />
            </label>
            <div className="manager-club">
              Club
              <strong>{managerTeam.name}</strong>
            </div>
          </div>
        ) : (
          <div className="manager-club">
            Estado
            <strong>Selecciona o crea una partida</strong>
          </div>
        )}
      </header>

      <nav className="main-nav" aria-label="Principal">
        <NavLink to="/games">Partidas</NavLink>
        {game && <NavLink to="/dashboard">Dashboard</NavLink>}
        {game && <NavLink to="/squad">Plantilla</NavLink>}
        {game && <NavLink to="/club">Club</NavLink>}
        {game && <NavLink to="/transfers">Mercado</NavLink>}
      </nav>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button className="secondary" onClick={clearNotice}>
            Cerrar
          </button>
        </div>
      )}

      <Routes>
        <Route path="/" element={<Navigate to={game ? '/dashboard' : '/games'} replace />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/dashboard" element={game ? <DashboardPage /> : <Navigate to="/games" replace />} />
        <Route path="/squad" element={game ? <SquadPage /> : <Navigate to="/games" replace />} />
        <Route path="/club" element={game ? <ClubPage /> : <Navigate to="/games" replace />} />
        <Route path="/transfers" element={game ? <TransfersPage /> : <Navigate to="/games" replace />} />
      </Routes>
    </main>
  )
}

export default App
