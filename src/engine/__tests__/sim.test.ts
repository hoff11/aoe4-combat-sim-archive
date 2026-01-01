// src/engine/__tests__/sim.test.ts
// Core engine simulation tests

import { describe, expect, it } from 'vitest'
import { runSim } from '../sim'
import { computeHit } from '../combatStats'
import { counterMultiplier } from '../rules/counters'
import type { SimTeamInput, SimOptions } from '../types'

// ==================== Combat Stats Tests ====================

describe('computeHit – damage calculation', () => {
  it('returns 0 for unit with no weapon', () => {
    const attacker = {
      unitId: 'test',
      types: [],
      weapon: null,
      armorMelee: 0,
      armorRanged: 0,
    }
    const defender = {
      unitId: 'test',
      types: [],
      weapon: null,
      armorMelee: 0,
      armorRanged: 0,
    }

    const hit = computeHit(attacker, defender)
    expect(hit).toBe(0)
  })

  it('computes basic damage: weapon max damage - armor', () => {
    const attacker = {
      unitId: 'archer',
      types: ['ranged'],
      weapon: {
        isRanged: true,
        damageMin: 3,
        damageMax: 7,
        damageType: 'Ranged' as const,
        attackPeriod: 2,
        rangeMin: 0,
        rangeMax: 5,
      },
      armorMelee: 0,
      armorRanged: 0,
    }
    const defender = {
      unitId: 'spearman',
      types: ['infantry'],
      weapon: null,
      armorMelee: 0,
      armorRanged: 2,
    }

    const hit = computeHit(attacker, defender)
    expect(hit).toBe(7 - 2) // max damage - ranged armor
  })

  it('clamps negative damage to 0', () => {
    const attacker = {
      unitId: 'archer',
      types: [],
      weapon: {
        isRanged: true,
        damageMin: 1,
        damageMax: 3,
        damageType: 'Ranged' as const,
        attackPeriod: 2,
        rangeMin: 0,
        rangeMax: 5,
      },
      armorMelee: 0,
      armorRanged: 0,
    }
    const defender = {
      unitId: 'armored',
      types: ['armored'],
      weapon: null,
      armorMelee: 0,
      armorRanged: 10, // High armor
    }

    const hit = computeHit(attacker, defender)
    expect(hit).toBe(0)
  })

  it('uses melee armor for melee attacks', () => {
    const attacker = {
      unitId: 'sword',
      types: ['melee'],
      weapon: {
        isRanged: false,
        damageMin: 5,
        damageMax: 10,
        damageType: 'Melee' as const,
        attackPeriod: 1.5,
        rangeMin: 0,
        rangeMax: 1,
      },
      armorMelee: 0,
      armorRanged: 0,
    }
    const defender = {
      unitId: 'armored',
      types: ['armored'],
      weapon: null,
      armorMelee: 3,
      armorRanged: 0,
    }

    const hit = computeHit(attacker, defender)
    expect(hit).toBe(10 - 3)
  })

  it('applies effect add bonus to damage', () => {
    const attacker = {
      unitId: 'knight',
      types: ['cavalry'],
      weapon: {
        isRanged: false,
        damageMin: 8,
        damageMax: 12,
        damageType: 'Melee' as const,
        attackPeriod: 1.8,
        rangeMin: 0,
        rangeMax: 1,
      },
      armorMelee: 0,
      armorRanged: 0,
    }
    const defender = {
      unitId: 'archer',
      types: ['ranged', 'infantry_light'],
      weapon: null,
      armorMelee: 1,
      armorRanged: 0,
    }

    const effects = [
      {
        stat: 'meleeAttack' as const,
        op: 'add' as const,
        value: 3,
        select: { anyOfAll: [['cavalry']] },
        target: undefined,
        sourceId: 'mounted_attack_tech',
      },
    ]

    const hit = computeHit(attacker, defender, effects)
    expect(hit).toBe(12 + 3 - 1) // base + bonus - armor
  })

  it('applies effect mul multiplier to damage', () => {
    const attacker = {
      unitId: 'archer',
      types: ['ranged'],
      weapon: {
        isRanged: true,
        damageMin: 4,
        damageMax: 8,
        damageType: 'Ranged' as const,
        attackPeriod: 2,
        rangeMin: 0,
        rangeMax: 5,
      },
      armorMelee: 0,
      armorRanged: 0,
    }
    const defender = {
      unitId: 'spearman',
      types: ['infantry'],
      weapon: null,
      armorMelee: 0,
      armorRanged: 1,
    }

    const effects = [
      {
        stat: 'rangedAttack' as const,
        op: 'mul' as const,
        value: 1.2,
        select: { anyOfAll: [['ranged']] },
        target: undefined,
        sourceId: 'archer_training_tech',
      },
    ]

    const hit = computeHit(attacker, defender, effects)
    expect(hit).toBe(8 * 1.2 - 1) // (max damage * mul) - armor
  })

  it('ignores effects that do not match selector', () => {
    const attacker = {
      unitId: 'spearman',
      types: ['melee', 'spearman'],
      weapon: {
        isRanged: false,
        damageMin: 6,
        damageMax: 10,
        damageType: 'Melee' as const,
        attackPeriod: 1.6,
        rangeMin: 0,
        rangeMax: 1,
      },
      armorMelee: 0,
      armorRanged: 0,
    }
    const defender = {
      unitId: 'archer',
      types: ['ranged'],
      weapon: null,
      armorMelee: 0,
      armorRanged: 0,
    }

    const effects = [
      {
        stat: 'rangedAttack' as const,
        op: 'add' as const,
        value: 5,
        select: { anyOfAll: [['ranged']] }, // Only matches ranged attackers
        target: undefined,
        sourceId: 'archer_tech',
      },
    ]

    const hit = computeHit(attacker, defender, effects)
    expect(hit).toBe(10) // No effect applied
  })
})

