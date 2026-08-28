import type {
  MotionActionState,
  MotionActionValue,
  PlayerMotionState,
  ProviderId,
} from '../../motion/contracts/motion'

interface ActionDebugOverlayProps {
  readonly providerId: ProviderId
  readonly player: PlayerMotionState | undefined
}

const ALWAYS_VISIBLE = new Set([
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'HAND_POSITION_LEFT',
  'HAND_POSITION_RIGHT',
  'VOICE_LEVEL',
  'VOICE_PITCH',
  'RUN_CADENCE',
])

function formatNumber(value: number): string {
  return value.toFixed(value > 1 ? 1 : 2)
}

function formatValue(value: MotionActionValue): string {
  if (typeof value === 'number') return formatNumber(value)
  if ('magnitude' in value) {
    return `x ${value.x.toFixed(2)} y ${value.y.toFixed(2)} v ${value.magnitude.toFixed(2)}`
  }
  return `x ${value.x.toFixed(2)} y ${value.y.toFixed(2)}`
}

function visibleAction(action: MotionActionState): boolean {
  return action.phase !== 'idle' || ALWAYS_VISIBLE.has(action.id)
}

export function ActionDebugOverlay({
  providerId,
  player,
}: ActionDebugOverlayProps) {
  const actions = Object.values(player?.actions ?? {}).filter(
    (action): action is MotionActionState => Boolean(action && visibleAction(action)),
  )

  return (
    <aside className="action-debug" aria-label="Normalized action inspector">
      <div className="debug-heading">
        <span>Normalized actions</span>
        <span className="provider-badge">{providerId}</span>
      </div>
      <p className="debug-player">
        {player?.playerId.replace('player-', 'Player ') ?? 'No player'}
        <span>{player?.abilityProfile.profileIds.join(' + ')}</span>
      </p>
      <div className="debug-action-list">
        {actions.map((action) => (
          <div
            className="debug-action-row"
            data-action-id={action.id}
            data-sequence={action.sequence}
            key={action.id}
          >
            <code>{action.id}</code>
            <output>{formatValue(action.value)}</output>
            <span data-phase={action.phase}>{action.phase}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}
