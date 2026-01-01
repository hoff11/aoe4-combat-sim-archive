import { describe, it, expect } from 'vitest'
import { runSim } from '../sim'
import type { SimTeamInput, SimOptions } from '../types'

// Helper to create sim options with custom scenario params
const createOptions = (
  distance: number,
  openness: number = 0.5,
  kitingEnabled: boolean = false,
  coverage: number = 0.5,
): SimOptions => ({
  maxSeconds: 120,
  tickInterval: 0.1,
  scenario: 'Custom',
  scenarioParams: {
    preset: 'Custom',
    startingDistance: distance,
    opennessFactor: openness,
    kitingEnabled,
    auraCoverage: coverage,
  },
})

// Common scenarios
const SKIRMISH = createOptions(20, 0.5, false, 0.5)
const OPEN_FIELD_KITE = createOptions(30, 0.8, true, 0.3)

// Unit helper factories
const createSpearman = (count: number): SimTeamInput => ({
  units: [
    {
      unitId: 'spearman',
      count,
      types: ['infantry', 'melee'],
      stats: {
        hitpoints: 70,
        armorMelee: 0,
        armorRanged: 0,
        weapons: [
          {
            damageType: 'Melee' as const,
            isRanged: false,
            damageMin: 7,
            damageMax: 8,
            attackPeriod: 1.88,
            rangeMin: 0,
            rangeMax: 0.35,
          },
        ],
        movement: { speed: 1.125 },
      },
      combatMods: { effects: [] },
    },
  ],
  teamCombatMods: { effects: [] },
  enableCounters: false,
})

const createMenAtArms = (count: number): SimTeamInput => ({
  units: [
    {
      unitId: 'man-at-arms',
      count,
      types: ['infantry', 'melee', 'heavy'],
      stats: {
        hitpoints: 130,
        armorMelee: 3,
        armorRanged: 3,
        weapons: [
          {
            damageType: 'Melee' as const,
            isRanged: false,
            damageMin: 10,
            damageMax: 11,
            attackPeriod: 1.5,
            rangeMin: 0,
            rangeMax: 0.35,
          },
        ],
        movement: { speed: 1.0 },
      },
      combatMods: { effects: [] },
    },
  ],
  teamCombatMods: { effects: [] },
  enableCounters: false,
})

const createArcher = (count: number): SimTeamInput => ({
  units: [
    {
      unitId: 'archer',
      count,
      types: ['ranged', 'infantry'],
      stats: {
        hitpoints: 60,
        armorMelee: 0,
        armorRanged: 0,
        weapons: [
          {
            damageType: 'Ranged' as const,
            isRanged: true,
            damageMin: 5,
            damageMax: 6,
            attackPeriod: 1.5,
            rangeMin: 0,
            rangeMax: 5.5,
          },
        ],
        movement: { speed: 1.375 },
      },
      combatMods: { effects: [] },
    },
  ],
  teamCombatMods: { effects: [] },
  enableCounters: false,
})

// Hybrid archetype (Desert Raider-like): melee primary + ranged sidearm
// weapons[0] = melee, weapons[1] = ranged
const createHybrid = (
  count: number,
  sustainedWeaponIndex: number,
  volleyWeaponIndex: number,
): SimTeamInput => ({
  units: [
    {
      unitId: 'hybrid-raider',
      count,
      types: ['cavalry', 'hybrid'],
      stats: {
        hitpoints: 135,
        armorMelee: 1,
        armorRanged: 1,
        weapons: [
          {
            damageType: 'Melee' as const,
            isRanged: false,
            damageMin: 10,
            damageMax: 12,
            attackPeriod: 1.6,
            rangeMin: 0,
            rangeMax: 0.35,
          },
          {
            damageType: 'Ranged' as const,
            isRanged: true,
            damageMin: 6,
            damageMax: 7,
            attackPeriod: 1.5,
            rangeMin: 0,
            rangeMax: 4.5,
          },
        ],
        movement: { speed: 1.625 },
      },
      combatMods: { effects: [] },
      sustainedWeaponIndex,
      volleyWeaponIndex,
    },
  ],
  teamCombatMods: { effects: [] },
  enableCounters: false,
})

// Helper to create mixed armies
const createMixedArmy = (...armies: SimTeamInput[]): SimTeamInput => {
  const allUnits = armies.flatMap((a) => a.units)
  return {
    units: allUnits,
    teamCombatMods: { effects: [] },
    enableCounters: false,
  }
}