// ==================== Counter Multiplier Tests ====================

describe('counterMultiplier – class-based bonuses', () => {
  it('spears have 1.35x vs cavalry', () => {
    const mult = counterMultiplier(['spearman'], ['cavalry'])
    expect(mult).toBe(1.35)
  })

  it('spears have 1.35x vs mounted units', () => {
    const mult = counterMultiplier(['spearman'], ['mounted'])
    expect(mult).toBe(1.35)
  })

  it('crossbows have 1.3x vs armored units', () => {
    const mult = counterMultiplier(['crossbow'], ['armored'])
    expect(mult).toBe(1.3)
  })

  it('archers have 1.05x vs light infantry', () => {
    const mult = counterMultiplier(['archer'], ['infantry_light'])
    expect(mult).toBe(1.05)
  })

  it('archers have 1.05x vs infantry', () => {
    const mult = counterMultiplier(['archer'], ['infantry'])
    expect(mult).toBe(1.05)
  })

  it('cavalry have 1.1x vs ranged units', () => {
    const mult = counterMultiplier(['cavalry'], ['ranged'])
    expect(mult).toBe(1.1)
  })

  it('no match returns 1.0x', () => {
    const mult = counterMultiplier(['scout'], ['scout'])
    expect(mult).toBe(1.0)
  })

  it('is case-insensitive', () => {
    const mult1 = counterMultiplier(['Spearman'], ['Cavalry'])
    const mult2 = counterMultiplier(['SPEARMAN'], ['cavalry'])
    expect(mult1).toBe(1.35)
    expect(mult2).toBe(1.35)
  })
})

// ==================== Simulation Tests ====================

