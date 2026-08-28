import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'

import { PhaserCanvas } from '../../game/phaser/PhaserCanvas'
import type { TestLabMotionBridge } from '../../game/phaser/TestLabMotionBridge'
import {
  ABILITY_PROFILE_IDS,
  resolveAbilityProfile,
  type AbilityProfileId,
} from '../../motion/adaptive/profiles'
import {
  MOTION_ACTION_IDS,
  type MotionActionId,
  type MotionInputRequest,
  type PlayerId,
  type PlayerMotionState,
} from '../../motion/contracts/motion'
import {
  KeyboardMouseTestInputProvider,
  type PointerSimulationMode,
} from '../../motion/providers/KeyboardMouseTestInputProvider'
import { ActionDebugOverlay } from './ActionDebugOverlay'
import './DeveloperInputLab.css'

interface DeveloperInputLabProps {
  readonly onExit: () => void
}

type BaseProfileId = Exclude<
  AbilityProfileId,
  'LEFT_SIDE' | 'RIGHT_SIDE'
>
type SideSelection = 'BOTH' | 'LEFT_SIDE' | 'RIGHT_SIDE'

interface PlayerProfileSelection {
  readonly base: BaseProfileId
  readonly side: SideSelection
}

const PLAYER_IDS = [
  'player-1',
  'player-2',
  'player-3',
  'player-4',
] as const satisfies readonly PlayerId[]

const BASE_PROFILES = ABILITY_PROFILE_IDS.filter(
  (profile): profile is BaseProfileId =>
    profile !== 'LEFT_SIDE' && profile !== 'RIGHT_SIDE',
)

const INITIAL_PROFILES: readonly PlayerProfileSelection[] = [
  { base: 'STANDARD', side: 'BOTH' },
  { base: 'SEATED', side: 'RIGHT_SIDE' },
  { base: 'LOW_MOTION', side: 'LEFT_SIDE' },
  { base: 'SLOW_RESPONSE', side: 'BOTH' },
]

const TRIGGER_ACTIONS: ReadonlyArray<{
  id: MotionActionId
  label: string
}> = [
  { id: 'JUMP', label: 'Jump' },
  { id: 'SQUAT', label: 'Squat' },
  { id: 'STRIKE_LEFT', label: 'L strike' },
  { id: 'STRIKE_RIGHT', label: 'R strike' },
  { id: 'THROW', label: 'Throw' },
  { id: 'HAND_OPEN', label: 'Hand open' },
  { id: 'PINCH', label: 'Pinch' },
  { id: 'VOICE_TRIGGER', label: 'Voice trigger' },
]

function selectedProfile(selection: PlayerProfileSelection) {
  const profiles: AbilityProfileId[] = [selection.base]
  if (selection.side !== 'BOTH') profiles.push(selection.side)
  return resolveAbilityProfile(profiles)
}

function createRequest(
  playerCount: number,
  selections: readonly PlayerProfileSelection[],
): MotionInputRequest {
  return {
    players: PLAYER_IDS.slice(0, playerCount).map((playerId, index) => ({
      playerId,
      abilityProfile: selectedProfile(
        selections[index] ?? { base: 'STANDARD', side: 'BOTH' },
      ),
    })),
    actions: MOTION_ACTION_IDS,
    sensors: { pose: false, hands: false, audio: false },
  }
}

function numericAction(player: PlayerMotionState | undefined, id: MotionActionId) {
  const value = player?.actions[id]?.value
  return typeof value === 'number' ? value : 0
}

