// src/data/resolve/resolvedViewTypes.ts

import type { TeamId, TierLabel } from '../../ui/uiStateTypes'
import type { CanonArmor, CanonWeapon } from '../canon/canonTypes'
import type { TeamCombatMods } from './combatModsTypes'

export type ResolvedUnitLine = {
  unitId: string
  unitName: string

  // chosen canon variation id after applying civ/age/tier selection
  variationId: string
  tier: TierLabel

  count: number

  hitpoints: number
  armor: CanonArmor
  weapons: CanonWeapon[]

  cost?: Record<string, number>
  variationAge: 1 | 2 | 3 | 4
  unitCivs: string[]
  variationCivs?: string[]

  // Passive abilities this unit has (e.g., Camel Unease)
  abilityIds?: string[]
}

export type ResolvedTeamView = {
  team: TeamId
  civ: string
  age: 1 | 2 | 3 | 4
  units: ResolvedUnitLine[]
}

export type ResolvedScenarioView = {
  version: string
  teams: Record<TeamId, ResolvedTeamView>
}

// --------------------
// Sim-facing resolved config (engine-agnostic for now)
// --------------------

export type ResolvedSimUnitGroup = {
  unitId: string
  variationId: string
  count: number

  unitTechIds: string[]
  unitCombatMods: TeamCombatMods

  // Passive abilities this unit has
  abilityIds?: string[]
}

export type ResolvedSimTeam = {
  civ: string
  age: 1 | 2 | 3 | 4

  teamTechIds: string[]
  teamCombatMods: TeamCombatMods

  units: ResolvedSimUnitGroup[]
}

export type ResolvedSimConfig = {
  version: string
  teams: Record<TeamId, ResolvedSimTeam>
}
