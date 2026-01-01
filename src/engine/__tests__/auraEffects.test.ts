// src/engine/__tests__/auraEffects.test.ts
// Unit tests for aura calculation functions

import { describe, it, expect } from 'vitest'
import { calculateTargetShare, calculateAuraMultiplier, detectActiveAuras } from '../auraEffects'
import type { SimTeamInput, AuraEffect } from '../auraEffects'

describe('calculateTargetShare', () => {
  it('should return 100% for team with only cavalry', () => {
    const team: SimTeamInput = {
      units: [
        {
          unitId: 'knight',
          count: 10,
          stats: {
            hitpoints: 150,
            armorMelee: 4,
            armorRanged: 4,
            weapons: [
              {
                damageType: 'Melee',
                isRanged: false,
                damageMin: 18,
                damageMax: 18,
                attackPeriod: 1.5,
                rangeMin: 0,
                rangeMax: 0.35,
              },
            ],
          },
          types: ['cavalry', 'heavy'],
          combatMods: { effects: [] },
        },
      ],
      teamCombatMods: { effects: [] },
      enableCounters: false,
    }

    const result = calculateTargetShare(team, ['cavalry'])

    expect(result.unitShare).toBe(1.0) // 10/10 units
    expect(result.dpsShare).toBe(1.0) // 100% of DPS
  })

  it('should return 0% for team with no cavalry', () => {
    const team: SimTeamInput = {
      units: [
        {
          unitId: 'archer',
          count: 20,
          stats: {
            hitpoints: 70,
            armorMelee: 0,
            armorRanged: 0,
            weapons: [
              {
                damageType: 'Ranged',
                isRanged: true,
                damageMin: 8,
                damageMax: 8,
                attackPeriod: 2.0,
                rangeMin: 0,
                rangeMax: 5.5,
              },
            ],
          },
          types: ['ranged', 'infantry'],
          combatMods: { effects: [] },
        },
      ],
      teamCombatMods: { effects: [] },
      enableCounters: false,
    }

    const result = calculateTargetShare(team, ['cavalry'])

    expect(result.unitShare).toBe(0) // 0/20 cavalry
    expect(result.dpsShare).toBe(0) // 0% cavalry DPS
  })

  it('should calculate proportional share for mixed army', () => {
    const team: SimTeamInput = {
      units: [
        {
          unitId: 'knight',
          count: 5,
          stats: {
            hitpoints: 150,
            armorMelee: 4,
            armorRanged: 4,
            weapons: [
              {
                damageType: 'Melee',
                isRanged: false,
                damageMin: 18,
                damageMax: 18,
                attackPeriod: 1.5,
                rangeMin: 0,
                rangeMax: 0.35,
              },
            ],
          },
          types: ['cavalry', 'heavy'],
          combatMods: { effects: [] },
        },
        {
          unitId: 'archer',
          count: 10,
          stats: {
            hitpoints: 70,
            armorMelee: 0,
            armorRanged: 0,
            weapons: [
              {
                damageType: 'Ranged',
                isRanged: true,
                damageMin: 8,
                damageMax: 8,
                attackPeriod: 2.0,
                rangeMin: 0,
                rangeMax: 5.5,
              },
            ],
          },
          types: ['ranged', 'infantry'],
          combatMods: { effects: [] },
        },
      ],
      teamCombatMods: { effects: [] },
      enableCounters: false,
    }

    const result = calculateTargetShare(team, ['cavalry'])

    // Unit share: 5 knights / 15 total = 0.33
    expect(result.unitShare).toBeCloseTo(0.333, 2)

    // DPS share:
    // Knights: 5 × (18/1.5) = 60 DPS
    // Archers: 10 × (8/2.0) = 40 DPS
    // Total: 100 DPS → Knights = 60%
    expect(result.dpsShare).toBeCloseTo(0.6, 2)
  })
})

