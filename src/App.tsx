import { lazy, Suspense, useEffect, useState } from 'react'

import { TEST_INPUT_ENABLED } from './app/testModeGate'
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
  return (
    <main className="home-shell">
      <nav className="home-nav" aria-label="Application status">
        <span className="home-wordmark">Motion Arcade</span>
        <span className="phase-badge">Phase 1A · foundation</span>
      </nav>

      <section className="home-hero">
        <div className="home-copy">
          <p className="home-eyebrow">Browser-based adaptive movement platform</p>
          <h1>
            One input contract.
            <br />
            Many ways to participate.
          </h1>
          <p className="home-summary">
            The application shell starts without Phaser or sensor libraries. The
            developer-only lab proves keyboard, pointer, voice simulation, and
            per-player adaptations through normalized actions.
          </p>
          {TEST_INPUT_ENABLED ? (
            <button
              className="home-primary-button"
              type="button"
              onClick={onOpenLab}
            >
              Open Developer Input Lab
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <p className="production-mode-note">
              Developer input controls are disabled in this production build.
            </p>
          )}
        </div>

        <div className="architecture-card" aria-label="Input architecture summary">
          <div className="architecture-node source-node">
            <span>Provider</span>
            <strong>TEST</strong>
          </div>
          <span className="architecture-arrow">↓</span>
          <div className="architecture-node contract-node">
            <span>Stable boundary</span>
            <strong>Normalized Actions</strong>
          </div>
          <span className="architecture-arrow">↓</span>
          <div className="architecture-node output-node">
            <span>Consumers</span>
            <strong>React · Phaser</strong>
          </div>
          <p>No camera · no microphone · no permissions</p>
        </div>
      </section>

      <section className="home-foundation-grid" aria-label="Phase 1A capabilities">
        <article>
          <span>01</span>
          <h2>Per-player adaptation</h2>
          <p>Four simulated players keep separate profiles, sides, and state.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Canonical coordinates</h2>
          <p>Mirroring is resolved before games see world or hand positions.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Lazy playfield</h2>
          <p>Phaser loads only when the full-screen test shell is entered.</p>
        </article>
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
