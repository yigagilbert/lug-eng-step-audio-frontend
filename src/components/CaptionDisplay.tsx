"use client";

import { getRevealedWordCount, splitCaptionWords } from "@/lib/captions";

type CaptionDisplayProps = {
  text: string;
  currentTime: number;
  duration: number;
  progressive: boolean;
};

export function CaptionDisplay({
  text,
  currentTime,
  duration,
  progressive,
}: CaptionDisplayProps) {
  const words = splitCaptionWords(text);
  const revealedWords = progressive
    ? getRevealedWordCount(words.length, currentTime, duration)
    : words.length;

  if (words.length === 0) {
    return (
      <section className="captionsPanel" aria-live="polite">
        <p className="captionPlaceholder">Translated English captions will appear here.</p>
      </section>
    );
  }

  return (
    <section className="captionsPanel" aria-label="Translated English captions" aria-live="polite">
      <p className="captionText">
        {words.map((word, index) => (
          <span
            className={index < revealedWords ? "captionWord visible" : "captionWord"}
            key={`${word}-${index}`}
          >
            {word}
          </span>
        ))}
      </p>
    </section>
  );
}
