import { forwardRef, useId } from 'react'

// An aged shipping tag with a twine loop and a wax seal. Used for the start-page choices,
// the Skills tag and the board's Back tag.
const PaperTag = forwardRef(function PaperTag(
  { label, kicker, size = 'large', seal = 'star', pressed = false, progress = null, className = '', ...buttonProps },
  ref,
) {
  const id = useId().replace(/:/g, '')
  const hasProgress = progress !== null

  return (
    <button
      ref={ref}
      type="button"
      className={`pf-tag pf-tag--${size} ${pressed ? 'is-pressed' : ''} ${className}`}
      aria-pressed={pressed || undefined}
      {...buttonProps}
    >
      <span className="pf-tag__body">
        <svg className="pf-tag__paper" viewBox="0 0 200 300" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id={`grain-${id}`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="noise" />
              <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.28  0 0 0 0 0.2  0 0 0 0 0.11  0 0 0 0.75 -0.05" />
              <feComposite in2="SourceGraphic" operator="in" />
            </filter>
            <filter id={`mottle-${id}`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves="3" seed="3" result="noise" />
              <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 1.1 -0.45" />
              <feComposite in2="SourceGraphic" operator="in" />
            </filter>
            <filter id={`burn-${id}`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <clipPath id={`clip-${id}`}>
              <path d="M42 3 L158 2 L197 42 L198 296 L3 298 L2 43 Z" />
            </clipPath>
            <radialGradient id={`tone-${id}`} cx="42%" cy="38%" r="80%">
              <stop offset="0" stopColor="#c9b38a" />
              <stop offset="0.6" stopColor="#b09671" />
              <stop offset="1" stopColor="#7e6545" />
            </radialGradient>
          </defs>
          {/* Clipped top corners, slightly irregular edges like hand-cut card stock. */}
          <path
            className="pf-tag__shape"
            d="M42 3 L158 2 L197 42 L198 296 L3 298 L2 43 Z"
            fill={`url(#tone-${id})`}
          />
          <g clipPath={`url(#clip-${id})`}>
            <rect width="200" height="300" filter={`url(#mottle-${id})`} fill="#000" />
            <rect width="200" height="300" filter={`url(#grain-${id})`} fill="#000" />
            {/* Water stain and handling marks. */}
            <path
              d="M128 178 C150 170 172 186 170 206 C168 228 146 236 128 228 C110 222 104 188 128 178 Z"
              fill="rgba(110, 76, 40, 0.1)"
              stroke="rgba(96, 62, 30, 0.22)"
              strokeWidth="1.4"
            />
            {/* Burnt, handled edges. */}
            <path
              d="M42 3 L158 2 L197 42 L198 296 L3 298 L2 43 Z"
              fill="none"
              stroke="rgba(52, 32, 14, 0.65)"
              strokeWidth="16"
              filter={`url(#burn-${id})`}
            />
          </g>
          <path
            d="M14 52 L186 52 M14 282 L186 282"
            stroke="rgba(40, 26, 12, 0.4)"
            strokeWidth="1.1"
            strokeDasharray="2 3"
          />
          {/* Reinforced eyelet. */}
          <circle cx="100" cy="28" r="13" fill="#9d8358" stroke="rgba(50,32,16,.6)" strokeWidth="2" />
          <circle cx="100" cy="28" r="6.5" fill="#0f0c09" />
        </svg>
        <svg className="pf-tag__twine" viewBox="0 0 60 80" aria-hidden="true">
          <path d="M30 60 C 8 40, 14 8, 30 2 C 46 8, 52 40, 30 60" fill="none" stroke="#8a7350" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M30 60 C 26 66, 20 72, 14 79 M30 60 C 34 67, 40 72, 47 78" fill="none" stroke="#8a7350" strokeWidth="2.2" strokeLinecap="round" />
        </svg>

        <span className="pf-tag__text">
          {kicker && <span className="pf-tag__kicker">{kicker}</span>}
          <span className="pf-tag__label">{label}</span>
        </span>

        <span className="pf-tag__seal" aria-hidden="true">
          <svg viewBox="0 0 100 100">
            <defs>
              <radialGradient id={`wax-${id}`} cx="36%" cy="30%" r="72%">
                <stop offset="0" stopColor="#94342c" />
                <stop offset="0.5" stopColor="#651812" />
                <stop offset="1" stopColor="#35090a" />
              </radialGradient>
            </defs>
            <path
              d="M50 4 C62 5 66 11 76 14 C86 19 88 28 94 38 C98 50 93 58 95 68 C92 80 84 84 76 91 C65 97 57 94 48 97 C36 96 30 90 20 86 C10 78 8 70 5 58 C3 46 8 38 9 28 C15 16 24 13 34 7 C40 4 45 4 50 4 Z"
              fill={`url(#wax-${id})`}
            />
            <circle cx="50" cy="51" r="30" fill="none" stroke="rgba(30,4,2,.55)" strokeWidth="2.5" />
            <circle cx="50" cy="51" r="30" fill="none" stroke="rgba(255,190,170,.18)" strokeWidth="1" transform="translate(-1 -1)" />
            {seal === 'star' ? (
              <path
                d="M50 32 L55.3 45.2 L69.5 46 L58.5 55 L62.1 68.8 L50 61 L37.9 68.8 L41.5 55 L30.5 46 L44.7 45.2 Z"
                fill="rgba(40,6,4,.6)"
                stroke="rgba(255,190,170,.22)"
                strokeWidth="0.8"
              />
            ) : seal === 'arrow' ? (
              <path
                d="M33 51 L48 38 L48 46 L67 46 L67 56 L48 56 L48 64 Z"
                fill="rgba(40,6,4,.6)"
                stroke="rgba(255,190,170,.22)"
                strokeWidth="0.8"
                strokeLinejoin="round"
              />
            ) : (
              <text x="50" y="60" textAnchor="middle" className="pf-tag__seal-mark">{seal}</text>
            )}
            {hasProgress && (
              // Fills from `progress.from` to full over `progress.seconds` (the rest of the loop).
              <circle
                className="pf-tag__progress"
                cx="50"
                cy="51"
                r="41"
                pathLength="1"
                style={{ '--from': 1 - progress.from, animationDuration: `${progress.seconds}s` }}
              />
            )}
          </svg>
        </span>
      </span>
    </button>
  )
})

export default PaperTag
