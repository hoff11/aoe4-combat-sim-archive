// src/engine/combatStats.ts
// Damage calculation: base weapon damage + combat mods (bonusVs, weaponDamage) - armor.

import type { CombatEffect, CombatSelector } from '../data/resolve/combatModsTypes'
import type { Weapon } from './types'

type SimUnitLike = {
  unitId: string
  types: readonly string[]
  weapon: Weapon | null
  armorMelee: number
  armorRanged: number
}

/**
 * Check if unit matches a combat selector (class + unit filters).
 * MATCH RULES (from resolve layer):
 * 1. If selector.unitIds and unit is in list: MATCH
 * 2. If selector.anyOfAll groups: for each group, check if unit has ALL classes in group
 *    If any group fully matches: MATCH
 * 3. Default (no criteria): NO MATCH (empty selector is invalid)
 */
function matchesSelector(unit: SimUnitLike, sel: CombatSelector | undefined): boolean {
  if (!sel) return false

  const baseUnitId = String(unit.unitId).toLowerCase()
  const classes = new Set((unit.types ?? []).map((c) => String(c).toLowerCase()))

  if (sel.unitIds) {
    for (const id of sel.unitIds) {
      if (String(id).toLowerCase() === baseUnitId) return true
    }
  }

  if (sel.anyOfAll) {
    for (const group of sel.anyOfAll) {
      let ok = true
      for (const need of group) {
        if (!need) continue
        if (!classes.has(String(need).toLowerCase())) {
          ok = false
          break
        }
      }
      if (ok) return true
    }
  }

  return false
}

/**
 * Compute raw damage from attacker weapon + mods vs defender armor.
 * Uses max weapon damage as baseline (consistent, simple).
 *
 * @param attacker Unit attacking
 * @param defender Unit defending
 * @param effects Combat effects from resolved techs
 * @returns Damage dealt (≥ 0)
 */
export function computeHit(
  attacker: SimUnitLike,
  defender: SimUnitLike,
  effects: readonly CombatEffect[] = [],
): number {
  const w = attacker.weapon
  if (!w) return 0

  let baseDamage = w.damageMax

  // Apply tech effects
  let addBonus = 0
  let mulBonus = 1
  for (const effect of effects) {
    // Check if attacker and defender match selectors
    const attackerMatches = matchesSelector(attacker, effect.select)
    const defenderMatches = !effect.target || matchesSelector(defender, effect.target)

    if (!attackerMatches) continue
    if (effect.target && !defenderMatches) continue

    // Apply effect: only hitpoints/armor effects in combatStats
    if (effect.stat === 'meleeAttack' && !w.isRanged) {
      if (effect.op === 'add') addBonus += effect.value
      else if (effect.op === 'mul') mulBonus *= effect.value
    } else if (effect.stat === 'rangedAttack' && w.isRanged) {
      if (effect.op === 'add') addBonus += effect.value
      else if (effect.op === 'mul') mulBonus *= effect.value
    }
  }

  baseDamage = baseDamage * mulBonus + addBonus

  // Apply armor
  const armor = w.isRanged ? defender.armorRanged : defender.armorMelee
  const dmg = baseDamage - armor

  return Math.max(0, dmg)
}
