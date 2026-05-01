import { type CSSProperties, useCallback, useState } from 'react'
import { extractHint, getInitials, shortenIdentifier } from './fallback'
import { usePartyDirectory } from './react'

export interface PartyNameProps {
  identifier: string
  variant?: 'default' | 'full' | 'badge'
  copyable?: boolean
  tooltip?: boolean
  fallback?: React.ReactNode
  className?: string
}

const styles: Record<string, CSSProperties> = {
  root: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
  },
  rootNoCopy: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  hint: {
    color: 'var(--canton-party-hint-color, #888)',
    fontSize: '0.85em',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    background: 'var(--canton-party-badge-bg, #2a2a4a)',
    color: 'var(--canton-party-badge-color, #a0a0d0)',
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '6px',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    background: 'var(--canton-party-tooltip-bg, #1a1a2e)',
    color: 'var(--canton-party-tooltip-color, #e0e0e0)',
    pointerEvents: 'none',
    zIndex: 50,
  },
  copied: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '6px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    background: '#22c55e',
    color: '#fff',
    pointerEvents: 'none',
    zIndex: 50,
  },
  unknown: {
    color: 'var(--canton-party-hint-color, #888)',
    fontFamily: 'monospace',
    fontSize: '0.9em',
  },
}

export function PartyName({
  identifier,
  variant = 'default',
  copyable = true,
  tooltip = true,
  className,
}: PartyNameProps) {
  const { displayName: resolve, loading } = usePartyDirectory()
  const [showTooltip, setShowTooltip] = useState(false)
  const [showCopied, setShowCopied] = useState(false)

  const name = resolve(identifier)
  const hint = extractHint(identifier)
  const isKnown = name !== hint && name !== identifier && !name.endsWith('...')

  const handleClick = useCallback(() => {
    if (!copyable || !identifier) return
    navigator.clipboard
      .writeText(identifier)
      .then(() => {
        setShowCopied(true)
        setTimeout(() => setShowCopied(false), 1500)
      })
      .catch((err) => {
        console.error('[canton-party-directory] clipboard write failed', err)
      })
  }, [copyable, identifier])

  if (loading) {
    return (
      <span className={className} style={{ opacity: 0.5 }}>
        {hint || '...'}
      </span>
    )
  }

  const rootStyle = copyable ? styles.root : styles.rootNoCopy

  return (
    <span
      className={className}
      style={rootStyle}
      onClick={handleClick}
      onMouseEnter={() => tooltip && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={tooltip ? undefined : identifier}
    >
      {variant === 'badge' && isKnown && <span style={styles.badge}>{getInitials(name)}</span>}

      {isKnown ? (
        <span className={className} style={{ color: 'var(--canton-party-name-color, inherit)' }}>
          {name}
        </span>
      ) : (
        <span className={className} style={styles.unknown}>
          {name}
        </span>
      )}

      {variant === 'full' && isKnown && hint && <span style={styles.hint}>({hint})</span>}

      {showTooltip && tooltip && !showCopied && (
        <span style={styles.tooltip}>{shortenIdentifier(identifier)}</span>
      )}

      {showCopied && <span style={styles.copied}>Copied</span>}
    </span>
  )
}
