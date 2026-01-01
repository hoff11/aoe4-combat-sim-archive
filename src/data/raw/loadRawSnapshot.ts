// src/data/raw/loadRawSnapshot.ts
import {
  listSnapshotVersions,
  SNAPSHOT_TECHS,
  SNAPSHOT_UNITS,
  SNAPSHOT_UPGRADES,
  SNAPSHOT_ABILITIES,
} from './snapshotIndex'
import type { RawEnvelope, RawTechnology, RawUnit, RawUpgrade, RawAbility } from './rawTypes'

export type RawSnapshot = {
  version: string
  units: RawEnvelope<RawUnit>
  technologies: RawEnvelope<RawTechnology>
  upgrades: RawEnvelope<RawUpgrade>
  abilities: RawEnvelope<RawAbility>
}

export function loadRawSnapshot(version?: string): RawSnapshot {
  const versions = listSnapshotVersions()
  const v = version ?? versions[versions.length - 1]
  if (!v) throw new Error('No snapshots found under src/data/snapshots/*')

  const units = SNAPSHOT_UNITS.get(v) as RawEnvelope<RawUnit> | undefined
  const technologies = SNAPSHOT_TECHS.get(v) as RawEnvelope<RawTechnology> | undefined
  const upgrades = SNAPSHOT_UPGRADES.get(v) as RawEnvelope<RawUpgrade> | undefined
  const abilities = SNAPSHOT_ABILITIES.get(v) as RawEnvelope<RawAbility> | undefined

  if (!units?.data) throw new Error(`Missing/invalid units.json for snapshot ${v}`)
  if (!technologies?.data) throw new Error(`Missing/invalid technologies.json for snapshot ${v}`)
  if (!upgrades?.data) throw new Error(`Missing/invalid upgrades.json for snapshot ${v}`)

  // Abilities are optional - fallback to empty if not found
  const finalAbilities: RawEnvelope<RawAbility> = abilities?.data ? abilities : { data: [] }

  return { version: v, units, technologies, upgrades, abilities: finalAbilities }
}