describe('Range & Movement — Hybrid & Mixed Focus', () => {
  describe('B5. Volley uses ranged weapon for hybrids', () => {
    it('Hybrid with melee primary still volleys with ranged sidearm', () => {
      // Hybrid: sustained = melee (0), volley = ranged (1)
      const hybridMeleePrimary = createHybrid(10, 0, 1)
      const maa = createMenAtArms(10)

      const result = runSim(hybridMeleePrimary, maa, SKIRMISH)

      // Expect a pre-contact ranged exchange from hybrids
      expect(result.preContactAttacksA).toBeGreaterThan(0)
      expect(result.preContactDamageA).toBeGreaterThan(0)
      expect(result.contactMade).toBe(true)
    })
  })

  describe('D1. Sustained uses primary selection; volley identical across primaries', () => {
    it('Hybrid melee-primary vs ranged-primary: same volley, different sustained', () => {
      const hybridMeleePrimary = createHybrid(10, 0, 1)
      const hybridRangedPrimary = createHybrid(10, 1, 1)
      const maa = createMenAtArms(12)

      const meleePrimary = runSim(hybridMeleePrimary, maa, SKIRMISH)
      const rangedPrimary = runSim(hybridRangedPrimary, maa, SKIRMISH)

      // Volley should be identical (same volley weapon index)
      expect(meleePrimary.preContactAttacksA).toBe(rangedPrimary.preContactAttacksA)
      expect(meleePrimary.preContactDamageA).toBe(rangedPrimary.preContactDamageA)

      // Sustained phase differs because primary weapon differs
      // Accept differences in any of several sustained metrics
      const sustainedDiffers =
        meleePrimary.totalDmgDoneA !== rangedPrimary.totalDmgDoneA ||
        meleePrimary.totalDmgDoneB !== rangedPrimary.totalDmgDoneB ||
        meleePrimary.survivorsA !== rangedPrimary.survivorsA ||
        meleePrimary.survivorsB !== rangedPrimary.survivorsB ||
        meleePrimary.seconds !== rangedPrimary.seconds ||
        meleePrimary.winner !== rangedPrimary.winner
      expect(sustainedDiffers).toBe(true)
    })
  })

  describe('D2. Sustained phase executed marker', () => {
    it('sets sustainedPhaseExecuted=true when contactMade=true', () => {
      const hybrid = createHybrid(10, 0, 1)
      const maa = createMenAtArms(10)
      const result = runSim(hybrid, maa, SKIRMISH)

      expect(result.contactMade).toBe(true)
      expect(result.sustainedPhaseExecuted).toBe(true)
    })

    it('sets sustainedPhaseExecuted=false when contactMade=false (no-contact kiting)', () => {
      // Pure ranged fast vs pure melee slow in open field with kiting on
      const archers = createArcher(10)
      const maa = createMenAtArms(10)
      const result = runSim(archers, maa, OPEN_FIELD_KITE)

      if (!result.contactMade) {
        expect(result.sustainedPhaseExecuted).toBe(false)
      } else {
        // If this matchup contacts due to parameters, still validate field
        expect(result.sustainedPhaseExecuted).toBe(true)
      }
    })
  })

  describe('F1. Report contains core fields (engine shape)', () => {
    it('has preset, contact, volley fields, and kiting flags', () => {
      const hybrid = createHybrid(6, 0, 1)
      const maa = createMenAtArms(6)
      const result = runSim(hybrid, maa, SKIRMISH)

      expect(result.scenarioPreset).toBeDefined()
      expect(result.contactMade).toBeTypeOf('boolean')
      expect(result.preContactAttacksA).toBeGreaterThanOrEqual(0)
      expect(result.preContactAttacksB).toBeGreaterThanOrEqual(0)
      expect(result.preContactDamageA).toBeGreaterThanOrEqual(0)
      expect(result.preContactDamageB).toBeGreaterThanOrEqual(0)
      expect(typeof result.scenarioExplanation).toBe('string')
      // Kiting flags are optional; ensure presence when relevant fields exist
      expect(result.kitingEligible).toBeTypeOf('boolean')
    })
  })

  describe('E. Mixed armies behavior', () => {
    it('C1. Kiting eligible for pure ranged vs pure melee', () => {
      const archers = createArcher(10)
      const spears = createSpearman(10)
      const opts = createOptions(25, 0.7, true, 0.4)

      const result = runSim(archers, spears, opts)

      expect(result.kitingEligible).toBe(true)
    })

    it('E1. Mixed vs melee-only: kiting ENABLED (has ranged), contact depends on movement', () => {
      const mixed = createMixedArmy(createArcher(5), createSpearman(5))
      const maa = createMenAtArms(10)
      const opts = createOptions(20, 0.6, true, 0.4)

      const result = runSim(mixed, maa, opts)

      // Mixed army HAS ranged, enemy has NO ranged → kiting eligible
      expect(result.kitingEligible).toBe(true)
      // Contact may or may not happen depending on speeds and distance
      expect(result.preContactDamageA).toBeGreaterThan(0)
    })

    it('E2. Mixed vs mixed: contact true, kiting ineligible', () => {
      const sideA = createMixedArmy(createArcher(6), createMenAtArms(4))
      const sideB = createMixedArmy(createArcher(6), createSpearman(4))
      const opts = createOptions(20, 0.6, true, 0.4)

      const result = runSim(sideA, sideB, opts)

      expect(result.contactMade).toBe(true)
      expect(result.kitingEligible).toBe(false)
      // Both sides have some ranged; pre-contact could be two-sided
      expect(result.preContactDamageA + result.preContactDamageB).toBeGreaterThan(0)
    })
  })

  describe('B7. Volley invariants', () => {
    it('Non-negative volley fields and time ordering when contact', () => {
      const hybrid = createHybrid(8, 0, 1)
      const maa = createMenAtArms(8)
      const result = runSim(hybrid, maa, SKIRMISH)

      expect(result.preContactAttacksA).toBeGreaterThanOrEqual(0)
      expect(result.preContactDamageA).toBeGreaterThanOrEqual(0)
      expect(result.preContactAttacksB).toBeGreaterThanOrEqual(0)
      expect(result.preContactDamageB).toBeGreaterThanOrEqual(0)

      if (result.contactMade) {
        expect(result.timeToContact).not.toBeNull()
        expect(result.seconds).toBeGreaterThanOrEqual(result.timeToContact || 0)
      }
    })
  })
})
