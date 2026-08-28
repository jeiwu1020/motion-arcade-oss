import { lazy, Suspense, useEffect, useState } from 'react'

import { TEST_INPUT_ENABLED } from './app/testModeGate'
import { REAL_SENSOR_LAB_ENABLED } from './app/realSensorLabGate'
import { homeCategories } from './app/homeCategories'
import type { GameCategory } from './game/registry/types'
import './App.css'

const DeveloperInputLab = lazy(
  () => import('./therapist/test-lab/DeveloperInputLab'),
)
const PoseSensorLab = lazy(
  () => import('./therapist/sensor-lab/PoseSensorLab'),
)

type AppScreen = 'HOME' | 'TEST_LAB' | 'POSE_SENSOR_LAB'

function screenFromLocation(): AppScreen {
  if (TEST_INPUT_ENABLED && window.location.hash === '#test-lab') {
    return 'TEST_LAB'
  }
  if (
    REAL_SENSOR_LAB_ENABLED &&
    window.location.hash === '#pose-sensor-lab'
  ) {
    return 'POSE_SENSOR_LAB'
  }
  return 'HOME'
}

function navigate(screen: AppScreen): void {
  window.location.hash =
    screen === 'TEST_LAB'
      ? 'test-lab'
      : screen === 'POSE_SENSOR_LAB'
        ? 'pose-sensor-lab'
        : ''
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

  return (
    <HomeScreen
      onOpenLab={() => navigate('TEST_LAB')}
      onOpenPoseLab={() => navigate('POSE_SENSOR_LAB')}
    />
  )
}

function HomeScreen({
  onOpenLab,
  onOpenPoseLab,
}: {
  readonly onOpenLab: () => void
  readonly onOpenPoseLab: () => void
}) {
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('SPORTS')

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
      Loading the isolated Phaser test field…
    </main>
  )
}

export default App
