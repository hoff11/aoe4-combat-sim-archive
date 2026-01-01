// Canonical AoE4 civilization metadata for the new UI (pulled from the old UI)
export const CIV_MAP: Record<string, string> = {
  ab: 'Abbasid Dynasty',
  ay: 'Ayyubids',
  by: 'Byzantines',
  ch: 'Chinese',
  de: 'Delhi Sultanate',
  en: 'English',
  fr: 'French',
  gol: 'Golden Horde',
  hl: 'House of Lancaster',
  hr: 'Holy Roman Empire',
  je: "Jeanne d'Arc",
  ja: 'Japanese',
  mac: 'Macedonian Dynasty',
  ma: 'Malians',
  mo: 'Mongols',
  od: 'Order of the Dragon',
  ot: 'Ottomans',
  ru: "Rus'",
  sen: 'Sengoku Daimyo',
  kt: 'The Knights Templar',
  tug: 'Tughlag Dynasty',
  zx: "Zhu Xi's Legacy",
}

// Aliases observed in parsed data/folders
export const CIV_ALIASES: Record<string, string> = {
  ja: 'Japanese', // data shows "ja"
  la: 'House of Lancaster', // alternate code
  jd: "Jeanne d'Arc", // in case you see "jd"
  sg: 'Sengoku Daimyo', // old code
  te: 'The Knights Templar', // old code
  zh: "Zhu Xi's Legacy", // old code
}

// Civ codes that should never appear in UI
const CIV_IGNORED = new Set([
  // 'hl' is now House of Lancaster, no longer ignored
])

// Returns a clean name or null if unknown
export function civDisplayName(code: string): string | null {
  if (CIV_IGNORED.has(code)) return null
  return CIV_MAP[code] ?? CIV_ALIASES[code] ?? null
}

// Safe display helper: returns a human name if known, otherwise the raw code
export function civDisplayNameOrCode(code: string): string {
  if (CIV_IGNORED.has(code)) return code
  return CIV_MAP[code] ?? CIV_ALIASES[code] ?? code
}

// Prebuilt civ options (unique names, canonical codes preferred; aliases fill gaps)
export const CIV_OPTIONS: { code: string; name: string }[] = (() => {
  const seenNames = new Set<string>()
  const opts: { code: string; name: string }[] = []

  const add = (code: string) => {
    const name = civDisplayName(code)
    if (!name) return
    if (seenNames.has(name)) return
    seenNames.add(name)
    opts.push({ code, name })
  }

  Object.keys(CIV_MAP).forEach(add)
  Object.keys(CIV_ALIASES).forEach(add)

  return opts.sort((a, b) => a.name.localeCompare(b.name))
})()
