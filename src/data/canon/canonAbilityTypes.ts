// src/data/canon/canonAbilityTypes.ts
// Canon ability types - parsed from game-data abilities

import type { CivCode } from './civs'

/**
 * When the ability is active.
 * - "always": Passive aura, always on
 * - "manual": Player activated
 * - "toggled": Can be turned on/off
 * - "conditional": Activated under specific conditions
 */
export type AbilityActivation = 'always' | 'manual' | 'toggled' | 'conditional'

/**
 * Raw ability effect from game data.
 * Note: Many effects have "unknown" property with value 0,
 * so we extract actual effect from description text.
 */
export type RawAbilityEffect = {
  property: string
  select?: {
    id?: string[]
    class?: string[][]
  }
  effect: string
  value: number
  type: string
}

/**
 * Parsed ability effect - extracted from description and raw data.
 */
export type AbilityEffect = {
  /** What this ability affects: damage, armor, speed, etc. */
  stat: 'damage' | 'armor' | 'speed' | 'range' | 'hp' | 'unknown'

  /** Operation: multiply damage, add armor, etc. */
  op: 'mul' | 'add'

  /** Numeric value (e.g., 0.8 for -20%, 2 for +2) */
  value: number

  /** Who gets affected (friendly units near this unit) */
  affectsAllies?: string[] // Unit IDs or classes

  /** Who gets debuffed (enemy units near this unit) */
  affectsEnemies?: string[] // Unit IDs or classes
}

/**
 * Canon ability - combat-relevant abilities only.
 * Focus on passive auras and toggleable combat stances.
 */
export type CanonAbility = {
  /** Ability ID (e.g., "ability-camel-unease") */
  id: string

  /** Base ID without age suffix */
  baseId: string

  /** Display name */
  name: string

  /** Which civs have access to this ability */
  civs: CivCode[]

  /** Minimum age this ability is available */
  minAge: number

  /** When this ability is active */
  activation: AbilityActivation

  /** Range in tiles (0 = self, >0 = aura radius) */
  auraRange: number

  /** Cooldown in seconds (for manual abilities) */
  cooldown?: number

  /** Human-readable description */
  description: string

  /** Icon URL */
  icon: string

  /** Units that have this ability intrinsically */
  activatedOn: string[] // Unit IDs like "camel-rider", "desert-raider"

  /** Technologies that unlock this ability */
  unlockedBy: string[] // Tech IDs

  /** Parsed combat effects */
  effects: AbilityEffect[]

  /** Raw effects from game data (for reference) */
  rawEffects: RawAbilityEffect[]
}

/**
 * Collection of canon abilities indexed by base ID.
 */
export type CanonAbilities = {
  byId: Map<string, CanonAbility>
  byUnit: Map<string, CanonAbility[]> // Quick lookup: which abilities does this unit have?
}
