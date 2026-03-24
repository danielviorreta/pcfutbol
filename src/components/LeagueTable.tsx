import type { Team } from '../types/game'
import { ClubBadge } from './ClubBadge'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function LeagueTable({ teams }: { teams: Team[] }) {
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
          return (
            <tr key={team.id}>
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
