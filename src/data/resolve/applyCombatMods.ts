// src/data/resolve/applyCombatMods.ts
import type { CanonArmor, CanonUnitVariation, CanonWeapon } from '../canon/canonTypes'
import type { CombatEffect, TeamCombatMods } from './combatModsTypes'
import { matchesSelector } from './resolveCombatMods'

function norm(s: any) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

function getWeaponType(
  w: CanonWeapon,
): 'melee' | 'ranged' | 'siege' | 'fire' | 'other' | 'unknown' {
  const dt = norm(w.damageType)
  if (dt === 'melee') return 'melee'
  if (dt === 'ranged') return 'ranged'
  if (dt === 'siege') return 'siege'
  if (dt === 'fire') return 'fire'
  if (dt === 'other') return 'other'

  if (w.damageType) {
    console.warn(`⚠️ Unknown weapon damage type: "${w.damageType}"`)
  }

  return 'unknown'
}

function isWeaponMelee(w: CanonWeapon): boolean {
  return getWeaponType(w) === 'melee'
}
function isWeaponRanged(w: CanonWeapon): boolean {
  return getWeaponType(w) === 'ranged'
}
function isWeaponSiege(w: CanonWeapon): boolean {
  return getWeaponType(w) === 'siege'
}

function applyAddMul(
  base: number,
  op: 'add' | 'mul',
  value: number,
  options?: { stat?: string; sourceId?: string; clamp?: boolean },
): number {
  const result = op === 'add' ? base + value : base * value

  // Validation with optional warnings
  if (options?.clamp) {
    if (op === 'mul') {
      if (value === 0) {
        console.warn(
          `⚠️ Zero multiplier from ${options.sourceId} on ${options.stat}: ` +
            `${base} * 0 = 0 (likely unintended)`,
        )
      }
      if (value < 0) {
        console.warn(
          `⚠️ Negative multiplier from ${options.sourceId} on ${options.stat}: ` +
            `${base} * ${value} = ${result}`,
        )
      }
    }

    // Clamp final result for critical stats
    if (options.stat === 'hitpoints' && result < 1) {
      console.warn(`⚠️ HP would drop below 1 from ${options.sourceId}: clamping ${result} → 1`)
      return 1
    }
  }

  return result
}

export type AppliedEffectDebug = {
  sourceId: string
  stat: string
  op: 'add' | 'mul'
  value: number
}

export type EffectiveCombatStats = {
  hitpoints: number
  armor: CanonArmor
  weapons: CanonWeapon[]
  movement?: { speed: number }
  applied: AppliedEffectDebug[]
}

/**
 * "Unit card" effective stats: ignores target-conditional effects (bonus vs).
 */
