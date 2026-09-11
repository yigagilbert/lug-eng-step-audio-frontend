import { formatDuration } from "@/lib/format";
import {
  TRANSLATION_PROGRESS_STAGES,
  getTranslationProgressSnapshot,
} from "@/lib/translation-progress";

type TranslationProgressProps = {
  elapsedSeconds: number;
  isPreparingRecording: boolean;
};

export function TranslationProgress({
  elapsedSeconds,
  isPreparingRecording,
}: TranslationProgressProps) {
  const snapshot = getTranslationProgressSnapshot(elapsedSeconds, isPreparingRecording);
  const activeIndex = TRANSLATION_PROGRESS_STAGES.findIndex(
    (stage) => stage.id === snapshot.activeStageId,
  );

  return (
    <section className="translationProgress" aria-label="Translation progress" aria-live="polite">
      <div className="progressHeader">
        <div>
          <p className="progressKicker">Estimated progress</p>
          <strong>{snapshot.headline}</strong>
          <span>{snapshot.detail}</span>
        </div>
        <time dateTime={`PT${Math.floor(elapsedSeconds)}S`}>
          {formatDuration(elapsedSeconds)}
        </time>
      </div>

      <div
        className="progressTrack"
        role="progressbar"
        aria-label={snapshot.headline}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(snapshot.percent)}
      >
        <span style={{ width: `${snapshot.percent}%` }} />
      </div>

      <ol className="progressSteps">
        {TRANSLATION_PROGRESS_STAGES.map((stage, index) => {
          const status =
            index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending";

          return (
            <li className={`progressStep progressStep-${status}`} key={stage.id}>
              <span className="progressStepDot" aria-hidden="true" />
              <span>{stage.label}</span>
            </li>
          );
        })}
      </ol>

      {snapshot.coldStartLikely ? (
        <p className="coldStartNote">
          The service may be waking from idle. The first request can be slower, but later
          translations should respond faster.
        </p>
      ) : null}
    </section>
  );
}
