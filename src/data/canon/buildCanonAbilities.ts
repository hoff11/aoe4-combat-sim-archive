// src/data/canon/buildCanonAbilities.ts
// Build canon abilities from raw game-data abilities

import type { RawEnvelope } from '../raw/rawTypes'
import type {
  CanonAbility,
  CanonAbilities,
  AbilityActivation,
  AbilityEffect,
} from './canonAbilityTypes'
import type { CivCode } from './civs'

/**
 * Parse ability effects from description text.
 * Many abilities have placeholder effects in raw data, so we extract from description.
 */
function parseEffectsFromDescription(description: string, _abilityId: string): AbilityEffect[] {
  const effects: AbilityEffect[] = []
  const desc = description.toLowerCase()

  // Camel Unease: -20% damage for enemy cavalry
  if (desc.includes('20% less damage') || desc.includes('deal 20% less')) {
    effects.push({
      stat: 'damage',
      op: 'mul',
      value: 0.8, // 20% reduction = 0.8x multiplier
      affectsEnemies: ['cavalry'], // Could be more specific: horse cavalry
    })
  }

  // Camel Support: +2 armor for infantry
  if (
    desc.includes('infantry gain armor') ||
    (desc.includes('infantry gain') && desc.includes('armor'))
  ) {
    const match = desc.match(/(\d+)\s*armor/)
    if (match) {
      effects.push({
        stat: 'armor',
        op: 'add',
        value: parseInt(match[1]),
        affectsAllies: ['infantry'],
      })
    }
  }

  // Prelate inspiration: +movement speed
  if (desc.includes('movement speed') && desc.includes('+')) {
    const match = desc.match(/\+(\d+)%\s*movement/)
    if (match) {
      effects.push({
        stat: 'speed',
        op: 'mul',
        value: 1 + parseInt(match[1]) / 100,
        affectsAllies: [], // Apply to nearby units
      })
    }
  }

  return effects
}

/**
 * Determine activation type from raw data.
 */
function getActivationType(active: string | undefined): AbilityActivation {
  if (!active) return 'conditional'
  switch (active.toLowerCase()) {
    case 'always':
      return 'always'
    case 'manual':
      return 'manual'
    case 'toggle':
      return 'toggled'
    default:
      return 'conditional'
  }
}

/**
 * Extract unit IDs from activatedOn field.
 * Format: "units/camel-rider" -> "camel-rider"
 */
function parseActivatedOn(activatedOn: string[] | undefined): string[] {
  if (!activatedOn) return []
  return activatedOn
    .map((s) => {
      const match = s.match(/units\/(.+)/)
      return match ? match[1] : s
    })
    .filter(Boolean)
}

/**
 * Extract tech IDs from unlockedBy field.
 * Format: "technologies/camel-support" -> "camel-support"
 */
function parseUnlockedBy(unlockedBy: string[] | undefined): string[] {
  if (!unlockedBy) return []
  return unlockedBy
    .map((s) => {
      const match = s.match(/technologies\/(.+)/)
      return match ? match[1] : s
    })
    .filter(Boolean)
}

/**
 * Check if ability is combat-relevant.
 * Filter out non-combat abilities like conversion, healing, resource gathering, etc.
 */
function isCombatRelevant(raw: any): boolean {
  const name = raw.name?.toLowerCase() || ''
  const desc = raw.description?.toLowerCase() || ''
  const baseId = raw.baseId?.toLowerCase() || raw.id?.toLowerCase() || ''

  // Exclude: conversion, healing, building, economic, special mechanics
  const excludePatterns = [
    'conversion',
    'heal',
    'repair',
    'construct',
    'build',
    'gather',
    'convert',
    'transport',
    'sacred',
    'inspire', // Prelate inspire is economic bonus
    'detonate', // Self-destruct
    'ram', // Building attack toggle
  ]

  for (const pattern of excludePatterns) {
    if (name.includes(pattern) || baseId.includes(pattern)) {
      return false
    }
  }

  // Include: damage modifiers, armor, movement, attack bonuses, auras
  const includePatterns = [
    'damage',
    'armor',
    'attack',
    'unease', // Camel unease
    'support', // Camel support
    'charge',
    'stance',
    'weapon',
    'blade',
    'bow',
    'speed',
  ]

  for (const pattern of includePatterns) {
    if (desc.includes(pattern) || name.includes(pattern) || baseId.includes(pattern)) {
      return true
    }
  }

  // If has aura range and affects combat stats, likely relevant
  if (raw.auraRange > 0 && raw.active === 'always') {
    return true
  }

  return false
}

/**
 * Extract unit IDs that have this ability.
 * Check both activatedOn field and effects.select.id fields.
 */
function extractUnitIds(raw: any): string[] {
  const unitIds = new Set<string>()

  // Method 1: activatedOn field (format: "units/camel-rider")
  const activatedOn = parseActivatedOn(raw.activatedOn)
  for (const id of activatedOn) {
    unitIds.add(id)
  }

  // Method 2: effects[].select.id (direct unit IDs)
  if (raw.effects && Array.isArray(raw.effects)) {
    for (const effect of raw.effects) {
      if (effect.select?.id && Array.isArray(effect.select.id)) {
        for (const id of effect.select.id) {
          unitIds.add(id)
        }
      }
    }
  }

  return Array.from(unitIds)
}

/**
 * Build canon ability from raw ability data.
 */
function buildCanonAbility(raw: any): CanonAbility | null {
  if (!raw.id || !raw.name) return null
  if (!isCombatRelevant(raw)) return null

  const baseId = raw.baseId || raw.id
  const civs = (raw.civs || []) as CivCode[]
  const age = raw.age || 1

  // Parse effects from description since raw effects often have placeholders
  const parsedEffects = parseEffectsFromDescription(raw.description || '', raw.id)

  // Extract units that have this ability
  const unitIds = extractUnitIds(raw)

  const ability: CanonAbility = {
    id: raw.id,
    baseId,
    name: raw.name,
    civs,
    minAge: age,
    activation: getActivationType(raw.active),
    auraRange: raw.auraRange || 0,
    cooldown: raw.cooldown,
    description: raw.description || '',
    icon: raw.icon || '',
    activatedOn: unitIds,
    unlockedBy: parseUnlockedBy(raw.unlockedBy),
    effects: parsedEffects,
    rawEffects: raw.effects || [],
  }

  return ability
}

/**
 * Build canon abilities collection from raw abilities data.
 * Groups by base ID and creates lookup maps.
 */
export function buildCanonAbilities(rawAbilities: RawEnvelope<any>): CanonAbilities {
  const byId = new Map<string, CanonAbility>()
  const byUnit = new Map<string, CanonAbility[]>()

  if (!rawAbilities?.data) {
    return { byId, byUnit }
  }

  // Parse each raw ability
  for (const raw of rawAbilities.data) {
    const ability = buildCanonAbility(raw)
    if (!ability) continue

    // Store by base ID (use most recent/highest age version)
    const existing = byId.get(ability.baseId)
    if (!existing || ability.minAge >= existing.minAge) {
      byId.set(ability.baseId, ability)
    }

    // Index by unit IDs that have this ability
    for (const unitId of ability.activatedOn) {
      const list = byUnit.get(unitId) || []
      // Avoid duplicates
      if (!list.some((a) => a.baseId === ability.baseId)) {
        list.push(ability)
      }
      byUnit.set(unitId, list)
    }
  }

  console.log(`[buildCanonAbilities] Parsed ${byId.size} combat-relevant abilities`)
  console.log(`[buildCanonAbilities] Indexed ${byUnit.size} units with abilities`)

  return { byId, byUnit }
}
