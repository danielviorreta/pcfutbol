import { useMemo, useState } from 'react'
import { useGame } from '../state/gameState'
import { competitionName } from '../engine/club/seasonHistory'
import type { SeasonLeader, Team } from '../types/game'

const COMPETITIONS = [
  { key: 'Primera', label: 'Primera' },
  { key: 'Segunda', label: 'Segunda' },
  { key: 'Primera Federacion - Grupo 1', label: '1a RFEF G1' },
  { key: 'Primera Federacion - Grupo 2', label: '1a RFEF G2' },
] as const

const LEADERS_SHOWN = 10

interface LeaderRow {
  id: string
  name: string
  teamName: string
  appearances: number
  value: number
}

function leaders(teams: Team[], stat: 'goals' | 'assists'): LeaderRow[] {
  return teams
    .flatMap((team) =>
      team.players.map((player) => ({
        id: player.id,
        name: player.name,
        teamName: team.name,
        appearances: player.seasonStats?.appearances ?? 0,
        value: player.seasonStats?.[stat] ?? 0,
      })),
    )
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.appearances - b.appearances)
    .slice(0, LEADERS_SHOWN)
}

function LeaderTable({ title, rows, valueLabel, managerTeamName }: { title: string; rows: LeaderRow[]; valueLabel: string; managerTeamName?: string }) {
  return (
    <div>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p>Aun no hay datos esta temporada.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>Club</th>
              <th>PJ</th>
              <th>{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className={row.teamName === managerTeamName ? 'table-row-manager' : undefined}>
                <td>{index + 1}</td>
                <td>{row.name}</td>
                <td>{row.teamName}</td>
                <td>{row.appearances}</td>
                <td><strong>{row.value}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function formatLeader(leader: SeasonLeader | null, unit: string): string {
  return leader ? `${leader.playerName} (${leader.teamName}) - ${leader.value} ${unit}` : '-'
}

export function HistoryPage() {
  const { game, managerTeam } = useGame()
  const [selected, setSelected] = useState<string | null>(null)
  const competition = selected ?? (managerTeam ? competitionName(managerTeam) : 'Primera')

  const competitionTeams = useMemo(
    () => (game?.leagueState.teams ?? []).filter((team) => competitionName(team) === competition),
    [game, competition],
  )
  const scorers = useMemo(() => leaders(competitionTeams, 'goals'), [competitionTeams])
  const assisters = useMemo(() => leaders(competitionTeams, 'assists'), [competitionTeams])
  const history = [...(game?.leagueState.seasonHistory ?? [])].reverse()

  return (
    <section className="page-grid">
      <article className="panel full-span">
        <h2>Estadisticas de la temporada</h2>
        <div className="actions" style={{ marginBottom: '0.75rem' }}>
          {COMPETITIONS.map((item) => (
            <button
              key={item.key}
              className="secondary"
              onClick={() => setSelected(item.key)}
              disabled={competition === item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="history-leaders">
          <LeaderTable title="Maximos goleadores" rows={scorers} valueLabel="Goles" managerTeamName={managerTeam?.name} />
          <LeaderTable title="Maximos asistentes" rows={assisters} valueLabel="Asist." managerTeamName={managerTeam?.name} />
        </div>
      </article>

      <article className="panel full-span">
        <h2>Historial de temporadas</h2>
        {history.length === 0 ? (
          <p>Aun no has completado ninguna temporada.</p>
        ) : (
          <div className="history-seasons">
            {history.map((season) => (
              <section className="history-season" key={season.label || season.managerTeamName}>
                <h3>
                  Temporada {season.label}
                  <span className="competition-badge inline-badge">
                    {season.managerTeamName}: {season.managerPosition}º en {season.managerCompetition}
                  </span>
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th>Competicion</th>
                      <th>Campeon</th>
                      <th>Pichichi</th>
                      <th>Maximo asistente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {season.competitions.map((item) => (
                      <tr key={item.competition}>
                        <td>{item.competition}</td>
                        <td><strong>{item.champion}</strong></td>
                        <td>{formatLeader(item.topScorer, 'goles')}</td>
                        <td>{formatLeader(item.topAssister, 'asist.')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {season.cupWinner && <p><strong>Copa del Rey:</strong> {season.cupWinner}</p>}
                {season.promoted.length > 0 && <p><strong>Ascensos:</strong> {season.promoted.join(', ')}</p>}
                {season.relegated.length > 0 && <p><strong>Descensos:</strong> {season.relegated.join(', ')}</p>}
              </section>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}
