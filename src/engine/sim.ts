// Extend globalThis for kiting temp storage
type KitingGlobals = typeof globalThis & {
  __kitingTimeline?: TimelinePoint[]
  __kitingTotalDamageA?: number
  __kitingTotalDamageB?: number
  __kitingTotalTime?: number
}
// src/engine/sim.ts
// Tick-by-tick combat simulation engine.
// Takes resolved config, runs event-driven combat loop, returns timeline + stats.

import type { SimTeamInput, SimResult, TimelinePoint, SimOptions, AuraTrackingInfo } from './types'
import type { CombatEffect } from '../data/resolve/combatModsTypes'
import { getScenarioParams } from './types'
import { mulberry32 } from './rng'
import { computeHit } from './combatStats'
import { counterMultiplier } from './rules/counters'
import { detectActiveAuras, calculateAuraMultiplier, calculateTargetShare } from './auraEffects'
// (unused type import removed)

import type { Weapon } from './types'
type SimUnit = {
  team: 'A' | 'B'
  unitId: string
  types: readonly string[]
  hp: number
  nextAttack: number
  weapon: Weapon | null
  // Optional ranged weapon used only during the opening volley phase
  volleyWeapon?: Weapon | null
  armorMelee: number
  armorRanged: number
  moveSpeed: number // Tiles per second
  // Flags indicating if this unit has any melee/ranged weapons available in its loadout
  hasAnyMeleeWeapon?: boolean
  hasAnyRangedWeapon?: boolean
  weapons?: Weapon[]
  // Unit-specific combat mods (e.g., weapon modifiers like +17 vs cavalry)
  combatMods?: { effects: readonly CombatEffect[] }
}

function buildArmy(team: 'A' | 'B', input: SimTeamInput): SimUnit[] {
  const out: SimUnit[] = []

  for (const spawn of input.units) {
    const n = Math.max(0, Math.floor(spawn.count))
    if (n === 0) continue

    const weapons = spawn.stats.weapons ?? []
    const sustainedIdx =
      typeof spawn.sustainedWeaponIndex === 'number' ? spawn.sustainedWeaponIndex : 0
    const volleyIdx =
      typeof spawn.volleyWeaponIndex === 'number'
        ? spawn.volleyWeaponIndex
        : weapons.findIndex((ww) => ww?.isRanged)

    const primary = weapons[sustainedIdx] ?? null
    const volley = volleyIdx >= 0 ? weapons[volleyIdx] : null
    const hasAnyMelee = weapons.some((ww) => ww && ww.isRanged === false)
    const hasAnyRanged = weapons.some((ww) => ww && ww.isRanged === true)

    for (let i = 0; i < n; i++) {
      out.push({
        team,
        unitId: spawn.unitId,
        types: spawn.types,
        hp: spawn.stats.hitpoints,
        nextAttack: (i % 5) * 0.1,
        weapon: primary
          ? {
              damageType: primary.damageType,
              isRanged: primary.isRanged,
              damageMin: primary.damageMin,
              damageMax: primary.damageMax,
              attackPeriod: primary.attackPeriod,
              rangeMin: primary.rangeMin,
              rangeMax: primary.rangeMax,
            }
          : null,
        volleyWeapon: volley
          ? {
              damageType: volley.damageType,
              isRanged: volley.isRanged,
              damageMin: volley.damageMin,
              damageMax: volley.damageMax,
              attackPeriod: volley.attackPeriod,
              rangeMin: volley.rangeMin,
              rangeMax: volley.rangeMax,
            }
          : null,
        armorMelee: spawn.stats.armorMelee,
        armorRanged: spawn.stats.armorRanged,
        moveSpeed: spawn.stats.movement?.speed ?? 1.5, // Default to 1.5 if missing
        hasAnyMeleeWeapon: hasAnyMelee,
        hasAnyRangedWeapon: hasAnyRanged,
        weapons: [...weapons], // propagate all weapons for special logic (e.g., spearwall) as mutable array
        combatMods: spawn.combatMods, // Store unit-specific combat mods (weapon modifiers, etc.)
      })
    }
  }

  return out
}

function countAlive(army: SimUnit[]): number {
  let c = 0
  for (const u of army) if (u.hp > 0) c++
  return c
}

function collectAlive(army: SimUnit[]): SimUnit[] {
  return army.filter((u) => u.hp > 0)
}

function sumHpAlive(army: SimUnit[]): number {
  let s = 0
  for (const u of army) if (u.hp > 0) s += u.hp
  return s
}

function pickAliveTarget(rng: () => number, alive: SimUnit[]): SimUnit | null {
  if (alive.length === 0) return null
  for (let tries = 0; tries < 6; tries++) {
    const t = alive[Math.floor(rng() * alive.length)]
    if (t && t.hp > 0) return t
  }
  for (const t of alive) if (t.hp > 0) return t
  return null
}

