"use client";

import { Loader2, Play } from "lucide-react";
import { AUDIO_SAMPLES, type AudioSample } from "@/lib/samples";

type SamplePickerProps = {
  disabled: boolean;
  activeSampleId: string | null;
  onSelect: (sample: AudioSample) => void;
};

export function SamplePicker({ disabled, activeSampleId, onSelect }: SamplePickerProps) {
  return (
    <div className="sampleTray" aria-label="Luganda audio samples">
      <p className="sampleTrayLabel">Or try a sample clip</p>
      <div className="sampleChips">
        {AUDIO_SAMPLES.map((sample) => {
          const isActive = sample.id === activeSampleId;
          return (
            <button
              key={sample.id}
              type="button"
              className={isActive ? "sampleChip active" : "sampleChip"}
              disabled={disabled}
              aria-label={`Translate ${sample.label}`}
              onClick={() => onSelect(sample)}
            >
              {isActive && disabled ? (
                <Loader2 aria-hidden="true" className="spin" size={15} />
              ) : (
                <Play aria-hidden="true" size={14} />
              )}
              {sample.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
