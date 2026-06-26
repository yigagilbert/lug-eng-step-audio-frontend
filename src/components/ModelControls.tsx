"use client";

import {
  DIRECTIONS,
  MODEL_MODES,
  VOICES,
  directionLabel,
  isValidCombo,
  isVoiceAvailable,
  modelModeDescription,
  modelModeLabel,
  voiceLabel,
  type Direction,
  type ModelMode,
  type TranslationSettings,
  type Voice,
  type VoiceAvailability,
} from "@/lib/translation-settings";

type Props = {
  settings: TranslationSettings;
  voiceAvailability: VoiceAvailability;
  adapterAvailability: ReadonlyArray<string>;
  disabled?: boolean;
  onChange: (next: TranslationSettings) => void;
};

export function ModelControls({
  settings,
  voiceAvailability,
  adapterAvailability,
  disabled,
  onChange,
}: Props) {
  const adapterReady = (mode: ModelMode) =>
    adapterAvailability.length === 0 ? true : adapterAvailability.includes(mode);

  return (
    <fieldset className="modelControls" disabled={disabled}>
      <legend className="visuallyHidden">Translation settings</legend>

      <PillGroup
        label="Model"
        helpText={modelModeDescription(settings.modelMode)}
      >
        {MODEL_MODES.map((mode) => (
          <PillButton
            key={mode}
            active={settings.modelMode === mode}
            disabled={!adapterReady(mode)}
            onClick={() => onChange({ ...settings, modelMode: mode })}
          >
            {modelModeLabel(mode)}
          </PillButton>
        ))}
      </PillGroup>

      <PillGroup label="Direction">
        {DIRECTIONS.map((direction) => {
          const supported = isValidCombo(settings.modelMode, direction);
          return (
            <PillButton
              key={direction}
              active={settings.direction === direction}
              disabled={!supported}
              title={
                supported
                  ? undefined
                  : `Not available with the ${modelModeLabel(settings.modelMode)} model`
              }
              onClick={() => onChange({ ...settings, direction })}
            >
              {directionLabel(direction)}
            </PillButton>
          );
        })}
      </PillGroup>

      <PillGroup label="Voice">
        {VOICES.map((voice) => {
          const available = isVoiceAvailable(voiceAvailability, voice);
          return (
            <PillButton
              key={voice}
              active={settings.voice === voice}
              disabled={!available}
              title={available ? undefined : `${voiceLabel(voice)} not provisioned yet`}
              onClick={() => onChange({ ...settings, voice })}
            >
              {voiceLabel(voice)}
            </PillButton>
          );
        })}
      </PillGroup>
    </fieldset>
  );
}

function PillGroup({
  label,
  helpText,
  children,
}: {
  label: string;
  helpText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pillGroup" role="group" aria-label={label}>
      <span className="pillGroupLabel">{label}</span>
      <div className="pillRow">{children}</div>
      {helpText ? <small className="pillHelp">{helpText}</small> : null}
    </div>
  );
}

function PillButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`pill ${active ? "pillActive" : ""}`}
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export type { Voice, Direction, ModelMode, VoiceAvailability };
