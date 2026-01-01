// src/data/resolve/buildSimInput.ts
// Adapter: ResolvedSimConfig → SimTeamInput (engine layer)

import type { ResolvedSimConfig, ResolvedSimTeam } from './resolvedViewTypes'
import type { SimTeamInput } from '../../engine/types'
import type { CanonUnit } from '../canon/canonTypes'
import type { CombatEffect, TeamCombatMods } from './combatModsTypes'
import { buildCanonUnits } from '../canon/buildCanonUnits'
import { loadRawSnapshot } from '../raw/loadRawSnapshot'

/**
 * Build engine inputs from a resolved scenario.
 * Loads canon data to look up unit variation stats.
 */
export function buildEngineInputs(resolvedConfig: ResolvedSimConfig) {
  console.log('[BUILD ENGINE] Starting buildEngineInputs')
  // Load canon units to look up variation stats
  const raw = loadRawSnapshot(resolvedConfig.version)
  const canonUnits = buildCanonUnits(raw.units.data)

  // Index variations by id
  const variationById = new Map<string, { unit: CanonUnit; variation: any }>()
  for (const unit of canonUnits) {
    for (const variation of unit.variations || []) {
      variationById.set(variation.id, { unit, variation })
    }
  }
  console.log('[BUILD ENGINE] Loaded', variationById.size, 'unit variations')

  const teamA = buildSimTeamInput(resolvedConfig.teams.A, variationById)
  const teamB = buildSimTeamInput(resolvedConfig.teams.B, variationById)

  console.log('[BUILD ENGINE] Team A units:', teamA.units.length)
  console.log('[BUILD ENGINE] Team B units:', teamB.units.length)

  return { teamA, teamB }
}

/**
 * Expand compound class names for robust matching.
 * Example: "light_melee_infantry" → ["light_melee_infantry", "light", "melee", "infantry"]
 */
function expandClassNames(classes: string[]): string[] {
  const result = new Set<string>()

  for (const cls of classes) {
    const normalized = String(cls).toLowerCase().trim()
    result.add(normalized)

    // Split compound names on underscores
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
 * These modifiers are intrinsic to the weapon and need to be applied as combat mods.
 */
function convertWeaponModifiersToCombatEffects(
  weaponModifiers: any[],
  unitId: string,
  weaponName: string,
): CombatEffect[] {
  const effects: CombatEffect[] = []
  console.log(`[WEAPON MOD] Converting modifiers for ${unitId} ${weaponName}:`, weaponModifiers)

  for (const mod of weaponModifiers) {
    if (!mod || typeof mod !== 'object') continue

    // Parse property (stat type)
    const property = String(mod.property ?? '').toLowerCase()
    let stat: CombatEffect['stat'] | null = null

    if (property === 'meleeattack') stat = 'meleeAttack'
    else if (property === 'rangedattack') stat = 'rangedAttack'
    else if (property === 'siegeattack') stat = 'siegeAttack'
    else continue // Skip non-attack modifiers for now

    // Parse effect (operation)
    const effectType = String(mod.effect ?? '').toLowerCase()
    let op: CombatEffect['op'] | null = null

    if (effectType === 'change') op = 'add'
    else if (effectType === 'multiply' || effectType === 'mult') op = 'mul'
    else continue

    // Parse value
    const value = Number(mod.value)
    if (!Number.isFinite(value)) continue

    // Parse target selector (which enemy classes this bonus applies against)
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

    // Create the combat effect
    // The selector is the unit itself (only this unit gets this weapon bonus)
    const effect: CombatEffect = {
      stat,
      op,
      value,
      select: {
        unitIds: [unitId.toLowerCase()],
      },
      target: targetSelector,
      sourceId: `${unitId}:${weaponName}:intrinsic`,
    }
    console.log(`[WEAPON MOD] Created effect:`, effect)
    effects.push(effect)
  }

  console.log(`[WEAPON MOD] Total effects for ${unitId}:`, effects.length)
  return effects
}

/**
 * Convert a ResolvedSimTeam to SimTeamInput for the engine.
 */
function buildSimTeamInput(
  resolvedTeam: ResolvedSimTeam,
  variationById: Map<string, { unit: CanonUnit; variation: any }>,
): SimTeamInput {
  console.log('[BUILD TEAM] Starting, units:', resolvedTeam.units.length)
  const units = []

  for (const _group of resolvedTeam.units) {
    console.log('[BUILD TEAM] Processing unit:', _group.unitId, 'variation:', _group.variationId)
    const unitData = variationById.get(_group.variationId)
    if (!unitData) {
      console.warn(`[buildSimTeamInput] unit variation not found: ${_group.variationId}`)
      continue
    }

    const { variation } = unitData

    // Convert armor to melee/ranged format
    const armorByType: Record<string, number> = {}
    const armor = variation.armor
    if (Array.isArray(armor)) {
      for (const a of armor) {
        armorByType[a.type] = a.value ?? 0
      }
    }

    // Convert weapons
    const weapons = (variation.weapons || []).map((w: any) => ({
      damageType: w.modifiers?.[0]?.damageType ?? 'Melee',
      isRanged: w.type === 'ranged',
      damageMin: w.damage ?? 0,
      damageMax: w.damage ?? 0,
      attackPeriod: w.speed ?? 1,
      rangeMin: w.range?.min ?? 0,
      rangeMax: w.range?.max ?? 0,
      name: w.name,
      rawType: w.type,
      isSpearwall: w.name === 'Spearwall',
    }))

    // Extract weapon modifiers (e.g., +17 vs cavalry) and convert to combat effects
    // Only process modifiers from non-torch weapons (torch is never the primary combat weapon)
    const weaponModifierEffects: CombatEffect[] = []
    console.log(
      `[BUILD UNIT] Processing ${_group.count}x ${_group.unitId}, weapons:`,
      variation.weapons?.length,
    )
    for (const w of variation.weapons || []) {
      // Skip torch weapons - they're auxiliary and not used for primary combat
      if (w.name === 'Torch' || w.type === 'fire') {
        console.log(`[BUILD UNIT] Skipping torch weapon: ${w.name}`)
        continue
      }

      if (Array.isArray(w.modifiers)) {
        console.log(`[BUILD UNIT] Weapon ${w.name} has modifiers:`, w.modifiers.length)
        const effects = convertWeaponModifiersToCombatEffects(
          w.modifiers,
          _group.unitId,
          w.name ?? 'weapon',
        )
        weaponModifierEffects.push(...effects)
      }
    }

    console.log(
      `[BUILD UNIT] ${_group.unitId} weapon modifier effects:`,
      weaponModifierEffects.length,
    )
    console.log(
      `[BUILD UNIT] ${_group.unitId} unit combat mods:`,
      _group.unitCombatMods?.effects?.length ?? 0,
    )

    // Merge weapon modifiers into unit combat mods
    const mergedCombatMods: TeamCombatMods = {
      effects: [...(_group.unitCombatMods?.effects ?? []), ...weaponModifierEffects],
    }
    console.log(
      `[BUILD UNIT] ${_group.unitId} MERGED combat mods:`,
      mergedCombatMods.effects.length,
    )

    units.push({
      unitId: _group.unitId,
      count: _group.count,
      stats: {
        hitpoints: variation.hitpoints ?? 30,
        armorMelee: armorByType['melee'] ?? 0,
        armorRanged: armorByType['ranged'] ?? 0,
        weapons,
      },
      types: expandClassNames(variation.classes || []),
      combatMods: mergedCombatMods,
    })
  }

  return {
    units,
    teamCombatMods: resolvedTeam.teamCombatMods,
    enableCounters: true,
  }
}
