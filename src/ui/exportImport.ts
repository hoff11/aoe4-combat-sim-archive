import type { UiScenarioState } from './uiStateTypes'
import * as LZ from 'lz-string'

const SCHEMA_VERSION = 2

export function exportScenarioState(state: UiScenarioState): string {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  }
  return JSON.stringify(payload)
}

export function importScenarioState(json: string): UiScenarioState {
  const parsed = JSON.parse(json)
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON')

  // Accept both legacy scenario export and new summary export
  if ('schemaVersion' in parsed && 'state' in parsed) {
    const { schemaVersion, state } = parsed
    if (schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported schema version')
    if (!state || typeof state !== 'object') throw new Error('Missing state')
    validateScenarioState(state)
    return state as UiScenarioState
  }

  // Accept new summary export format (with scenario, outcome, explanation)
  if ('scenario' in parsed && 'outcome' in parsed) {
    // Reconstruct UiScenarioState from summary export
    const scenario = parsed.scenario
    // Defensive: only use known fields
    return {
      teams: {
        A: { civ: 'ab', age: 1, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
        B: { civ: 'ab', age: 1, units: [], selectedTechIds: [], selectedUpgradeIds: [] },
      },
      scenarioPreset: scenario.preset,
      startingDistance: scenario.startingDistance,
      openness: scenario.openness,
      kitingAllowed: scenario.kitingAllowed,
    }
  }

  throw new Error('Unrecognized scenario format')
}

function validateScenarioState(state: unknown): asserts state is UiScenarioState {
  if (!state || typeof state !== 'object') {
    throw new Error('Invalid state: must be an object')
  }

  const s = state as Record<string, unknown>

  // Validate teams
  if (!s.teams || typeof s.teams !== 'object') {
    throw new Error('Invalid state: missing teams')
  }

  const teams = s.teams as Record<string, unknown>
  if (!teams.A || !teams.B) {
    throw new Error('Invalid state: must have teams A and B')
  }

  // Validate each team
  for (const teamKey of ['A', 'B']) {
    const team = teams[teamKey]
    if (!team || typeof team !== 'object') {
      throw new Error(`Invalid team ${teamKey}`)
    }

    const t = team as Record<string, unknown>

    // Validate civ (string)
    if (typeof t.civ !== 'string' || t.civ.length > 10) {
      throw new Error(`Invalid civ in team ${teamKey}`)
    }

    // Validate age (1-4)
    if (typeof t.age !== 'number' || t.age < 1 || t.age > 4) {
      throw new Error(`Invalid age in team ${teamKey}`)
    }

    // Validate units array
    if (!Array.isArray(t.units)) {
      throw new Error(`Invalid units in team ${teamKey}`)
    }

    if (t.units.length > 50) {
      throw new Error(`Too many units in team ${teamKey}`)
    }

    for (const unit of t.units) {
      if (!unit || typeof unit !== 'object') {
        throw new Error(`Invalid unit in team ${teamKey}`)
      }

      const u = unit as Record<string, unknown>

      // Validate unitId (string, reasonable length)
      if (typeof u.unitId !== 'string' || u.unitId.length > 100) {
        throw new Error(`Invalid unitId in team ${teamKey}`)
      }

      // Validate count (positive integer)
      if (typeof u.count !== 'number' || u.count < 0 || u.count > 1000) {
        throw new Error(`Invalid count in team ${teamKey}`)
      }

      // Validate tier
      const validTiers = ['base', 'veteran', 'elite']
      if (typeof u.tier !== 'string' || !validTiers.includes(u.tier)) {
        throw new Error(`Invalid tier in team ${teamKey}`)
      }
    }

    // Validate tech IDs
    if (!Array.isArray(t.selectedTechIds)) {
      throw new Error(`Invalid selectedTechIds in team ${teamKey}`)
    }

    if (t.selectedTechIds.length > 100) {
      throw new Error(`Too many techs in team ${teamKey}`)
    }

    for (const id of t.selectedTechIds) {
      if (typeof id !== 'string' || id.length > 100) {
        throw new Error(`Invalid tech ID in team ${teamKey}`)
      }
    }

    // Validate upgrade IDs
    if (!Array.isArray(t.selectedUpgradeIds)) {
      throw new Error(`Invalid selectedUpgradeIds in team ${teamKey}`)
    }

    if (t.selectedUpgradeIds.length > 100) {
      throw new Error(`Too many upgrades in team ${teamKey}`)
    }

    for (const id of t.selectedUpgradeIds) {
      if (typeof id !== 'string' || id.length > 100) {
        throw new Error(`Invalid upgrade ID in team ${teamKey}`)
      }
    }
  }

  // Validate scenario controls (optional with sensible defaults)
  const preset = (state as Partial<UiScenarioState>).scenarioPreset
  if (preset !== undefined) {
    const validPresets = ['Engaged', 'Skirmish', 'OpenField', 'Custom']
    if (typeof preset !== 'string' || !validPresets.includes(preset)) {
      throw new Error('Invalid scenarioPreset')
    }
  }

  const startingDistance = (state as Partial<UiScenarioState>).startingDistance
  if (startingDistance !== undefined) {
    if (typeof startingDistance !== 'number' || startingDistance < 0 || startingDistance > 200) {
      throw new Error('Invalid startingDistance')
    }
  }

  const openness = (state as Partial<UiScenarioState>).openness
  if (openness !== undefined) {
    if (typeof openness !== 'number' || openness < 0 || openness > 1) {
      throw new Error('Invalid openness (0..1)')
    }
  }

  const kitingAllowed = (state as Partial<UiScenarioState>).kitingAllowed
  if (kitingAllowed !== undefined) {
    if (typeof kitingAllowed !== 'boolean') {
      throw new Error('Invalid kitingAllowed')
    }
  }
}

// URL-based sharing with LZ compression
export function exportScenarioToUrl(state: UiScenarioState): string {
  const json = exportScenarioState(state)
  const compressed = LZ.compressToEncodedURIComponent(json)
  const url = new URL(window.location.href)
  url.searchParams.set('scenario', compressed)
  return url.toString()
}

export function importScenarioFromUrl(): UiScenarioState | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const compressed = params.get('scenario')
    if (!compressed) return null

    const json = LZ.decompressFromEncodedURIComponent(compressed)
    if (!json) return null
    return importScenarioState(json)
  } catch (e) {
    console.error('Failed to import scenario from URL:', e)
    return null
  }
}