export default function DeveloperInputLab({ onExit }: DeveloperInputLabProps) {
  const [provider] = useState(
    () => new KeyboardMouseTestInputProvider({ keyboardTarget: window }),
  )
  const [playerCount, setPlayerCount] = useState(4)
  const [activePlayerId, setActivePlayerId] = useState<PlayerId>('player-1')
  const [profiles, setProfiles] = useState(INITIAL_PROFILES)
  const [pointerMode, setPointerMode] =
    useState<PointerSimulationMode>('POINTER')

  const request = useMemo(
    () => createRequest(playerCount, profiles),
    [playerCount, profiles],
  )
  const subscribe = useCallback(
    (listener: () => void) => provider.subscribe(listener),
    [provider],
  )
  const getSnapshot = useCallback(() => provider.getSnapshot(), [provider])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    void provider.start(request)
  }, [provider, request])

  useEffect(
    () => () => {
      void provider.stop()
    },
    [provider],
  )

  useEffect(() => {
    provider.setActivePlayer(activePlayerId)
  }, [activePlayerId, provider, request])

  useEffect(() => {
    provider.setPointerMode(pointerMode)
  }, [pointerMode, provider])

  useEffect(() => {
    let previous = performance.now()
    let frame = 0
    const tick = (now: number) => {
      provider.update(now - previous)
      previous = now
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [provider])

  const bridge = useMemo<TestLabMotionBridge>(
    () => ({
      getSnapshot: () => provider.getSnapshot(),
      getActivePlayerId: () => provider.getActivePlayerId(),
    }),
    [provider],
  )
  const activePlayer = snapshot.players.find(
    ({ playerId }) => playerId === activePlayerId,
  )
  const activeIndex = PLAYER_IDS.indexOf(activePlayerId as (typeof PLAYER_IDS)[number])
  const activeProfile = profiles[activeIndex] ?? INITIAL_PROFILES[0]

  function updateProfile(patch: Partial<PlayerProfileSelection>) {
    setProfiles((current) =>
      current.map((profile, index) =>
        index === activeIndex ? { ...profile, ...patch } : profile,
      ),
    )
  }

  function changePlayerCount(nextCount: number) {
    setPlayerCount(nextCount)
    if (activeIndex >= nextCount) setActivePlayerId('player-1')
  }

  function setContinuousValue(actionId: 'VOICE_LEVEL' | 'VOICE_PITCH' | 'RUN_CADENCE', value: number) {
    provider.setContinuousValue(activePlayerId, actionId, value)
  }

  return (
    <main className="test-lab-shell">
      <section className="test-field-region">
        <div className="test-lab-topbar">
          <button className="back-button" type="button" onClick={onExit}>
            ← Home
          </button>
          <div>
            <span className="lab-kicker">Developer-only architecture proof</span>
            <h1>Motion Arcade · Input Lab</h1>
          </div>
          <span className="no-sensors-badge">TEST · no sensors</span>
        </div>

        <div className="test-field-stack">
          <PhaserCanvas bridge={bridge} provider={provider} />
          <ActionDebugOverlay
            providerId={snapshot.providerId}
            player={activePlayer}
          />
          <div className="field-hint">
            Click or drag inside the field · A/D move · W jump · J/L strike
          </div>
        </div>
      </section>

      <aside className="test-control-panel" aria-label="Simulated input controls">
        <div className="control-panel-heading">
          <div>
            <span>Input provider</span>
            <strong>TEST</strong>
          </div>
          <label>
            Players
            <select
              aria-label="Simulated player count"
              value={playerCount}
              onChange={(event) => changePlayerCount(Number(event.target.value))}
            >
              {[1, 2, 3, 4].map((count) => (
                <option value={count} key={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="control-section player-tabs">
          <legend>Active player</legend>
          <div className="segmented-grid">
            {PLAYER_IDS.slice(0, playerCount).map((playerId, index) => (
              <button
                aria-pressed={activePlayerId === playerId}
                type="button"
                key={playerId}
                onClick={() => setActivePlayerId(playerId)}
              >
                P{index + 1}
              </button>
            ))}
          </div>
        </fieldset>

        <section className="control-section two-column-controls">
          <label>
            Ability profile
            <select
              aria-label="Ability profile"
              value={activeProfile?.base}
              onChange={(event) =>
                updateProfile({ base: event.target.value as BaseProfileId })
              }
            >
              {BASE_PROFILES.map((profile) => (
                <option value={profile} key={profile}>
                  {profile.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Usable side
            <select
              aria-label="Usable anatomical side"
              value={activeProfile?.side}
              onChange={(event) =>
                updateProfile({ side: event.target.value as SideSelection })
              }
            >
              <option value="BOTH">BOTH</option>
              <option value="LEFT_SIDE">LEFT SIDE</option>
              <option value="RIGHT_SIDE">RIGHT SIDE</option>
            </select>
          </label>
        </section>

        <fieldset className="control-section">
          <legend>Mouse simulates</legend>
          <div className="segmented-grid pointer-modes">
            {(
              [
                ['LEFT_HAND', 'Left hand'],
                ['POINTER', 'Pointer'],
                ['RIGHT_HAND', 'Right hand'],
              ] as const
            ).map(([mode, label]) => (
              <button
                aria-pressed={pointerMode === mode}
                type="button"
                key={mode}
                onClick={() => setPointerMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <section className="control-section slider-stack">
          <label>
            <span>
              Voice level
              <output>{numericAction(activePlayer, 'VOICE_LEVEL').toFixed(2)}</output>
            </span>
            <input
              aria-label="Voice level"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={numericAction(activePlayer, 'VOICE_LEVEL')}
              onInput={(event) =>
                setContinuousValue('VOICE_LEVEL', Number(event.currentTarget.value))
              }
            />
          </label>
          <label>
            <span>
              Voice pitch
              <output>{numericAction(activePlayer, 'VOICE_PITCH').toFixed(2)}</output>
            </span>
            <input
              aria-label="Voice pitch"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={numericAction(activePlayer, 'VOICE_PITCH')}
              onInput={(event) =>
                setContinuousValue('VOICE_PITCH', Number(event.currentTarget.value))
              }
            />
          </label>
          <label>
            <span>
              Run cadence
              <output>{numericAction(activePlayer, 'RUN_CADENCE').toFixed(1)} /s</output>
            </span>
            <input
              aria-label="Run cadence"
              type="range"
              min="0"
              max="4"
              step="0.1"
              value={numericAction(activePlayer, 'RUN_CADENCE')}
              onInput={(event) =>
                setContinuousValue('RUN_CADENCE', Number(event.currentTarget.value))
              }
            />
          </label>
        </section>

        <fieldset className="control-section">
          <legend>Trigger normalized actions</legend>
          <div className="trigger-grid">
            {TRIGGER_ACTIONS.map(({ id, label }) => (
              <button
                type="button"
                key={id}
                onClick={() => provider.triggerAction(activePlayerId, id)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <details className="binding-help">
          <summary>Keyboard bindings</summary>
          <p>A/D move · arrows vertical · W jump · S squat · Q/E lean · J/K/L strike</p>
          <p>R/Z/C reach · F/G/H arm swing · Space throw · Shift run · X step</p>
          <p>1 open · 2 pinch · 3 point · 4 clap · O close · V voice trigger</p>
        </details>
      </aside>
    </main>
  )
}
