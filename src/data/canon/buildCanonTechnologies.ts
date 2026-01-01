//src/data/canon/buildCanonTechnologies.ts
import type { CanonTechnology, CanonTechEffect, Age } from './canonTypes'

function toAge(x: any): Age | undefined {
  const n = Number(x)
  if (n === 1 || n === 2 || n === 3 || n === 4) return n
  return undefined
}

function norm(s: any) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

export function buildCanonTechnologies(rawTechs: any[]): CanonTechnology[] {
  if (!Array.isArray(rawTechs)) return []

  const out: CanonTechnology[] = []

  for (const rt of rawTechs) {
    if (!rt || typeof rt !== 'object') continue

    // Check if this is optimized format with variations
    const hasVariations = Array.isArray((rt as any).variations) && (rt as any).variations.length > 0

    if (hasVariations) {
      // Optimized format: expand each variation
      const baseData = rt
      for (const variation of (rt as any).variations) {
        const varId = String(variation.id ?? '')
        const varCivs = Array.isArray(variation.civs) ? variation.civs.map(String) : []

        // Merge: base tech data + variation specifics
        const id = varId
        const baseId = String(baseData.baseId ?? baseData.id ?? varId)
        const name = String(baseData.name ?? varId)
        const civs = varCivs
        const age = toAge(baseData.age)

        // Merge classes and displayClasses
        const rawClasses = Array.isArray(baseData.classes) ? baseData.classes.map(String) : []
        const rawDisplayClasses = Array.isArray(baseData.displayClasses)
          ? baseData.displayClasses.map(String)
          : []
        const classes = [...rawClasses, ...rawDisplayClasses].filter(Boolean)

        const pbRaw = baseData.producedBy
        const producedBy = Array.isArray(pbRaw)
          ? pbRaw.map(norm).filter(Boolean)
          : pbRaw
            ? [norm(pbRaw)].filter(Boolean)
            : undefined

        const rawEffects = Array.isArray(baseData.effects) ? baseData.effects : []
        const effects: CanonTechEffect[] = rawEffects.map((e: any) => ({
          type: String(e?.type ?? 'unknown'),
          raw: e,
        }))

        out.push({
          id,
          baseId,
          name,
          description: baseData.description,
          civs,
          age,
          classes,
          producedBy,
          effects,
        })
      }
    } else {
      // Legacy format: single tech
      const id = String((rt as any).id ?? '')
      const baseId = String((rt as any).baseId ?? id)
      const name = String((rt as any).name ?? id)

      const civs = Array.isArray((rt as any).civs) ? ((rt as any).civs as any[]).map(String) : []
      const age = toAge((rt as any).age)

      // Merge classes and displayClasses
      const rawClasses = Array.isArray((rt as any).classes)
        ? ((rt as any).classes as any[]).map(String)
        : []
      const rawDisplayClasses = Array.isArray((rt as any).displayClasses)
        ? ((rt as any).displayClasses as any[]).map(String)
        : []
      const classes = [...rawClasses, ...rawDisplayClasses].filter(Boolean)

      // ✅ producedBy passthrough (normalize)
      const pbRaw = (rt as any).producedBy
      const producedBy = Array.isArray(pbRaw)
        ? pbRaw.map(norm).filter(Boolean)
        : pbRaw
          ? [norm(pbRaw)].filter(Boolean)
          : undefined

      const rawEffects = Array.isArray((rt as any).effects) ? ((rt as any).effects as any[]) : []
      const effects: CanonTechEffect[] = rawEffects.map((e) => ({
        type: String((e as any)?.type ?? 'unknown'),
        raw: e,
      }))

      out.push({
        id,
        baseId,
        name,
        description: (rt as any).description,
        civs,
        age,
        classes,
        producedBy, // ✅
        effects,
      })
    }
  }

  return out
}
