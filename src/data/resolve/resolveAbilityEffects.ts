// src/data/resolve/resolveAbilityEffects.ts
// Convert ability data into CombatEffect[] for the combat engine

import type { CanonAbility, CanonAbilities } from '../canon/canonAbilityTypes'
import type { CombatEffect, CombatSelector } from './combatModsTypes'

/**
 * Convert ability targets into CombatSelector format.
 *
 * For Camel Unease: affects enemy cavalry
 * Returns selector that matches cavalry classes.
 */
function buildAbilitySelector(affectedClasses: string[], affectedUnits?: string[]): CombatSelector {
  const selector: CombatSelector = {}

  if (affectedUnits && affectedUnits.length > 0) {
    selector.unitIds = affectedUnits
  }

  if (affectedClasses && affectedClasses.length > 0) {
    // Convert single class array to anyOfAll format: [["cavalry"]]
    selector.anyOfAll = affectedClasses.map((cls) => [cls])
  }

  return selector
}

/**
 * Convert a single ability into combat effects.
 *
 * Example: Camel Unease → -20% damage for enemy cavalry
 */
function abilityToCombatEffects(ability: CanonAbility): CombatEffect[] {
  const effects: CombatEffect[] = []

  for (const eff of ability.effects) {
    // Map ability stat names to combat stat IDs
    let stat: CombatEffect['stat']

    switch (eff.stat) {
      case 'damage':
        // For debuffs, this affects enemy attack damage
        // We'll use both melee and ranged attack reductions
        stat = 'meleeAttack'
        break
      case 'armor':
        // Could be meleeArmor or rangedArmor - use melee for now
        stat = 'meleeArmor'
        break
      case 'speed':
        stat = 'attackSpeed'
        break
      default:
        // Skip unknown stats
        continue
    }

    // Determine who this effect targets
    const target = eff.affectsEnemies
      ? buildAbilitySelector(eff.affectsEnemies)
      : eff.affectsAllies
        ? buildAbilitySelector(eff.affectsAllies)
        : undefined

    // For damage debuffs (Camel Unease), need both melee and ranged
    if (eff.stat === 'damage') {
      // Melee attack debuff
      effects.push({
        stat: 'meleeAttack',
        op: eff.op,
        value: eff.value,
        select: {}, // Applies to all enemy units matching target
        target,
        sourceId: ability.baseId,
      })

      // Ranged attack debuff
      effects.push({
        stat: 'rangedAttack',
        op: eff.op,
        value: eff.value,
        select: {}, // Applies to all enemy units matching target
        target,
        sourceId: ability.baseId,
      })
    } else {
      // Other effects (armor, speed, etc.)
      effects.push({
        stat,
        op: eff.op,
        value: eff.value,
        select: target || {}, // Who gets affected
        sourceId: ability.baseId,
      })
    }
  }

  return effects
}

/**
 * Resolve combat effects from team abilities.
 *
 * @param abilities - All canon abilities
 * @param activeAbilityIds - Ability IDs active on this team's units
 * @returns Combat effects to apply
 */
export function resolveAbilityEffects(args: {
  abilities: CanonAbilities
  activeAbilityIds: string[]
}): CombatEffect[] {
  const { abilities, activeAbilityIds } = args
  const effects: CombatEffect[] = []

  for (const abilityId of activeAbilityIds) {
    const ability = abilities.byId.get(abilityId)
    if (!ability) continue

    // Only process passive auras for now
    if (ability.activation !== 'always') continue

    const abilityEffects = abilityToCombatEffects(ability)
    effects.push(...abilityEffects)
  }

  return effects
}

/**
 * Collect all active ability IDs from a team's units.
 */
export function collectTeamAbilities(units: Array<{ abilityIds?: string[] }>): string[] {
  const abilitySet = new Set<string>()

  for (const unit of units) {
    if (!unit.abilityIds) continue
    for (const id of unit.abilityIds) {
      abilitySet.add(id)
    }
  }

  return Array.from(abilitySet)
}
