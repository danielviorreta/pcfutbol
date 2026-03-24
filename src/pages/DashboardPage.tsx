import { LeagueTable } from '../components/LeagueTable'
import { NewsList } from '../components/NewsList'
import { ResultsList } from '../components/ResultsList'
import { useGame } from '../state/gameState'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function teamName(teamId: string, teams: { id: string; name: string }[]): string {
  return teams.find((team) => team.id === teamId)?.name ?? teamId
}

export function DashboardPage() {
  const {
    game,
    managerTeam,
    table,
    playRound,
    resetGame,
    saveCurrentGame,
  } = useGame()

  if (!game || !managerTeam) {
    return null
  }

  const { leagueState, managerName } = game
  const payroll = Math.round(
    managerTeam.players.reduce((sum, player) => sum + player.wage, 0) / 52,
  )
  const isSeasonOver = leagueState.currentRound > leagueState.totalRounds
  const champion = isSeasonOver ? table[0] : null

  const nextFixtures = leagueState.fixtures
    .filter((fixture) => fixture.round === leagueState.currentRound)
    .slice(0, 4)

  return (
    <section className="page-grid">
      <article className="panel">
        <h2>Despacho</h2>
        <p>
          Bienvenido, <strong>{managerName || 'Mister'}</strong>. Diriges a{' '}
          <strong>{managerTeam.name}</strong>.
        </p>
        <p>
          Jornada {Math.min(leagueState.currentRound, leagueState.totalRounds)} de{' '}
          {leagueState.totalRounds}.
        </p>
        <p>Presupuesto: {formatCurrency(managerTeam.budget)}</p>
        <p>Nomina semanal: {formatCurrency(payroll)}</p>
        <p>
          Sponsor: {managerTeam.sponsor.name} (+{formatCurrency(managerTeam.sponsor.weeklyIncome)}/sem)
        </p>

        <div className="actions">
          <button onClick={playRound} disabled={isSeasonOver}>
            Jugar Jornada
          </button>
          <button className="secondary" onClick={saveCurrentGame}>
            Guardar Partida
          </button>
          <button className="secondary" onClick={resetGame}>
            Reiniciar
          </button>
        </div>

        {champion && (
          <p className="champion-banner">
            Campeon: {champion.name} con {champion.points} puntos.
          </p>
        )}
      </article>

      <article className="panel">
        <h2>Agenda</h2>
        {isSeasonOver ? (
          <p>Calendario completado.</p>
        ) : (
          <ul className="fixture-list">
            {nextFixtures.map((fixture) => (
              <li key={fixture.id}>
                <span>{teamName(fixture.homeTeamId, leagueState.teams)}</span>
                <span>vs</span>
                <span>{teamName(fixture.awayTeamId, leagueState.teams)}</span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="panel table-panel full-span">
        <h2>Clasificacion</h2>
        <LeagueTable teams={table} />
      </article>

      <article className="panel">
        <h2>Ultimos Resultados</h2>
        <ResultsList results={leagueState.lastResults} teams={leagueState.teams} />
      </article>

      <article className="panel">
        <h2>Noticias</h2>
        <NewsList news={leagueState.news} />
      </article>
    </section>
  )
}