export function runSim(teamA: SimTeamInput, teamB: SimTeamInput, opts: SimOptions): SimResult {
  // Track if Spearwall is used in this fight
  let spearwallUsed = false
  const seed = opts.seed ?? 0
  const rng = mulberry32(seed)
  const tick = Math.max(0.05, opts.tickInterval)

  const armyA = buildArmy('A', teamA)
  const armyB = buildArmy('B', teamB)

  // Analyze bonus damage potential (for display purposes)
  const analyzeBonusDamage = () => {
    const result: {
      teamA: Array<{ unitType: string; targetClass: string; totalBonus: number }>
      teamB: Array<{ unitType: string; targetClass: string; totalBonus: number }>
    } = {
      teamA: [],
      teamB: [],
    }

    const analyzeTeam = (
      team: SimTeamInput,
      enemyArmy: SimUnit[],
      resultKey: 'teamA' | 'teamB',
    ) => {
      // Track bonuses by unit+target to avoid duplicates
      const bonusMap = new Map<
        string,
        { unitType: string; targetClass: string; totalBonus: number }
      >()

      for (const spawn of team.units) {
        if (spawn.count === 0) continue

        // Check unit-specific combat mods for weapon bonuses
        const combatEffects = spawn.combatMods?.effects || []

        for (const effect of combatEffects) {
          // Only look at attack bonuses with targets (bonus vs X)
          if (!effect.target) continue
          if (!['meleeAttack', 'rangedAttack', 'siegeAttack'].includes(effect.stat)) continue
          if (effect.op !== 'add' || effect.value <= 0) continue

          // Find enemy units that match this target selector
          const matchingEnemies = enemyArmy.filter((enemy) => {
            if (!effect.target) return false

            // Check if enemy matches target selector
            if (effect.target.anyOfAll) {
              return effect.target.anyOfAll.some((group) =>
                group.every((cls) => enemy.types.includes(cls)),
              )
            }

            return false
          })

          if (matchingEnemies.length > 0) {
            // Determine target class name for display
            let targetClassName = 'enemies'
            if (effect.target.anyOfAll && effect.target.anyOfAll[0]) {
              const classGroup = effect.target.anyOfAll[0]
              if (classGroup.includes('cavalry')) targetClassName = 'Cavalry'
              else if (classGroup.includes('elephant')) targetClassName = 'Elephants'
              else if (classGroup.includes('heavy')) targetClassName = 'Heavy units'
              else if (classGroup.includes('light')) {
                if (classGroup.includes('infantry')) targetClassName = 'Light Infantry'
                else targetClassName = 'Light units'
              } else if (classGroup.includes('infantry')) targetClassName = 'Infantry'
              else if (classGroup.includes('building')) targetClassName = 'Buildings'
              else targetClassName = classGroup.join(' ')
            }

            const unitType =
              spawn.unitId.charAt(0).toUpperCase() +
              spawn.unitId.slice(1).replace(/-/g, ' ').replace(/\d+$/, '').trim()
            const key = `${unitType}|${targetClassName}`

            // Calculate total bonus (bonus per hit * unit count * enemy count)
            const totalBonus = effect.value * spawn.count * matchingEnemies.length

            // Merge with existing entry or create new one
            const existing = bonusMap.get(key)
            if (existing) {
              existing.totalBonus += totalBonus
            } else {
              bonusMap.set(key, { unitType, targetClass: targetClassName, totalBonus })
            }
          }
        }
      }

      result[resultKey].push(...bonusMap.values())
    }

    analyzeTeam(teamA, armyB, 'teamA')
    analyzeTeam(teamB, armyA, 'teamB')

    return result.teamA.length > 0 || result.teamB.length > 0 ? result : undefined
  }

  const bonusDamage = analyzeBonusDamage()

  // Detect active auras for this matchup
  const activeAuras = detectActiveAuras(teamA, teamB)
  const scenarioParams = opts.scenarioParams ?? getScenarioParams(opts.scenario)

  // Track aura source survival for uptime calculation
  const auraSourceInitialCounts: Record<string, { teamA: number; teamB: number }> = {}
  const getAuraSourceMatcher = (aura: (typeof activeAuras)[0]) => {
    // Determine how to identify aura sources
    if (aura.abilityId.includes('camel'))
      return (u: SimUnit) => u.types.some((t) => t.toLowerCase().includes('camel'))
    if (aura.abilityId.includes('bannerman')) return (u: SimUnit) => u.unitId.includes('bannerman')
    if (aura.abilityId.includes('tower-of-victory'))
      return (u: SimUnit) => u.unitId.includes('tower-of-victory')
    if (aura.abilityId.includes('quick-strike')) return (u: SimUnit) => u.unitId.includes('ghulam')
    return () => false
  }

  for (const aura of activeAuras) {
    const sourceId = aura.abilityId
    if (!auraSourceInitialCounts[sourceId]) {
      auraSourceInitialCounts[sourceId] = { teamA: 0, teamB: 0 }
    }
    const matcher = getAuraSourceMatcher(aura)
    const sourceArmy = aura.sourceTeam === 'A' ? armyA : armyB
    auraSourceInitialCounts[sourceId][`team${aura.sourceTeam}`] = sourceArmy.filter(
      (u) => matcher(u) && u.hp > 0,
    ).length
  }

  // Apply armor buffs from auras (permanent modifiers applied before combat)
  for (const aura of activeAuras) {
    if (aura.statModifier !== 'armor') continue

    const affectedArmy = aura.targetTeam === 'A' ? armyA : armyB
    const affectedTeamInput = aura.targetTeam === 'A' ? teamA : teamB

    // Calculate armor bonus (scaled by coverage, assuming full uptime at start)
    const armorBonus = calculateAuraMultiplier(
      aura,
      affectedTeamInput,
      scenarioParams.auraCoverage,
      1.0,
    )

    // Apply armor to matching units
    for (const unit of affectedArmy) {
      const matchesFilter =
        aura.targetClasses.length === 0 ||
        unit.types.some((t) =>
          aura.targetClasses.some((tc) => t.toLowerCase().includes(tc.toLowerCase())),
        )

      if (matchesFilter) {
        if (aura.armorType === 'melee' || !aura.armorType) {
          unit.armorMelee += armorBonus
        }
        if (aura.armorType === 'ranged' || !aura.armorType) {
          unit.armorRanged += armorBonus
        }
      }
    }
  }

  // Store base attack periods for attack speed modifiers
  const baseAttackPeriods = new Map<SimUnit, number>()
  for (const unit of [...armyA, ...armyB]) {
    if (unit.weapon) {
      baseAttackPeriods.set(unit, unit.weapon.attackPeriod)
    }
  }

  // Bucket B: Calculate opening volley (pre-contact damage)
  let preContactDamageA = 0
  let preContactDamageB = 0
  let preContactAttacksA = 0
  let preContactAttacksB = 0
  let contactMade = true
  let timeToContact: number | null = scenarioParams.startingDistance === 0 ? 0 : null
  let scenarioExplanation = ''

  // Volley capability (any ranged weapon available for volley)
  const teamAHasVolleyRanged = armyA.some((u) => u.volleyWeapon && u.volleyWeapon.isRanged)
  const teamBHasVolleyRanged = armyB.some((u) => u.volleyWeapon && u.volleyWeapon.isRanged)

  // Kiting check: Can ranged maintain distance from melee?
  let kitingPreventsContact = false

  // Kiting eligibility (pure ranged vs pure melee). Mixed armies disable kiting.
  const teamAAnyRanged = armyA.some((u) => !!u.hasAnyRangedWeapon)
  const teamBAnyRanged = armyB.some((u) => !!u.hasAnyRangedWeapon)

  // Kiting eligible: one side has ranged, other doesn't (XOR rule)
  const kitingEligible = (teamAAnyRanged && !teamBAnyRanged) || (teamBAnyRanged && !teamAAnyRanged)

  // If kiting prevents contact, simulate continued ranged attacks until melee is dead
  let kitingResolved = false
  if (scenarioParams.kitingEnabled && scenarioParams.startingDistance > 0 && kitingEligible) {
    // Determine which team can kite
    const teamACanKite = teamAAnyRanged && !teamBAnyRanged
    const teamBCanKite = teamBAnyRanged && !teamAAnyRanged

    // For kiting, calculate speeds based on units that CAN do that role
    const getKitingRangedSpeed = (army: SimUnit[]) => {
      const rangedCapable = army.filter((u) => u.hasAnyRangedWeapon)
      if (rangedCapable.length === 0) return 0
      const totalSpeed = rangedCapable.reduce((sum, u) => sum + u.moveSpeed, 0)
      return totalSpeed / rangedCapable.length
    }

    const getKitingMeleeSpeed = (army: SimUnit[]) => {
      const meleeCapable = army.filter((u) => u.hasAnyMeleeWeapon)
      if (meleeCapable.length === 0) return 0
      const totalSpeed = meleeCapable.reduce((sum, u) => sum + u.moveSpeed, 0)
      return totalSpeed / meleeCapable.length
    }

    if (teamACanKite) {
      // Effective ranged retreat speed scales with openness
      const kitingRangedSpeedA = getKitingRangedSpeed(armyA)
      const kitingMeleeSpeedB = getKitingMeleeSpeed(armyB)
      const effectiveRetreatSpeed = kitingRangedSpeedA * scenarioParams.opennessFactor
      const netClosingSpeed = kitingMeleeSpeedB - effectiveRetreatSpeed

      if (netClosingSpeed <= 0) {
        kitingPreventsContact = true
        contactMade = false
        timeToContact = null
        scenarioExplanation = `Kiting: Team A ranged maintains distance (retreat ${effectiveRetreatSpeed.toFixed(1)} vs melee ${kitingMeleeSpeedB.toFixed(1)}). Team B melee cannot connect.`
        // Simulate continued ranged attacks from Team A until Team B is dead
        const rangedUnitsA = armyA.filter(
          (u) => u.hasAnyRangedWeapon && u.volleyWeapon && u.volleyWeapon.isRanged,
        )
        if (rangedUnitsA.length > 0 && armyB.length > 0) {
          const attackPeriod = Math.max(...rangedUnitsA.map((u) => u.volleyWeapon!.attackPeriod))
          const avgArmorB = armyB.reduce((sum, u) => sum + u.armorRanged, 0) / armyB.length
          const avgDamage = Math.max(
            0,
            rangedUnitsA.reduce(
              (sum, u) => sum + (u.volleyWeapon!.damageMin + u.volleyWeapon!.damageMax) / 2,
              0,
            ) /
              rangedUnitsA.length -
              avgArmorB,
          )
          let totalTime = 0
          // let totalAttacks = 0; // removed unused variable
          let totalDamage = preContactDamageA // already applied volley
          let remainingHP = armyB.reduce((sum, u) => sum + u.hp, 0)
          const timeline: TimelinePoint[] = []
          const hpPoolA = armyA.reduce((sum, u) => sum + u.hp, 0)
          let hpPoolB = remainingHP
          // Add initial timeline point
          timeline.push({
            t: 0,
            hpA: hpPoolA,
            hpB: hpPoolB,
            aliveA: armyA.length,
            aliveB: armyB.length,
          })
          while (remainingHP > 0 && avgDamage > 0) {
            // totalAttacks++;
            totalTime += attackPeriod
            remainingHP -= avgDamage
            totalDamage += avgDamage
            hpPoolB = Math.max(0, remainingHP)
            timeline.push({
              t: totalTime,
              hpA: hpPoolA,
              hpB: hpPoolB,
              aliveA: armyA.length,
              aliveB: hpPoolB > 0 ? 1 : 0,
            })
          }
          // Set all Team B units to dead
          for (const unit of armyB)
            unit.hp = 0
            // Update result stats for reporting
            // These will be used later in the result object
          ;(
            globalThis as {
              __kitingTimeline?: TimelinePoint[]
              __kitingTotalDamageA?: number
              __kitingTotalTime?: number
            }
          ).__kitingTimeline = timeline
          ;(
            globalThis as {
              __kitingTimeline?: TimelinePoint[]
              __kitingTotalDamageA?: number
              __kitingTotalTime?: number
            }
          ).__kitingTotalDamageA = totalDamage
          ;(
            globalThis as {
              __kitingTimeline?: TimelinePoint[]
              __kitingTotalDamageA?: number
              __kitingTotalTime?: number
            }
          ).__kitingTotalTime = totalTime
          scenarioExplanation += ` Team A ranged kites and finishes Team B in ${totalTime.toFixed(1)}s.`
          kitingResolved = true
        }
      }
    }

    if (teamBCanKite) {
      const kitingRangedSpeedB = getKitingRangedSpeed(armyB)
      const kitingMeleeSpeedA = getKitingMeleeSpeed(armyA)
      const effectiveRetreatSpeed = kitingRangedSpeedB * scenarioParams.opennessFactor
      const netClosingSpeed = kitingMeleeSpeedA - effectiveRetreatSpeed

      if (netClosingSpeed <= 0) {
        kitingPreventsContact = true
        contactMade = false
        timeToContact = null
        scenarioExplanation = `Kiting: Team B ranged maintains distance (retreat ${effectiveRetreatSpeed.toFixed(1)} vs melee ${kitingMeleeSpeedA.toFixed(1)}). Team A melee cannot connect.`
        // Simulate continued ranged attacks from Team B until Team A is dead
        const rangedUnitsB = armyB.filter(
          (u) => u.hasAnyRangedWeapon && u.volleyWeapon && u.volleyWeapon.isRanged,
        )
        if (rangedUnitsB.length > 0 && armyA.length > 0) {
          const attackPeriod = Math.max(...rangedUnitsB.map((u) => u.volleyWeapon!.attackPeriod))
          const avgArmorA = armyA.reduce((sum, u) => sum + u.armorRanged, 0) / armyA.length
          const avgDamage = Math.max(
            0,
            rangedUnitsB.reduce(
              (sum, u) => sum + (u.volleyWeapon!.damageMin + u.volleyWeapon!.damageMax) / 2,
              0,
            ) /
              rangedUnitsB.length -
              avgArmorA,
          )
          let totalTime = 0
          // let totalAttacks = 0; // removed unused variable
          let totalDamage = preContactDamageB
          let remainingHP = armyA.reduce((sum, u) => sum + u.hp, 0)
          const timeline: TimelinePoint[] = []
          const hpPoolB = armyB.reduce((sum, u) => sum + u.hp, 0)
          let hpPoolA = remainingHP
          timeline.push({
            t: 0,
            hpA: hpPoolA,
            hpB: hpPoolB,
            aliveA: hpPoolA > 0 ? 1 : 0,
            aliveB: armyB.length,
          })
          while (remainingHP > 0 && avgDamage > 0) {
            // totalAttacks++;
            totalTime += attackPeriod
            remainingHP -= avgDamage
            totalDamage += avgDamage
            hpPoolA = Math.max(0, remainingHP)
            timeline.push({
              t: totalTime,
              hpA: hpPoolA,
              hpB: hpPoolB,
              aliveA: hpPoolA > 0 ? 1 : 0,
              aliveB: armyB.length,
            })
          }
          for (const unit of armyA) unit.hp = 0
          ;(
            globalThis as {
              __kitingTimeline?: TimelinePoint[]
              __kitingTotalDamageB?: number
              __kitingTotalTime?: number
            }
          ).__kitingTimeline = timeline
          ;(
            globalThis as {
              __kitingTimeline?: TimelinePoint[]
              __kitingTotalDamageB?: number
              __kitingTotalTime?: number
            }
          ).__kitingTotalDamageB = totalDamage
          ;(
            globalThis as {
              __kitingTimeline?: TimelinePoint[]
              __kitingTotalDamageB?: number
              __kitingTotalTime?: number
            }
          ).__kitingTotalTime = totalTime
          scenarioExplanation += ` Team B ranged kites and finishes Team A in ${totalTime.toFixed(1)}s.`
          kitingResolved = true
        }
      }
    }
  }

  // Always initialize timeline before any code may push to it
  let t = 0
  const timeline: TimelinePoint[] = []

  // Calculate opening volley phase for all scenarios with starting distance
  // This applies even when kiting prevents melee contact (but not if kiting already resolved the fight)
  // Also, apply pre-contact damage to the timeline at the moment of contact
  if (scenarioParams.startingDistance > 0 && !kitingResolved) {
    // Determine closing speed: both armies approach each other
    // Use average speed of all units on each team
    const avgSpeedA = armyA.reduce((sum, u) => sum + u.moveSpeed, 0) / armyA.length
    const avgSpeedB = armyB.reduce((sum, u) => sum + u.moveSpeed, 0) / armyB.length
    const closingSpeed = avgSpeedA + avgSpeedB

    if (closingSpeed > 0) {
      // Calculate approach time for opening volley calculation
      const approachTime = scenarioParams.startingDistance / closingSpeed

      // Only set timeToContact if contact actually happens
      if (!kitingPreventsContact) {
        timeToContact = approachTime
      }

      // Apply opening volley from Team A units with a ranged volley weapon
      if (teamAHasVolleyRanged) {
        const rangedUnitsA = armyA.filter((u) => u.volleyWeapon && u.volleyWeapon.isRanged)
        for (const rangedUnit of rangedUnitsA) {
          if (!rangedUnit.volleyWeapon) continue

          const attackPeriod = rangedUnit.volleyWeapon.attackPeriod
          const attacksBeforeContact = Math.floor(approachTime / attackPeriod)
          preContactAttacksA += attacksBeforeContact

          // Calculate average damage using computeHit() to apply combat modifiers
          // Use each enemy unit as target and average the results
          let totalDamage = 0
          for (const enemy of armyB) {
            // Create a temporary attacker with volleyWeapon as current weapon
            const attackerWithVolley = {
              ...rangedUnit,
              weapon: rangedUnit.volleyWeapon,
            }
            // Merge team and unit combat effects
            const allEffects = [
              ...(teamA.teamCombatMods.effects || []),
              ...(rangedUnit.combatMods?.effects || []),
            ]
            const damage = computeHit(attackerWithVolley, enemy, allEffects)
            totalDamage += damage
          }
          const avgDamage = armyB.length > 0 ? totalDamage / armyB.length : 0

          preContactDamageA += avgDamage * attacksBeforeContact
        }
      }

      // Apply opening volley from Team B units with a ranged volley weapon
      if (teamBHasVolleyRanged) {
        const rangedUnitsB = armyB.filter((u) => u.volleyWeapon && u.volleyWeapon.isRanged)
        for (const rangedUnit of rangedUnitsB) {
          if (!rangedUnit.volleyWeapon) continue

          const attackPeriod = rangedUnit.volleyWeapon.attackPeriod
          const attacksBeforeContact = Math.floor(approachTime / attackPeriod)
          preContactAttacksB += attacksBeforeContact

          // Calculate average damage using computeHit() to apply combat modifiers
          // Use each enemy unit as target and average the results
          let totalDamage = 0
          for (const enemy of armyA) {
            // Create a temporary attacker with volleyWeapon as current weapon
            const attackerWithVolley = {
              ...rangedUnit,
              weapon: rangedUnit.volleyWeapon,
            }
            // Merge team and unit combat effects
            const allEffects = [
              ...(teamB.teamCombatMods.effects || []),
              ...(rangedUnit.combatMods?.effects || []),
            ]
            const damage = computeHit(attackerWithVolley, enemy, allEffects)
            totalDamage += damage
          }
          const avgDamage = armyA.length > 0 ? totalDamage / armyA.length : 0

          preContactDamageB += avgDamage * attacksBeforeContact
        }
      }

      // Apply pre-contact damage to units and timeline at contact time
      // Team B takes damage from Team A ranged
      let remainingDamageB = preContactDamageA
      for (const unit of armyB) {
        if (remainingDamageB <= 0) break
        const damageToApply = Math.min(unit.hp, remainingDamageB)
        unit.hp -= damageToApply
        remainingDamageB -= damageToApply
      }

      // Team A takes damage from Team B ranged
      let remainingDamageA = preContactDamageB
      for (const unit of armyA) {
        if (remainingDamageA <= 0) break
        const damageToApply = Math.min(unit.hp, remainingDamageA)
        unit.hp -= damageToApply
        remainingDamageA -= damageToApply
      }

      // Add a timeline point at the moment of contact reflecting pre-contact damage
      if (approachTime > 0 && timeline.length > 0) {
        // Only add if not already at t=approachTime
        const last = timeline[timeline.length - 1]
        const hpA = armyA.reduce((sum, u) => sum + Math.max(0, u.hp), 0)
        const hpB = armyB.reduce((sum, u) => sum + Math.max(0, u.hp), 0)
        const aliveA = armyA.filter((u) => u.hp > 0).length
        const aliveB = armyB.filter((u) => u.hp > 0).length
        if (!last || Math.abs(last.t - approachTime) > 0.01) {
          timeline.push({ t: approachTime, hpA, hpB, aliveA, aliveB })
        }
      }

      // Generate explanation using approach time (which includes kiting scenarios)
      if (kitingPreventsContact) {
        // Kiting explanation already set above; append volley info if applicable
        // scenarioExplanation already contains kiting info, keep it as-is
      } else if (teamAHasVolleyRanged && teamBHasVolleyRanged) {
        scenarioExplanation = `Ranged exchange before contact: ${approachTime.toFixed(1)}s until melee engages. Both sides traded shots.`
      } else if (teamAHasVolleyRanged) {
        scenarioExplanation = `Opening volley: Team A ranged dealt ${Math.floor(preContactDamageA)} damage in ${approachTime.toFixed(1)}s before contact.`
      } else if (teamBHasVolleyRanged) {
        scenarioExplanation = `Opening volley: Team B ranged dealt ${Math.floor(preContactDamageB)} damage in ${approachTime.toFixed(1)}s before contact.`
      } else {
        scenarioExplanation = `Melee engagement: Contact made immediately at starting distance.`
      }
    }
  } else if (scenarioParams.startingDistance === 0) {
    timeToContact = 0
    scenarioExplanation = 'Engaged: Armies start in contact, no opening volley.'
  } else if (kitingPreventsContact) {
    // Kiting already set contactMade = false and scenarioExplanation
  } else {
    // No melee to close distance (both pure ranged)
    timeToContact = null
    contactMade = true // They still fight at range
    scenarioExplanation = 'Pure ranged battle: No melee contact needed.'
  }

  // (moved above)

  let dmgDoneA = 0
  let dmgDoneB = 0
  let overkillA = 0
  let overkillB = 0

  // Track aura uptime over the fight
  const auraUptimeTracking: Record<string, { totalAlive: number; samples: number }> = {}
  for (const aura of activeAuras) {
    auraUptimeTracking[aura.abilityId] = { totalAlive: 0, samples: 0 }
  }

  function resolveUpTo(time: number) {
    let guard = 0
    const GUARD_MAX = 2_000_000

    while (guard++ < GUARD_MAX) {
      if (countAlive(armyA) === 0 || countAlive(armyB) === 0) break

      let attacker: SimUnit | null = null
      let soonest = Number.POSITIVE_INFINITY

      // Find next attacker
      for (const u of armyA) {
        if (u.hp <= 0) continue
        if (u.nextAttack <= time && u.nextAttack < soonest) {
          soonest = u.nextAttack
          attacker = u
        }
      }
      for (const u of armyB) {
        if (u.hp <= 0) continue
        if (u.nextAttack <= time && u.nextAttack < soonest) {
          soonest = u.nextAttack
          attacker = u
        }
      }

      if (!attacker || !Number.isFinite(soonest)) break

      // No weapon = can't attack
      if (!attacker.weapon) {
        attacker.nextAttack = Number.POSITIVE_INFINITY
        continue
      }

      // Prevent melee attacks before contact time (allows ranged opening volley)
      // If contact is scheduled later, reschedule melee's next attack to that moment
      if (attacker.weapon && !attacker.weapon.isRanged) {
        const contactTime = timeToContact ?? 0
        if (contactTime > 0 && soonest < contactTime) {
          attacker.nextAttack = contactTime
          continue
        }
      }

      // If kiting prevents contact, melee units cannot attack
      if (!contactMade && !attacker.weapon.isRanged) {
        attacker.nextAttack = Number.POSITIVE_INFINITY
        continue
      }

      // Pick target
      const enemies = attacker.team === 'A' ? collectAlive(armyB) : collectAlive(armyA)
      const target = pickAliveTarget(rng, enemies)
      if (!target) break

      // SPEARWALL LOGIC: If defender is cavalry/elephant and attacker is melee with a spearwall weapon, use spearwall weapon for this attack
      let attackerWeapon = attacker.weapon
      // Only applies to melee attacks
      if (attackerWeapon && !attackerWeapon.isRanged && Array.isArray(attacker.weapons)) {
        // Check if target is cavalry or war elephant
        const isCavalry = target.types?.some((t) => t.toLowerCase().includes('cavalry'))
        const isElephant = target.types?.some((t) => t.toLowerCase().includes('elephant'))
        console.log('[SIM DEBUG] Checking spearwall:', {
          attacker: attacker.unitId,
          attackerWeapons: attacker.weapons,
          target: target.unitId,
          targetTypes: target.types,
          isCavalry,
          isElephant,
        })
        if (isCavalry || isElephant) {
          // Find a spearwall weapon
          const spearwall = attacker.weapons.find((w: Weapon) => w.isSpearwall)
          if (spearwall) {
            attackerWeapon = { ...spearwall }
            spearwallUsed = true
            console.log('[SIM DEBUG] Spearwall TRIGGERED:', {
              attacker: attacker.unitId,
              target: target.unitId,
              spearwall,
            })
            // Apply stun to target if spearwall weapon has stunDuration
            if (typeof spearwall.stunDuration === 'number' && spearwall.stunDuration > 0) {
              // Only apply stun if target is alive
              if (target.hp > 0) {
                // Delay target's next attack by stunDuration, but only if their next attack is not already further in the future
                target.nextAttack = Math.max(target.nextAttack, soonest + spearwall.stunDuration)
                // Optionally, mark target as stunned (for future UI/logic)
                // target.stunnedUntil = soonest + spearwall.stunDuration
              }
            }
          }
        }
      }
      const mods = attacker.team === 'A' ? teamA : teamB

      // Merge team-wide and unit-specific combat mods
      const allEffects = [
        ...(mods.teamCombatMods.effects ?? []),
        ...(attacker.combatMods?.effects ?? []),
      ]
      console.log(
        `[SIM] Computing damage for ${attacker.unitId}, total effects: ${allEffects.length}`,
      )

      let hit = computeHit(
        {
          ...attacker,
          weapon: attackerWeapon
            ? {
                ...attackerWeapon,
                damageType: 'Melee' as const,
              }
            : null,
        },
        {
          ...target,
          weapon: target.weapon
            ? {
                ...target.weapon,
                damageType: 'Melee' as const,
              }
            : null,
        },
        allEffects,
      )

      // Apply counter multiplier
      if (attacker.team === 'A' && teamA.enableCounters) {
        hit *= counterMultiplier(attacker.types, target.types)
      } else if (attacker.team === 'B' && teamB.enableCounters) {
        hit *= counterMultiplier(attacker.types, target.types)
      }

      // Apply aura effects (Bucket A: Class-Scoped Auras)
      for (const aura of activeAuras) {
        // Only apply aura if it targets the attacker's team (aura affects this team's damage output)
        if (aura.targetTeam !== attacker.team) continue
        if (aura.statModifier !== 'damage') continue

        // Check if attacker matches target class filter
        const attackerMatchesFilter =
          aura.targetClasses.length === 0 ||
          attacker.types.some((unitClass) =>
            aura.targetClasses.some((targetClass) =>
              unitClass.toLowerCase().includes(targetClass.toLowerCase()),
            ),
          )

        if (!attackerMatchesFilter) continue // Aura doesn't affect this attacker

        // Calculate uptime: fraction of aura sources still alive
        const sourceArmy = aura.sourceTeam === 'A' ? armyA : armyB
        const matcher = getAuraSourceMatcher(aura)
        const aliveSources = sourceArmy.filter((u) => u.hp > 0 && matcher(u)).length
        const initialSources =
          auraSourceInitialCounts[aura.abilityId]?.[`team${aura.sourceTeam}`] ?? 1
        const uptime = initialSources > 0 ? aliveSources / initialSources : 0

        // Skip if no aura sources alive
        if (uptime === 0) continue

        // For damage-affecting auras, we need to scale based on scenario coverage
        // But we don't need to recalculate target share per-attack (attacker already filtered)
        // Just apply: effect_magnitude × coverage × uptime
        const effectMagnitude = Math.abs(aura.modifierValue - 1.0)
        const effectDirection = aura.modifierValue < 1.0 ? -1 : 1
        const netEffect = scenarioParams.auraCoverage * uptime * effectMagnitude
        const multiplier = 1.0 + effectDirection * netEffect

        // Apply to damage
        hit *= multiplier
      }

      hit = Math.max(0, hit)

      if (hit > 0) {
        const actualDamage = Math.min(hit, target.hp)
        const overkill = hit - actualDamage

        target.hp -= hit
        if (attacker.team === 'A') {
          dmgDoneA += actualDamage
          overkillA += overkill
        } else {
          dmgDoneB += actualDamage
          overkillB += overkill
        }
      }

      // Schedule next attack with attack speed modifiers
      let period = baseAttackPeriods.get(attacker) ?? attacker.weapon.attackPeriod

      // Apply attack speed auras
      for (const aura of activeAuras) {
        if (aura.targetTeam !== attacker.team) continue
        if (aura.statModifier !== 'attackSpeed') continue

        const matchesFilter =
          aura.targetClasses.length === 0 ||
          attacker.types.some((t) =>
            aura.targetClasses.some((tc) => t.toLowerCase().includes(tc.toLowerCase())),
          )

        if (!matchesFilter) continue

        // Attack speed modifier: 1.20 = +20% speed = 0.833× period
        if (aura.modifierOp === 'mul') {
          period /= aura.modifierValue
        }
      }

      attacker.nextAttack =
        Number.isFinite(period) && period > 0 ? soonest + period : Number.POSITIVE_INFINITY
    }
  }

  function pushSample(time: number) {
    const tOut = +time.toFixed(3)
    timeline.push({
      t: tOut,
      aliveA: countAlive(armyA),
      aliveB: countAlive(armyB),
      hpA: sumHpAlive(armyA),
      hpB: sumHpAlive(armyB),
    })

    // Track aura source uptime
    for (const aura of activeAuras) {
      const sourceArmy = aura.sourceTeam === 'A' ? armyA : armyB
      const matcher = getAuraSourceMatcher(aura)
      const aliveSources = sourceArmy.filter((u) => u.hp > 0 && matcher(u)).length
      auraUptimeTracking[aura.abilityId].totalAlive += aliveSources
      auraUptimeTracking[aura.abilityId].samples++
    }
  }

  // Initial state
  resolveUpTo(0)
  pushSample(0)

  // Main loop
  while (t < opts.maxSeconds) {
    if (countAlive(armyA) === 0 || countAlive(armyB) === 0) break

    t += tick
    const tBound = Math.min(t, opts.maxSeconds)

    resolveUpTo(tBound)
    pushSample(tBound)
  }

  // Determine winner
  const aliveA = countAlive(armyA)
  const aliveB = countAlive(armyB)

  let winner: 'A' | 'B' | 'Draw'
  if (aliveA > 0 && aliveB === 0) winner = 'A'
  else if (aliveB > 0 && aliveA === 0) winner = 'B'
  else winner = 'Draw'

  // If kiting resolved, update stats for reporting and graphing
  if ((globalThis as KitingGlobals).__kitingTimeline) {
    timeline.length = 0
    for (const pt of (globalThis as KitingGlobals).__kitingTimeline!) timeline.push(pt)
    if ((globalThis as KitingGlobals).__kitingTotalDamageA !== undefined) {
      dmgDoneA = (globalThis as KitingGlobals).__kitingTotalDamageA!
      overkillA = Math.max(0, dmgDoneA - armyB.reduce((sum, u) => sum + u.hp, 0))
    }
    if ((globalThis as KitingGlobals).__kitingTotalDamageB !== undefined) {
      dmgDoneB = (globalThis as KitingGlobals).__kitingTotalDamageB!
      overkillB = Math.max(0, dmgDoneB - armyA.reduce((sum, u) => sum + u.hp, 0))
    }
    // Set fight duration for DPS calculation
    if ((globalThis as KitingGlobals).__kitingTotalTime !== undefined) {
      t = (globalThis as KitingGlobals).__kitingTotalTime!
    }
    // Clean up
    delete (globalThis as KitingGlobals).__kitingTimeline
    delete (globalThis as KitingGlobals).__kitingTotalDamageA
    delete (globalThis as KitingGlobals).__kitingTotalDamageB
    delete (globalThis as KitingGlobals).__kitingTotalTime
  }

  // Build aura tracking info for results
  const auraTrackingInfo: AuraTrackingInfo[] = activeAuras
    .map((aura) => {
      const tracking = auraUptimeTracking[aura.abilityId]
      const initialSources =
        auraSourceInitialCounts[aura.abilityId]?.[`team${aura.sourceTeam}`] ?? 1
      const averageAlive = tracking.samples > 0 ? tracking.totalAlive / tracking.samples : 0
      const averageUptime = initialSources > 0 ? averageAlive / initialSources : 0

      // Calculate target share to show realistic impact
      const affectedTeamInput = aura.targetTeam === 'A' ? teamA : teamB
      const targetShare =
        aura.targetClasses.length > 0
          ? calculateTargetShare(affectedTeamInput, aura.targetClasses).dpsShare
          : 1.0

      // Calculate estimated impact
      const targetTeamName = aura.targetTeam === 'A' ? 'Team A' : 'Team B'
      const classFilter = aura.targetClasses.length > 0 ? ` ${aura.targetClasses.join('/')} ` : ' '

      let estimatedImpact: string

      if (aura.statModifier === 'armor') {
        // For armor: show flat value scaled by coverage, uptime, and target share
        const effectiveArmor = (
          aura.modifierValue *
          scenarioParams.auraCoverage *
          averageUptime *
          targetShare
        ).toFixed(1)
        const armorTypeStr = aura.armorType ? ` ${aura.armorType}` : ''
        estimatedImpact = `+${effectiveArmor}${armorTypeStr} armor to ${targetTeamName}${classFilter}`
      } else if (aura.statModifier === 'attackSpeed') {
        // For attack speed: show percentage scaled by target share
        const effectMagnitude = Math.abs(aura.modifierValue - 1.0)
        const netEffect =
          scenarioParams.auraCoverage * averageUptime * effectMagnitude * targetShare
        const impactPercent = (netEffect * 100).toFixed(1)
        const direction = aura.modifierValue < 1.0 ? '-' : '+'
        estimatedImpact = `${direction}${impactPercent}% ${targetTeamName}${classFilter}attack speed`
      } else {
        // For damage and other multiplicative effects, include target share
        const effectMagnitude = Math.abs(aura.modifierValue - 1.0)
        const netEffect =
          scenarioParams.auraCoverage * averageUptime * effectMagnitude * targetShare
        const impactPercent = (netEffect * 100).toFixed(1)
        const direction = aura.modifierValue < 1.0 ? '-' : '+'
        estimatedImpact = `${direction}${impactPercent}% ${targetTeamName}${classFilter}damage`
      }

      return {
        abilityId: aura.abilityId,
        abilityName: aura.abilityName,
        sourceTeam: aura.sourceTeam,
        targetTeam: aura.targetTeam,
        targetClasses: aura.targetClasses,
        averageUptime,
        coverage: scenarioParams.auraCoverage,
        effectMagnitude: aura.modifierValue,
        estimatedImpact,
        targetShare, // Keep track of target share
      }
    })
    .filter((aura) => {
      // Remove auras with no valid targets (0% target share)
      return aura.targetShare > 0
    })

  // After combat, append to scenario explanation if spearwall was used
  if (spearwallUsed) {
    scenarioExplanation += ' Spearwall was triggered against cavalry/elephant.'
  }
  // DEBUG: Log spearwallUsed and winner for verification
  console.log(
    '[SIM DEBUG] spearwallUsed:',
    spearwallUsed,
    '| winner:',
    winner,
    '| scenario:',
    scenarioExplanation,
  )
  return {
    spearwallUsed,
    bonusDamage,
    winner,
    seconds: t,
    survivorsA: aliveA,
    survivorsB: aliveB,
    totalDmgDoneA: dmgDoneA,
    totalDmgDoneB: dmgDoneB,
    overkillA,
    overkillB,
    activeAuras: auraTrackingInfo,
    scenarioPreset: scenarioParams.preset,
    timeline,

    // Bucket B: Opening Volley & Kiting
    contactMade,
    timeToContact,
    preContactDamageA,
    preContactDamageB,
    preContactAttacksA,
    preContactAttacksB,
    scenarioExplanation,
    // Reporting additions
    kitingEligible: ((): boolean => {
      const aRanged = armyA.some((u) => !!u.hasAnyRangedWeapon)
      const bRanged = armyB.some((u) => !!u.hasAnyRangedWeapon)
      // XOR rule: one side has ranged, other doesn't
      return (aRanged && !bRanged) || (bRanged && !aRanged)
    })(),
    kitingReason: !scenarioParams.kitingEnabled
      ? 'Kiting disabled by scenario toggle'
      : scenarioParams.startingDistance <= 0
        ? 'No approach phase (distance = 0)'
        : undefined,
    sustainedPhaseExecuted: contactMade,
  }
}
