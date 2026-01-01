// Create human-readable export summary with outcome and explanation
import type { UiScenarioState } from './uiStateTypes'
import type { SimResult } from '../engine/types'

export function createExportSummary(state: UiScenarioState, result: SimResult | null) {
  const { teams, scenarioPreset, startingDistance, openness, kitingAllowed } = state

  // Build readable team descriptions
  const teamADesc = `Team A: ${teams.A.civ.toUpperCase()} Age ${teams.A.age} - ${teams.A.units.map((u) => `${u.count}x ${u.unitId}`).join(', ')}`
  const teamBDesc = `Team B: ${teams.B.civ.toUpperCase()} Age ${teams.B.age} - ${teams.B.units.map((u) => `${u.count}x ${u.unitId}`).join(', ')}`

  const summary = {
    matchup: {
      teamA: {
        civ: teams.A.civ,
        age: teams.A.age,
        units: teams.A.units.map((u) => ({ unitId: u.unitId, count: u.count, tier: u.tier })),
        techs: teams.A.selectedTechIds || [],
        upgrades: teams.A.selectedUpgradeIds || [],
      },
      teamB: {
        civ: teams.B.civ,
        age: teams.B.age,
        units: teams.B.units.map((u) => ({ unitId: u.unitId, count: u.count, tier: u.tier })),
        techs: teams.B.selectedTechIds || [],
        upgrades: teams.B.selectedUpgradeIds || [],
      },
    },
    scenario: {
      preset: scenarioPreset,
      startingDistance,
      openness,
      kitingAllowed,
    },
    outcome: result
      ? {
          winner: result.winner,
          duration: `${result.seconds.toFixed(1)}s`,
          survivorsA: result.survivorsA,
          survivorsB: result.survivorsB,
          totalDamageA: result.totalDmgDoneA.toFixed(1),
          totalDamageB: result.totalDmgDoneB.toFixed(1),
          contactMade: result.contactMade,
          timeToContact: result.timeToContact ? `${result.timeToContact.toFixed(1)}s` : 'N/A',
        }
      : null,
    activeModifiers: result
      ? {
          auras: result.activeAuras?.map((aura) => ({
            source: aura.abilityName,
            effect: aura.estimatedImpact,
            coverage: `${(aura.coverage * 100).toFixed(0)}%`,
            uptime: `${(aura.averageUptime * 100).toFixed(0)}%`,
          })),
          bonusDamage: result.bonusDamage,
        }
      : null,
    description: [
      `${teamADesc}`,
      `${teamBDesc}`,
      `Scenario: ${scenarioPreset} (distance: ${startingDistance}, openness: ${openness}, kiting: ${kitingAllowed})`,
      result
        ? `Outcome: ${result.winner === 'A' ? 'Team A' : result.winner === 'B' ? 'Team B' : 'Draw'} wins in ${result.seconds.toFixed(1)}s`
        : 'Not yet simulated',
      result ? `Survivors: Team A: ${result.survivorsA}, Team B: ${result.survivorsB}` : '',
      result
        ? `Total Damage: Team A: ${result.totalDmgDoneA.toFixed(1)}, Team B: ${result.totalDmgDoneB.toFixed(1)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  }

  return summary
}
