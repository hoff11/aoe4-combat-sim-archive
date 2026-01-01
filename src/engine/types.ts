// src/engine/types.ts
// Minimal engine types — focus on combat simulation only.
// Unit data (variations, stats, combat mods) comes pre-resolved from resolve layer.

import type { TeamCombatMods } from '../data/resolve/combatModsTypes'

export type TeamId = 'A' | 'B'

export type DamageType = 'Melee' | 'Ranged' | 'Fire' | 'True' | 'Siege' | 'Magic' | 'Other'

export type Weapon = {
  damageType: DamageType
  isRanged: boolean
  damageMin: number
  damageMax: number
  attackPeriod: number
  rangeMin: number
  rangeMax: number
  name?: string
  rawType?: string
  isSpearwall?: boolean
  stunDuration?: number // Duration in seconds for Spearwall stun (optional)
}

export type CombatStats = {
  hitpoints: number
  armorMelee: number
  armorRanged: number
  weapons: readonly Weapon[]
  movement?: { speed: number }
}

/**
 * Snapshot of team state for simulation.
 * Built directly from ResolvedSimTeam + unit variations.
 */
export type SimTeamInput = {
  units: Array<{
    unitId: string
    count: number
    stats: CombatStats
    types: readonly string[]
    combatMods: TeamCombatMods
    // Optional explicit weapon selectors (indices into stats.weapons)
    // - sustainedWeaponIndex: weapon used in sustained phase (post-contact)
    // - volleyWeaponIndex: weapon used during approach/volley (should be ranged)
    sustainedWeaponIndex?: number
    volleyWeaponIndex?: number
  }>
  teamCombatMods: TeamCombatMods
  enableCounters: boolean
}

export type TimelinePoint = {
  t: number
  aliveA: number
  aliveB: number
  hpA: number
  hpB: number
}

export type AuraTrackingInfo = {
  abilityId: string
  abilityName: string
  sourceTeam: 'A' | 'B'
  targetTeam: 'A' | 'B'
  targetClasses: readonly string[]
  averageUptime: number // 0-1, fraction of fight duration aura source was alive
  coverage: number // From scenario preset
  effectMagnitude: number // 0.8 for -20% damage
  estimatedImpact: string // Human-readable like "-16% enemy cavalry damage"
}

export type SimResult = {
  winner: TeamId | 'Draw'
  seconds: number
  survivorsA: number
  survivorsB: number
  totalDmgDoneA: number
  totalDmgDoneB: number
  overkillA: number // Wasted damage on already-dead units
  overkillB: number
  activeAuras: AuraTrackingInfo[]
  scenarioPreset: ScenarioPreset
  timeline: TimelinePoint[]

  // Bucket B: Opening Volley & Kiting
  contactMade: boolean // Did melee reach ranged, or did kiting prevent contact?
  timeToContact: number | null // Seconds until melee reaches ranged (null if no contact)
  preContactDamageA: number // Damage dealt by Team A before contact
  preContactDamageB: number // Damage dealt by Team B before contact
  preContactAttacksA: number // Number of ranged attacks before contact
  preContactAttacksB: number // Number of ranged attacks before contact
  scenarioExplanation: string // Human-readable explanation of scenario outcome
  // Hybrid/kiting reporting
  kitingEligible?: boolean
  kitingReason?: string
  sustainedPhaseExecuted?: boolean

  // Special mechanic reporting
  spearwallUsed?: boolean
  bonusDamage?: {
    teamA?: Array<{ unitType: string; targetClass: string; totalBonus: number }>
    teamB?: Array<{ unitType: string; targetClass: string; totalBonus: number }>
  }
}

export type SimOptions = {
  seed?: number
  maxSeconds: number
  tickInterval: number
  scenario?: ScenarioPreset
  scenarioParams?: ScenarioParams // Optional override for custom scenarios
}

/**
 * Scenario preset defining tactical engagement conditions.
 * Controls coverage, kiting, and opening volley calculations for Bucket A/B effects.
 */
export type ScenarioPreset = 'Engaged' | 'Skirmish' | 'OpenField' | 'Custom'

/**
 * Scenario parameters derived from preset choice.
 */
export type ScenarioParams = {
  preset: ScenarioPreset
  startingDistance: number // Tiles between armies (affects opening volley)
  opennessFactor: number // 0-1, affects aura coverage and charge effectiveness
  kitingEnabled: boolean // Whether ranged can kite melee
  auraCoverage: number // Expected % of units in aura range (0-1)
}

/**
 * Get scenario parameters for a given preset.
 */
export function getScenarioParams(preset: ScenarioPreset = 'Engaged'): ScenarioParams {
  switch (preset) {
    case 'Engaged':
      return {
        preset: 'Engaged',
        startingDistance: 5,
        opennessFactor: 0.2,
        kitingEnabled: false,
        auraCoverage: 0.8, // Tight blob, most units in range
      }
    case 'Skirmish':
      return {
        preset: 'Skirmish',
        startingDistance: 20,
        opennessFactor: 0.5,
        kitingEnabled: false,
        auraCoverage: 0.5, // Mixed formation
      }
    case 'OpenField':
      return {
        preset: 'OpenField',
        startingDistance: 40,
        opennessFactor: 0.8,
        kitingEnabled: true,
        auraCoverage: 0.3, // Spread out, only front line in range
      }
    case 'Custom':
      // Default to Skirmish values, user can override
      return {
        preset: 'Custom',
        startingDistance: 20,
        opennessFactor: 0.5,
        kitingEnabled: false,
        auraCoverage: 0.5,
      }
  }
}
