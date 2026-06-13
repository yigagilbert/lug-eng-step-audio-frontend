export function splitCaptionWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function getRevealedWordCount(wordCount: number, currentTime: number, duration: number) {
  if (wordCount <= 0) {
    return 0;
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return wordCount;
  }
  if (currentTime >= duration) {
    return wordCount;
  }
  const progress = Math.max(0, Math.min(1, currentTime / duration));
  return Math.max(1, Math.ceil(wordCount * progress));
}
