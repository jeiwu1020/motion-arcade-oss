import { lazy, Suspense, useEffect, useState } from 'react'

import { TEST_INPUT_ENABLED } from './app/testModeGate'
import { homeCategories } from './app/homeCategories'
import type { GameCategory } from './game/registry/types'
import './App.css'

const DeveloperInputLab = lazy(
  () => import('./therapist/test-lab/DeveloperInputLab'),
)

type AppScreen = 'HOME' | 'TEST_LAB'

function screenFromLocation(): AppScreen {
  return TEST_INPUT_ENABLED && window.location.hash === '#test-lab'
    ? 'TEST_LAB'
    : 'HOME'
}

function navigate(screen: AppScreen): void {
  window.location.hash = screen === 'TEST_LAB' ? 'test-lab' : ''
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

  return <HomeScreen onOpenLab={() => navigate('TEST_LAB')} />
}

function HomeScreen({ onOpenLab }: { readonly onOpenLab: () => void }) {
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
        {TEST_INPUT_ENABLED ? (
          <button className="developer-lab-link" type="button" onClick={onOpenLab}>
            Developer Input Lab
          </button>
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