describe('calculateAuraMultiplier', () => {
  const mockAura: AuraEffect = {
    abilityId: 'ability-camel-unease',
    abilityName: 'Camel Unease',
    sourceTeam: 'A',
    targetTeam: 'B',
    targetClasses: ['cavalry'],
    statModifier: 'damage',
    modifierOp: 'mul',
    modifierValue: 0.8, // -20% damage
    auraRange: 5,
  }

  const mockCavalryTeam: SimTeamInput = {
    units: [
      {
        unitId: 'knight',
        count: 10,
        stats: {
          hitpoints: 150,
          armorMelee: 4,
          armorRanged: 4,
          weapons: [
            {
              damageType: 'Melee',
              isRanged: false,
              damageMin: 18,
              damageMax: 18,
              attackPeriod: 1.5,
              rangeMin: 0,
              rangeMax: 0.35,
            },
          ],
        },
        types: ['cavalry', 'heavy'],
        combatMods: { effects: [] },
      },
    ],
    teamCombatMods: { effects: [] },
    enableCounters: false,
  }

  it('should calculate full effect with 100% coverage and uptime', () => {
    const multiplier = calculateAuraMultiplier(mockAura, mockCavalryTeam, 1.0, 1.0)

    // 100% cavalry × 100% coverage × 100% uptime × 20% effect
    // = 1.0 × 1.0 × 1.0 × 0.2 = 0.2 reduction
    // Multiplier = 1.0 - 0.2 = 0.8
    expect(multiplier).toBeCloseTo(0.8, 3)
  })

  it('should scale effect by coverage (Engaged vs Open Field)', () => {
    // Engaged scenario: 80% coverage
    const engagedMultiplier = calculateAuraMultiplier(mockAura, mockCavalryTeam, 0.8, 1.0)
    expect(engagedMultiplier).toBeCloseTo(0.84, 3) // 1.0 - (1.0 × 0.8 × 1.0 × 0.2)

    // Open Field scenario: 30% coverage
    const openFieldMultiplier = calculateAuraMultiplier(mockAura, mockCavalryTeam, 0.3, 1.0)
    expect(openFieldMultiplier).toBeCloseTo(0.94, 3) // 1.0 - (1.0 × 0.3 × 1.0 × 0.2)
  })

  it('should scale effect by uptime (aura source survival)', () => {
    // Aura source survives 50% of fight
    const multiplier = calculateAuraMultiplier(mockAura, mockCavalryTeam, 0.8, 0.5)

    // 100% cavalry × 80% coverage × 50% uptime × 20% effect
    // = 1.0 × 0.8 × 0.5 × 0.2 = 0.08 reduction
    // Multiplier = 1.0 - 0.08 = 0.92
    expect(multiplier).toBeCloseTo(0.92, 3)
  })

  it('should return no effect when uptime is 0 (aura source dead)', () => {
    const multiplier = calculateAuraMultiplier(mockAura, mockCavalryTeam, 0.8, 0.0)
    expect(multiplier).toBe(1.0) // No effect
  })

  it('should apply proportional effect to mixed army', () => {
    const mixedTeam: SimTeamInput = {
      units: [
        {
          unitId: 'knight',
          count: 5,
          stats: {
            hitpoints: 150,
            armorMelee: 4,
            armorRanged: 4,
            weapons: [
              {
                damageType: 'Melee',
                isRanged: false,
                damageMin: 18,
                damageMax: 18,
                attackPeriod: 1.5,
                rangeMin: 0,
                rangeMax: 0.35,
              },
            ],
          },
          types: ['cavalry', 'heavy'],
          combatMods: { effects: [] },
        },
        {
          unitId: 'archer',
          count: 10,
          stats: {
            hitpoints: 70,
            armorMelee: 0,
            armorRanged: 0,
            weapons: [
              {
                damageType: 'Ranged',
                isRanged: true,
                damageMin: 8,
                damageMax: 8,
                attackPeriod: 2.0,
                rangeMin: 0,
                rangeMax: 5.5,
              },
            ],
          },
          types: ['ranged', 'infantry'],
          combatMods: { effects: [] },
        },
      ],
      teamCombatMods: { effects: [] },
      enableCounters: false,
    }

    const multiplier = calculateAuraMultiplier(mockAura, mixedTeam, 0.8, 1.0)

    // Cavalry DPS share: 60% (5 knights @ 12 DPS = 60, 10 archers @ 4 DPS = 40)
    // 0.6 × 0.8 × 1.0 × 0.2 = 0.096 reduction
    // Multiplier = 1.0 - 0.096 = 0.904
    expect(multiplier).toBeCloseTo(0.904, 3)
  })
})

describe('detectActiveAuras', () => {
  const camelTeam: SimTeamInput = {
    units: [
      {
        unitId: 'camel-rider',
        count: 10,
        stats: {
          hitpoints: 130,
          armorMelee: 2,
          armorRanged: 2,
          weapons: [
            {
              damageType: 'Melee',
              isRanged: false,
              damageMin: 12,
              damageMax: 12,
              attackPeriod: 1.88,
              rangeMin: 0,
              rangeMax: 0.35,
            },
          ],
        },
        types: ['cavalry', 'camel', 'light'],
        combatMods: { effects: [] },
      },
    ],
    teamCombatMods: { effects: [] },
    enableCounters: false,
  }

  const knightTeam: SimTeamInput = {
    units: [
      {
        unitId: 'knight',
        count: 10,
        stats: {
          hitpoints: 150,
          armorMelee: 4,
          armorRanged: 4,
          weapons: [
            {
              damageType: 'Melee',
              isRanged: false,
              damageMin: 18,
              damageMax: 18,
              attackPeriod: 1.5,
              rangeMin: 0,
              rangeMax: 0.35,
            },
          ],
        },
        types: ['cavalry', 'heavy'],
        combatMods: { effects: [] },
      },
    ],
    teamCombatMods: { effects: [] },
    enableCounters: false,
  }

  it('should detect Camel Unease when camel units present', () => {
    const auras = detectActiveAuras(camelTeam, knightTeam)

    expect(auras).toHaveLength(1)
    expect(auras[0].abilityId).toBe('ability-camel-unease')
    expect(auras[0].sourceTeam).toBe('A')
    expect(auras[0].targetTeam).toBe('B')
    expect(auras[0].targetClasses).toEqual(['cavalry'])
    expect(auras[0].modifierValue).toBe(0.8)
  })

  it('should detect aura from both teams if both have camels', () => {
    const auras = detectActiveAuras(camelTeam, camelTeam)

    expect(auras).toHaveLength(2)
    expect(auras[0].sourceTeam).toBe('A')
    expect(auras[1].sourceTeam).toBe('B')
  })

  it('should return empty array when no aura units present', () => {
    const auras = detectActiveAuras(knightTeam, knightTeam)
    expect(auras).toHaveLength(0)
  })
})
