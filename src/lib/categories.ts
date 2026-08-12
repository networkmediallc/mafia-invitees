export const CATEGORIES = [
  { key: "mafiaCrew", label: "Mafia Crew" },
  { key: "laMafia", label: "LA Mafia" },
  { key: "vegasMafia", label: "Vegas Mafia" },
  { key: "networkMedia", label: "Network Media" },
  { key: "staffFamily", label: "Staff/Family" },
  { key: "personal", label: "Personal" },
  { key: "mi", label: "MI" },
  { key: "laActor", label: "LA Actor" },
  { key: "industry", label: "Industry" },
  { key: "businessContact", label: "Business Contact" },
  { key: "magic", label: "Magic" },
  { key: "game", label: "Game" },
  { key: "fourSeasons", label: "4 Seasons" },
  { key: "journalist", label: "Journalist" },
  { key: "rando", label: "Rando" },
  { key: "outOfTown", label: "Out of Town" },
  { key: "formerPlayer", label: "Former Player" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

/** Tags dropped from the address book (not shown as categories). */
const DROPPED_GROUP_TAGS = new Set([
  "Mafia",
  "Los Angeles",
  "Creator",
  "Modified by Rick Lax",
]);

/** Exact Address Book Group Tag → category key */
export const GROUP_TAG_TO_CATEGORY: Record<string, CategoryKey> = {
  "LA Mafia": "laMafia",
  "Vegas Mafia": "vegasMafia",
  "Network Media": "networkMedia",
  "Staff/Family": "staffFamily",
  Personal: "personal",
  MI: "mi",
  "LA Actor": "laActor",
  Industry: "industry",
  "Business Contact": "businessContact",
  Magician: "magic",
  Magic: "magic",
  Game: "game",
  "4 Seasons": "fourSeasons",
  Journalist: "journalist",
  Rando: "rando",
  "Mafia Crew": "mafiaCrew",
};

/** Normalize raw Group Tag string: drop removed tags, merge Magician → Magic. */
export function normalizeGroupTags(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(";")) {
    let tag = part.trim();
    if (!tag) continue;
    if (DROPPED_GROUP_TAGS.has(tag)) continue;
    if (tag === "Magician") tag = "Magic";
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out.length ? out.join(";") : null;
}
