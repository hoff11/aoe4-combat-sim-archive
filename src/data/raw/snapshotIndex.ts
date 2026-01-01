// src/data/raw/snapshotIndex.ts
export type SnapshotVersion = string

function parseVersion(path: string) {
  // "../snapshots/15.2.7445.0/units.json"
  const m = path.match(/snapshots\/([^/]+)\//)
  return m?.[1] ?? 'unknown'
}

function toMap(mods: Record<string, unknown>) {
  const out = new Map<SnapshotVersion, any>()
  for (const [path, mod] of Object.entries(mods)) {
    const version = parseVersion(path)
    const json = (mod as any).default ?? mod
    out.set(version, json)
  }
  return out
}

const unitMods = import.meta.glob('../snapshots/*/units-all-optimized.json', { eager: true })
const techMods = import.meta.glob('../snapshots/*/technologies-all-optimized.json', { eager: true })
const upgMods = import.meta.glob('../snapshots/*/upgrades-all-optimized.json', { eager: true })
const abilityMods = import.meta.glob('../snapshots/*/abilities.json', { eager: true })

export const SNAPSHOT_UNITS = toMap(unitMods)
export const SNAPSHOT_TECHS = toMap(techMods)
export const SNAPSHOT_UPGRADES = toMap(upgMods)
export const SNAPSHOT_ABILITIES = toMap(abilityMods)

export function listSnapshotVersions(): SnapshotVersion[] {
  const set = new Set<string>()
  for (const m of [SNAPSHOT_UNITS, SNAPSHOT_TECHS, SNAPSHOT_UPGRADES, SNAPSHOT_ABILITIES]) {
    for (const v of m.keys()) set.add(v)
  }
  return [...set].filter((v) => v !== 'unknown').sort()
}
