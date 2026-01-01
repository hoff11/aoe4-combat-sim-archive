// src/engine/rules/counters.ts
// Class-based combat bonuses (spears vs cavalry, etc.).

function hasType(types: readonly string[], t: string): boolean {
  const normalized = String(t).toLowerCase()
  return types.some((typ) => String(typ).toLowerCase() === normalized)
}

/**
 * Bonus multiplier for attacker type vs defender type.
 * Simple, transparent class-matching system.
 *
 * @param attackerTypes Classes of attacker unit
 * @param defenderTypes Classes of defender unit
 * @returns Multiplier (1.0 = no bonus)
 */
export function counterMultiplier(
  attackerTypes: readonly string[],
  defenderTypes: readonly string[],
): number {
  // Spears vs cavalry
  if (
    hasType(attackerTypes, 'spearman') &&
    (hasType(defenderTypes, 'cavalry') || hasType(defenderTypes, 'mounted'))
  ) {
    return 1.35
  }

  // Crossbows vs armored/heavy
  if (
    hasType(attackerTypes, 'crossbow') &&
    (hasType(defenderTypes, 'armored') || hasType(defenderTypes, 'infantry_heavy'))
  ) {
    return 1.3
  }

  // Archers vs light infantry
  if (
    hasType(attackerTypes, 'archer') &&
    (hasType(defenderTypes, 'infantry_light') || hasType(defenderTypes, 'infantry'))
  ) {
    return 1.05
  }

  // Knights vs ranged
  if (
    (hasType(attackerTypes, 'cavalry') || hasType(attackerTypes, 'mounted')) &&
    hasType(defenderTypes, 'ranged')
  ) {
    return 1.1
  }

  return 1.0
}
