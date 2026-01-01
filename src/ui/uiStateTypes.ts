// src/ui/uiStateTypes.ts

// UI state is "choices only" (serializable). No deterministic calculations belong in UI.

export type TierLabel = 'base' | 'veteran' | 'elite'
export type TeamId = 'A' | 'B'
export type Age = 1 | 2 | 3 | 4

// Tech toggle for a specific unit line (optional UI convenience)
export type UiToggle = {
  id: string
  enabled: boolean
}

// One row in the team roster list (what the user adds in the UI)
export type UiUnitRow = {
  // Base unit id from units.json (NOT a variation id)
  unitId: string

  count: number

  // Tier selection for this unit line
  tier: TierLabel

  // Optional unit-specific tech toggles (unique/unit techs, etc.)
  // Resolve layer decides applicability; UI only records selection intent.
  unitTechs?: UiToggle[]
}

export type UiTeamState = {
  civ: string
  age: Age

  units: UiUnitRow[]

  // Global selections from technologies.json (blacksmith/university/unique/global techs)
  selectedTechIds: string[]

  // Optional: direct selections from upgrades.json (tier-like variation packs).
  // In many builds this can remain empty; keep it for future-proofing.
  selectedUpgradeIds: string[]
}

export type UiScenarioState = {
  // Optional snapshot version override; resolve defaults to latest if omitted
  version?: string

  teams: Record<TeamId, UiTeamState>

  // Scenario controls
  scenarioPreset?: 'Engaged' | 'Skirmish' | 'OpenField' | 'Custom'
  startingDistance?: number // tiles/meters between armies
  openness?: number // 0..1, clumped→open
  kitingAllowed?: boolean
}

/** Convenience: create an empty team state */
export function makeEmptyTeamState(args?: Partial<UiTeamState>): UiTeamState {
  return {
    civ: args?.civ ?? 'ab',
    age: args?.age ?? 1,
    units: args?.units ?? [],
    selectedTechIds: args?.selectedTechIds ?? [],
    selectedUpgradeIds: args?.selectedUpgradeIds ?? [],
  }
}

/** Convenience: create an empty scenario state */
export function makeEmptyScenarioState(args?: Partial<UiScenarioState>): UiScenarioState {
  return {
    version: args?.version,
    teams: args?.teams ?? {
      A: makeEmptyTeamState({ civ: 'ab', age: 1 }),
      B: makeEmptyTeamState({ civ: 'ab', age: 1 }),
    },
    scenarioPreset: args?.scenarioPreset ?? 'Engaged',
    startingDistance: args?.startingDistance ?? 5,
    openness: args?.openness ?? 0.2,
    kitingAllowed: args?.kitingAllowed ?? false,
  }
}
