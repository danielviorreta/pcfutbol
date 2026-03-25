import type { Team } from '../types/game'
import { ClubBadge } from './ClubBadge'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

interface LeagueTableProps {
  teams: Team[]
  managerTeamId?: string
}

function getZoneClass(team: Team, index: number, totalTeams: number): string | null {
  if (team.division === 'Primera') {
    if (index >= totalTeams - 3) {
      return 'table-row-zone-relegation'
    }

    return null
  }

  if (team.division === 'Segunda') {
    if (index < 2) {
      return 'table-row-zone-promotion'
    }

    if (index < 6) {
      return 'table-row-zone-playoff'
    }

    if (index >= totalTeams - 4) {
      return 'table-row-zone-relegation'
    }

    return null
  }

  if (team.division === 'Primera Federacion') {
    if (index < 1) {
      return 'table-row-zone-promotion'
    }

    if (index < 5) {
      return 'table-row-zone-playoff'
    }

    return null
  }

  return null
}

export function LeagueTable({ teams, managerTeamId }: LeagueTableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Equipo</th>
          <th>Pts</th>
          <th>PJ</th>
          <th>DG</th>
          <th>Presupuesto</th>
        </tr>
      </thead>
      <tbody>
        {teams.map((team, index) => {
          const goalDiff = team.goalsFor - team.goalsAgainst
          const isManagerTeam = team.id === managerTeamId
          const zoneClass = getZoneClass(team, index, teams.length)
          const rowClassName = [
            zoneClass,
            isManagerTeam ? 'table-row-manager' : null,
          ]
            .filter(Boolean)
            .join(' ') || undefined

          return (
            <tr key={team.id} className={rowClassName}>
              <td>{index + 1}</td>
              <td>
                <div className="team-with-crest">
                  <ClubBadge teamName={team.name} crestUrl={team.crestUrl} />
                  <span>{team.name}</span>
                  <span className="table-badge">
                    {team.division === 'Primera Federacion' ? team.group : team.division}
                  </span>
                </div>
              </td>
              <td>{team.points}</td>
              <td>{team.played}</td>
              <td>{goalDiff >= 0 ? `+${goalDiff}` : goalDiff}</td>
              <td>{formatCurrency(team.budget)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
