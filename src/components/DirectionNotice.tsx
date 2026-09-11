import { ArrowRight, Loader2, LockKeyhole } from "lucide-react";
import type { ServiceReadiness } from "@/lib/types";

type DirectionNoticeProps = {
  sourceLanguage: string;
  targetLanguage: string;
  readiness: ServiceReadiness;
};

const READINESS_LABELS: Record<ServiceReadiness, string> = {
  checking: "Checking model",
  warming: "Cold start possible",
  ready: "Model ready",
  unavailable: "Service needs attention",
};

export function DirectionNotice({
  sourceLanguage,
  targetLanguage,
  readiness,
}: DirectionNoticeProps) {
  const isLoading = readiness === "checking" || readiness === "warming";

  return (
    <section className="directionNotice" aria-label="Supported translation direction">
      <div className="directionRoute">
        <div className="directionNode">
          <span>Input speech</span>
          <strong>{sourceLanguage}</strong>
        </div>

        <ArrowRight aria-hidden="true" className="directionArrow" size={25} />

        <div className="directionNode">
          <span>Output speech and captions</span>
          <strong>{targetLanguage}</strong>
        </div>
      </div>

      <div className="directionMeta">
        <span className="directionLock">
          <LockKeyhole aria-hidden="true" size={16} />
          Single-direction model: Luganda in, English out only
        </span>
        <span className={`readinessPill readiness-${readiness}`} aria-live="polite">
          {isLoading ? (
            <Loader2 aria-hidden="true" className="spin" size={14} />
          ) : (
            <span className="readinessDot" aria-hidden="true" />
          )}
          {READINESS_LABELS[readiness]}
        </span>
      </div>
    </section>
  );
}
