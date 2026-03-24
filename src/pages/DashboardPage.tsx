import { useMemo, useState } from 'react'
import { LeagueTable } from '../components/LeagueTable'
import { NewsList } from '../components/NewsList'
import { ResultsList } from '../components/ResultsList'
import { sortLeagueTable } from '../engine/simulation'
import { useGame } from '../state/gameState'

type DashboardCompetition =
  | 'Primera'
  | 'Segunda'
  | 'Primera Federacion - Grupo 1'
  | 'Primera Federacion - Grupo 2'

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
    .filter((fixture) => {
      if (fixture.round !== leagueState.currentRound) {
        return false
      }

      const homeTeam = leagueState.teams.find((team) => team.id === fixture.homeTeamId)
      return homeTeam?.division === managerTeam.division
        && (managerTeam.division !== 'Primera Federacion' || homeTeam.group === managerTeam.group)
    })
    .slice(0, 4)

  const divisionTables: Record<DashboardCompetition, typeof table> = useMemo(() => ({
    Primera: sortLeagueTable(leagueState.teams.filter((team) => team.division === 'Primera')),
    Segunda: sortLeagueTable(leagueState.teams.filter((team) => team.division === 'Segunda')),
    'Primera Federacion - Grupo 1': sortLeagueTable(leagueState.teams.filter((team) => team.division === 'Primera Federacion' && team.group === 'Grupo 1')),
    'Primera Federacion - Grupo 2': sortLeagueTable(leagueState.teams.filter((team) => team.division === 'Primera Federacion' && team.group === 'Grupo 2')),
  }), [leagueState.teams])

  const initialDivision: DashboardCompetition = managerTeam.division === 'Primera Federacion'
    ? `Primera Federacion - ${managerTeam.group ?? 'Grupo 1'}`
    : managerTeam.division
  const [activeDivision, setActiveDivision] = useState<DashboardCompetition>(initialDivision as DashboardCompetition)
  const selectedDivision: DashboardCompetition = divisionTables[activeDivision].length > 0 ? activeDivision : initialDivision

  return (
    <section className="page-grid">
      <article className="panel">
        <h2>Despacho</h2>
        <p>
          Bienvenido, <strong>{managerName || 'Mister'}</strong>. Diriges a{' '}
          <strong>{managerTeam.name}</strong>.
        </p>
        <p>Division: {managerTeam.division}{managerTeam.group ? ` - ${managerTeam.group}` : ''}</p>
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
        <div className="actions" style={{ marginBottom: '0.75rem' }}>
          <button
            className="secondary"
            onClick={() => setActiveDivision('Primera')}
            disabled={selectedDivision === 'Primera'}
          >
            Primera
          </button>
          <button
            className="secondary"
            onClick={() => setActiveDivision('Segunda')}
            disabled={selectedDivision === 'Segunda'}
          >
            Segunda
          </button>
          <button
            className="secondary"
            onClick={() => setActiveDivision('Primera Federacion - Grupo 1')}
            disabled={selectedDivision === 'Primera Federacion - Grupo 1'}
          >
            1a RFEF G1
          </button>
          <button
            className="secondary"
            onClick={() => setActiveDivision('Primera Federacion - Grupo 2')}
            disabled={selectedDivision === 'Primera Federacion - Grupo 2'}
          >
            1a RFEF G2
          </button>
        </div>
        <LeagueTable teams={divisionTables[selectedDivision]} managerTeamId={managerTeam.id} />
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
