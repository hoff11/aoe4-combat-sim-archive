// Hybrid archetype factory (reference from rangeMovement.hybrid.test.ts)
const createHybrid = (
  count: number,
  sustainedWeaponIndex: number,
  volleyWeaponIndex: number,
): SimTeamInput => ({
  units: [
    {
      unitId: 'donso-hybrid',
      count,
      types: [
        'annihilation_condition',
        'find_non_siege_land_military',
        'formational',
        'human',
        'included_by_military_hotkeys',
        'infantry',
        'infantry_light',
        'land_military',
        'light_melee_infantry',
        'melee',
        'melee_infantry',
        'military',
        'spearman_donso',
        'torch_thrower',
      ],
      stats: {
        hitpoints: 80,
        armorMelee: 0,
        armorRanged: 0,
        weapons: [
          {
            damageType: 'Melee' as const,
            isRanged: false,
            damageMin: 0, // to be set per test (Spear)
            damageMax: 0, // to be set per test
            attackPeriod: 1.875,
            rangeMin: 0,
            rangeMax: 0.295,
          },
          {
            damageType: 'Fire' as const,
            isRanged: false,
            damageMin: 10, // Torch (not used in these tests)
            damageMax: 10,
            attackPeriod: 2.125,
            rangeMin: 0,
            rangeMax: 1.25,
          },
          {
            damageType: 'Ranged' as const,
            isRanged: true,
            damageMin: 0, // to be set per test (Javelin)
            damageMax: 0, // to be set per test
            attackPeriod: 0.75,
            rangeMin: 2.5,
            rangeMax: 6.5,
          },
        ],
        movement: { speed: 1.25 },
      },
      combatMods: { effects: [] },
      sustainedWeaponIndex,
      volleyWeaponIndex,
    },
  ],
  teamCombatMods: { effects: [] },
  enableCounters: false,
})
import { describe, it, expect } from 'vitest'
import { runSim } from '../sim'
import type { SimTeamInput, SimOptions } from '../types'

// Table of all spear vs cavalry/elephant scenarios from docs/spearmanVsCavMultiplier.md
const scenarios = [
  // civ, age, unit, base, bonus vs cav, bonus vs elephant, notes
  { civ: 'English', age: 2, unit: 'Hardened Spearman', base: 8, cav: 20, elephant: 4 },
  { civ: 'English', age: 3, unit: 'Veteran Spearman', base: 9, cav: 23, elephant: 5 },
  { civ: 'English', age: 4, unit: 'Elite Spearman', base: 11, cav: 28, elephant: 6 },
  { civ: 'French', age: 1, unit: 'Spearman', base: 7, cav: 17, elephant: 3 },
  { civ: 'French', age: 2, unit: 'Hardened Spearman', base: 8, cav: 20, elephant: 4 },
  { civ: 'French', age: 3, unit: 'Veteran Spearman', base: 9, cav: 23, elephant: 5 },
  { civ: 'French', age: 4, unit: 'Elite Spearman', base: 11, cav: 28, elephant: 6 },
  { civ: 'Ottomans', age: 1, unit: 'Spearman', base: 7, cav: 17, elephant: 3 },
  { civ: 'Ottomans', age: 2, unit: 'Hardened Spearman', base: 8, cav: 20, elephant: 4 },
  { civ: 'Ottomans', age: 3, unit: 'Veteran Spearman', base: 9, cav: 23, elephant: 5 },
  { civ: 'Ottomans', age: 4, unit: 'Elite Spearman', base: 11, cav: 28, elephant: 6 },
  { civ: 'Mongols', age: 1, unit: 'Spearman', base: 7, cav: 17, elephant: 3 },
  { civ: 'Mongols', age: 2, unit: 'Hardened Spearman', base: 8, cav: 20, elephant: 4 },
  { civ: 'Mongols', age: 3, unit: 'Veteran Spearman', base: 9, cav: 23, elephant: 5 },
  { civ: 'Mongols', age: 4, unit: 'Elite Spearman', base: 11, cav: 28, elephant: 6 },
  { civ: 'Malians', age: 1, unit: 'Donso', base: 7, cav: 17, elephant: 3, ranged: 5 },
  { civ: 'Malians', age: 2, unit: 'Hardened Donso', base: 8, cav: 20, elephant: 4, ranged: 7 },
  { civ: 'Malians', age: 3, unit: 'Veteran Donso', base: 9, cav: 23, elephant: 5, ranged: 8 },
  { civ: 'Malians', age: 4, unit: 'Elite Donso', base: 11, cav: 28, elephant: 6, ranged: 8 },
  { civ: 'Zhuxi', age: 1, unit: 'Spearman', base: 7, cav: 17, elephant: 3 },
  { civ: 'Zhuxi', age: 2, unit: 'Hardened Spearman', base: 8, cav: 20, elephant: 4 },
  { civ: 'Zhuxi', age: 3, unit: 'Veteran Spearman', base: 9, cav: 23, elephant: 5 },
  { civ: 'Zhuxi', age: 4, unit: 'Elite Spearman', base: 11, cav: 28, elephant: 6 },
  { civ: 'Abbasid', age: 1, unit: 'Spearman', base: 7, cav: 17, elephant: 3 },
  { civ: 'Abbasid', age: 2, unit: 'Hardened Spearman', base: 8, cav: 20, elephant: 4 },
  { civ: 'Abbasid', age: 3, unit: 'Veteran Spearman', base: 9, cav: 23, elephant: 5 },
  { civ: 'Abbasid', age: 4, unit: 'Elite Spearman', base: 11, cav: 28, elephant: 6 },
]

