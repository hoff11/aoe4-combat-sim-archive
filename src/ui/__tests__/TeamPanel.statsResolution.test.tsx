// Test that stats resolution applies tech effects correctly
import { describe, it, expect } from 'vitest'
import { loadRawSnapshot } from '../../data/raw/loadRawSnapshot'
import { buildCanonUnits } from '../../data/canon/buildCanonUnits'
import { buildCanonTechnologies } from '../../data/canon/buildCanonTechnologies'
import { pickVariationByRequestedTier } from '../../data/resolve/resolveScenario'
import {
  buildTechIndex,
  resolveTeamCombatMods,
  resolveUnitCombatMods,
} from '../../data/resolve/resolveCombatMods'
import { applyCombatModsToVariation } from '../../data/resolve/applyCombatMods'

// Helper to build tech index for a specific civ
function buildTechIndexForCiv(allTechs: ReturnType<typeof buildCanonTechnologies>, civ: string) {
  const civTechs = allTechs.filter((t) => t.civs.length === 0 || t.civs.includes(civ))
  return buildTechIndex(civTechs)
}

describe('Stats Resolution - Blacksmith Techs', () => {
  it('applies blacksmith melee attack bonus to knight', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)
    const allTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndexForCiv(allTechs, 'en')

    // Find knight unit
    const knightUnit = canonUnits.find((u) => u.id === 'knight')
    expect(knightUnit).toBeDefined()
    if (!knightUnit) return

    // Get base variation
    const baseVariation = pickVariationByRequestedTier({
      vars: knightUnit.variations,
      civ: 'en',
      teamAge: 2,
      tier: 'base',
      unit: knightUnit,
    })
    expect(baseVariation).toBeDefined()
    if (!baseVariation) return

    const baseDamage = baseVariation.weapons[0]?.damageMin || 0

    // Apply melee attack tech (Bloomery = +1 melee attack)
    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['bloomery-2'],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation: baseVariation,
      teamMods,
    })

    const boostedDamage = effectiveStats.weapons[0]?.damageMin || 0

    // Should be +1 damage
    expect(boostedDamage).toBe(baseDamage + 1)
  })

  it('applies blacksmith armor bonuses to man-at-arms', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)
    const canonTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndex(canonTechs)

    // Find man-at-arms unit
    const maaUnit = canonUnits.find((u) => u.id === 'man-at-arms')
    expect(maaUnit).toBeDefined()
    if (!maaUnit) return

    // Get base variation
    const baseVariation = pickVariationByRequestedTier({
      vars: maaUnit.variations,
      civ: 'en',
      teamAge: 3,
      tier: 'base',
      unit: maaUnit,
    })
    expect(baseVariation).toBeDefined()
    if (!baseVariation) return

    const baseMeleeArmor = baseVariation.armor?.melee || 0

    // Apply melee armor techs (both fitted-leatherwork and insulated-helm give melee armor)
    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['fitted-leatherwork-2', 'insulated-helm-3'],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation: baseVariation,
      teamMods,
    })

    // Both techs give melee armor: +2 total
    expect(effectiveStats.armor.melee).toBe(baseMeleeArmor + 2)
  })

  it('stacks multiple blacksmith techs correctly', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)
    const canonTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndex(canonTechs)

    // Find archer unit
    const archerUnit = canonUnits.find((u) => u.id === 'archer')
    expect(archerUnit).toBeDefined()
    if (!archerUnit) return

    // Get base variation
    const baseVariation = pickVariationByRequestedTier({
      vars: archerUnit.variations,
      civ: 'en',
      teamAge: 4,
      tier: 'base',
      unit: archerUnit,
    })
    expect(baseVariation).toBeDefined()
    if (!baseVariation) return

    const baseDamage = baseVariation.weapons[0]?.damageMin || 0

    // Apply all three ranged attack upgrades (Steeled Arrow, Balanced Projectiles, Platecutter Point)
    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['steeled-arrow-2', 'balanced-projectiles-3', 'platecutter-point-4'],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation: baseVariation,
      teamMods,
    })

    const boostedDamage = effectiveStats.weapons[0]?.damageMin || 0
    console.log('Archer damage progression:', { base: baseDamage, withTechs: boostedDamage })

    // Should be +3 damage total
    expect(boostedDamage).toBe(baseDamage + 3)
  })
})

