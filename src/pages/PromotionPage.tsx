import { useGame } from '../state/gameState'

type TieLeg = {
  homeTeam: string
  awayTeam: string
  homeGoals: number
  awayGoals: number
}

type TieView = {
  label: string
  teamA: string
  teamB: string
  winner: string
  legs: TieLeg[]
}

function renderTeamList(items: string[]) {
  return items.length === 0 ? <p>Sin datos.</p> : (
    <ul className="promotion-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function tieAggregate(tie: TieView): { teamA: number; teamB: number } {
  let teamAGoals = 0
  let teamBGoals = 0

  tie.legs.forEach((leg) => {
    if (leg.homeTeam === tie.teamA) {
      teamAGoals += leg.homeGoals
      teamBGoals += leg.awayGoals
      return
    }

    if (leg.homeTeam === tie.teamB) {
      teamBGoals += leg.homeGoals
      teamAGoals += leg.awayGoals
      return
    }

    // Fallback in case of name mismatch in legacy saves.
    teamAGoals += leg.homeGoals
    teamBGoals += leg.awayGoals
  })

  return { teamA: teamAGoals, teamB: teamBGoals }
}

function renderTieList(title: string, ties: TieView[]) {
  if (ties.length === 0) {
    return null
  }

  return (
    <>
      <p className="promotion-label">{title}</p>
      <div className="promotion-ties">
        {ties.map((tie) => {
          const aggregate = tieAggregate(tie)

          return (
            <article className="promotion-tie" key={`${title}-${tie.label}-${tie.teamA}-${tie.teamB}`}>
              <p className="promotion-tie-title">
                <strong>{tie.label}</strong>
              </p>
              <p className="promotion-tie-pairing">{tie.teamA} vs {tie.teamB}</p>
              <p className="promotion-aggregate">
                Global: <strong>{tie.teamA} {aggregate.teamA}-{aggregate.teamB} {tie.teamB}</strong>
              </p>
              <ul className="promotion-list compact">
                {tie.legs.map((leg, index) => (
                  <li key={`${tie.label}-${index}`}>
                    {leg.homeTeam} {leg.homeGoals}-{leg.awayGoals} {leg.awayTeam}
                  </li>
                ))}
              </ul>
              <p className="promotion-winner">Clasifica: {tie.winner}</p>
            </article>
          )
        })}
      </div>
    </>
  )
}

export function PromotionPage() {
  const { game } = useGame()

  if (!game) {
    return null
  }

  const { promotionSummary, promotionBracket } = game.leagueState

  return (
    <section className="page-grid">
      <article className="panel full-span">
        <h2>Resumen de Ascensos</h2>
        {!promotionBracket && promotionSummary.length === 0 ? (
          <p>Aun no hay resumen de ascensos. Se mostrara al terminar la temporada.</p>
        ) : (
          <div className="promotion-grid">
            {promotionBracket && (
              <>
                <section className="promotion-card">
                  <h3>Segunda a Primera <span className="competition-badge inline-badge">Playoff</span></h3>
                  <p className="promotion-label">Ascenso directo</p>
                  {renderTeamList(promotionBracket.segundaToPrimera.directPromotions)}
                  <p className="promotion-label">Playoff</p>
                  {renderTeamList(promotionBracket.segundaToPrimera.playoffTeams)}
                  {renderTieList('Semifinales', promotionBracket.segundaToPrimera.semiFinals)}
                  {renderTieList('Final', promotionBracket.segundaToPrimera.final ? [promotionBracket.segundaToPrimera.final] : [])}
                  <p className="promotion-label">Ganador</p>
                  {renderTeamList(promotionBracket.segundaToPrimera.playoffWinner ? [promotionBracket.segundaToPrimera.playoffWinner] : [])}
                  <p className="promotion-label">Descenso desde Primera</p>
                  {renderTeamList(promotionBracket.segundaToPrimera.relegatedFromPrimera)}
                </section>

                <section className="promotion-card">
                  <h3>1a RFEF a Segunda <span className="competition-badge inline-badge">Playoff</span></h3>
                  <p className="promotion-label">Ascenso directo</p>
                  {renderTeamList(promotionBracket.federacionToSegunda.directPromotions)}
                  <p className="promotion-label">Playoff</p>
                  {renderTeamList(promotionBracket.federacionToSegunda.playoffTeams)}
                  {renderTieList('Cuartos', promotionBracket.federacionToSegunda.quarterFinals)}
                  {renderTieList('Semifinales', promotionBracket.federacionToSegunda.semiFinals)}
                  {renderTieList('Final', promotionBracket.federacionToSegunda.final ? [promotionBracket.federacionToSegunda.final] : [])}
                  <p className="promotion-label">Ganadores</p>
                  {renderTeamList(promotionBracket.federacionToSegunda.playoffWinners)}
                  <p className="promotion-label">Descenso desde Segunda</p>
                  {renderTeamList(promotionBracket.federacionToSegunda.relegatedFromSegunda)}
                </section>
              </>
            )}

            <section className="promotion-card full-span">
              <h3>Resumen textual</h3>
              <ul className="fixture-list">
                {promotionSummary.map((item, index) => (
                  <li key={`${index}-${item}`}>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </article>
    </section>
  )
}