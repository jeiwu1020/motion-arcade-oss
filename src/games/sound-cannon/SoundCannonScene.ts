import Phaser from 'phaser'
import { SOUND_CANNON_RULES, type SoundCannonGameplayPhase, type SoundCannonState, type SoundCannonTarget } from './SoundCannonCore'
import type { SoundCannonSession } from './SoundCannonSession'

const W = 1280; const H = 720; const CANNON_X = 210; const BLAST_X = 430; const TARGET_Y: Record<string, number> = { HIGH: 230, CENTER: 360, LOW: 490 }
const PHASE: Record<SoundCannonGameplayPhase, string> = { WARM_UP: 'WARM UP', TARGET_WAVE: 'TARGET WAVE', POWER_WAVE: 'POWER WAVE', FINAL_BARRAGE: 'FINAL BARRAGE!' }

/** Thin Phaser projection. Core owns target timing, judgement, and score. */
export class SoundCannonScene extends Phaser.Scene {
  readonly #session: SoundCannonSession
  #world!: Phaser.GameObjects.Graphics; #actors!: Phaser.GameObjects.Graphics; #effects!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text; #phase!: Phaser.GameObjects.Text; #feedback!: Phaser.GameObjects.Text; #hud!: Phaser.GameObjects.Text
  constructor(session: SoundCannonSession) { super('sound-cannon'); this.#session = session }
  create(): void {
    this.#world = this.add.graphics(); this.#actors = this.add.graphics(); this.#effects = this.add.graphics()
    const style = { color: '#fff', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', stroke: '#080b2c', strokeThickness: 10 }
    this.#countdown = this.add.text(W / 2, H / 2, '', { ...style, fontSize: '180px' }).setOrigin(.5).setDepth(10)
    this.#phase = this.add.text(W / 2, 58, '', { ...style, fontSize: '54px' }).setOrigin(.5).setDepth(10)
    this.#feedback = this.add.text(W / 2, 180, '', { ...style, fontSize: '78px', color: '#ffe17a' }).setOrigin(.5).setDepth(10)
    this.#hud = this.add.text(32, 28, '', { ...style, fontSize: '28px' }).setDepth(10)
  }
  update(): void { const state = this.#session.getState(); this.#world.clear(); this.#actors.clear(); this.#effects.clear(); this.#drawWorld(state); this.#drawTargets(state); this.#drawCannon(state); this.#drawEffects(state); this.#updateText(state) }
  #drawWorld(state: SoundCannonState): void {
    const rush = state.gamePhase === 'FINAL_BARRAGE'; const pulse = .5 + .5 * Math.sin(state.elapsedMs / (rush ? 70 : 150))
    this.#world.fillStyle(rush ? 0x32104d : 0x111b49, 1); this.#world.fillRect(0, 0, W, H)
    this.#world.fillStyle(rush ? 0xff4f9e : 0x40b9ff, .15 + pulse * .1); this.#world.fillCircle(930, 180, 200 + pulse * 20)
    this.#world.fillStyle(0x282c68, 1); this.#world.fillRect(0, 560, W, 160); this.#world.fillStyle(rush ? 0xff6b93 : 0x5fe1d6, .8); this.#world.fillRect(0, 552, W, 8)
    for (let x = -80; x < W + 100; x += 120) { this.#world.fillStyle(0x8edcff, .18); this.#world.fillRect(x - ((state.elapsedMs * (rush ? .18 : .08)) % 120), 630, 70, 8) }
    this.#world.lineStyle(6, 0x6cecff, .38); this.#world.lineBetween(BLAST_X, 120, BLAST_X, 560); this.#world.strokeCircle(BLAST_X, 360, 76)
  }
  #drawTargets(state: SoundCannonState): void {
    for (const target of state.targets.filter((item) => item.resolution === 'PENDING').slice(0, 6)) this.#drawTarget(target, state)
  }
  #drawTarget(target: SoundCannonTarget, state: SoundCannonState): void {
    const x = BLAST_X + ((target.targetTimeMs - state.elapsedMs) / SOUND_CANNON_RULES.visualLeadMs) * 620; const y = TARGET_Y[target.region] ?? 360; if (x < -80 || x > W + 100) return
    const color = target.type === 'ORB' ? 0x68e8ff : target.type === 'SHIELD' ? 0xffd66e : 0xff6fbe; const g = this.#actors
    g.lineStyle(10, color, .9); if (target.type === 'ORB') { g.fillStyle(color, .9); g.fillCircle(x, y, 34); g.lineStyle(5, 0xffffff, .8); g.strokeCircle(x, y, 50) } else if (target.type === 'SHIELD') { g.fillStyle(color, .75); g.fillCircle(x, y, 44); g.strokeCircle(x, y, 62); g.lineBetween(x - 38, y, x + 38, y) } else { g.fillStyle(color, .9); g.fillTriangle(x - 44, y, x + 25, y - 32, x + 25, y + 32); g.lineBetween(x - 90, y, x - 35, y) }
  }
  #drawCannon(state: SoundCannonState): void {
    const g = this.#actors; const charge = state.charge; g.fillStyle(0x081535, .9); g.fillRoundedRect(CANNON_X - 65, 300, 130, 150, 28); g.fillStyle(0x73e6ff, .9); g.fillRoundedRect(CANNON_X + 20, 345, 170, 60, 30); g.fillStyle(0xffffff, .9); g.fillCircle(CANNON_X, 365, 40); g.lineStyle(14, 0x7cfff0, .25 + charge * .6); g.strokeCircle(CANNON_X, 365, 74 + charge * 26); g.lineStyle(8, 0xffdc7a, .95); g.beginPath(); g.arc(CANNON_X, 365, 96, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge); g.strokePath()
  }
  #drawEffects(state: SoundCannonState): void { const g = this.#effects; const pulse = .5 + .5 * Math.sin(state.elapsedMs / 80); g.lineStyle(4, state.gamePhase === 'FINAL_BARRAGE' ? 0xff5fbd : 0x75eaff, .15 + pulse * .18); g.strokeCircle(BLAST_X, 360, 82 + pulse * 12); for (const event of state.presentationEvents) { if (event.kind === 'HIT' || event.kind === 'FULL_BLAST') { g.lineStyle(event.kind === 'FULL_BLAST' ? 24 : 12, 0xfff0a0, .9); g.strokeCircle(BLAST_X, 360, event.kind === 'FULL_BLAST' ? 145 : 105) } } }
  #updateText(state: SoundCannonState): void { this.#countdown.setText(state.phase === 'COUNTDOWN' ? String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1000))) : ''); this.#phase.setText(state.phase === 'PLAYING' ? PHASE[state.gamePhase] : ''); const latest = state.presentationEvents[state.presentationEvents.length - 1]; this.#feedback.setText(latest?.kind === 'FULL_BLAST' ? 'FULL BLAST!' : latest?.kind === 'HIT' ? latest.result.hit?.grade ?? 'HIT!' : latest?.kind === 'WASTED_SHOT' ? '太早了' : latest?.kind === 'MISS' ? 'MISS' : ''); this.#hud.setText(`聲音 ${Math.round(state.voiceMeterLevel * 100)}   蓄力 ${Math.round(state.charge * 100)}   分數 ${state.score}   連續 ${state.currentStreak}`) }
}