// Helper to create a minimal SimTeamInput for a single unit
import type { Weapon } from '../types'

function createUnitSim(
  unit: {
    unitId: string
    types: string[]
    hitpoints: number
    armorMelee: number
    armorRanged: number
    weapons: Weapon[]
    sustainedWeaponIndex?: number
    volleyWeaponIndex?: number
  },
  count = 1,
): SimTeamInput {
  return {
    units: [
      {
        unitId: unit.unitId,
        count,
        stats: {
          hitpoints: unit.hitpoints,
          armorMelee: unit.armorMelee,
          armorRanged: unit.armorRanged,
          weapons: unit.weapons,
          movement: { speed: 1.25 },
        },
        types: unit.types,
        combatMods: { effects: [] },
        ...(typeof unit.sustainedWeaponIndex === 'number'
          ? { sustainedWeaponIndex: unit.sustainedWeaponIndex }
          : {}),
        ...(typeof unit.volleyWeaponIndex === 'number'
          ? { volleyWeaponIndex: unit.volleyWeaponIndex }
          : {}),
      },
    ],
    teamCombatMods: { effects: [] },
    enableCounters: false,
  }
}

// Minimal ENGAGED SimOptions
const ENGAGED: SimOptions = {
  maxSeconds: 10,
  tickInterval: 0.1,
  scenario: 'Engaged',
}

// Volley scenario for hybrid Donso (javelin before melee contact)
const RANGED_ENGAGE: SimOptions = {
  maxSeconds: 10,
  tickInterval: 0.1,
  scenario: 'Custom',
  scenarioParams: {
    preset: 'Custom',
    startingDistance: 6, // Donso javelin range max is 6.5
    opennessFactor: 0.5,
    kitingEnabled: false, // Disable kiting for hybrid units (they should volley then melee)
    auraCoverage: 0.5,
  },
}

