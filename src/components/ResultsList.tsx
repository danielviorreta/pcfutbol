import type { MatchResult, Team } from '../types/game'

function teamName(teamId: string, teams: Team[]): string {
  return teams.find((team) => team.id === teamId)?.name ?? teamId
}

export function ResultsList({ results, teams }: { results: MatchResult[]; teams: Team[] }) {
  if (results.length === 0) {
    return <p>Aun no se han disputado partidos.</p>
  }

  return (
    <ul className="results-list">
      {results.map((result) => (
        <li key={result.fixtureId}>
          <span>{teamName(result.homeTeamId, teams)}</span>
          <strong>
            {result.homeGoals} - {result.awayGoals}
          </strong>
          <span>{teamName(result.awayTeamId, teams)}</span>
        </li>
      ))}
    </ul>
  )
}
