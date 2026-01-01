// src/data/resolve/buildSimInputFromUi.ts
// NEW: Build SimTeamInput directly from UI state using combat mods resolution

import type { UiScenarioState, TeamId } from '../../ui/uiStateTypes'
import type { SimTeamInput, CombatStats, Weapon, DamageType } from '../../engine/types'
import { loadRawSnapshot } from '../raw/loadRawSnapshot'
import { buildCanonUnits } from '../canon/buildCanonUnits'
import { buildCanonTechnologies } from '../canon/buildCanonTechnologies'
import type { CanonWeapon } from '../canon/canonTypes'
import { CIV_MAP, CIV_ALIASES } from '../canon/civs'
import { buildTechIndex, resolveTeamCombatMods, resolveUnitCombatMods } from './resolveCombatMods'
import { applyCombatModsToVariation } from './applyCombatMods'
import { pickVariationByRequestedTier } from './resolveScenario'
import type { CombatEffect } from './combatModsTypes'

/**
 * Convert civilization display name (e.g., "English") to civ code (e.g., "en")
 */
function civNameToCode(displayName: string): string {
  const lower = displayName.toLowerCase()
  // Look up in CIV_MAP (code -> name)
  for (const [code, name] of Object.entries(CIV_MAP)) {
    if (name.toLowerCase() === lower) return code
  }
  // Check aliases too
  for (const [code, name] of Object.entries(CIV_ALIASES)) {
    if (name.toLowerCase() === lower) return code
  }
  // If not found, assume it's already a code
  return displayName.toLowerCase()
}

function toDamageType(t: string): DamageType {
  const norm = String(t || '').toLowerCase()
  if (norm === 'melee') return 'Melee'
  if (norm === 'ranged') return 'Ranged'
  if (norm === 'siege') return 'Siege'
  if (norm === 'fire') return 'Fire'
  if (norm === 'magic') return 'Magic'
  return 'Other'
}

function weaponToEngine(w: CanonWeapon): Weapon {
  const damageType = toDamageType(w.damageType)
  return {
    damageType,
    isRanged: damageType === 'Ranged' || damageType === 'Siege' || damageType === 'Fire',
    damageMin: w.damageMin,
    damageMax: w.damageMax,
    attackPeriod: w.attackPeriod,
    rangeMin: w.rangeMin,
    rangeMax: w.rangeMax,
    name: w.name,
    rawType: w.damageType,
  }
}

function normalizeTypes(classes: string[] | undefined): string[] {
  if (!classes) return []
  const result = new Set<string>()

  for (const cls of classes) {
    const normalized = String(cls).toLowerCase().trim()
    result.add(normalized)

    // Expand compound class names (e.g., "light_melee_infantry" → "light", "melee", "infantry")
    // This allows weapon modifiers targeting ["light", "melee", "infantry"] to match units with "light_melee_infantry"
    if (normalized.includes('_')) {
      const parts = normalized.split('_')
      for (const part of parts) {
        if (part) result.add(part)
      }
    }
  }

  return Array.from(result)
}

/**
 * Convert weapon modifiers (e.g., +17 vs cavalry) into CombatEffect objects.
 */
function convertWeaponModifiersToCombatEffects(
  weaponModifiers: any[],
  unitId: string,
  weaponName: string,
): CombatEffect[] {
  const effects: CombatEffect[] = []

  for (const mod of weaponModifiers) {
    if (!mod || typeof mod !== 'object') continue

    const property = String(mod.property ?? '').toLowerCase()
    let stat: CombatEffect['stat'] | null = null

    if (property === 'meleeattack') stat = 'meleeAttack'
    else if (property === 'rangedattack') stat = 'rangedAttack'
    else if (property === 'siegeattack') stat = 'siegeAttack'
    else continue

    const effectType = String(mod.effect ?? '').toLowerCase()
    let op: CombatEffect['op'] | null = null

    if (effectType === 'change') op = 'add'
    else if (effectType === 'multiply' || effectType === 'mult') op = 'mul'
    else continue

    const value = Number(mod.value)
    if (!Number.isFinite(value)) continue

    const target = mod.target
    let targetSelector: CombatEffect['target'] = undefined

    if (target && typeof target === 'object' && Array.isArray(target.class)) {
      const groups: string[][] = []
      for (const classGroup of target.class) {
        if (Array.isArray(classGroup)) {
          const normalized = classGroup.map((c: any) => String(c).toLowerCase()).filter(Boolean)
          if (normalized.length > 0) groups.push(normalized)
        }
      }
      if (groups.length > 0) {
        targetSelector = { anyOfAll: groups }
      }
    }

    const effect: CombatEffect = {
      stat,
      op,
      value,
      select: {
        unitIds: [unitId.toLowerCase()],
      },
      target: targetSelector,
      sourceId: `weapon_${weaponName.toLowerCase().replace(/\s+/g, '_')}_${unitId}`,
    }

    effects.push(effect)
  }

  return effects
}