describe('Stats Resolution - Hybrid Units (Melee + Ranged)', () => {
  it('applies ranged attack bonus only to ranged weapons on desert raider', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)
    const allTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndexForCiv(allTechs, 'ay')

    const unit = canonUnits.find((u) => u.id === 'desert-raider')
    expect(unit).toBeDefined()
    if (!unit) return

    const variation = pickVariationByRequestedTier({
      vars: unit.variations,
      civ: 'ay',
      teamAge: 2,
      tier: 'base',
      unit,
    })
    expect(variation).toBeDefined()
    if (!variation) return

    // Desert raider has 3 weapons: melee sword (13), fire torch (10), ranged bow (7)
    expect(variation.weapons.length).toBeGreaterThanOrEqual(3)

    const meleeWeapon = variation.weapons.find((w) => w.damageType === 'melee')
    const rangedWeapon = variation.weapons.find((w) => w.damageType === 'ranged')
    expect(meleeWeapon).toBeDefined()
    expect(rangedWeapon).toBeDefined()

    const baseMeleeDamage = meleeWeapon!.damageMin
    const baseRangedDamage = rangedWeapon!.damageMin

    // Apply Steeled Arrow (+1 ranged attack) - desert raider has 'ranged' class
    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['steeled-arrow-2'],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation,
      teamMods,
    })

    const newMeleeWeapon = effectiveStats.weapons.find((w) => w.damageType === 'melee')
    const newRangedWeapon = effectiveStats.weapons.find((w) => w.damageType === 'ranged')

    // Ranged weapon should get +1, melee weapons unchanged (no 'melee' class)
    expect(newRangedWeapon!.damageMin).toBe(baseRangedDamage + 1)
    expect(newMeleeWeapon!.damageMin).toBe(baseMeleeDamage)
  })

  it('does not apply melee bonus to desert raider (lacks melee class)', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)
    const allTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndexForCiv(allTechs, 'ay')

    const unit = canonUnits.find((u) => u.id === 'desert-raider')
    if (!unit) return

    const variation = pickVariationByRequestedTier({
      vars: unit.variations,
      civ: 'ay',
      teamAge: 2,
      tier: 'base',
      unit,
    })
    if (!variation) return

    const meleeWeapon = variation.weapons.find((w) => w.damageType === 'melee')
    const baseMeleeDamage = meleeWeapon!.damageMin

    // Apply Bloomery (+1 melee attack) - desert raider lacks 'melee' class!
    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['bloomery-2'],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation,
      teamMods,
    })

    const newMeleeWeapon = effectiveStats.weapons.find((w) => w.damageType === 'melee')

    // Melee weapon should NOT change (desert raider doesn't have 'melee' class)
    expect(newMeleeWeapon!.damageMin).toBe(baseMeleeDamage)
  })

  it('applies ranged attack bonus to desert raider', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)
    const allTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndexForCiv(allTechs, 'ay')

    const unit = canonUnits.find((u) => u.id === 'desert-raider')
    if (!unit) return

    const variation = pickVariationByRequestedTier({
      vars: unit.variations,
      civ: 'ay',
      teamAge: 2,
      tier: 'base',
      unit,
    })
    if (!variation) return

    const rangedWeapon = variation.weapons.find((w) => w.damageType === 'ranged')
    const baseRangedDamage = rangedWeapon!.damageMin

    // Apply steeled arrow (ranged +1) at Age 2
    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['steeled-arrow-2'],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation,
      teamMods,
    })

    const newRangedWeapon = effectiveStats.weapons.find((w) => w.damageType === 'ranged')

    // Ranged weapon should get +1
    expect(newRangedWeapon!.damageMin).toBe(baseRangedDamage + 1)
  })
})

describe('Stats Resolution - Armor Techs', () => {
  it('applies melee armor bonus correctly', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)
    const canonTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndex(canonTechs)

    const unit = canonUnits.find((u) => u.id === 'man-at-arms')
    if (!unit) return

    const variation = pickVariationByRequestedTier({
      vars: unit.variations,
      civ: 'en',
      teamAge: 2,
      tier: 'base',
      unit,
    })
    if (!variation) return

    const baseArmor = variation.armor.melee

    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['fitted-leatherwork-2'],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation,
      teamMods,
    })

    expect(effectiveStats.armor.melee).toBe(baseArmor + 1)
  })

  it('stacks armor upgrades correctly', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)
    const canonTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndex(canonTechs)

    const unit = canonUnits.find((u) => u.id === 'knight')
    if (!unit) return

    const variation = pickVariationByRequestedTier({
      vars: unit.variations,
      civ: 'en',
      teamAge: 3,
      tier: 'base',
      unit,
    })
    if (!variation) return

    const baseMeleeArmor = variation.armor.melee

    // Apply two melee armor upgrades
    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['fitted-leatherwork-2', 'insulated-helm-3'],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation,
      teamMods,
    })

    expect(effectiveStats.armor.melee).toBe(baseMeleeArmor + 2)
  })
})

