import { withBasePath } from "@/lib/public-path";

export type AudioSample = {
  id: string;
  label: string;
  src: string;
  filename: string;
};

// Luganda speech clips served from public/luganda_inputs.
// To add more, drop a .wav in that folder and append an entry here.
const SAMPLE_FILES = [
  "01_lug_eng_0058182.lug.wav",
  "02_lug_eng_0043936.lug.wav",
  "03_lug_eng_0000622.lug.wav",
  "04_lug_eng_0006677.lug.wav",
  "05_lug_eng_0001936.lug.wav",
  "06_lug_eng_0088689.lug.wav",
  "07_lug_eng_0069972.lug.wav",
  "08_lug_eng_0011715.lug.wav",
  "09_lug_eng_0050907.lug.wav",
  "10_lug_eng_0056160.lug.wav",
];

export const AUDIO_SAMPLES: AudioSample[] = SAMPLE_FILES.map((filename, index) => ({
  id: filename,
  label: `Sample ${index + 1}`,
  src: withBasePath(`/luganda_inputs/${encodeURIComponent(filename)}`),
  filename,
}));
