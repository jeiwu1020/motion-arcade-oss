import { lazy, Suspense, useEffect, useState } from 'react'

import { TEST_INPUT_ENABLED } from './app/testModeGate'
import { REAL_SENSOR_LAB_ENABLED } from './app/realSensorLabGate'
import { homeCategories } from './app/homeCategories'
import {
  hashForScreen,
  screenFromHash,
  type AppScreen,
} from './app/navigation'
import { gameRegistry } from './game/registry/gameRegistry'
import type { GameCategory } from './game/registry/types'
import './App.css'

const DeveloperInputLab = lazy(
  () => import('./therapist/test-lab/DeveloperInputLab'),
)
const PoseSensorLab = lazy(
  () => import('./therapist/sensor-lab/PoseSensorLab'),
)
const BalloonPopGameScreen = lazy(
  () =>
    import.meta.env.DEV
      ? import('./games/balloon-pop/BalloonPopGameScreen')
      : import('./games/balloon-pop/BalloonPopPoseGameScreen'),
)
const ReactionArenaGameScreen = lazy(
  () =>
    import.meta.env.DEV
      ? import('./games/reaction-arena/ReactionArenaGameScreen')
      : import('./games/reaction-arena/ReactionArenaPoseGameScreen'),
)
const RunnerGameScreen = lazy(
  () =>
    import.meta.env.DEV
      ? import('./games/runner/RunnerGameScreen')
      : import('./games/runner/RunnerPoseGameScreen'),
)
const RhythmMotionGameScreen = lazy(
  () =>
    import.meta.env.DEV
      ? import('./games/rhythm-motion/RhythmGameScreen')
      : import('./games/rhythm-motion/RhythmPoseGameScreen'),
)
const TennisGameScreen = lazy(
  () =>
    import.meta.env.DEV
      ? import('./games/tennis/TennisGameScreen')
      : import('./games/tennis/TennisPoseGameScreen'),
)

function screenFromLocation(): AppScreen {
  return screenFromHash(window.location.hash, {
    testInputEnabled: TEST_INPUT_ENABLED,
    realSensorLabEnabled: REAL_SENSOR_LAB_ENABLED,
  })
}

function navigate(screen: AppScreen): void {
  window.location.hash = hashForScreen(screen)
}

