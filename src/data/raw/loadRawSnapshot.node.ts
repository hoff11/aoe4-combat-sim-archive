declare const require: any
const fs: any = require('node:fs')
const path: any = require('node:path')

type RawEnvelope<T> = { __note__?: string; __version__?: string; data: T[] }

export function listSnapshotVersionsNode(): string[] {
  const dir = path.join((globalThis as any).process?.cwd?.() ?? '', 'src', 'data', 'snapshots')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d: any) => d.isDirectory())
    .map((d: any) => d.name)
    .sort()
}

export function loadRawSnapshotNode(version?: string) {
  const versions = listSnapshotVersionsNode()
  const v = version ?? versions[versions.length - 1]
  if (!v) throw new Error('No snapshots found under src/data/snapshots/*')

  const base = path.join((globalThis as any).process?.cwd?.() ?? '', 'src', 'data', 'snapshots', v)

  const units = JSON.parse(
    fs.readFileSync(path.join(base, 'units.json'), 'utf8'),
  ) as RawEnvelope<any>
  const technologies = JSON.parse(
    fs.readFileSync(path.join(base, 'technologies.json'), 'utf8'),
  ) as RawEnvelope<any>
  const upgrades = JSON.parse(
    fs.readFileSync(path.join(base, 'upgrades.json'), 'utf8'),
  ) as RawEnvelope<any>

  if (!Array.isArray(units?.data)) throw new Error(`Invalid units.json in ${v}`)
  if (!Array.isArray(technologies?.data)) throw new Error(`Invalid technologies.json in ${v}`)
  if (!Array.isArray(upgrades?.data)) throw new Error(`Invalid upgrades.json in ${v}`)

  // Prefer bundled snapshot abilities.json; fallback to external aoe4-game-data
  let abilities: RawEnvelope<any> = { data: [] }
  const internalAbilitiesPath = path.join(base, 'abilities.json')
  if (fs.existsSync(internalAbilitiesPath)) {
    abilities = JSON.parse(fs.readFileSync(internalAbilitiesPath, 'utf8')) as RawEnvelope<any>
    if (!Array.isArray(abilities?.data)) {
      console.warn(`Invalid abilities.json in snapshot ${v}, using empty array`)
      abilities = { data: [] }
    }
  } else {
    const externalPath =
      process.env.AOE4_DATA_PATH ??
      path.join((globalThis as any).process?.cwd?.() ?? '', '..', 'aoe4-game-data', `data_v${v}`)
    const abilitiesPath = path.join(externalPath, 'abilities', 'all.json')
    if (fs.existsSync(abilitiesPath)) {
      abilities = JSON.parse(fs.readFileSync(abilitiesPath, 'utf8')) as RawEnvelope<any>
      if (!Array.isArray(abilities?.data)) {
        console.warn(`Invalid abilities.json in ${v}, using empty array`)
        abilities = { data: [] }
      }
    } else {
      console.warn(
        `Abilities not found at ${internalAbilitiesPath} or ${abilitiesPath}, using empty array`,
      )
    }
  }

  return { version: v, units, technologies, upgrades, abilities }
}
