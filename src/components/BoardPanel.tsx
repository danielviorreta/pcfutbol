import { createBoardState, leaguePosition } from '../engine/board'
import type { ManagerGameState, Team } from '../types/game'

interface BoardPanelProps {
  game: ManagerGameState
  managerTeam: Team
  onAcceptOffer: (teamId: string) => void
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 75) return 'Muy alta'
  if (confidence >= 55) return 'Buena'
  if (confidence >= 35) return 'En duda'
  return 'Critica'
}

function confidenceTone(confidence: number): string {
  if (confidence >= 55) return 'board-meter-good'
  if (confidence >= 35) return 'board-meter-warn'
  return 'board-meter-bad'
}

export function BoardPanel({ game, managerTeam, onAcceptOffer }: BoardPanelProps) {
  // Saves from before the board existed get expectations computed on the fly.
  const board = game.board ?? createBoardState(game.leagueState.teams, managerTeam)

  if (board.status === 'sacked') {
    return (
      <article className="panel full-span board-panel board-sacked">
        <h2>Destituido</h2>
        <p>{board.lastReview}</p>
        <p>Reputacion: <strong>{board.reputation}</strong>/100. Estos clubes te ofrecen el banquillo:</p>
        {board.jobOffers.length === 0 ? (
          <p>Ningun club te ofrece trabajo por ahora.</p>
        ) : (
          <ul className="job-offers">
            {board.jobOffers.map((offer) => (
              <li key={offer.teamId}>
                <div>
                  <strong>{offer.teamName}</strong>
                  <span className="competition-badge inline-badge">{offer.competition}</span>
                  <p>Objetivo: {offer.objective.description}</p>
                </div>
                <button onClick={() => onAcceptOffer(offer.teamId)}>Aceptar</button>
              </li>
            ))}
          </ul>
        )}
      </article>
    )
  }

  const position = leaguePosition(game.leagueState.teams, managerTeam)
  const onTarget = position <= board.objective.targetPosition

  return (
    <article className="panel board-panel">
      <h2>Directiva</h2>
      <p>Objetivo: <strong>{board.objective.description}</strong></p>
      <p>
        Posicion actual: <strong>{position}º</strong>{' '}
        <span className={onTarget ? 'board-on-target' : 'board-off-target'}>
          ({onTarget ? 'en objetivo' : `objetivo: ${board.objective.targetPosition}º o mejor`})
        </span>
      </p>
      <p>Confianza: <strong>{confidenceLabel(board.confidence)}</strong></p>
      <div
        className="board-meter"
        role="meter"
        aria-label="Confianza de la directiva"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={board.confidence}
      >
        <span className={confidenceTone(board.confidence)} style={{ width: `${board.confidence}%` }} />
      </div>
      <p>Reputacion del entrenador: <strong>{board.reputation}</strong>/100</p>
      {board.lastReview && <p className="board-review">{board.lastReview}</p>}
    </article>
  )
}
