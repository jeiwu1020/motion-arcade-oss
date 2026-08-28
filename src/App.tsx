import './App.css'

import { PhaserCanvas } from './game/phaser/PhaserCanvas'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Phase 0 architecture scaffold</p>
          <h1>Motion Arcade</h1>
        </div>
        <div className="status-row" aria-label="Scaffold status">
          <span>React shell</span>
          <span>Phaser 4.2.1</span>
          <span>1280 × 720 FIT</span>
        </div>
      </header>

      <main className="playfield-panel">
        <PhaserCanvas />
      </main>

      <footer className="phase-zero-note">
        <details>
          <summary>Phase 0 boundaries</summary>
          <p>
            This page proves the React-to-Phaser lifecycle only. It requests no
            camera or microphone permission, performs no MediaPipe inference,
            and contains no game implementation.
          </p>
        </details>
        <p className="privacy-note">Camera frames and microphone signals stay local.</p>
      </footer>
    </div>
  )
}

export default App
