import { getConstructionProgress, getOperationalCapacity } from '../engine/stadium'
import type { Stadium } from '../types/game'

type StadiumIllustrationProps = {
  stadium: Stadium
  teamName?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360
  }
  return hash
}

export function StadiumIllustration({ stadium, teamName }: StadiumIllustrationProps) {
  const capacityRatio = clamp(stadium.capacity / 120_000, 0.25, 1)
  const sizeTier = stadium.capacity >= 70_000 ? 'large' : stadium.capacity >= 35_000 ? 'medium' : 'small'
  const baseHue = hashString(teamName ?? stadium.name)
  const accentHue = (baseHue + 32) % 360
  const bowlInset = 24 - capacityRatio * 10
  const upperInset = bowlInset + 8
  const isUnderConstruction = (stadium.upgradeWeeksRemaining ?? 0) > 0
  const progress = getConstructionProgress(stadium)
  const operationalCapacity = getOperationalCapacity(stadium)
  const centerX = 160
  const bowlWidth = sizeTier === 'large' ? 202 : sizeTier === 'medium' ? 182 : 160
  const bowlX = centerX - bowlWidth / 2
  const craneX = centerX + bowlWidth / 2 - 10 + (progress / 100) * 8
  const roofPath = sizeTier === 'large'
    ? `M${centerX - 120} 78 q120 -48 240 0 l-10 16 q-110 -32 -220 0 z`
    : sizeTier === 'medium'
      ? `M${centerX - 106} 84 q106 -34 212 0 l-10 12 q-96 -22 -192 0 z`
      : `M${centerX - 90} 92 q90 -22 180 0 l-8 9 q-82 -14 -164 0 z`
  const bowlY = sizeTier === 'large' ? 84 : sizeTier === 'medium' ? 90 : 98
  const bowlHeight = sizeTier === 'large' ? 96 : sizeTier === 'medium' ? 84 : 70
  const lowerY = sizeTier === 'large' ? 98 : sizeTier === 'medium' ? 102 : 108
  const lowerHeight = sizeTier === 'large' ? 70 : sizeTier === 'small' ? 52 : 64
  const upperY = sizeTier === 'large' ? 92 : sizeTier === 'small' ? 102 : 96
  const upperHeight = sizeTier === 'large' ? 18 : sizeTier === 'small' ? 10 : 14
  const pitchWidth = sizeTier === 'large' ? 112 : sizeTier === 'medium' ? 106 : 96
  const pitchX = centerX - pitchWidth / 2
  const pitchHeight = sizeTier === 'large' ? 46 : sizeTier === 'small' ? 34 : 42
  const pitchY = sizeTier === 'large'
    ? lowerY + Math.round((lowerHeight - pitchHeight) / 2)
    : sizeTier === 'medium'
      ? lowerY + Math.round((lowerHeight - pitchHeight) / 2)
      : lowerY + Math.round((lowerHeight - pitchHeight) / 2)
  const pitchInnerX = pitchX + 8
  const pitchInnerY = pitchY + 6
  const pitchInnerWidth = pitchWidth - 16
  const pitchInnerHeight = pitchHeight - 12
  const penaltyBoxDepth = Math.max(12, Math.round(pitchInnerWidth * 0.14))
  const penaltyBoxHeight = Math.max(16, Math.round(pitchInnerHeight * 0.62))
  const goalAreaDepth = Math.max(6, Math.round(penaltyBoxDepth * 0.45))
  const goalAreaHeight = Math.max(8, Math.round(penaltyBoxHeight * 0.45))
  const boxTop = pitchInnerY + (pitchInnerHeight - penaltyBoxHeight) / 2
  const goalTop = pitchInnerY + (pitchInnerHeight - goalAreaHeight) / 2
  const bowlClass = `stadium-bowl is-${sizeTier}`
  const lowerSeatingWidth = bowlWidth - bowlInset * 2
  const upperSeatingWidth = bowlWidth - upperInset * 2
  const phase = stadium.upgradeWeeksRemaining === 4
    ? 'demolicion'
    : stadium.upgradeWeeksRemaining === 3
      ? 'estructura'
      : stadium.upgradeWeeksRemaining === 2
        ? 'graderio'
        : stadium.upgradeWeeksRemaining === 1
          ? 'acabados'
          : 'operativo'

  return (
    <div
      className={`stadium-illustration is-${sizeTier} ${isUnderConstruction ? 'is-under-construction' : ''}`}
      aria-label={`Estado del estadio ${stadium.name}`}
      style={{
        ['--stadium-accent' as string]: `hsl(${accentHue} 72% 64%)`,
        ['--stadium-accent-dark' as string]: `hsl(${accentHue} 66% 44%)`,
        ['--stadium-club' as string]: `hsl(${baseHue} 48% 30%)`,
        ['--stadium-club-soft' as string]: `hsl(${baseHue} 55% 55%)`,
      }}
    >
      <svg viewBox="0 0 320 220" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="stadiumSky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#183f57" />
            <stop offset="55%" stopColor="#0d2533" />
            <stop offset="100%" stopColor="#071821" />
          </linearGradient>
          <linearGradient id="stadiumGrass" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#46a36d" />
            <stop offset="100%" stopColor="#18573a" />
          </linearGradient>
          <linearGradient id="stadiumRoof" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--stadium-club-soft)" />
            <stop offset="100%" stopColor="var(--stadium-club)" />
          </linearGradient>
          <linearGradient id="stadiumSeatsLower" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--stadium-accent)" />
            <stop offset="100%" stopColor="var(--stadium-accent-dark)" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="320" height="220" fill="url(#stadiumSky)" />
        <ellipse cx="76" cy="36" rx="34" ry="12" className="stadium-cloud" />
        <ellipse cx="252" cy="28" rx="42" ry="14" className="stadium-cloud" />
        <ellipse cx="160" cy="58" rx="104" ry="24" className="stadium-light-glow" />
        <ellipse cx="160" cy="198" rx="136" ry="16" className="stadium-shadow" />

        <path d={roofPath} fill="url(#stadiumRoof)" className="stadium-roof" />

        <rect x={String(bowlX)} y={String(bowlY)} width={String(bowlWidth)} height={String(bowlHeight)} rx="18" className={bowlClass} />
        <rect x={String(bowlX + bowlInset)} y={String(lowerY)} width={String(lowerSeatingWidth)} height={String(lowerHeight)} rx="8" fill="url(#stadiumSeatsLower)" className="stadium-seating-lower" />
        <rect x={String(bowlX + upperInset)} y={String(upperY)} width={String(upperSeatingWidth)} height={String(upperHeight)} rx="6" className="stadium-seating-upper" />
        <path d={`M${bowlX + bowlInset} ${lowerY + 12} h${lowerSeatingWidth}`} className="stadium-seat-line" />
        <path d={`M${bowlX + bowlInset} ${lowerY + 22} h${lowerSeatingWidth}`} className="stadium-seat-line" />
        <path d={`M${bowlX + bowlInset} ${lowerY + 32} h${lowerSeatingWidth}`} className="stadium-seat-line" />
        <path d={`M${bowlX + bowlInset} ${lowerY + 42} h${lowerSeatingWidth}`} className="stadium-seat-line" />
        <path d={`M${bowlX + bowlInset} ${lowerY + 52} h${lowerSeatingWidth}`} className="stadium-seat-line" />
        <path d={`M${bowlX + bowlInset} ${lowerY + 62} h${lowerSeatingWidth}`} className="stadium-seat-line" />
        <path d={`M${bowlX + upperInset} ${upperY + 6} h${upperSeatingWidth}`} className="stadium-seat-line is-upper" />
        <path d={`M${bowlX + upperInset} ${upperY + 12} h${upperSeatingWidth}`} className="stadium-seat-line is-upper" />

        <rect x={String(pitchX)} y={String(pitchY)} width={String(pitchWidth)} height={String(pitchHeight)} rx="2" fill="url(#stadiumGrass)" className="stadium-pitch" />
        <rect x={String(pitchX)} y={String(pitchY)} width={String(pitchWidth)} height={String(pitchHeight)} rx="2" className="stadium-pitch-stripes" />
        <rect x={String(pitchInnerX)} y={String(pitchInnerY)} width={String(pitchInnerWidth)} height={String(pitchInnerHeight)} rx="1" className="stadium-lines" />
        <line x1="160" y1={String(pitchInnerY)} x2="160" y2={String(pitchInnerY + pitchInnerHeight)} className="stadium-lines" />
        <circle cx="160" cy={String(pitchY + pitchHeight / 2)} r="8" className="stadium-lines" />
        <rect x={String(pitchInnerX)} y={String(boxTop)} width={String(penaltyBoxDepth)} height={String(penaltyBoxHeight)} className="stadium-penalty-box" />
        <rect x={String(pitchInnerX + pitchInnerWidth - penaltyBoxDepth)} y={String(boxTop)} width={String(penaltyBoxDepth)} height={String(penaltyBoxHeight)} className="stadium-penalty-box" />
        <rect x={String(pitchInnerX)} y={String(goalTop)} width={String(goalAreaDepth)} height={String(goalAreaHeight)} className="stadium-goal-area" />
        <rect x={String(pitchInnerX + pitchInnerWidth - goalAreaDepth)} y={String(goalTop)} width={String(goalAreaDepth)} height={String(goalAreaHeight)} className="stadium-goal-area" />
        <rect x={String(pitchX - 2)} y={String(goalTop + 2)} width="2" height={String(Math.max(8, goalAreaHeight - 4))} className="stadium-goal-box" />
        <rect x={String(pitchX + pitchWidth)} y={String(goalTop + 2)} width="2" height={String(Math.max(8, goalAreaHeight - 4))} className="stadium-goal-box" />

        {isUnderConstruction && (
          <>
            <g className="stadium-crane-group">
              <rect x={String(craneX)} y="42" width="6" height="96" className="stadium-crane" />
              <rect x={String(craneX - 28)} y="42" width="64" height="6" className="stadium-crane" />
              <line x1={String(craneX + 20)} y1="48" x2={String(craneX + 20)} y2="86" className="stadium-crane-line" />
              <rect x={String(craneX + 14)} y="84" width="12" height="10" className="stadium-crane-load" />
            </g>

            {(phase === 'estructura' || phase === 'graderio' || phase === 'acabados') && (
              <>
                <rect x="214" y="86" width="28" height="16" className="stadium-scaffold" />
                <rect x="212" y="102" width="34" height="20" className="stadium-scaffold" />
              </>
            )}

            {phase === 'demolicion' && (
              <>
                <path d="M215 117 l10 -8 l11 6 l9 -7" className="stadium-rubble" />
                <path d="M228 130 l8 -6 l10 5 l8 -5" className="stadium-rubble" />
              </>
            )}

            {phase === 'graderio' && (
              <rect x="210" y="92" width="40" height="10" className="stadium-new-stand" />
            )}

            {phase === 'acabados' && (
              <rect x="208" y="88" width="44" height="18" className="stadium-finish-highlight" />
            )}

            <path d="M236 126 l12 -8 l12 8" className="stadium-cone" />
            <path d="M90 170 l10 -12 l10 12" className="stadium-cone" />
          </>
        )}
      </svg>

      <div className="stadium-meta">
        <span>
          {isUnderConstruction
            ? `${operationalCapacity.toLocaleString('es-ES')} / ${stadium.capacity.toLocaleString('es-ES')} plazas`
            : `${stadium.capacity.toLocaleString('es-ES')} plazas`}
        </span>
        <span>{isUnderConstruction ? `Obras en curso · ${progress.toFixed(0)}%` : 'Estadio operativo'}</span>
      </div>
    </div>
  )
}
