import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { ClubPage } from './pages/ClubPage'
import { GamesPage } from './pages/GamesPage'
import { MatchDayPage } from './pages/MatchDayPage'
import { PlayerManagementPage } from './pages/PlayerManagementPage'
import { PromotionPage } from './pages/PromotionPage'
import { SquadPage } from './pages/SquadPage'
import { TransferOfferPage } from './pages/TransferOfferPage'
import { TransfersPage } from './pages/TransfersPage'
import { useGame } from './state/gameState'
import { ClubBadge } from './components/ClubBadge'
import './App.css'

function formatSeasonLabel(startYear: number): string {
  const nextShortYear = String((startYear + 1) % 100).padStart(2, '0')
  return `${startYear}/${nextShortYear}`
}

function App() {
  const { game, setManagerName, setSaveName, clearNotice, notice, managerTeam } = useGame()

  return (
    <main className="game-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Temporada {formatSeasonLabel(game?.seasonStartYear ?? 2025)} - Modo Carrera</p>
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
              <strong className="team-with-crest">
                <ClubBadge teamName={managerTeam.name} crestUrl={managerTeam.crestUrl} />
                <span>{managerTeam.name}</span>
              </strong>
              <span className="competition-badge">
                {managerTeam.division}{managerTeam.group ? ` - ${managerTeam.group}` : ''}
              </span>
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
        {game && <NavLink to="/promotions">Ascensos</NavLink>}
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
        <Route path="/matchday" element={game ? <MatchDayPage /> : <Navigate to="/games" replace />} />
        <Route path="/squad" element={game ? <SquadPage /> : <Navigate to="/games" replace />} />
        <Route path="/club" element={game ? <ClubPage /> : <Navigate to="/games" replace />} />
        <Route path="/club/player/:playerId" element={game ? <PlayerManagementPage /> : <Navigate to="/games" replace />} />
        <Route path="/promotions" element={game ? <PromotionPage /> : <Navigate to="/games" replace />} />
        <Route path="/transfers" element={game ? <TransfersPage /> : <Navigate to="/games" replace />} />
        <Route path="/transfers/offer/:playerId" element={game ? <TransferOfferPage /> : <Navigate to="/games" replace />} />
      </Routes>
    </main>
  )
}

export default App
