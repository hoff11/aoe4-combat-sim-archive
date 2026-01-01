import { describe, it, expect } from 'vitest'
import { buildSimInputsFromUi } from '../../data/resolve/buildSimInputFromUi'
import { makeEmptyScenarioState } from '../../ui/uiStateTypes'

describe('buildSimInputFromUi', () => {
  it('builds engine inputs with combat mods applied', () => {
    const uiState = makeEmptyScenarioState()

    // Setup Team A: Desert raider with ranged upgrades
    uiState.teams.A.civ = 'Ayyubids'
    uiState.teams.A.age = 2
    uiState.teams.A.units = [
      {
        unitId: 'desert-raider',
        count: 10,
        tier: 'base',
        unitTechs: [],
      },
    ]
    // Add blacksmith ranged upgrade (Steeled Arrow)
    uiState.teams.A.selectedTechIds = ['steeled-arrow-2']

    // Setup Team B: Man-at-arms with melee upgrades
    uiState.teams.B.civ = 'English'
    uiState.teams.B.age = 2
    uiState.teams.B.units = [
      {
        unitId: 'man-at-arms',
        count: 10,
        tier: 'base',
        unitTechs: [],
      },
    ]
    // Add blacksmith melee upgrade (Bloomery)
    uiState.teams.B.selectedTechIds = ['bloomery-2']

    const { teamA, teamB } = buildSimInputsFromUi(uiState)

    console.log('\n=== TEAM A (Desert Raider with Steeled Arrow) ===')
    console.log(`Team combat mods:`, teamA.teamCombatMods)
    console.log(`Units: ${teamA.units.length}`)
    const unitA = teamA.units[0]
    console.log(`Unit: ${unitA.unitId}`)
    console.log(`Count: ${unitA.count}`)
    console.log(`HP: ${unitA.stats.hitpoints}`)
    console.log(`Armor: M${unitA.stats.armorMelee} / R${unitA.stats.armorRanged}`)
    console.log(`Weapons: ${unitA.stats.weapons.length}`)
    unitA.stats.weapons.forEach((w, i) => {
      console.log(`  ${i}: ${w.name} (${w.damageType}) - ${w.damageMin} dmg, ${w.attackPeriod}s`)
    })

    console.log('\n=== TEAM B (Man-at-Arms with Bloomery) ===')
    console.log(`Team combat mods:`, teamB.teamCombatMods)
    console.log(`Units: ${teamB.units.length}`)
    const unitB = teamB.units[0]
    console.log(`Unit: ${unitB.unitId}`)
    console.log(`Count: ${unitB.count}`)
    console.log(`HP: ${unitB.stats.hitpoints}`)
    console.log(`Armor: M${unitB.stats.armorMelee} / R${unitB.stats.armorRanged}`)
    console.log(`Weapons: ${unitB.stats.weapons.length}`)
    unitB.stats.weapons.forEach((w, i) => {
      console.log(`  ${i}: ${w.name} (${w.damageType}) - ${w.damageMin} dmg, ${w.attackPeriod}s`)
    })

    // Verify fire weapons are excluded
    expect(unitA.stats.weapons.every((w) => w.damageType !== 'Fire')).toBe(true)
    expect(unitB.stats.weapons.every((w) => w.damageType !== 'Fire')).toBe(true)

    console.log('\n✓ Fire weapons excluded from engine inputs')
    console.log('✓ Units have resolved stats with combat mods applied')
  })
})