describe('Stats Resolution - HP Bonuses', () => {
  it('applies HP bonus from technologies', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)
    const canonTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndex(canonTechs)

    const unit = canonUnits.find((u) => u.id === 'spearman')
    if (!unit) return

    const variation = pickVariationByRequestedTier({
      vars: unit.variations,
      civ: 'en',
      teamAge: 2,
      tier: 'base',
      unit,
    })
    if (!variation) return

    const baseHP = variation.hitpoints

    // Look for any tech that gives HP bonus (this is exploratory)
    const hpTech = canonTechs.find((t) => t.effects.some((e) => e.raw?.property === 'hitpoints'))

    if (hpTech) {
      const teamMods = resolveTeamCombatMods({
        techById: techIndex,
        selectedTechIds: [hpTech.id],
      })

      const effectiveStats = applyCombatModsToVariation({
        variation,
        teamMods,
      })

      // HP should either increase or stay the same (if selector doesn't match)
      expect(effectiveStats.hitpoints).toBeGreaterThanOrEqual(baseHP)
    }
  })
})

describe('Stats Resolution - Team + Unit Mods Combined', () => {
  it('applies both team-wide and unit-specific technologies', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)
    const allTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndexForCiv(allTechs, 'en')

    const unit = canonUnits.find((u) => u.id === 'knight')
    if (!unit) return

    const variation = pickVariationByRequestedTier({
      vars: unit.variations,
      civ: 'en',
      teamAge: 3,
      tier: 'base',
      unit,
    })
    if (!variation) return

    const baseDamage = variation.weapons[0]?.damageMin || 0

    // Apply team-wide blacksmith techs (bloomery +1, decarbonization +1)
    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['bloomery-2', 'decarbonization-3'],
    })

    // Apply empty unit mods (no unit-specific techs)
    const unitMods = resolveUnitCombatMods({
      techById: techIndex,
      unitTechIds: [],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation,
      teamMods,
      unitMods,
    })

    const newDamage = effectiveStats.weapons[0]?.damageMin || 0

    // Should have +2 from bloomery and decarbonization (both apply to melee)
    expect(newDamage).toBe(baseDamage + 2)
  })
})

describe('Stats Resolution - Edge Cases', () => {
  it('handles units with no weapons gracefully', () => {
    const raw = loadRawSnapshot()
    const canonTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndex(canonTechs)

    // Create a mock variation with no weapons
    const mockVariation = {
      id: 'test-unit',
      baseUnitId: 'test',
      name: 'Test',
      civs: ['en'],
      age: 1 as const,
      classes: ['melee', 'infantry'],
      hitpoints: 100,
      armor: { melee: 0, ranged: 0 },
      weapons: [],
    }

    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['bloomery'],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation: mockVariation,
      teamMods,
    })

    expect(effectiveStats.weapons).toHaveLength(0)
    expect(effectiveStats.hitpoints).toBe(100)
  })

  it('handles zero or negative values correctly', () => {
    const raw = loadRawSnapshot()
    const canonTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndex(canonTechs)

    const mockVariation = {
      id: 'weak-unit',
      baseUnitId: 'weak',
      name: 'Weak',
      civs: ['en'],
      age: 1 as const,
      classes: ['infantry'],
      hitpoints: 1,
      armor: { melee: 0, ranged: 0 },
      weapons: [
        {
          name: 'Stick',
          damageMin: 1,
          damageMax: 1,
          attackPeriod: 1,
          rangeMin: 0,
          rangeMax: 0,
          damageType: 'melee',
        },
      ],
    }

    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['bloomery'],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation: mockVariation,
      teamMods,
    })

    // Should not go below 1 HP or 0 damage
    expect(effectiveStats.hitpoints).toBeGreaterThan(0)
    expect(effectiveStats.weapons[0].damageMin).toBeGreaterThan(0)
  })

  it('does not apply effects when selector does not match', () => {
    const raw = loadRawSnapshot()
    const canonUnits = buildCanonUnits(raw.units.data)
    const canonTechs = buildCanonTechnologies(raw.technologies.data)
    const techIndex = buildTechIndex(canonTechs)

    // Archer should not be affected by melee attack upgrades
    const unit = canonUnits.find((u) => u.id === 'archer')
    if (!unit) return

    const variation = pickVariationByRequestedTier({
      vars: unit.variations,
      civ: 'en',
      teamAge: 2,
      tier: 'base',
      unit,
    })
    if (!variation) return

    const baseDamage = variation.weapons[0]?.damageMin || 0

    // Apply melee attack tech (shouldn't affect ranged units with only ranged weapons)
    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: ['bloomery'],
    })

    const effectiveStats = applyCombatModsToVariation({
      variation,
      teamMods,
    })

    // Damage should be unchanged
    expect(effectiveStats.weapons[0]?.damageMin).toBe(baseDamage)
  })
})
