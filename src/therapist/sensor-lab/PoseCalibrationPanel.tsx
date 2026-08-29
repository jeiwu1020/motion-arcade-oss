import type {
  PlayerCalibration,
  PlayerCalibrationStep,
} from '../../motion/contracts/motion'
import type {
  PoseCalibrationFlowStep,
  PoseCalibrationSnapshot,
} from '../../motion/calibration/PoseCalibrationSession'

interface PoseCalibrationPanelProps {
  readonly snapshot: PoseCalibrationSnapshot
  readonly cameraRunning: boolean
  readonly onAdvance: () => void
  readonly onRetry: () => void
  readonly onSkip: () => void
  readonly onReset: () => void
}

const STEP_COPY: Readonly<Record<PoseCalibrationFlowStep, {
  readonly eyebrow: string
  readonly title: string
  readonly instruction: string
}>> = {
  WELCOME: {
    eyebrow: 'PHASE 1D.1 · STANDARD',
    title: '動作校正',
    instruction: '啟動相機後，跟著畫面完成五個簡單步驟',
  },
  NEUTRAL: {
    eyebrow: 'STEP 1 / 5',
    title: '自然站好',
    instruction: '保持全身與雙腳在畫面內，短暫站穩',
  },
  MOVE: {
    eyebrow: 'STEP 2 / 5',
    title: '左右移動',
    instruction: '身體向自己的左邊移動，再向右邊移動；保持身體大致直立',
  },
  LEAN: {
    eyebrow: 'STEP 3 / 5',
    title: '左右傾斜',
    instruction: '站在原地，上半身向左傾，再向右傾',
  },
  REACH: {
    eyebrow: 'STEP 4 / 5',
    title: '左右手伸展',
    instruction: '左手舒服地向外伸，再換右手',
  },
  SQUAT: {
    eyebrow: 'STEP 5 / 5',
    title: '舒服地深蹲',
    instruction: '做一次你覺得舒服的深蹲，不需要勉強蹲到最低',
  },
  REVIEW: {
    eyebrow: 'REVIEW',
    title: '校正完成',
    instruction: '確認結果；已跳過的項目會保留為未提供',
  },
  COMPLETE: {
    eyebrow: 'SESSION READY',
    title: '✓ 校正資料已建立',
    instruction: '資料只保留在這個頁面的記憶體中',
  },
}

const PROGRESS_STEPS: readonly {
  readonly id: PlayerCalibrationStep
  readonly label: string
}[] = [
  { id: 'NEUTRAL', label: '站立基準' },
  { id: 'MOVE', label: '左右移動' },
  { id: 'LEAN', label: '左右傾斜' },
  { id: 'REACH', label: '左右伸手' },
  { id: 'SQUAT', label: '深蹲' },
]

function isVersionOneCalibration(
  calibration: PlayerCalibration | null,
): calibration is Extract<PlayerCalibration, { readonly version: 1 }> {
  return calibration?.version === 1
}

function statusLabel(status: PoseCalibrationSnapshot['stepStatuses'][PlayerCalibrationStep]): string {
  if (status === 'COMPLETE') return '✓'
  if (status === 'SKIPPED') return '已跳過'
  if (status === 'COLLECTING') return '●'
  return '○'
}

export function PoseCalibrationPanel({
  snapshot,
  cameraRunning,
  onAdvance,
  onRetry,
  onSkip,
  onReset,
}: PoseCalibrationPanelProps) {
  const copy = STEP_COPY[snapshot.step]
  const isMeasurement = PROGRESS_STEPS.some(({ id }) => id === snapshot.step)
  const canSkip = snapshot.step !== 'NEUTRAL' && isMeasurement
  const result = isVersionOneCalibration(snapshot.result) ? snapshot.result : null
  const tone = snapshot.collectionState === 'WAITING_FOR_TRACKING'
    ? 'problem'
    : snapshot.collectionState === 'READY' || snapshot.step === 'COMPLETE'
      ? 'ready'
      : snapshot.step === 'WELCOME' || snapshot.step === 'REVIEW'
        ? 'idle'
        : 'collecting'
  const stateLabel = snapshot.collectionState === 'WAITING_FOR_TRACKING'
    ? '請回到畫面中'
    : snapshot.collectionState === 'READY'
      ? '✓ 這一步完成'
      : snapshot.collectionState === 'COLLECTING'
        ? `收集中 ${Math.round(snapshot.progress * 100)}%`
        : cameraRunning
          ? '準備開始'
          : '請先啟動相機'

  return (
    <section className={`pose-calibration pose-calibration-${tone}`} aria-label="引導式姿勢校正">
      <div className="pose-calibration-copy" role="status" aria-live="polite">
        <span>{copy.eyebrow}</span>
        <h2>{copy.title}</h2>
        <p>{copy.instruction}</p>
        {snapshot.sideProgress ? (
          <div className="pose-calibration-sides" aria-label="左右完成狀態">
            <strong className={snapshot.sideProgress.left ? 'is-complete' : ''}>
              左側 {snapshot.sideProgress.left ? '✓ 完成' : '等待中'}
            </strong>
            <strong className={snapshot.sideProgress.right ? 'is-complete' : ''}>
              右側 {snapshot.sideProgress.right ? '✓ 完成' : '等待中'}
            </strong>
          </div>
        ) : null}
        <b className="pose-calibration-state">{stateLabel}</b>
      </div>

      <ol className="pose-calibration-progress" aria-label="校正進度">
        {PROGRESS_STEPS.map(({ id, label }) => {
          const status = snapshot.stepStatuses[id]
          return (
            <li key={id} className={`pose-calibration-progress-${status.toLowerCase()}`}>
              <span>{label}</span>
              <b>{statusLabel(status)}</b>
            </li>
          )
        })}
      </ol>

      {snapshot.step === 'REVIEW' && result ? (
        <div className="pose-calibration-review">
          <strong>{result.status === 'COMPLETE' ? '全部完成' : '部分完成'}</strong>
          <p>✓ 完成的能力會保留；跳過項目不會填入假資料。</p>
        </div>
      ) : null}

      <div className="pose-calibration-actions">
        {snapshot.step === 'WELCOME' ? (
          <button type="button" className="pose-button pose-button-primary" onClick={onAdvance} disabled={!cameraRunning}>
            開始校正
          </button>
        ) : null}
        {isMeasurement ? (
          <>
            <button type="button" className="pose-button pose-button-primary" onClick={onAdvance} disabled={!snapshot.readyToAdvance}>
              下一步
            </button>
            <button type="button" className="pose-button" onClick={onRetry}>
              重新測試
            </button>
            {canSkip ? (
              <button type="button" className="pose-button pose-button-quiet" onClick={onSkip}>
                跳過
              </button>
            ) : null}
          </>
        ) : null}
        {snapshot.step === 'REVIEW' ? (
          <>
            <button type="button" className="pose-button pose-button-primary" onClick={onAdvance}>
              完成
            </button>
            <button type="button" className="pose-button" onClick={onReset}>
              重新校正
            </button>
          </>
        ) : null}
        {snapshot.step === 'COMPLETE' ? (
          <button type="button" className="pose-button" onClick={onReset}>
            重新校正
          </button>
        ) : null}
      </div>

      {result ? (
        <details className="pose-calibration-diagnostics">
          <summary>開發者：標準化校正值</summary>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  )
}