describe('runSim – combat simulation', () => {
  function makeTeam(unitCount: number, hp: number, damageMax: number): SimTeamInput {
    return {
      units: [
        {
          unitId: 'unit-a',
          count: unitCount,
          stats: {
            hitpoints: hp,
            armorMelee: 0,
            armorRanged: 0,
            weapons: [
              {
                isRanged: false,
                damageMin: damageMax * 0.8,
                damageMax: damageMax,
                damageType: 'Melee' as const,
                attackPeriod: 1.0,
                rangeMin: 0,
                rangeMax: 1,
              },
            ],
          },
          types: ['melee'],
          combatMods: { effects: [] },
        },
      ],
      teamCombatMods: { effects: [] },
      enableCounters: false,
    }
  }

  it('returns winner when one team eliminates the other', () => {
    const opts: SimOptions = { seed: 42, maxSeconds: 30, tickInterval: 0.1 }
    const result = runSim(makeTeam(10, 50, 10), makeTeam(1, 50, 10), opts)

    expect(result.winner).toBe('A')
    expect(result.survivorsB).toBe(0)
    expect(result.survivorsA).toBeGreaterThan(0)
  })

  it('produces deterministic results with same seed', () => {
    const teamA = makeTeam(5, 30, 8)
    const teamB = makeTeam(5, 30, 8)
    const opts: SimOptions = { seed: 123, maxSeconds: 20, tickInterval: 0.1 }

    const result1 = runSim(teamA, teamB, opts)
    const result2 = runSim(teamA, teamB, opts)

    expect(result1.winner).toBe(result2.winner)
    expect(result1.seconds).toBe(result2.seconds)
    expect(result1.survivorsA).toBe(result2.survivorsA)
    expect(result1.survivorsB).toBe(result2.survivorsB)
  })

  it('seed produces consistent results on multiple runs', () => {
    const teamA = makeTeam(10, 50, 10)
    const teamB = makeTeam(5, 50, 10)
    const opts: SimOptions = { seed: 42, maxSeconds: 20, tickInterval: 0.1 }

    // Run same simulation 3 times with same seed; all should be identical
    const result1 = runSim(teamA, teamB, opts)
    const result2 = runSim(teamA, teamB, opts)
    const result3 = runSim(teamA, teamB, opts)

    expect(result1.winner).toBe(result2.winner)
    expect(result1.winner).toBe(result3.winner)
    expect(result1.survivorsA).toBe(result2.survivorsA)
    expect(result1.survivorsA).toBe(result3.survivorsA)
    expect(result1.totalDmgDoneA).toBe(result2.totalDmgDoneA)
    expect(result1.totalDmgDoneA).toBe(result3.totalDmgDoneA)
  })

  it('timeline points are monotonically increasing in time', () => {
    const opts: SimOptions = { seed: 42, maxSeconds: 20, tickInterval: 0.1 }
    const result = runSim(makeTeam(10, 50, 10), makeTeam(5, 50, 10), opts)

    for (let i = 1; i < result.timeline.length; i++) {
      expect(result.timeline[i].t).toBeGreaterThanOrEqual(result.timeline[i - 1].t)
    }
  })

  it('HP decreases or stays same over time', () => {
    const opts: SimOptions = { seed: 42, maxSeconds: 20, tickInterval: 0.1 }
    const result = runSim(makeTeam(10, 50, 10), makeTeam(5, 50, 10), opts)

    for (let i = 1; i < result.timeline.length; i++) {
      expect(result.timeline[i].hpA).toBeLessThanOrEqual(result.timeline[i - 1].hpA + 0.01) // small tolerance
      expect(result.timeline[i].hpB).toBeLessThanOrEqual(result.timeline[i - 1].hpB + 0.01)
    }
  })

  it('survivor count matches final timeline state', () => {
    const opts: SimOptions = { seed: 42, maxSeconds: 30, tickInterval: 0.1 }
    const result = runSim(makeTeam(10, 50, 10), makeTeam(5, 50, 10), opts)

    const lastPoint = result.timeline[result.timeline.length - 1]
    expect(result.survivorsA).toBe(lastPoint.aliveA)
    expect(result.survivorsB).toBe(lastPoint.aliveB)
  })

  it('handles empty roster (team with 0 units)', () => {
    const teamEmpty = makeTeam(0, 50, 10)
    const teamFull = makeTeam(5, 50, 10)
    const opts: SimOptions = { seed: 42, maxSeconds: 20, tickInterval: 0.1 }

    const result = runSim(teamEmpty, teamFull, opts)

    expect(result.winner).toBe('B')
    expect(result.survivorsA).toBe(0)
    expect(result.survivorsB).toBeGreaterThan(0)
  })

  it('handles very small tick interval', () => {
    const opts: SimOptions = { seed: 42, maxSeconds: 10, tickInterval: 0.01 }
    const result = runSim(makeTeam(5, 30, 8), makeTeam(5, 30, 8), opts)

    expect(result.winner).toBeDefined()
    expect(result.timeline.length).toBeGreaterThan(0)
  })

  it('respects maxSeconds timeout', () => {
    const opts: SimOptions = { seed: 42, maxSeconds: 5, tickInterval: 0.1 }
    const result = runSim(makeTeam(100, 1000, 1), makeTeam(100, 1000, 1), opts)

    expect(result.seconds).toBeLessThanOrEqual(5.1) // small tolerance
  })

  it('tracks total damage done by each team', () => {
    const opts: SimOptions = { seed: 42, maxSeconds: 20, tickInterval: 0.1 }
    const result = runSim(makeTeam(10, 50, 10), makeTeam(5, 50, 10), opts)

    expect(result.totalDmgDoneA).toBeGreaterThan(0)
    expect(result.totalDmgDoneB).toBeGreaterThan(0)
  })

  it('winner has higher total damage than loser', () => {
    const opts: SimOptions = { seed: 42, maxSeconds: 30, tickInterval: 0.1 }
    const result = runSim(makeTeam(10, 50, 10), makeTeam(1, 50, 10), opts)

    if (result.winner === 'A') {
      expect(result.totalDmgDoneA).toBeGreaterThan(result.totalDmgDoneB)
    } else if (result.winner === 'B') {
      expect(result.totalDmgDoneB).toBeGreaterThan(result.totalDmgDoneA)
    }
  })

  it('uses Spearwall weapon against cavalry and not against infantry', () => {
    const spearwallWeapon = {
      isRanged: false,
      damageMin: 100,
      damageMax: 100,
      damageType: 'Melee' as const,
      attackPeriod: 1.0,
      rangeMin: 0,
      rangeMax: 1,
      isSpearwall: true,
      name: 'Spearwall',
    }
    const normalWeapon = {
      isRanged: false,
      damageMin: 10,
      damageMax: 10,
      damageType: 'Melee' as const,
      attackPeriod: 1.0,
      rangeMin: 0,
      rangeMax: 1,
      name: 'Spear',
    }
    const makeTestTeam = (types: string[]) => ({
      units: [
        {
          unitId: 'spearman',
          count: 1,
          stats: {
            hitpoints: 100,
            armorMelee: 0,
            armorRanged: 0,
            weapons: [normalWeapon, spearwallWeapon],
          },
          types: ['infantry', ...types],
          combatMods: { effects: [] },
        },
      ],
      teamCombatMods: { effects: [] },
      enableCounters: false,
    })
    const infantry = makeTestTeam(['melee'])
    const cavalry = makeTestTeam(['cavalry'])
    const opts: SimOptions = { seed: 1, maxSeconds: 2, tickInterval: 0.1 }
    // Spearwall should not be used against infantry (low damage)
    let result = runSim(infantry, infantry, opts)
    expect(result.totalDmgDoneA).toBeLessThan(200)
    // Spearwall should be used against cavalry (high damage)
    result = runSim(infantry, cavalry, opts)
    expect(result.totalDmgDoneA).toBeGreaterThan(90)
  })
})