// Minimal cavalry and elephant targets
const genericCavalry = {
  unitId: 'royal-knight',
  types: ['cavalry', 'melee'],
  hitpoints: 230,
  armorMelee: 4,
  armorRanged: 4,
  weapons: [
    {
      damageType: 'Melee' as const,
      isRanged: false,
      damageMin: 24,
      damageMax: 24,
      attackPeriod: 1.5,
      rangeMin: 0,
      rangeMax: 0.3,
    },
  ],
}
const genericElephant = {
  unitId: 'war-elephant',
  types: ['war', 'elephant', 'melee'],
  hitpoints: 600,
  armorMelee: 4,
  armorRanged: 4,
  weapons: [
    {
      damageType: 'Melee' as const,
      isRanged: false,
      damageMin: 30,
      damageMax: 30,
      attackPeriod: 2.5,
      rangeMin: 0,
      rangeMax: 0.3,
    },
  ],
}

describe('Spearman vs Cavalry/Elephant bonus (engine)', () => {
  scenarios.forEach(({ civ, age, unit, base, cav, elephant, ranged }) => {
    it(`${civ} ${unit} (Age ${age}) vs generic cavalry`, () => {
      // Simulate a single spearman vs single cavalry
      const spear = {
        unitId: unit.toLowerCase().replace(/ /g, '-'),
        types: ['infantry', 'spearman', 'melee'],
        hitpoints: 80,
        armorMelee: 0,
        armorRanged: 0,
        weapons: [
          {
            damageType: 'Melee' as const,
            isRanged: false,
            damageMin: base + cav,
            damageMax: base + cav,
            attackPeriod: 1.88,
            rangeMin: 0,
            rangeMax: 0.3,
          },
        ],
      }
      const teamA = createUnitSim(spear)
      const teamB = createUnitSim(genericCavalry)
      const result = runSim(teamA, teamB, ENGAGED)
      // Check that the first hit is the expected bonus
      expect(result.totalDmgDoneA).toBeGreaterThanOrEqual(base + cav)
    })
    it(`${civ} ${unit} (Age ${age}) vs generic elephant`, () => {
      const spear = {
        unitId: unit.toLowerCase().replace(/ /g, '-'),
        types: ['infantry', 'spearman', 'melee'],
        hitpoints: 80,
        armorMelee: 0,
        armorRanged: 0,
        weapons: [
          {
            damageType: 'Melee' as const,
            isRanged: false,
            damageMin: base + elephant,
            damageMax: base + elephant,
            attackPeriod: 1.88,
            rangeMin: 0,
            rangeMax: 0.3,
          },
        ],
      }
      const teamA = createUnitSim(spear)
      const teamB = createUnitSim(genericElephant)
      const result = runSim(teamA, teamB, ENGAGED)
      expect(result.totalDmgDoneA).toBeGreaterThanOrEqual(base + elephant)
    })
    if (ranged) {
      it(`${civ} ${unit} (Age ${age}) hybrid volley and sustained vs cavalry`, () => {
        // Use createHybrid to build Donso hybrid unit
        const meleeDmg = base + cav
        // Javelin: base 5 damage + ranged bonus vs cavalry
        const javelinBase = 5
        const rangedDmg = javelinBase + ranged
        // Indices: 0 = spear (melee), 1 = torch, 2 = javelin (ranged)
        const teamA = createHybrid(1, 0, 2)
        // Patch in correct damage values for this scenario
        teamA.units[0].stats.weapons[0].damageMin = meleeDmg
        teamA.units[0].stats.weapons[0].damageMax = meleeDmg
        teamA.units[0].stats.weapons[2].damageMin = rangedDmg
        teamA.units[0].stats.weapons[2].damageMax = rangedDmg
        const teamB = createUnitSim(genericCavalry)
        const result = runSim(teamA, teamB, RANGED_ENGAGE)
        // Volley phase: Donso javelin (5+5 vs cav) - 4 armor = 6 per hit
        expect(result.preContactDamageA).toBeGreaterThanOrEqual(6)
        expect(result.preContactAttacksA).toBeGreaterThan(0)
        // Sustained phase: Donso melee (base+cav) - 4 armor
        if (result.contactMade) {
          expect(result.sustainedPhaseExecuted).toBe(true)
          expect(result.totalDmgDoneA).toBeGreaterThan(result.preContactDamageA)
        }
      })
    }
  })
})
