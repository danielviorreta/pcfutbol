import { useMemo, useRef, useEffect, useState } from 'react'
import { useGame } from '../state/gameState'
import { sortLeagueTable } from '../engine/simulation'
import type { CompetitionGroup, Division, Fixture, Team } from '../types/game'

type CalendarCompetition =
  | 'Primera'
  | 'Segunda'
  | 'Primera Federacion - Grupo 1'
  | 'Primera Federacion - Grupo 2'

const COMPETITION_LABELS: Record<CalendarCompetition, string> = {
  'Primera': 'Primera División',
  'Segunda': 'Segunda División',
  'Primera Federacion - Grupo 1': '1ª RFEF · G1',
  'Primera Federacion - Grupo 2': '1ª RFEF · G2',
}

function teamName(teamId: string, teams: Team[]): string {
  return teams.find((t) => t.id === teamId)?.name ?? teamId
}

function getCompetitionKey(division: Division, group?: CompetitionGroup): CalendarCompetition {
  if (division === 'Primera Federacion') {
    return `Primera Federacion - ${group ?? 'Grupo 1'}` as CalendarCompetition
  }
  return division as CalendarCompetition
}

function belongsToCompetition(fixture: Fixture, teams: Team[], competition: CalendarCompetition): boolean {
  const homeTeam = teams.find((t) => t.id === fixture.homeTeamId)
  return homeTeam ? getCompetitionKey(homeTeam.division, homeTeam.group) === competition : false
}

function getZoneClass(index: number, total: number, competition: CalendarCompetition): string {
  if (competition === 'Primera') {
    return index >= total - 3 ? 'zone-rel' : ''
  }
  if (competition === 'Segunda') {
    if (index < 2) return 'zone-up'
    if (index < 6) return 'zone-play'
    if (index >= total - 4) return 'zone-rel'
  }
  if (competition.startsWith('Primera Federacion')) {
    if (index < 1) return 'zone-up'
    if (index < 5) return 'zone-play'
  }
  return ''
}

