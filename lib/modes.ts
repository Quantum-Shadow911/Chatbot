export type ModeCategory = "reasoning" | "specialty";

export interface Mode {
  id: string;
  label: string;
  description: string;
  category: ModeCategory;
  prompt: string;
}

export const MODES: Mode[] = [
  {
    id: "auto",
    label: "Auto",
    description: "Picks the best style for each request",
    category: "reasoning",
    prompt: "",
  },
  {
    id: "think",
    label: "Think",
    description: "Reasons step by step, checks its work",
    category: "reasoning",
    prompt:
      "Use your full reasoning capability. Before answering, think extensively: break the problem into parts, explore multiple solution paths, work through the math or logic explicitly, test your reasoning against edge cases, look for flaws in your first attempt, and revise. Do not rush to an answer — depth and correctness matter more than speed. Then present a clean, well-organized final answer; keep the visible answer focused and put only the essential reasoning in it.",
  },
  {
    id: "research",
    label: "Research",
    description: "Deep, structured, thorough answers",
    category: "reasoning",
    prompt:
      "Provide deep, thorough, well-structured answers. Organize with headings and bullet points, cover relevant context, trade-offs, and nuances, compare alternatives where useful, and explicitly note when information may be uncertain, contested, or outdated.",
  },
  {
    id: "cooking",
    label: "Cooking",
    description: "Recipes, techniques, and meal help",
    category: "specialty",
    prompt:
      "You are an expert cooking assistant. Give clear recipes with ingredient lists including quantities, numbered step-by-step instructions, timings, and serving sizes. Offer practical tips, substitutions, and storage advice. When a request is ambiguous, briefly state your assumption and continue. Ask about dietary restrictions when it materially changes the answer.",
  },
  {
    id: "coding",
    label: "Coding",
    description: "Programming help with working code",
    category: "specialty",
    prompt:
      "You are an expert software engineering assistant. Provide correct, idiomatic code in fenced code blocks tagged with the language. Explain key decisions briefly, mention edge cases and error handling, and suggest how to test the result. Prefer complete, runnable examples over fragments.",
  },
  {
    id: "study",
    label: "Study",
    description: "Tutoring that builds understanding",
    category: "specialty",
    prompt:
      "You are a patient tutor. Explain concepts simply, building from fundamentals with concrete examples and analogies. Break complex topics into small steps. End with a short question or practice exercise so the user can check their understanding, unless they only asked for a quick fact.",
  },
  {
    id: "travel",
    label: "Travel",
    description: "Trips, itineraries, and logistics",
    category: "specialty",
    prompt:
      "You are a knowledgeable travel assistant. Give practical itineraries with rough timings, costs, and logistics. Consider season, budget, and pace, and include local tips. Flag when prices, schedules, or entry requirements should be verified before booking.",
  },
  {
    id: "fitness",
    label: "Fitness",
    description: "Training plans and healthy habits",
    category: "specialty",
    prompt:
      "You are a safe, encouraging fitness assistant. Give structured plans with sets, reps, or durations, plus progressions and form cues. Include brief safety notes and modifications for different levels. Recommend consulting a professional for injuries, pain, or medical conditions.",
  },
];

const MODE_PATTERN = new RegExp(`^(${MODES.map((m) => m.id).join("|")})$`);

export function isModeId(value: unknown): value is string {
  return typeof value === "string" && MODE_PATTERN.test(value);
}

export function getMode(id: string | null | undefined): Mode {
  return MODES.find((mode) => mode.id === id) ?? MODES[0];
}

const AUTO_PATTERNS: [RegExp, string][] = [
  [
    /\b(recipe|recipes|cook|cooking|bake|baking|ingredient|ingredients|dinner|lunch|breakfast|meal|vegetarian|vegan|kitchen|seasoning|marinade)\b/i,
    "cooking",
  ],
  [
    /\b(code|coding|bug|debug|debugging|javascript|typescript|python|react|css|html|sql|regex|api|compile|compiler|programming|refactor)\b/i,
    "coding",
  ],
  [
    /\b(homework|exam|exams|revise|revision|flashcards|quiz|essay|thesis|studying|study for|test prep)\b/i,
    "study",
  ],
  [
    /\b(travel|trip|itinerary|flight|flights|hotel|hostel|vacation|holiday|tourist|sightseeing|visa|backpacking)\b/i,
    "travel",
  ],
  [
    /\b(workout|workouts|gym|fitness|exercise|training plan|calories|muscle|strength training|weight loss)\b/i,
    "fitness",
  ],
];

export function detectModeId(text: string): string {
  for (const [pattern, id] of AUTO_PATTERNS) {
    if (pattern.test(text)) return id;
  }
  return "auto";
}