/**
 * Build SimTeamInput from UI state using the new combat mods resolution system.
 * This ensures the engine receives units with properly applied tech bonuses.
 */
export function buildSimTeamInputFromUi(uiState: UiScenarioState, teamId: TeamId): SimTeamInput {
  const teamState = uiState.teams[teamId]

  // Load canon data
  const raw = loadRawSnapshot()
  const canonUnits = buildCanonUnits(raw.units.data)
  const canonTechs = buildCanonTechnologies(raw.technologies.data)
  const techIndex = buildTechIndex(canonTechs)

  // Resolve team-wide combat mods (blacksmith + university)
  const teamCombatMods = resolveTeamCombatMods({
    techById: techIndex,
    selectedTechIds: teamState.selectedTechIds || [],
  })

  // Build unit inputs
  const units = teamState.units.map((uiUnit) => {
    const canonUnit = canonUnits.find((u) => u.id === uiUnit.unitId)
    if (!canonUnit) {
      throw new Error(`Unit not found: ${uiUnit.unitId}`)
    }

    // Convert civ display name to code (e.g., "English" -> "en")
    const civCode = civNameToCode(teamState.civ)

    // Pick variation by tier
    const variation = pickVariationByRequestedTier({
      vars: canonUnit.variations,
      civ: civCode,
      teamAge: teamState.age,
      tier: uiUnit.tier,
      unit: canonUnit,
    })

    // Resolve unit-specific combat mods
    const unitTechIds = (uiUnit.unitTechs || []).filter((ut) => ut.enabled).map((ut) => ut.id)

    const unitMods = resolveUnitCombatMods({
      techById: techIndex,
      unitTechIds,
    })

    // Extract weapon modifiers from the original variation (before applying tech mods)
    // Only process modifiers from non-torch weapons (torch is never the primary combat weapon)
    console.log(`[UI BUILD] Processing unit ${variation.id}, weapons:`, variation.weapons.length)
    const weaponModifierEffects: CombatEffect[] = []
    for (const weapon of variation.weapons) {
      // Skip torch weapons - they're auxiliary and not used for primary combat
      if (weapon.name === 'Torch') {
        console.log(`[UI BUILD] Skipping torch weapon: ${weapon.name}`)
        continue
      }

      console.log(`[UI BUILD] Weapon ${weapon.name}, modifiers:`, weapon.modifiers)
      if (weapon.modifiers && Array.isArray(weapon.modifiers)) {
        const effects = convertWeaponModifiersToCombatEffects(
          weapon.modifiers,
          variation.id,
          weapon.name,
        )
        console.log(`[UI BUILD] Converted ${effects.length} effects from weapon ${weapon.name}`)
        weaponModifierEffects.push(...effects)
      }
    }
    console.log(`[UI BUILD] Total weapon modifier effects: ${weaponModifierEffects.length}`)

    // Merge weapon modifiers with unit tech mods
    const allUnitEffects = [...(unitMods.effects ?? []), ...weaponModifierEffects]
    console.log(`[UI BUILD] Unit ${variation.id} total effects: ${allUnitEffects.length}`)

    const mergedUnitMods = {
      effects: allUnitEffects,
    }

    // Apply all combat mods to get effective stats
    const effectiveVariation = applyCombatModsToVariation({
      variation,
      teamMods: teamCombatMods,
      unitMods,
    })

    // Filter weapons: exclude fire and other types from combat
    const combatWeapons = effectiveVariation.weapons.filter((w) => {
      const dt = w.damageType?.toLowerCase()
      return dt === 'melee' || dt === 'ranged' || dt === 'siege'
    })

    // Convert to engine weapons
    const weapons = combatWeapons.map(weaponToEngine)

    const stats: CombatStats = {
      hitpoints: effectiveVariation.hitpoints,
      armorMelee: effectiveVariation.armor.melee,
      armorRanged: effectiveVariation.armor.ranged,
      weapons,
      movement: effectiveVariation.movement,
    }

    return {
      unitId: variation.id,
      count: uiUnit.count,
      stats,
      types: normalizeTypes(canonUnit.classes),
      combatMods: mergedUnitMods, // Pass unit-specific mods including weapon modifiers
    }
  })

  return {
    units,
    teamCombatMods,
    enableCounters: true, // Could make this configurable
  }
}

/**
 * Build both team inputs from UI state.
 * This is the main entry point for converting UI → Engine input.
 */
export function buildSimInputsFromUi(uiState: UiScenarioState) {
  return {
    teamA: buildSimTeamInputFromUi(uiState, 'A'),
    teamB: buildSimTeamInputFromUi(uiState, 'B'),
  }
}
