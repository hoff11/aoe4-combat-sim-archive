// src/data/resolve/combatModsTypes.ts

export type CombatStatId =
  | 'meleeAttack'
  | 'rangedAttack'
  | 'siegeAttack'
  | 'meleeArmor'
  | 'rangedArmor'
  | 'hitpoints'
  | 'attackSpeed'
  | 'range'

export type CombatOp = 'add' | 'mul'

/**
 * Combat effect selector - determines which units are affected.
 *
 * MATCHING RULES (in order):
 * 1. If `unitIds` is present and unit.baseUnitId matches ANY: MATCH ✓
 * 2. If `anyOfAll` is present:
 *    - For EACH group in anyOfAll, check if unit has ALL classes in that group (AND within group)
 *    - If ANY group matches completely: MATCH ✓ (OR across groups)
 * 3. Otherwise: NO MATCH ✗
 *
 * EXAMPLES:
 * - unitIds: ["knight"] → matches units with baseUnitId "knight" only
 * - anyOfAll: [["cavalry"]] → matches any unit with "cavalry" class
 * - anyOfAll: [["cavalry", "ranged"]] → matches cavalry units that are also ranged
 * - anyOfAll: [["cavalry"], ["archer"]] → matches cavalry OR archer (not cavalry+archer)
 *
 * @see matchesSelector() implementation in resolveCombatMods.ts
 */
export type CombatSelector = {
  /**
   * Target by exact unit ID match.
   * If present, is checked first (allows quick ID-based matching).
   *
   * Example: ["archer", "spearman"]
   */
  unitIds?: string[]

  /**
   * Target by class matching - array of groups, where:
   * - Within a group: ALL classes required (AND)
   * - Across groups: ANY group satisfies (OR)
   *
   * Example: [["melee", "heavy"], ["ranged"]]
   *   → (melee AND heavy) OR (ranged)
   */
  anyOfAll?: string[][]
}

/**
 * Combat effect: a modification to unit stats, optionally conditional on defender type.
 *
 * Effects are applied in two contexts:
 * 1. **Intrinsic stats** (unit card): armor, HP - applied if unit matches `select`
 * 2. **Attack-context** (vs defender): weapons damage - applied if attacker matches `select` AND
 *    defender matches `target` (if target is specified)
 */
export type CombatEffect = {
  /** Combat stat affected by this effect (damage, armor, etc.) */
  stat: CombatStatId

  /** Operation: "add" for flat bonus, "mul" for multiplier */
  op: CombatOp

  /** Value applied by operation (e.g., +2 attack, *1.1 speed) */
  value: number

  /**
   * Selector: which units GET this effect (attacker who owns the upgrade).
   * Used in all apply functions.
   *
   * @see CombatSelector documentation for matching rules
   */
  select: CombatSelector

  /**
   * Optional target selector: which units this effect applies AGAINST (defender).
   * Only used in applyCombatModsToWeaponsAgainstDefender().
   *
   * Example: bonus vs armored units would have target: { anyOfAll: [["armored"]] }
   *
   * @see CombatSelector documentation for matching rules
   */
  target?: CombatSelector

  /** Tech ID or source that provided this effect */
  sourceId: string
}

export type TeamCombatMods = {
  effects: CombatEffect[]
}
