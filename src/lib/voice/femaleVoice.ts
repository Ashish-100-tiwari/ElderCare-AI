/**
 * Picking a woman's voice out of the browser's voice list.
 *
 * Asha is a woman, and the OpenAI voice she normally speaks with (`coral`) is
 * one. The browser fallback, though, had no voice set at all — so it used the
 * platform default, which is male on most Linux and Windows installs. The
 * companion's voice changed gender the moment the network hiccuped.
 *
 * There is no gender field in the Web Speech API, so this matches on names. That
 * is unavoidably a heuristic, so it is written to fail in the safe direction: a
 * voice must be *recognisably* female to be chosen. An unlabelled voice like
 * espeak's "English (America)" is refused, because picking it would be a coin
 * flip on gender — and losing that flip is the exact bug this fixes. The caller
 * then falls back to the platform default, which is no worse than before.
 *
 * Kept free of browser globals so it can be unit-tested against a fixed list.
 */

/** The parts of `SpeechSynthesisVoice` this needs. */
export interface VoiceLike {
  name: string;
  lang: string;
}

/**
 * Voices shipped as female by the major platforms.
 *
 * Indian-locale names first — they are the ones that will actually be picked for
 * this app — then the wider en/hi sets from macOS, Windows and Chrome.
 */
const FEMALE_NAMES = [
  // en-IN / hi-IN
  "veena", // macOS en-IN
  "heera", // Windows hi-IN
  "kalpana", // Windows hi-IN
  "lekha", // macOS hi-IN
  "swara",
  "aditi",
  "raveena",
  "neerja", // Windows/Azure en-IN
  "isha",
  // macOS / iOS
  "samantha",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "victoria",
  "allison",
  "ava",
  "susan",
  "zoe",
  "alice",
  "alva",
  "amelie",
  "anna",
  "ellen",
  "joana",
  "kyoko",
  "laila",
  "mariska",
  "milena",
  "monica",
  "nora",
  "paulina",
  "sara",
  "satu",
  "sin-ji",
  "ting-ting",
  "yuna",
  "zuzana",
  // Windows
  "zira",
  "hazel",
  "eva",
  "catherine",
  "linda",
  "aria",
  "jenny",
  "michelle",
  // Chrome / Android
  "google uk english female",
  "google us english", // female-sounding in Chrome
];

/**
 * Voices shipped as male. Refused even when nothing better is available —
 * a male voice is the specific thing this module exists to avoid.
 */
const MALE_NAMES = [
  // en-IN / hi-IN
  "rishi", // macOS en-IN
  "hemant", // Windows hi-IN
  "madhur", // Windows/Azure hi-IN
  "ravi",
  "prabhat", // Azure en-IN
  // macOS / iOS
  "alex",
  "daniel",
  "fred",
  "thomas",
  "oliver",
  "aaron",
  "arthur",
  "albert",
  "bad news",
  "bahh",
  "bells",
  "boing",
  "bubbles",
  "cellos",
  "diego",
  "gordon",
  "jamie",
  "jorge",
  "juan",
  "junior",
  "lee",
  "luca",
  "maged",
  "martin",
  "nicky",
  "organ",
  "ralph",
  "reed",
  "rocko",
  "sandy",
  "trinoids",
  "whisper",
  "xander",
  "yuri",
  "zarvox",
  // Windows
  "david",
  "mark",
  "george",
  "james",
  "ryan",
  "guy",
  // Chrome / Android
  "google uk english male",
  // espeak, which spells the gender out
  "male",
  "+m1",
  "+m2",
  "+m3",
  "+m4",
  "+m5",
  "+m6",
  "+m7",
];

/** espeak and some Android builds mark female variants this way. */
const FEMALE_MARKERS = [/\bfemale\b/, /\+f\d/, /\bwoman\b/];

/**
 * Whole-word matching, not substring.
 *
 * Substring matching is wrong in both directions here: "female" contains "male",
 * and "lee" is inside "Leela". `\b` sidesteps both. Entries that are not plain
 * words (espeak's "+m1") fall back to a substring test, since `\b` would not
 * apply to a leading "+".
 */
function matches(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => {
    if (!/^[a-z]/.test(needle)) return haystack.includes(needle);
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(haystack);
  });
}

/**
 * Scores one voice. Higher is better; `null` means "never use this one".
 *
 * `languages` is in order of preference — for this app, Hindi and Indian English
 * ahead of anything else, so Asha does not answer a Hindi sentence in a US accent.
 */
function score(voice: VoiceLike, languages: string[]): number | null {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase().replace("_", "-");

  const explicitlyFemale = matches(name, FEMALE_NAMES) || FEMALE_MARKERS.some((re) => re.test(name));

  // Refuse anything not recognisably female — known-male voices and unlabelled
  // ones alike. See the note at the top of the file.
  if (!explicitlyFemale) return null;

  // Both lists matching means a short entry in FEMALE_NAMES collided with a male
  // voice's name. The male list wins: a wrong refusal costs us the platform
  // default, a wrong acceptance costs us the bug this module exists to fix.
  if (matches(name, MALE_NAMES)) return null;

  let points = 100;

  // Language fit. An exact locale match is worth more than the bare language,
  // and position in `languages` breaks ties between two exact matches.
  const exact = languages.findIndex((candidate) => candidate.toLowerCase() === lang);
  if (exact !== -1) {
    points += 40 - exact * 5;
  } else {
    const prefix = languages.findIndex(
      (candidate) => lang.split("-")[0] === candidate.toLowerCase().split("-")[0],
    );
    if (prefix !== -1) points += 20 - prefix * 5;
  }

  return points;
}

/**
 * The best female voice for `languages`, or null when the list holds none.
 *
 * Null is a real answer, not a failure: the caller should then fall back to the
 * platform default rather than refuse to speak. Text on screen beats silence.
 */
export function pickFemaleVoice(
  voices: readonly VoiceLike[],
  languages: string[] = ["hi-IN", "en-IN", "en-GB", "en-US"],
): VoiceLike | null {
  let best: VoiceLike | null = null;
  let bestScore = -1;

  for (const voice of voices) {
    const points = score(voice, languages);
    // A voice with no name match and no language match tells us nothing; taking
    // it would be a coin flip on gender, so require some positive signal.
    if (points === null || points <= 0) continue;

    if (points > bestScore) {
      best = voice;
      bestScore = points;
    }
  }

  return best;
}
