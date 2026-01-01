// src/engine/auraEffects.ts
// Calculate and apply class-scoped aura effects (Bucket A)

import type { SimTeamInput } from './types'

/**
 * Calculate what percentage of a team's damage output comes from units matching specific classes.
 * Used to determine "target share" for class-filtered auras.
 *
 * @param team - Team to analyze
 * @param targetClasses - Array of class names to match (e.g., ['cavalry'])
 * @returns Object with unitShare (% of units) and dpsShare (% of DPS)
 *
 * @example
 * // Team: 5 knights (cavalry) + 10 archers (infantry)
 * calculateTargetShare(team, ['cavalry'])
 * // Returns: { unitShare: 0.33, dpsShare: 0.60 } (5/15 units, but 60% of DPS)
 */
export function calculateTargetShare(
  team: SimTeamInput,
  targetClasses: readonly string[],
): { unitShare: number; dpsShare: number } {
  let totalUnits = 0
  let totalDps = 0
  let matchingUnits = 0
  let matchingDps = 0

  for (const group of team.units) {
    const count = Math.max(0, Math.floor(group.count))
    if (count === 0) continue

    // Check if unit matches any target class
    const hasMatch = group.types.some((unitClass) =>
      targetClasses.some((targetClass) =>
        unitClass.toLowerCase().includes(targetClass.toLowerCase()),
      ),
    )

    // Calculate DPS from primary weapon
    const weapon = group.stats.weapons[0]
    const dps = weapon ? (weapon.damageMin + weapon.damageMax) / 2 / weapon.attackPeriod : 0
    const groupDps = dps * count

    totalUnits += count
    totalDps += groupDps

    if (hasMatch) {
      matchingUnits += count
      matchingDps += groupDps
    }
  }

  const unitShare = totalUnits > 0 ? matchingUnits / totalUnits : 0
  const dpsShare = totalDps > 0 ? matchingDps / totalDps : 0

  return { unitShare, dpsShare }
}

/**
 * Aura effect descriptor for simulation.
 */
export type AuraEffect = {
  abilityId: string
  abilityName: string
  sourceTeam: 'A' | 'B'
  targetTeam: 'A' | 'B' // Same team = buff, opposite team = debuff
  targetClasses: readonly string[] // e.g., ['cavalry'], [] = all units
  statModifier: 'damage' | 'armor' | 'attackSpeed' | 'moveSpeed'
  modifierOp: 'mul' | 'add'
  modifierValue: number // For mul: 0.8 = -20%, 1.15 = +15%. For add: +2 armor
  auraRange: number
  armorType?: 'melee' | 'ranged' // For armor modifiers: which armor to modify
  isPermanent?: boolean // Tower of Victory: effect persists after leaving range (no coverage scaling)
  bannerPersistSeconds?: number // Bannerman: banner persists N seconds after death
}

/**
 * Calculate the effective multiplier for an aura effect based on scenario parameters.
 *
 * Formula: target_share × coverage × uptime × effect_magnitude
 *
 * Special cases:
 * - Permanent effects (Tower of Victory): ignore coverage (always 1.0)
 * - Banner persistence: uptime extends beyond source death
 *
 * @param aura - The aura effect to calculate
 * @param affectedTeam - Team receiving the effect (enemy for debuffs, ally for buffs)
 * @param coverage - % of units in aura range (from scenario preset: 0.8 = Engaged, 0.5 = Skirmish, 0.3 = Open)
 * @param uptime - % of fight duration aura source survives (0-1, calculated during sim)
 * @returns Effective multiplier to apply (e.g., 0.96 for 4% damage reduction)
 */
export function calculateAuraMultiplier(
  aura: AuraEffect,
  affectedTeam: SimTeamInput,
  coverage: number,
  uptime: number,
): number {
  // Calculate what % of affected team matches the target class filter
  const targetShare =
    aura.targetClasses.length > 0
      ? calculateTargetShare(affectedTeam, aura.targetClasses).dpsShare
      : 1.0 // No filter = affects all units

  // Permanent effects (Tower of Victory) ignore coverage
  const effectiveCoverage = aura.isPermanent ? 1.0 : coverage

  // For multiplicative effects (damage, attack speed)
  if (aura.modifierOp === 'mul') {
    // Effect magnitude is how far from 1.0
    // 0.8 → magnitude = 0.2 (20% reduction)
    // 1.15 → magnitude = 0.15 (15% increase)
    const effectMagnitude = Math.abs(aura.modifierValue - 1.0)
    const effectDirection = aura.modifierValue < 1.0 ? -1 : 1

    // Net effect = target_share × coverage × uptime × magnitude
    const netEffect = targetShare * effectiveCoverage * uptime * effectMagnitude

    // Convert back to multiplier
    return 1.0 + effectDirection * netEffect
  }

  // For additive effects (armor)
  if (aura.modifierOp === 'add') {
    // Scale additive value by coverage and uptime
    // If uptime is 50%, treat as half armor bonus on average
    return aura.modifierValue * effectiveCoverage * uptime * targetShare
  }

  return 1.0 // No effect
}

/**
 * Detect which aura effects are active for a given matchup.
 *
 * @param teamA - First team (including abilities)
 * @param teamB - Second team
 * @returns Array of active aura effects
 */
