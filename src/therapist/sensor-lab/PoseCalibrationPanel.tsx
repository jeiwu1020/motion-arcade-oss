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
  readonly analyzerMode: 'STANDARD' | 'CALIBRATION_V1'
  readonly onAdvance: () => void
  readonly onRetry: () => void
  readonly onSkip: () => void
  readonly onReset: () => void
  readonly onUseCalibration: (
    calibration: Extract<PlayerCalibration, { readonly version: 1 }>,
  ) => void
  readonly onUseStandard: () => void
}

const STEP_COPY: Readonly<Record<PoseCalibrationFlowStep, {
  readonly eyebrow: string
  readonly title: string
  readonly instruction: string
}>> = {
  WELCOME: {
    eyebrow: '階段 1 / 2 · 動作校正',
    title: '動作校正',
    instruction: '啟動相機後，跟著畫面完成五個簡單步驟',
  },
  NEUTRAL: {
    eyebrow: '階段 1 / 2 · 校正 1 / 5',
    title: '自然站好',
    instruction: '保持全身與雙腳在畫面內，短暫站穩',
  },
  MOVE: {
    eyebrow: '階段 1 / 2 · 校正 2 / 5',
    title: '左右移動',
    instruction: '身體向自己的左邊移動，再向右邊移動；保持身體大致直立',
  },
  LEAN: {
    eyebrow: '階段 1 / 2 · 校正 3 / 5',
    title: '左右傾斜',
    instruction: '站在原地，上半身向左傾，再向右傾',
  },
  REACH: {
    eyebrow: '階段 1 / 2 · 校正 4 / 5',
    title: '左右手伸展',
    instruction: '先放下雙手；畫面顯示可以伸手後，再依序把左手、右手舒服地向外伸',
  },
  SQUAT: {
    eyebrow: '階段 1 / 2 · 校正 5 / 5',
    title: '舒服地深蹲',
    instruction: '做一次你覺得舒服的深蹲，不需要勉強蹲到最低',
  },
  REVIEW: {
    eyebrow: '階段 1 / 2 · 校正完成',
    title: '校正完成',
    instruction: '下一步會直接使用這次校正值進入動作測試',
  },
  COMPLETE: {
    eyebrow: '階段 2 / 2 · 動作測試',
    title: '動作測試進行中',
    instruction: '直接做動作即可；系統已在偵測，不需要再按開始',
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
  analyzerMode,
  onAdvance,
  onRetry,
  onSkip,
  onReset,
  onUseCalibration,
  onUseStandard,
}: PoseCalibrationPanelProps) {
  const baseCopy = STEP_COPY[snapshot.step]
  const copy = snapshot.step === 'COMPLETE'
    ? {
        ...baseCopy,
        title: analyzerMode === 'CALIBRATION_V1'
          ? '校正值測試進行中'
          : 'STANDARD 測試進行中',
        instruction: analyzerMode === 'CALIBRATION_V1'
          ? '直接做左右移動、左右傾斜、左右伸手、深蹲與跳躍；系統正依照你的校正值判定，不需要再按開始'
          : '直接做左右移動、左右傾斜、左右伸手、深蹲與跳躍；系統正使用原本固定門檻，不需要再按開始',
      }
    : baseCopy
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
  const reachStateLabel = snapshot.step === 'REACH'
    ? snapshot.reachReadyForMotion === false
      ? '先放下雙手，準備偵測'
      : snapshot.sideProgress?.left
        ? snapshot.sideProgress.right
          ? '✓ 左右手都完成'
          : '左手完成，請伸右手'
        : '可以伸手：請先伸左手'
    : null
  const stateLabel = snapshot.step === 'COMPLETE'
    ? analyzerMode === 'CALIBRATION_V1'
      ? '✓ 測試已開始 · 目前使用校正值'
      : '✓ 測試已開始 · 目前使用 STANDARD'
    : snapshot.step === 'REVIEW'
      ? '校正已完成，下一步開始動作測試'
      : snapshot.collectionState === 'WAITING_FOR_TRACKING'
        ? '請回到畫面中'
        : reachStateLabel ?? (
          snapshot.collectionState === 'READY'
            ? '✓ 這一步完成'
            : snapshot.collectionState === 'COLLECTING'
              ? `收集中 ${Math.round(snapshot.progress * 100)}%`
              : cameraRunning
                ? '準備開始'
                : '請先啟動相機'
        )

  const restartFullCalibration = () => {
    onReset()
    onAdvance()
  }

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
          <strong>{result.status === 'COMPLETE' ? '✓ 五項校正全部完成' : '✓ 校正完成（部分項目已跳過）'}</strong>
          <p>按「開始校正值動作測試」後，測試會立即開始；進入下一頁後直接做動作即可。</p>
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
              重新測試這一步
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
            <button
              type="button"
              className="pose-button pose-button-primary"
              disabled={!cameraRunning || !result}
              onClick={() => {
                if (!result) return
                onUseCalibration(result)
                onAdvance()
              }}
            >
              開始校正值動作測試
            </button>
            <button type="button" className="pose-button" onClick={restartFullCalibration}>
              重新做完整校正
            </button>
          </>
        ) : null}
        {snapshot.step === 'COMPLETE' && result ? (
          <>
            {analyzerMode === 'CALIBRATION_V1' ? (
              <button
                type="button"
                className="pose-button"
                onClick={onUseStandard}
                disabled={!cameraRunning}
              >
                切換到 STANDARD 比較
              </button>
            ) : (
              <button
                type="button"
                className="pose-button pose-button-primary"
                onClick={() => onUseCalibration(result)}
                disabled={!cameraRunning}
              >
                切回校正值測試
              </button>
            )}
            <button type="button" className="pose-button pose-button-quiet" onClick={restartFullCalibration}>
              重新做完整校正
            </button>
          </>
        ) : null}
      </div>

      {snapshot.step === 'COMPLETE' && result ? (
        <div className="pose-calibration-developer">
          <strong>
            開發者診斷：{analyzerMode === 'CALIBRATION_V1' ? 'CALIBRATION v1' : 'STANDARD'}
          </strong>
          <details className="pose-calibration-diagnostics">
            <summary>標準化校正值</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </section>
  )
}
