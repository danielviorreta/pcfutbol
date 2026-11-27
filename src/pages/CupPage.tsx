import { useGame } from '../state/gameState'
import { ClubBadge } from '../components/ClubBadge'
import { findManagerCupTie } from '../engine/cup'
import type { CupTie, Team } from '../types/game'

function TieRow({ tie, teams, managerTeamId }: { tie: CupTie; teams: Map<string, Team>; managerTeamId: string }) {
  const home = teams.get(tie.homeTeamId)
  const away = teams.get(tie.awayTeamId)
  const played = Boolean(tie.winnerId)
  const isManager = tie.homeTeamId === managerTeamId || tie.awayTeamId === managerTeamId
  const side = (team: Team | undefined, id: string) => (
    <span className={`team-with-crest${tie.winnerId === id ? ' cup-winner' : ''}`}>
      <ClubBadge teamName={team?.name ?? id} crestUrl={team?.crestUrl} />
      <span>{team?.name ?? id}</span>
    </span>
  )

  return (
    <li className={`cup-tie${isManager ? ' cup-tie-manager' : ''}`}>
      {side(home, tie.homeTeamId)}
      <strong className="cup-score">
        {played ? `${tie.homeGoals}-${tie.awayGoals}` : 'vs'}
        {tie.penalties && <small> ({tie.penalties.home}-{tie.penalties.away} pen.)</small>}
      </strong>
      {side(away, tie.awayTeamId)}
    </li>
  )
}

export function CupPage() {
  const { game, managerTeam } = useGame()
  const cup = game?.leagueState.cup

  if (!game || !managerTeam) {
    return null
  }

  if (!cup) {
    return (
      <section className="page-grid">
        <article className="panel full-span">
          <h2>Copa del Rey</h2>
          <p>La Copa empezara la proxima temporada.</p>
        </article>
      </section>
    )
  }

  const teams = new Map(game.leagueState.teams.map((team) => [team.id, team]))
  const next = findManagerCupTie(cup, managerTeam.id)
  const stillIn = Boolean(next) || cup.winnerId === managerTeam.id || (cup.rounds.length === 1 && cup.byeTeamIds.includes(managerTeam.id))
  const winner = cup.winnerId ? teams.get(cup.winnerId) : undefined
  const rounds = [...cup.rounds].reverse()

  let status: string
  if (winner) {
    status = winner.id === managerTeam.id ? '¡Eres campeon de la Copa del Rey!' : `Campeon: ${winner.name}.`
  } else if (next) {
    const rival = next.tie.homeTeamId === managerTeam.id ? next.tie.awayTeamId : next.tie.homeTeamId
    status = `${next.round.name}: contra ${teams.get(rival)?.name ?? rival} tras la jornada ${next.round.afterLeagueRound}.`
  } else if (stillIn) {
    status = 'Exento de la primera ronda: entras en treintaidosavos.'
  } else {
    status = 'Tu equipo esta eliminado.'
  }

  return (
    <section className="page-grid">
      <article className="panel full-span">
        <h2>Copa del Rey</h2>
        <p className="cup-status">{status}</p>
        {rounds.map((round) => (
          <section key={round.name} className="cup-round">
            <h3>
              {round.name}
              <span className="competition-badge inline-badge">tras la jornada {round.afterLeagueRound}</span>
            </h3>
            <ul className="cup-ties">
              {[...round.ties]
                .sort((a, b) => Number(b.homeTeamId === managerTeam.id || b.awayTeamId === managerTeam.id) - Number(a.homeTeamId === managerTeam.id || a.awayTeamId === managerTeam.id))
                .map((tie) => (
                  <TieRow key={`${tie.homeTeamId}-${tie.awayTeamId}`} tie={tie} teams={teams} managerTeamId={managerTeam.id} />
                ))}
            </ul>
          </section>
        ))}
      </article>
    </section>
  )
}
