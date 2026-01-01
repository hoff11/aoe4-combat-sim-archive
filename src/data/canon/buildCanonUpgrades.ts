import type { Age, CivId } from './canonTypes'

export type CanonUpgradeVariation = {
  id: string
  baseUpgradeId: string
  name: string
  civs: CivId[]
  age: Age
  // keep raw-ish payload for now so resolve can interpret tier deltas later
  raw: unknown
}

export type CanonUpgrade = {
  id: string
  name: string
  civs: CivId[]
  minAge: Age
  variations: CanonUpgradeVariation[]
}

function toAge(x: any): Age {
  const n = Number(x)
  if (n === 1 || n === 2 || n === 3 || n === 4) return n
  return 1
}

export function buildCanonUpgrades(rawUpgrades: any[]): CanonUpgrade[] {
  if (!Array.isArray(rawUpgrades)) return []

  const out: CanonUpgrade[] = []

  for (const ru of rawUpgrades) {
    if (!ru || typeof ru !== 'object') continue

    const id = String((ru as any).id ?? '')
    const name = String((ru as any).name ?? id)

    const civs = Array.isArray((ru as any).civs) ? ((ru as any).civs as any[]).map(String) : []
    const minAge = toAge((ru as any).minAge)

    const rawVars = Array.isArray((ru as any).variations) ? ((ru as any).variations as any[]) : []
    const variations: CanonUpgradeVariation[] = rawVars.map((rv, i) => {
      const varId = String((rv as any)?.id ?? `${id}#${i}`)
      const varName = String((rv as any)?.name ?? name)

      const varCivs = Array.isArray((rv as any)?.civs)
        ? ((rv as any).civs as any[]).map(String)
        : civs
      const varAge = toAge((rv as any)?.age ?? (ru as any).minAge)

      return {
        id: varId,
        baseUpgradeId: id,
        name: varName,
        civs: varCivs,
        age: varAge,
        raw: rv,
      }
    })

    out.push({ id, name, civs, minAge, variations })
  }

  return out
}