function App() {
  const [screen, setScreen] = useState(screenFromLocation)

  useEffect(() => {
    const handleHashChange = () => setScreen(screenFromLocation())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (screen === 'TEST_LAB' && TEST_INPUT_ENABLED) {
    return (
      <Suspense fallback={<LabLoadingScreen />}>
        <DeveloperInputLab onExit={() => navigate('HOME')} />
      </Suspense>
    )
  }

  if (screen === 'POSE_SENSOR_LAB' && REAL_SENSOR_LAB_ENABLED) {
    return (
      <Suspense fallback={<LabLoadingScreen />}>
        <PoseSensorLab onExit={() => navigate('HOME')} />
      </Suspense>
    )
  }

  if (screen === 'BALLOON_POP') {
    return (
      <Suspense fallback={<LabLoadingScreen />}>
        <BalloonPopGameScreen onExit={() => navigate('HOME')} />
      </Suspense>
    )
  }

  if (screen === 'REACTION_ARENA') {
    return (
      <Suspense fallback={<LabLoadingScreen />}>
        <ReactionArenaGameScreen onExit={() => navigate('HOME')} />
      </Suspense>
    )
  }

  if (screen === 'RUNNER') {
    return (
      <Suspense fallback={<LabLoadingScreen />}>
        <RunnerGameScreen onExit={() => navigate('HOME')} />
      </Suspense>
    )
  }

  if (screen === 'RHYTHM_MOTION') {
    return (
      <Suspense fallback={<LabLoadingScreen />}>
        <RhythmMotionGameScreen onExit={() => navigate('HOME')} />
      </Suspense>
    )
  }

  if (screen === 'TENNIS') {
    return (
      <Suspense fallback={<LabLoadingScreen />}>
        <TennisGameScreen onExit={() => navigate('HOME')} />
      </Suspense>
    )
  }

  return (
    <HomeScreen
      onOpenLab={() => navigate('TEST_LAB')}
      onOpenPoseLab={() => navigate('POSE_SENSOR_LAB')}
      onOpenBalloonPop={() => navigate('BALLOON_POP')}
      onOpenReactionArena={() => navigate('REACTION_ARENA')}
      onOpenRunner={() => navigate('RUNNER')}
      onOpenRhythmMotion={() => navigate('RHYTHM_MOTION')}
      onOpenTennis={() => navigate('TENNIS')}
    />
  )
}

function HomeScreen({
  onOpenLab,
  onOpenPoseLab,
  onOpenBalloonPop,
  onOpenReactionArena,
  onOpenRunner,
  onOpenRhythmMotion,
  onOpenTennis,
}: {
  readonly onOpenLab: () => void
  readonly onOpenPoseLab: () => void
  readonly onOpenBalloonPop: () => void
  readonly onOpenReactionArena: () => void
  readonly onOpenRunner: () => void
  readonly onOpenRhythmMotion: () => void
  readonly onOpenTennis: () => void
}) {
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('SPORTS')
  const games = gameRegistry.filter((game) => game.category === selectedCategory)

  return (
    <main className="home-shell">
      <header className="home-nav">
        <a className="home-brand" href="#top" aria-label="Motion Arcade 首頁">
          <img className="home-brand-mark" src="/assets/home/motion_arcade_mark.svg" alt="" />
          <span>
            <strong>Motion Arcade</strong>
            <small>體感遊樂園</small>
          </span>
        </a>
        {TEST_INPUT_ENABLED || REAL_SENSOR_LAB_ENABLED ? (
          <div className="developer-lab-actions">
            {TEST_INPUT_ENABLED ? (
              <button className="developer-lab-link" type="button" onClick={onOpenLab}>
                Developer Input Lab
              </button>
            ) : null}
            {REAL_SENSOR_LAB_ENABLED ? (
              <button className="developer-lab-link" type="button" onClick={onOpenPoseLab}>
                Pose Sensor Lab
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <section className="home-hero" id="top" aria-labelledby="home-title">
        <div className="home-copy">
          <p className="home-eyebrow">MOTION ARCADE</p>
          <h1 id="home-title">今天想玩什麼？</h1>
          <p>動起來，找到今天想玩的遊戲。</p>
        </div>
        <div className="home-game-shelf" aria-live="polite">
          {games.map((game) => (
            <button
              className="home-game-entry"
              type="button"
              key={game.id}
              onClick={
                game.id === 'balloon-pop'
                  ? onOpenBalloonPop
                  : game.id === 'reaction-arena'
                    ? onOpenReactionArena
                    : game.id === 'runner'
                      ? onOpenRunner
                    : game.id === 'rhythm-motion'
                      ? onOpenRhythmMotion
                      : game.id === 'tennis'
                        ? onOpenTennis
                      : undefined
              }
            >
              <span className="home-game-entry-category">
                {game.category === 'SPORTS' ? '運動競技' : '小遊戲'} · 1 人 · 60 秒
              </span>
              <strong>{game.title}</strong>
              <span>{game.description}</span>
              <small>
                開始遊戲 →
              </small>
            </button>
          ))}
        </div>
      </section>

      <section className="category-section" aria-label="遊戲分類">
        <div className="category-rail">
          {homeCategories.map((category) => {
            const isSelected = category.id === selectedCategory

            return (
              <button
                className="category-card"
                data-selected={isSelected}
                aria-pressed={isSelected}
                type="button"
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
              >
                <img
                  src={category.artSrc}
                  alt=""
                  style={{ objectPosition: category.objectPosition }}
                />
                <span className="category-card-scrim" aria-hidden="true" />
                <span className="category-card-label">{category.title}</span>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}

function LabLoadingScreen() {
  return (
    <main className="lab-loading-screen" aria-live="polite">
      <span className="loading-dot" />
      Loading the Phaser playfield…
    </main>
  )
}

export default App
