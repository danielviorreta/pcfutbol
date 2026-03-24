import { useMemo, useState } from 'react'

function buildBadgeText(teamName: string): string {
  const ignored = new Set(['fc', 'cf', 'rcd', 'ud', 'ca', 'cd', 'de', 'del', 'la'])
  const tokens = teamName
    .split(/\s+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 1 && !ignored.has(token))

  if (tokens.length === 0) {
    return teamName.slice(0, 2).toUpperCase()
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase()
  }

  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase()
}

interface ClubBadgeProps {
  teamName: string
  crestUrl?: string
}

export function ClubBadge({ teamName, crestUrl }: ClubBadgeProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const badgeText = useMemo(() => buildBadgeText(teamName), [teamName])

  if (!crestUrl || imgFailed) {
    return (
      <span className="club-badge club-badge-fallback" aria-label={`Escudo ${teamName}`}>
        {badgeText}
      </span>
    )
  }

  return (
    <img
      className="club-badge club-badge-img"
      src={crestUrl}
      alt={`Escudo ${teamName}`}
      loading="lazy"
      onError={() => setImgFailed(true)}
    />
  )
}
