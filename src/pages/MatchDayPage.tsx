import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ClubBadge } from '../components/ClubBadge'
import { getFormationSlots } from '../engine/squad'
import { useGame } from '../state/gameState'
import type { Team } from '../types/game'

function buildLineupView(team: Team, lineup: string[]) {
  const slots = getFormationSlots(team)

  return slots.map((role, slotIndex) => ({
    slotIndex,
    role,
    player: team.players.find((candidate) => candidate.id === lineup[slotIndex]) ?? null,
  }))
}

function formatScore(homeGoals?: number, awayGoals?: number): string {
  if (homeGoals === undefined || awayGoals === undefined) {
    return '- : -'
  }

  return `${homeGoals} - ${awayGoals}`
}

function isManagerTeam(managerTeam: Team, teamId: string): boolean {
  return managerTeam.id === teamId
}

export function MatchDayPage() {
  const {
    game,
    managerTeam,
    matchPresentation,
    confirmMatchPresentation,
    clearMatchPresentation,
  } = useGame()
  const navigate = useNavigate()
  const [isSimulating, setIsSimulating] = useState(false)

  useEffect(() => {
    if (!isSimulating) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      confirmMatchPresentation()
      setIsSimulating(false)
    }, 900)

    return () => window.clearTimeout(timeoutId)
  }, [confirmMatchPresentation, isSimulating])

  if (!game || !managerTeam || !matchPresentation) {
    return <Navigate to="/dashboard" replace />
  }

  const homeTeam = game.leagueState.teams.find((team) => team.id === matchPresentation.homeTeamId)
  const awayTeam = game.leagueState.teams.find((team) => team.id === matchPresentation.awayTeamId)

  if (!homeTeam || !awayTeam) {
    return <Navigate to="/dashboard" replace />
  }

  const homeAssignments = buildLineupView(homeTeam, matchPresentation.homeLineup)
  const awayAssignments = buildLineupView(awayTeam, matchPresentation.awayLineup)
  const isResult = matchPresentation.phase === 'result'
  const summaryNews = isResult ? game.leagueState.news.slice(0, 5) : []
  const stats = matchPresentation.stats
  const commentary = matchPresentation.commentary ?? []
  const goals = matchPresentation.goals ?? []
  const incidents = matchPresentation.incidents ?? []
  const substitutionsCount = matchPresentation.substitutions?.length ?? 0
  const tacticalChangesCount = matchPresentation.tacticalChanges?.length ?? 0
  const starForward = managerTeam.players
    .filter((player) => player.position === 'FWD')
    .sort((a, b) => b.overall - a.overall)[0]
  const timelineEvents = commentary
    .filter((event) => event.kind && event.kind !== 'general')
    .sort((a, b) => a.minute - b.minute)

  return (
    <section className="page-grid games-grid">
      <article className={`panel full-span matchday-shell${isSimulating ? ' is-simulating' : ''}`}>
        <p className="eyebrow">Jornada {matchPresentation.round}</p>

        {isSimulating && (
          <div className="matchday-simulating-banner" role="status">
            Simulando partido...
          </div>
        )}

        <div className="matchday-scoreboard">
          <div className="matchday-team-card">
            <div className="team-with-crest matchday-team-name">
              <ClubBadge teamName={homeTeam.name} crestUrl={homeTeam.crestUrl} />
              <strong>{homeTeam.name}</strong>
            </div>
            <span className="competition-badge inline-badge">Local</span>
          </div>

          <div className="matchday-center-block">
            <h2>{isResult ? 'Resultado Final' : 'Previa del Partido'}</h2>
            <p className="matchday-score">{formatScore(matchPresentation.result?.homeGoals, matchPresentation.result?.awayGoals)}</p>
            <p className="matchday-subtitle">{homeTeam.stadium.name} · {homeTeam.division}{homeTeam.group ? ` - ${homeTeam.group}` : ''}</p>
          </div>

          <div className="matchday-team-card align-right">
            <div className="team-with-crest matchday-team-name">
              <ClubBadge teamName={awayTeam.name} crestUrl={awayTeam.crestUrl} />
              <strong>{awayTeam.name}</strong>
            </div>
            <span className="competition-badge inline-badge">Visitante</span>
          </div>
        </div>

        <div className="matchday-summary-grid">
          <section className="matchday-summary-card">
            <h3>Resumen</h3>
            <p>Competicion: <strong>{managerTeam.division}{managerTeam.group ? ` - ${managerTeam.group}` : ''}</strong></p>
            <p>Tu club: <strong>{managerTeam.name}</strong></p>
            <p>Rival: <strong>{homeTeam.id === managerTeam.id ? awayTeam.name : homeTeam.name}</strong></p>
            {isResult && matchPresentation.result && (
              <p>
                Marcador: <strong>{homeTeam.name} {matchPresentation.result.homeGoals}-{matchPresentation.result.awayGoals} {awayTeam.name}</strong>
              </p>
            )}
          </section>

          {isResult && (
            <section className="matchday-summary-card">
              <h3>Resumen de Jornada</h3>
              <ul className="news-list">
                {summaryNews.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {isResult && stats && (
          <div className="matchday-stats-grid">
            <section className="matchday-summary-card">
              <h3>Posesion</h3>
              <div className="matchday-stat-line">
                <strong>{stats.home.possession}%</strong>
                <span>{homeTeam.name}</span>
              </div>
              <div className="matchday-stat-line is-away">
                <strong>{stats.away.possession}%</strong>
                <span>{awayTeam.name}</span>
              </div>
            </section>

            <section className="matchday-summary-card">
              <h3>Tiros</h3>
              <div className="matchday-stat-line">
                <strong>{stats.home.shots}</strong>
                <span>{homeTeam.name}</span>
              </div>
              <div className="matchday-stat-line is-away">
                <strong>{stats.away.shots}</strong>
                <span>{awayTeam.name}</span>
              </div>
            </section>

            <section className="matchday-summary-card">
              <h3>Tiros a Puerta</h3>
              <div className="matchday-stat-line">
                <strong>{stats.home.shotsOnTarget}</strong>
                <span>{homeTeam.name}</span>
              </div>
              <div className="matchday-stat-line is-away">
                <strong>{stats.away.shotsOnTarget}</strong>
                <span>{awayTeam.name}</span>
              </div>
            </section>

            <section className="matchday-summary-card">
              <h3>Ocasiones Claras</h3>
              <div className="matchday-stat-line">
                <strong>{stats.home.bigChances}</strong>
                <span>{homeTeam.name}</span>
              </div>
              <div className="matchday-stat-line is-away">
                <strong>{stats.away.bigChances}</strong>
                <span>{awayTeam.name}</span>
              </div>
              <p className="matchday-attendance">Asistencia: <strong>{stats.attendance.toLocaleString('es-ES')}</strong></p>
            </section>
          </div>
        )}

        {isResult && (goals.length > 0 || incidents.length > 0) && (
          <div className="matchday-summary-grid">
            <section className="matchday-summary-card">
              <h3>Goleadores</h3>
              {goals.length === 0 ? (
                <p>Sin goles en el partido.</p>
              ) : (
                <ul className="matchday-commentary-list compact-list">
                  {goals.map((goal) => (
                    <li
                      key={`${goal.teamId}-${goal.minute}-${goal.scorer}`}
                      className={starForward && goal.scorer === starForward.name && isManagerTeam(managerTeam, goal.teamId) ? 'is-star-goal' : undefined}
                    >
                      <span>{goal.minute}'</span>
                      <strong>
                        {goal.scorer}
                        {goal.assist ? `, pase de ${goal.assist}` : ''}
                        {' · '}
                        {goal.teamId === homeTeam.id ? homeTeam.name : awayTeam.name}
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="matchday-summary-card">
              <h3>Incidencias</h3>
              {incidents.length === 0 ? (
                <p>Partido sin incidencias destacadas.</p>
              ) : (
                <ul className="matchday-commentary-list compact-list">
                  {incidents.map((incident) => (
                    <li
                      key={`${incident.teamId}-${incident.minute}-${incident.player}-${incident.type}`}
                      className={incident.type === 'injury' || incident.type === 'red' ? 'is-danger' : undefined}
                    >
                      <span>{incident.minute}'</span>
                      <strong>
                        {incident.player}
                        {' · '}
                        {incident.type === 'yellow'
                          ? 'Amarilla'
                          : incident.type === 'red'
                            ? 'Roja'
                            : incident.detail ?? 'Lesion'}
                        {' · '}
                        {incident.teamId === homeTeam.id ? homeTeam.name : awayTeam.name}
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {isResult && timelineEvents.length > 0 && (
          <section className="matchday-summary-card">
            <h3>Cronologia del Marcador</h3>
            <p>
              Cambios realizados: <strong>{substitutionsCount}</strong> · Ajustes tacticos: <strong>{tacticalChangesCount}</strong>
            </p>
            <ul className="matchday-commentary-list compact-list timeline-list">
              {timelineEvents.map((event) => (
                <li key={`${event.minute}-${event.kind}-${event.text}`} className={event.kind === 'incident' ? 'is-danger' : event.kind === 'goal' ? 'is-goal' : undefined}>
                  <span>{event.minute}'</span>
                  <strong>{event.text}</strong>
                  {event.scoreHome !== undefined && event.scoreAway !== undefined && (
                    <em>{homeTeam.name} {event.scoreHome}-{event.scoreAway} {awayTeam.name}</em>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="matchday-lineups">
          <section className="matchday-lineup-card">
            <h3>{homeTeam.name}</h3>
            <ul className="matchday-lineup-list">
              {homeAssignments.map((assignment) => (
                <li key={`${homeTeam.id}-${assignment.slotIndex}`}>
                  <span>{assignment.role}</span>
                  <strong>{assignment.player?.name ?? '-'}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="matchday-lineup-card">
            <h3>{awayTeam.name}</h3>
            <ul className="matchday-lineup-list">
              {awayAssignments.map((assignment) => (
                <li key={`${awayTeam.id}-${assignment.slotIndex}`}>
                  <span>{assignment.role}</span>
                  <strong>{assignment.player?.name ?? '-'}</strong>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {isResult && commentary.length > 0 && (
          <section className="matchday-summary-card">
            <h3>Relato del Partido</h3>
            <ul className="matchday-commentary-list">
              {commentary.map((event) => (
                <li
                  key={`${event.minute}-${event.text}`}
                  className={event.kind === 'incident' ? 'is-danger' : event.kind === 'goal' ? 'is-goal' : undefined}
                >
                  <span>{event.minute}'</span>
                  <strong>{event.text}</strong>
                  {event.scoreHome !== undefined && event.scoreAway !== undefined && (
                    <em>{homeTeam.name} {event.scoreHome}-{event.scoreAway} {awayTeam.name}</em>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="actions">
          {isResult ? (
            <button
              onClick={() => {
                clearMatchPresentation()
                navigate('/dashboard')
              }}
            >
              Volver al Dashboard
            </button>
          ) : (
            <>
              <button
                className="secondary"
                onClick={() => {
                  clearMatchPresentation()
                  navigate('/dashboard')
                }}
              >
                Cancelar
              </button>
              <button onClick={() => setIsSimulating(true)} disabled={isSimulating}>Comenzar Partido</button>
            </>
          )}
        </div>
      </article>
    </section>
  )
}