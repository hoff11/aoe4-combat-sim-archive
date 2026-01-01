// Core Phase B tests - focused subset to validate opening volley & kiting
import { describe, it, expect } from 'vitest'
import { runSim } from '../sim'
import type { SimTeamInput, SimOptions } from '../types'

// Helper to create sim options with custom scenario params
const createOptions = (
  distance: number,
  openness: number = 0.2,
  kitingEnabled: boolean = false,
  coverage: number = 0.8,
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
const ENGAGED = createOptions(0, 0.2, false, 0.8)
const SKIRMISH = createOptions(20, 0.5, false, 0.5)
const OPEN_FIELD = createOptions(40, 0.8, true, 0.3)

// Unit helper factories
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

const createHorseman = (count: number): SimTeamInput => ({
  units: [
    {
      unitId: 'horseman',
      count,
      types: ['cavalry', 'melee'],
      stats: {
        hitpoints: 125,
        armorMelee: 2,
        armorRanged: 2,
        weapons: [
          {
            damageType: 'Melee' as const,
            isRanged: false,
            damageMin: 10,
            damageMax: 12,
            attackPeriod: 1.625,
            rangeMin: 0,
            rangeMax: 0.35,
          },
        ],
        movement: { speed: 1.875 },
      },
      combatMods: { effects: [] },
    },
  ],
  teamCombatMods: { effects: [] },
  enableCounters: false,
})

const createMangudai = (count: number): SimTeamInput => ({
  units: [
    {
      unitId: 'mangudai',
      count,
      types: ['cavalry', 'ranged'],
      stats: {
        hitpoints: 110,
        armorMelee: 0,
        armorRanged: 1,
        weapons: [
          {
            damageType: 'Ranged' as const,
            isRanged: true,
            damageMin: 6,
            damageMax: 7,
            attackPeriod: 1.38,
            rangeMin: 0,
            rangeMax: 5.5,
          },
        ],
        movement: { speed: 1.875 },
      },
      combatMods: { effects: [] },
    },
  ],
  teamCombatMods: { effects: [] },
  enableCounters: false,
})

describe('Range & Movement - Core Tests', () => {
  describe('A. Backward Compatibility', () => {
    it('Engaged scenario has no opening volley (Archers vs Spearmen)', () => {
      const result = runSim(createArcher(10), createSpearman(10), ENGAGED)

      expect(result.preContactDamageA).toBe(0)
      expect(result.preContactDamageB).toBe(0)
      expect(result.contactMade).toBe(true)
      expect(result.timeToContact).toBe(0)
    })

    it('Determinism: same inputs produce identical outputs', () => {
      const result1 = runSim(createArcher(10), createMenAtArms(10), SKIRMISH)
      const result2 = runSim(createArcher(10), createMenAtArms(10), SKIRMISH)

      expect(result1.winner).toBe(result2.winner)
      expect(result1.timeToContact).toBe(result2.timeToContact)
      expect(result1.preContactDamageA).toBe(result2.preContactDamageA)
      expect(result1.seconds).toBe(result2.seconds)
    })
  })

  describe('B. Time-to-Contact', () => {
    it('Distance up → contact time up', () => {
      const engaged = runSim(createHorseman(10), createArcher(10), ENGAGED)
      const skirmish = runSim(createHorseman(10), createArcher(10), SKIRMISH)
      const openField = runSim(createHorseman(10), createArcher(10), createOptions(40, 0.8, false)) // Kiting OFF

      expect(engaged.timeToContact).toBe(0)
      expect(skirmish.timeToContact!).toBeGreaterThan(0)
      expect(openField.timeToContact!).toBeGreaterThan(skirmish.timeToContact!)
    })

    it('Faster melee closes sooner (Horseman vs Men-at-Arms)', () => {
      const fastMelee = runSim(createHorseman(10), createArcher(10), SKIRMISH)
      const slowMelee = runSim(createMenAtArms(10), createArcher(10), SKIRMISH)

      expect(fastMelee.timeToContact).toBeLessThan(slowMelee.timeToContact!)
    })
  })

  describe('C. Opening Volley', () => {
    it('Opening volley scales with distance (Archers vs Spearmen)', () => {
      const engaged = runSim(createArcher(10), createSpearman(10), ENGAGED)
      const skirmish = runSim(createArcher(10), createSpearman(10), SKIRMISH)
      const openField = runSim(createArcher(10), createSpearman(10), OPEN_FIELD)

      expect(engaged.preContactDamageA).toBe(0)
      expect(skirmish.preContactDamageA).toBeGreaterThan(0)
      expect(openField.preContactDamageA).toBeGreaterThan(skirmish.preContactDamageA)
    })

    it('No opening volley when melee vs melee', () => {
      const result = runSim(createMenAtArms(10), createSpearman(10), SKIRMISH)

      expect(result.preContactAttacksA).toBe(0)
      expect(result.preContactAttacksB).toBe(0)
      expect(result.preContactDamageA).toBe(0)
      expect(result.preContactDamageB).toBe(0)
    })

    it('Both sides ranged produces ranged exchange', () => {
      const result = runSim(createArcher(10), createArcher(10), SKIRMISH)

      expect(result.preContactDamageA).toBeGreaterThan(0)
      expect(result.preContactDamageB).toBeGreaterThan(0)
      expect(result.contactMade).toBe(true) // Pure ranged still fight
    })
  })

  describe('D. Kiting Logic', () => {
    it('Kiting off → contact happens (Mangudai vs Men-at-Arms)', () => {
      const result = runSim(createMangudai(10), createMenAtArms(10), createOptions(30, 0.8, false))

      expect(result.contactMade).toBe(true)
      expect(result.timeToContact).toBeGreaterThan(0)
    })

    it('Kiting on + fast ranged + open field → no contact (Mangudai vs Men-at-Arms)', () => {
      const result = runSim(createMangudai(10), createMenAtArms(10), OPEN_FIELD)

      expect(result.contactMade).toBe(false)
      expect(result.timeToContact).toBeNull()
      expect(result.scenarioExplanation).toContain('Kiting')
    })

    it('Fast melee catches ranged (Horseman vs Archers)', () => {
      const result = runSim(createHorseman(10), createArcher(10), OPEN_FIELD)

      expect(result.contactMade).toBe(true)
      expect(result.timeToContact).toBeGreaterThan(0)
    })

    it('Kiting prevents contact → melee deals zero damage', () => {
      const result = runSim(createMangudai(10), createMenAtArms(10), OPEN_FIELD)

      if (!result.contactMade) {
        expect(result.totalDmgDoneB).toBe(0) // Team B is melee, should do no damage
        expect(Number.isNaN(result.totalDmgDoneB)).toBe(false)
      }
    })
  })

  describe('E. Mixed Armies', () => {
    it('Mixed (ranged+melee) vs melee-only', () => {
      const mixedTeam: SimTeamInput = {
        units: [...createArcher(7).units, ...createSpearman(3).units],
        teamCombatMods: { effects: [] },
        enableCounters: false,
      }

      const result = runSim(mixedTeam, createMenAtArms(10), SKIRMISH)

      expect(result.preContactDamageA).toBeGreaterThan(0)
      expect(result.preContactAttacksA).toBeGreaterThan(0)
      expect(result.contactMade).toBe(true)
    })

    it('Tiny ranged fraction produces small opening volley', () => {
      const mixedTeam: SimTeamInput = {
        units: [...createArcher(1).units, ...createSpearman(9).units],
        teamCombatMods: { effects: [] },
        enableCounters: false,
      }

      const result = runSim(mixedTeam, createSpearman(10), SKIRMISH)

      expect(result.preContactDamageA).toBeGreaterThan(0)
      expect(result.preContactDamageA).toBeLessThan(50) // Should be small
    })
  })

  describe('F. Result Reporting', () => {
    it('All results have contact status and scenario explanation', () => {
      const result = runSim(createArcher(10), createMenAtArms(10), SKIRMISH)

      expect(result.contactMade).toBeDefined()
      expect(typeof result.contactMade).toBe('boolean')
      expect(result.scenarioExplanation).toBeTruthy()
      expect(typeof result.scenarioExplanation).toBe('string')
    })

    it('Pre-contact fields always present (even when zero)', () => {
      const result = runSim(createSpearman(10), createMenAtArms(10), ENGAGED)

      expect(result.preContactDamageA).toBeDefined()
      expect(result.preContactDamageB).toBeDefined()
      expect(result.preContactAttacksA).toBeDefined()
      expect(result.preContactAttacksB).toBeDefined()
      expect(result.preContactDamageA).toBe(0)
      expect(result.preContactDamageB).toBe(0)
    })
  })

  describe('G. Stress & Robustness', () => {
    it('Large army sizes (100 vs 100)', () => {
      const result = runSim(createArcher(100), createSpearman(100), SKIRMISH)

      expect(result.winner).toBeDefined()
      expect(Number.isNaN(result.seconds)).toBe(false)
      expect(Number.isNaN(result.preContactDamageA)).toBe(false)
    })

    it('Extreme distance does not overflow', () => {
      const result = runSim(createArcher(10), createMenAtArms(10), createOptions(100))

      expect(Number.isFinite(result.preContactDamageA)).toBe(true)
      expect(Number.isFinite(result.timeToContact!)).toBe(true)
      expect(result.preContactDamageA).toBeGreaterThan(0)
    })
  })

  describe('H. Golden Snapshots', () => {
    it('GOLDEN: Mangudai kiting Men-at-Arms (no contact)', () => {
      const result = runSim(createMangudai(10), createMenAtArms(10), OPEN_FIELD)

      expect(result.contactMade).toBe(false)
      expect(result.winner).toBe('A')
    })

    it('GOLDEN: Horseman catches Archers (contact happens)', () => {
      const result = runSim(createHorseman(10), createArcher(10), OPEN_FIELD)

      expect(result.contactMade).toBe(true)
      expect(result.preContactDamageB).toBeGreaterThan(0)
    })
  })
})
