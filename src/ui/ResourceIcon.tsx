// src/ui/ResourceIcon.tsx
export function ResourceIcon({ kind }: { kind: 'food' | 'wood' | 'gold' | 'stone' | 'oliveoil' }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    className: 'resSvg',
    'aria-hidden': true,
  } as const

  if (kind === 'food') {
    // Berry/food icon - rounder, more organic
    return (
      <svg {...common}>
        <circle cx="12" cy="13" r="7" fill="currentColor" />
        <path
          d="M12 6c-.5 0-1 .3-1.5 1-.5.7-.5 1.5-.5 2"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="10" cy="12" r="1" fill="rgba(0,0,0,0.2)" />
        <circle cx="14" cy="13" r="1" fill="rgba(0,0,0,0.2)" />
      </svg>
    )
  }
  if (kind === 'wood') {
    // Tree stump with rings
    return (
      <svg {...common}>
        <ellipse cx="12" cy="12" rx="8" ry="7" fill="currentColor" />
        <ellipse
          cx="12"
          cy="12"
          rx="5.5"
          ry="4.5"
          fill="none"
          stroke="rgba(0,0,0,0.25)"
          strokeWidth="1.2"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="3"
          ry="2.5"
          fill="none"
          stroke="rgba(0,0,0,0.25)"
          strokeWidth="1"
        />
        <path
          d="M8 8l8 8M16 8l-8 8"
          stroke="rgba(0,0,0,0.15)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (kind === 'gold') {
    // Gold pile/ingots
    return (
      <svg {...common}>
        <path d="M12 4l-7 5v7l7 4 7-4V9l-7-5Z" fill="currentColor" />
        <path
          d="M12 4v16M5 9l7 4M19 9l-7 4"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path d="M12 4l7 5-7 4-7-4z" fill="rgba(255,255,255,0.2)" />
      </svg>
    )
  }
  if (kind === 'stone') {
    // Rock/boulder with texture
    return (
      <svg {...common}>
        <path d="M7 10l2-6 6-1 5 4 1 6-2 5-5 3-6-1-3-4z" fill="currentColor" />
        <path
          d="M9 8l3-2M14 7l2 2M10 15l2-3M15 16l-2-3"
          stroke="rgba(0,0,0,0.25)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="11" cy="11" r="1" fill="rgba(0,0,0,0.2)" />
        <circle cx="15" cy="13" r="0.8" fill="rgba(0,0,0,0.2)" />
      </svg>
    )
  }
  // oliveoil - amphora/jar
  return (
    <svg {...common}>
      <path
        d="M12 5c-2 0-3 1-3 2v10c0 1.5 1.5 3 3 3s3-1.5 3-3V7c0-1-1-2-3-2Z"
        fill="currentColor"
      />
      <ellipse cx="12" cy="7" rx="3" ry="1.5" fill="currentColor" opacity="0.7" />
      <path
        d="M10.5 3.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V5h-3V3.5Z"
        fill="currentColor"
        opacity="0.6"
      />
      <path
        d="M9.5 10c.5.3 1.5.5 2.5.5s2-.2 2.5-.5M9.5 14c.5.3 1.5.5 2.5.5s2-.2 2.5-.5"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
