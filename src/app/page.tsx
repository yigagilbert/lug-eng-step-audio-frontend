import { VoiceTranslator } from "@/components/VoiceTranslator";

export default function Home() {
  return (
    <main className="appShell">
      <header className="appHeader" aria-label="Application header">
        <div>
          <p className="eyebrow">Step-Audio2 S2S</p>
          <h1>Luganda &harr; English Voice Translator</h1>
        </div>
        <div className="headerSignal" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </header>

      <VoiceTranslator />
    </main>
  );
}
