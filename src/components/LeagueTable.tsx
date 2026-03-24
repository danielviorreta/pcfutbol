import type { Team } from '../types/game'

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
              <td>{team.name}</td>
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