export function CalendarPage() {
  const { game, managerTeam } = useGame()
  const roundListRef = useRef<HTMLDivElement>(null)

  const competitions = useMemo<CalendarCompetition[]>(() => (
    ['Primera', 'Segunda', 'Primera Federacion - Grupo 1', 'Primera Federacion - Grupo 2']
  ), [])

  const initialCompetition = managerTeam
    ? getCompetitionKey(managerTeam.division, managerTeam.group)
    : 'Primera'

  const [selectedCompetition, setSelectedCompetition] = useState<CalendarCompetition>(initialCompetition)
  const [selectedRound, setSelectedRound] = useState<number | null>(null)

  if (!game || !managerTeam) return null

  const allTeams = game.leagueState.teams
  const allFixtures = game.leagueState.fixtures

  const availableRounds = Array.from(
    new Set(
      allFixtures
        .filter((f) => belongsToCompetition(f, allTeams, selectedCompetition))
        .map((f) => f.round),
    ),
  ).sort((a, b) => a - b)

  const currentRound = Math.min(game.leagueState.currentRound, game.leagueState.totalRounds)
  const effectiveRound = selectedRound && availableRounds.includes(selectedRound)
    ? selectedRound
    : availableRounds.includes(currentRound)
      ? currentRound
      : availableRounds[0] ?? 1

  const roundFixtures = allFixtures
    .filter((f) => f.round === effectiveRound && belongsToCompetition(f, allTeams, selectedCompetition))

  const competitionTeams = useMemo(
    () => sortLeagueTable(allTeams.filter((t) => getCompetitionKey(t.division, t.group) === selectedCompetition)),
    [allTeams, selectedCompetition],
  )

  const playedCount = roundFixtures.filter((f) => f.played).length
  const pendingCount = roundFixtures.length - playedCount
  const firstRound = availableRounds[0] ?? 1
  const lastRound = availableRounds[availableRounds.length - 1] ?? effectiveRound

  // Scroll active round into view in sidebar
  useEffect(() => {
    const list = roundListRef.current
    if (!list) return
    const active = list.querySelector<HTMLButtonElement>('.cal-round-item.is-active')
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [effectiveRound])

  return (
    <section className="page-grid calendar-grid">

      {/* Competition tabs */}
      <div className="panel full-span cal-comp-bar">
        {competitions.map((comp) => (
          <button
            key={comp}
            className={`cal-comp-tab ${comp === selectedCompetition ? 'is-active' : 'secondary'}`}
            onClick={() => { setSelectedCompetition(comp); setSelectedRound(null) }}
          >
            {COMPETITION_LABELS[comp]}
          </button>
        ))}
      </div>

      {/* Round sidebar */}
      <aside className="panel cal-round-sidebar" ref={roundListRef}>
        {availableRounds.map((round) => (
          <button
            key={round}
            className={`cal-round-item ${round === effectiveRound ? 'is-active' : ''} ${round === currentRound ? 'is-current-round' : ''}`}
            onClick={() => setSelectedRound(round)}
          >
            <span className="cal-round-label">J{round}</span>
            {round === currentRound && <span className="cal-live-dot" aria-hidden="true" />}
          </button>
        ))}
      </aside>

      {/* Fixture table */}
      <article className="panel cal-fixtures-panel">
        <div className="cal-fixtures-header">
          <button
            className="cal-nav-btn"
            onClick={() => setSelectedRound(Math.max(firstRound, effectiveRound - 1))}
            disabled={effectiveRound <= firstRound}
            aria-label="Jornada anterior"
          >
            ‹
          </button>
          <div className="cal-fixtures-title">
            <h2>Jornada {effectiveRound}</h2>
            <span className="cal-round-meta">
              {playedCount > 0 && `${playedCount} jugados`}
              {playedCount > 0 && pendingCount > 0 && ' · '}
              {pendingCount > 0 && `${pendingCount} pendientes`}
            </span>
          </div>
          <button
            className="cal-nav-btn"
            onClick={() => setSelectedRound(Math.min(lastRound, effectiveRound + 1))}
            disabled={effectiveRound >= lastRound}
            aria-label="Jornada siguiente"
          >
            ›
          </button>
        </div>

        <table className="cal-table">
          <tbody>
            {roundFixtures.map((fixture) => {
              const isManager = fixture.homeTeamId === managerTeam.id || fixture.awayTeamId === managerTeam.id
              const rowClass = [
                'cal-row',
                fixture.played ? 'is-played' : 'is-pending',
                isManager ? 'is-manager' : '',
              ].filter(Boolean).join(' ')

              return (
                <tr key={fixture.id} className={rowClass}>
                  <td className="cal-home">{teamName(fixture.homeTeamId, allTeams)}</td>
                  <td className="cal-score-cell">
                    {fixture.played
                      ? <strong className="cal-score">{fixture.homeGoals}–{fixture.awayGoals}</strong>
                      : <span className="cal-vs">vs</span>}
                  </td>
                  <td className="cal-away">{teamName(fixture.awayTeamId, allTeams)}</td>
                  <td className="cal-tags">
                    <span className={`cal-state-badge ${fixture.played ? 'is-played' : 'is-pending'}`}>
                      {fixture.played ? 'FIN' : 'PEN'}
                    </span>
                    {isManager && <span className="cal-manager-tag">★ Tu partido</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </article>

      {/* Mini league table */}
      <aside className="panel cal-standings-panel">
        <h3 className="cal-standings-title">Clasificación</h3>
        <table className="cal-standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Equipo</th>
              <th>Pts</th>
              <th>PJ</th>
              <th>DG</th>
            </tr>
          </thead>
          <tbody>
            {competitionTeams.map((team, i) => {
              const gd = team.goalsFor - team.goalsAgainst
              const zone = getZoneClass(i, competitionTeams.length, selectedCompetition)
              const isManager = team.id === managerTeam.id
              return (
                <tr
                  key={team.id}
                  className={[zone, isManager ? 'is-manager-row' : ''].filter(Boolean).join(' ') || undefined}
                >
                  <td className="cal-standings-pos">{i + 1}</td>
                  <td className="cal-standings-name">{team.name}</td>
                  <td><strong>{team.points}</strong></td>
                  <td>{team.played}</td>
                  <td className={gd > 0 ? 'pos' : gd < 0 ? 'neg' : ''}>{gd >= 0 ? `+${gd}` : gd}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </aside>

    </section>
  )
}