export function applyCombatModsToVariation(args: {
  variation: CanonUnitVariation
  teamMods?: TeamCombatMods
  unitMods?: TeamCombatMods
}): EffectiveCombatStats {
  const v = args.variation

  let hitpoints = Number(v.hitpoints)
  let armorMelee = Number(v.armor?.melee ?? 0)
  let armorRanged = Number(v.armor?.ranged ?? 0)

  const weapons: CanonWeapon[] = (v.weapons ?? []).map((w) => ({ ...w }))
  const applied: AppliedEffectDebug[] = []

  function applyEffects(effects: readonly CombatEffect[]) {
    for (const e of effects) {
      if (!matchesSelector(v, e.select)) continue

      // ✅ NEW: skip bonus-vs effects when computing intrinsic stats
      if (e.target) continue

      switch (e.stat) {
        case 'hitpoints':
          hitpoints = applyAddMul(hitpoints, e.op, e.value, {
            stat: 'hitpoints',
            sourceId: e.sourceId,
            clamp: true,
          })
          applied.push({ sourceId: e.sourceId, stat: e.stat, op: e.op, value: e.value })
          break
        case 'meleeArmor':
          armorMelee = applyAddMul(armorMelee, e.op, e.value)
          applied.push({ sourceId: e.sourceId, stat: e.stat, op: e.op, value: e.value })
          break
        case 'rangedArmor':
          armorRanged = applyAddMul(armorRanged, e.op, e.value)
          applied.push({ sourceId: e.sourceId, stat: e.stat, op: e.op, value: e.value })
          break
        case 'meleeAttack':
          for (const w of weapons) {
            if (!isWeaponMelee(w)) continue
            w.damageMin = applyAddMul(Number(w.damageMin), e.op, e.value)
            w.damageMax = applyAddMul(Number(w.damageMax), e.op, e.value)
          }
          applied.push({ sourceId: e.sourceId, stat: e.stat, op: e.op, value: e.value })
          break
        case 'rangedAttack':
          for (const w of weapons) {
            if (!isWeaponRanged(w)) continue
            w.damageMin = applyAddMul(Number(w.damageMin), e.op, e.value)
            w.damageMax = applyAddMul(Number(w.damageMax), e.op, e.value)
          }
          applied.push({ sourceId: e.sourceId, stat: e.stat, op: e.op, value: e.value })
          break
        case 'siegeAttack':
          for (const w of weapons) {
            if (!isWeaponSiege(w)) continue
            w.damageMin = applyAddMul(Number(w.damageMin), e.op, e.value)
            w.damageMax = applyAddMul(Number(w.damageMax), e.op, e.value)
          }
          applied.push({ sourceId: e.sourceId, stat: e.stat, op: e.op, value: e.value })
          break
        case 'attackSpeed':
          for (const w of weapons) {
            w.attackPeriod = applyAddMul(Number(w.attackPeriod), e.op, e.value)
          }
          applied.push({ sourceId: e.sourceId, stat: e.stat, op: e.op, value: e.value })
          break
        case 'range':
          for (const w of weapons) {
            w.rangeMax = applyAddMul(Number(w.rangeMax), e.op, e.value)
          }
          applied.push({ sourceId: e.sourceId, stat: e.stat, op: e.op, value: e.value })
          break
      }
    }
  }

  if (args.teamMods?.effects?.length) applyEffects(args.teamMods.effects)
  if (args.unitMods?.effects?.length) applyEffects(args.unitMods.effects)

  return {
    hitpoints,
    armor: { melee: armorMelee, ranged: armorRanged },
    weapons,
    movement: v.movement,
    applied,
  }
}

/**
 * Attack-context: applies target-conditional bonuses (bonus-vs) to weapon damage
 * when defender matches effect.target.
 *
 * This only modifies damageMin/Max (attack stats). Armor/HP are intrinsic.
 */
export function applyCombatModsToWeaponsAgainstDefender(args: {
  attacker: CanonUnitVariation
  defender: CanonUnitVariation
  teamMods?: TeamCombatMods
  unitMods?: TeamCombatMods
}): { weapons: CanonWeapon[]; applied: AppliedEffectDebug[] } {
  const a = args.attacker
  const d = args.defender

  const weapons: CanonWeapon[] = (a.weapons ?? []).map((w) => ({ ...w }))
  const applied: AppliedEffectDebug[] = []

  function applyEffects(effects: readonly CombatEffect[]) {
    for (const e of effects) {
      if (!matchesSelector(a, e.select)) continue

      // target-conditional check (if present)
      if (e.target) {
        if (!matchesSelector(d, e.target)) continue
      }

      // Only attack-related stats matter here
      if (e.stat === 'meleeAttack') {
        for (const w of weapons) {
          if (!isWeaponMelee(w)) continue
          w.damageMin = applyAddMul(Number(w.damageMin), e.op, e.value)
          w.damageMax = applyAddMul(Number(w.damageMax), e.op, e.value)
        }
        applied.push({ sourceId: e.sourceId, stat: e.stat, op: e.op, value: e.value })
      } else if (e.stat === 'rangedAttack') {
        for (const w of weapons) {
          if (!isWeaponRanged(w)) continue
          w.damageMin = applyAddMul(Number(w.damageMin), e.op, e.value)
          w.damageMax = applyAddMul(Number(w.damageMax), e.op, e.value)
        }
        applied.push({ sourceId: e.sourceId, stat: e.stat, op: e.op, value: e.value })
      } else if (e.stat === 'siegeAttack') {
        for (const w of weapons) {
          if (!isWeaponSiege(w)) continue
          w.damageMin = applyAddMul(Number(w.damageMin), e.op, e.value)
          w.damageMax = applyAddMul(Number(w.damageMax), e.op, e.value)
        }
        applied.push({ sourceId: e.sourceId, stat: e.stat, op: e.op, value: e.value })
      }
    }
  }

  if (args.teamMods?.effects?.length) applyEffects(args.teamMods.effects)
  if (args.unitMods?.effects?.length) applyEffects(args.unitMods.effects)

  return { weapons, applied }
}
