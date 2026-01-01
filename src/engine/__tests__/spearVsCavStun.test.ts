import { describe, it, expect } from 'vitest'
import { runSim } from '../sim'
import type { SimTeamInput, SimOptions } from '../types'

// Helper to create sim options
const createOptions = (
  distance: number,
  openness: number = 0.2,
  kitingEnabled: boolean = false,
  coverage: number = 0.8,
): SimOptions => ({
  maxSeconds: 60,
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

const ENGAGED = createOptions(0)

// Minimal Spearman with Spearwall weapon
const createSpearmanWithSpearwall = (count: number, stunDuration = 2): SimTeamInput => ({
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
            isSpearwall: true,
            stunDuration,
            name: 'Spearwall',
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

// Minimal Cavalry
const createCavalry = (count: number): SimTeamInput => ({
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

// Minimal Infantry (not cavalry)
const createInfantry = (count: number): SimTeamInput => ({
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

describe('Spearwall Stun Mechanic', () => {
  it('Spearwall triggers and reports when spearmen fight cavalry', () => {
    const result = runSim(createSpearmanWithSpearwall(5), createCavalry(5), ENGAGED)
    expect(result.spearwallUsed).toBe(true)
    expect(result.scenarioExplanation).toContain('Spearwall')
  })

  it('Spearwall does not trigger against non-cavalry', () => {
    const result = runSim(createSpearmanWithSpearwall(5), createInfantry(5), ENGAGED)
    expect(result.spearwallUsed).toBeFalsy()
    expect(result.scenarioExplanation).not.toContain('Spearwall')
  })

  it('Spearwall stun delays cavalry attacks (nextAttack is delayed)', () => {
    // Simulate a single spearman vs single cavalry, check that cavalry's nextAttack is delayed after first hit
    const simA = createSpearmanWithSpearwall(1, 2)
    const simB = createCavalry(1)
    // Patch: runSim does not expose per-unit state, so we check that the fight lasts longer than it would without stun
    const resultWithStun = runSim(simA, simB, ENGAGED)
    // Now run with a spearman that has no stun
    const simA_noStun = createSpearmanWithSpearwall(1, 0)
    const resultNoStun = runSim(simA_noStun, simB, ENGAGED)
    // The fight with stun should last longer (cavalry is delayed)
    expect(resultWithStun.seconds).toBeGreaterThan(resultNoStun.seconds)
  })

  it('Spearwall stun duration is respected (longer stun = longer fight)', () => {
    const simA_short = createSpearmanWithSpearwall(1, 1)
    const simA_long = createSpearmanWithSpearwall(1, 3)
    const simB = createCavalry(1)
    const resultShort = runSim(simA_short, simB, ENGAGED)
    const resultLong = runSim(simA_long, simB, ENGAGED)
    expect(resultLong.seconds).toBeGreaterThan(resultShort.seconds)
  })
})
