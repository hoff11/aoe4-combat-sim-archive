// src/data/raw/loadRawAbilities.node.ts
declare const require: any
const fs: any = require('node:fs')
const path: any = require('node:path')

type RawEnvelope<T> = { __note__?: string; __version__?: string; data: T[] }

/**
 * Load abilities JSON.
 * Prefer bundled snapshot: src/data/snapshots/<version>/abilities.json
 * Fallback to external aoe4-game-data if not present.
 */
export function loadRawAbilitiesNode(version: string = '15.2.7445.0') {
  const internalPath = path.join(
    (globalThis as any).process?.cwd?.() ?? '',
    'src',
    'data',
    'snapshots',
    version,
    'abilities.json',
  )

  let abilities: RawEnvelope<any> | null = null

  if (fs.existsSync(internalPath)) {
    abilities = JSON.parse(fs.readFileSync(internalPath, 'utf8')) as RawEnvelope<any>
  } else {
    const externalPath =
      process.env.AOE4_DATA_PATH ??
      path.join(
        (globalThis as any).process?.cwd?.() ?? '',
        '..',
        'aoe4-game-data',
        `data_v${version}`,
      )
    const abilitiesPath = path.join(externalPath, 'abilities', 'all.json')
    if (fs.existsSync(abilitiesPath)) {
      abilities = JSON.parse(fs.readFileSync(abilitiesPath, 'utf8')) as RawEnvelope<any>
    }
  }

  if (!abilities || !Array.isArray(abilities?.data)) {
    console.warn(`[loadRawAbilities] abilities not found/invalid for ${version}, using empty array`)
    return { version, abilities: { data: [] } }
  }

  return { version, abilities }
}