export function detectActiveAuras(teamA: SimTeamInput, teamB: SimTeamInput): AuraEffect[] {
  const auras: AuraEffect[] = []

  // TODO: Parse abilityIds from team units for dynamic detection
  // For now, detect Tier 1 auras based on unit types and IDs

  // Helper: check both teams for an aura source
  const checkTeamForAura = (team: SimTeamInput, teamLabel: 'A' | 'B', targetTeam: 'A' | 'B') => {
    for (const group of team.units) {
      // 1. Camel Unease: Camel units reduce enemy cavalry damage by 20%
      const hasCamel = group.types.some((type) => type.toLowerCase().includes('camel'))
      if (
        hasCamel &&
        !auras.some((a) => a.abilityId === 'ability-camel-unease' && a.sourceTeam === teamLabel)
      ) {
        auras.push({
          abilityId: 'ability-camel-unease',
          abilityName: 'Camel Unease',
          sourceTeam: teamLabel,
          targetTeam,
          targetClasses: ['cavalry'],
          statModifier: 'damage',
          modifierOp: 'mul',
          modifierValue: 0.8, // -20% damage
          auraRange: 5,
        })
      }

      // 2. Camel Support: Camel units grant +2 melee armor to friendly infantry
      // Only include if the source team actually fields infantry; otherwise skip (no targets)
      const sourceHasInfantry = team.units.some((u) =>
        u.types.some((t) => t.toLowerCase().includes('infantry')),
      )
      if (
        hasCamel &&
        sourceHasInfantry &&
        !auras.some((a) => a.abilityId === 'ability-camel-support' && a.sourceTeam === teamLabel)
      ) {
        auras.push({
          abilityId: 'ability-camel-support',
          abilityName: 'Camel Support',
          sourceTeam: teamLabel,
          targetTeam: teamLabel, // Same team = buff
          targetClasses: ['infantry'],
          statModifier: 'armor',
          modifierOp: 'add',
          modifierValue: 2,
          auraRange: 5,
          armorType: 'melee',
        })
      }

      // 3. Katana Bannerman: +15% damage to friendly melee infantry
      const isKatanaBannerman = group.unitId.includes('katana-bannerman')
      if (
        isKatanaBannerman &&
        !auras.some((a) => a.abilityId === 'ability-katana-bannerman' && a.sourceTeam === teamLabel)
      ) {
        auras.push({
          abilityId: 'ability-katana-bannerman',
          abilityName: 'Katana Bannerman Aura',
          sourceTeam: teamLabel,
          targetTeam: teamLabel,
          targetClasses: ['infantry'], // Melee infantry (we'll filter melee in sim)
          statModifier: 'damage',
          modifierOp: 'mul',
          modifierValue: 1.15, // +15% damage
          auraRange: 6,
          bannerPersistSeconds: 30,
        })
      }

      // 4. Uma Bannerman: +15% damage to friendly cavalry
      const isUmaBannerman = group.unitId.includes('uma-bannerman')
      if (
        isUmaBannerman &&
        !auras.some((a) => a.abilityId === 'ability-uma-bannerman' && a.sourceTeam === teamLabel)
      ) {
        auras.push({
          abilityId: 'ability-uma-bannerman',
          abilityName: 'Uma Bannerman Aura',
          sourceTeam: teamLabel,
          targetTeam: teamLabel,
          targetClasses: ['cavalry'],
          statModifier: 'damage',
          modifierOp: 'mul',
          modifierValue: 1.15,
          auraRange: 6,
          bannerPersistSeconds: 30,
        })
      }

      // 5. Yumi Bannerman: +15% damage to friendly ranged infantry
      const isYumiBannerman = group.unitId.includes('yumi-bannerman')
      if (
        isYumiBannerman &&
        !auras.some((a) => a.abilityId === 'ability-yumi-bannerman' && a.sourceTeam === teamLabel)
      ) {
        auras.push({
          abilityId: 'ability-yumi-bannerman',
          abilityName: 'Yumi Bannerman Aura',
          sourceTeam: teamLabel,
          targetTeam: teamLabel,
          targetClasses: ['infantry'], // Ranged infantry (we'll filter ranged in sim)
          statModifier: 'damage',
          modifierOp: 'mul',
          modifierValue: 1.15,
          auraRange: 6,
          bannerPersistSeconds: 30,
        })
      }

      // 6. Tower of Victory: +20% attack speed to friendly infantry (PERMANENT)
      const isTowerOfVictory =
        group.unitId === 'tower-of-victory' || group.unitId.includes('tower-of-victory')
      if (
        isTowerOfVictory &&
        !auras.some((a) => a.abilityId === 'ability-tower-of-victory' && a.sourceTeam === teamLabel)
      ) {
        auras.push({
          abilityId: 'ability-tower-of-victory',
          abilityName: 'Tower of Victory',
          sourceTeam: teamLabel,
          targetTeam: teamLabel,
          targetClasses: ['infantry'],
          statModifier: 'attackSpeed',
          modifierOp: 'mul',
          modifierValue: 1.2, // +20% attack speed = 0.833× period
          auraRange: 7.5,
          isPermanent: true, // No coverage scaling
        })
      }

      // 7. Quick Strike (Ghulam): Attacks twice (2× attack speed)
      const isGhulam = group.unitId.includes('ghulam')
      if (
        isGhulam &&
        !auras.some((a) => a.abilityId === 'ability-quick-strike' && a.sourceTeam === teamLabel)
      ) {
        auras.push({
          abilityId: 'ability-quick-strike',
          abilityName: 'Quick Strike',
          sourceTeam: teamLabel,
          targetTeam: teamLabel, // Self-buff
          targetClasses: [], // No filter - affects the Ghulam itself
          statModifier: 'attackSpeed',
          modifierOp: 'mul',
          modifierValue: 2.0, // 2× attack speed = 0.5× period (attacks twice as fast)
          auraRange: 0, // Self-buff, no range needed
          isPermanent: true, // Always active on the unit
        })
      }
    }
  }

  // Check both teams
  checkTeamForAura(teamA, 'A', 'B')
  checkTeamForAura(teamB, 'B', 'A')

  return auras
}
