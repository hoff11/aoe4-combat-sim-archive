import React from 'react'
import type { UiUnitRow } from './uiStateTypes'
import { loadRawSnapshot } from '../data/raw/loadRawSnapshot'
import { buildCanonUnits } from '../data/canon/buildCanonUnits'

type ScenarioPreset = 'Engaged' | 'Skirmish' | 'OpenField' | 'Custom'

type ScenarioState = {
  preset: ScenarioPreset
  startingDistance: number
  openness: number // 0..1
  kitingAllowed: boolean
}

type UnitMobilityType = 'PureRanged' | 'PureMelee' | 'Hybrid'

type TeamProfile = {
  hasHybrid: boolean
  hasRanged: boolean
  hasMelee: boolean
}

function classifyUnitWeapons(unitId: string): UnitMobilityType {
  // Load canon units to check weapon types
  const raw = loadRawSnapshot()
  const canonUnits = buildCanonUnits(raw.units.data)
  const unit = canonUnits.find((u) => u.id === unitId)

  if (!unit || unit.variations.length === 0) return 'PureMelee'

  // Check any variation for weapon types (all variations should have same mobility category)
  const variation = unit.variations[0]
  const hasMeleeWeapon = variation.weapons.some((w) => {
    const dt = w.damageType?.toLowerCase()
    return dt === 'melee'
  })
  const hasRangedWeapon = variation.weapons.some((w) => {
    const dt = w.damageType?.toLowerCase()
    return dt === 'ranged' || dt === 'siege'
  })

  if (hasMeleeWeapon && hasRangedWeapon) return 'Hybrid'
  if (hasRangedWeapon) return 'PureRanged'
  return 'PureMelee'
}

function computeTeamProfile(units: UiUnitRow[]): TeamProfile {
  const types = units.map((u) => classifyUnitWeapons(u.unitId))

  return {
    hasHybrid: types.some((t) => t === 'Hybrid'),
    hasRanged: types.some((t) => t === 'PureRanged' || t === 'Hybrid'),
    hasMelee: types.some((t) => t === 'PureMelee' || t === 'Hybrid'),
  }
}

function isKitingEligible(teamA: TeamProfile, teamB: TeamProfile): boolean {
  // One side has ranged (pure or hybrid), other side has no ranged at all
  return (teamA.hasRanged && !teamB.hasRanged) || (teamB.hasRanged && !teamA.hasRanged)
}

export function ScenarioPanel({
  scenario,
  onChange,
  teamAUnits,
  teamBUnits,
}: {
  scenario: ScenarioState
  onChange: (s: ScenarioState) => void
  teamAUnits: UiUnitRow[]
  teamBUnits: UiUnitRow[]
}) {
  const teamA = computeTeamProfile(teamAUnits)
  const teamB = computeTeamProfile(teamBUnits)
  const kitingEligible = isKitingEligible(teamA, teamB)

  // Explicit openness options (not full terrain, just kiting/formation abstraction)
  const opennessOptions = [
    {
      label: 'Clumped (no kiting)',
      value: 0.2,
      desc: 'Units are packed tightly, kiting is impossible.',
    },
    {
      label: 'Mixed (some kiting)',
      value: 0.5,
      desc: 'Some space to maneuver, kiting is possible if speed allows.',
    },
    {
      label: 'Open (max kiting)',
      value: 0.8,
      desc: 'Wide open space, ranged units can use full speed to kite.',
    },
  ]
  function setOpennessByValue(val: number) {
    onChange({ ...scenario, openness: val })
  }

  // Preset-aware defaults
  function applyPreset(p: ScenarioPreset) {
    if (p === 'Engaged') {
      onChange({ preset: p, startingDistance: 0, openness: 0.2, kitingAllowed: false })
    } else if (p === 'Skirmish') {
      onChange({ preset: p, startingDistance: 3, openness: 0.5, kitingAllowed: false })
    } else if (p === 'OpenField') {
      onChange({ preset: p, startingDistance: 12, openness: 0.8, kitingAllowed: kitingEligible })
    } else {
      onChange({ ...scenario, preset: 'Custom' })
    }
  }

  // Scenario preset explanations
  const presetExplanations: Record<ScenarioPreset, string> = {
    Engaged: 'Units begin in immediate contact with minimal maneuvering.',
    Skirmish: 'Units start at short range, allowing for a brief ranged volley before melee.',
    OpenField: 'Units start far apart with open space, enabling kiting and maneuver.',
    Custom: 'Customize all scenario parameters manually.',
  }

  // Quick distance presets
  const distancePresets = [
    { label: 'Contact', value: 0 },
    { label: 'Short', value: 3 },
    { label: 'Medium', value: 7 },
    { label: 'Long', value: 12 },
  ]

  return (
    <div
      className="scenario-panel"
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid rgba(148, 163, 184, 0.25)',
        background: 'rgba(10, 15, 25, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Engagement Setup */}
      <div
        style={{
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: '1px solid rgba(148,163,184,0.10)',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Engagement Setup</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
            <span style={{ fontWeight: 500, fontSize: 12 }}>Scenario preset</span>
            <select
              value={scenario.preset}
              onChange={(e) => applyPreset(e.target.value as ScenarioPreset)}
              style={{
                padding: '6px 8px',
                borderRadius: 8,
                background: 'rgba(30, 35, 45, 0.95)',
                color: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(100, 110, 130, 0.4)',
              }}
            >
              <option value="Engaged">Engaged / Blob</option>
              <option value="Skirmish">Skirmish</option>
              <option value="OpenField">Open Field / Kiting</option>
              <option value="Custom">Custom</option>
            </select>
            <span style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
              {presetExplanations[scenario.preset]}
            </span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
            <span style={{ fontWeight: 500, fontSize: 12 }}>
              Starting distance{' '}
              <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.7 }}>(tiles)</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                min={0}
                max={200}
                value={scenario.startingDistance}
                placeholder="e.g. 0 = contact"
                onChange={(e) =>
                  onChange({ ...scenario, startingDistance: Math.max(0, Number(e.target.value)) })
                }
                style={{ padding: '6px 8px', borderRadius: 8, width: 80 }}
              />
              {distancePresets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  style={{
                    fontSize: 11,
                    padding: '2px 7px',
                    borderRadius: 6,
                    border: '1px solid #444',
                    background: '#181c22',
                    color: '#fff',
                    opacity: scenario.startingDistance === p.value ? 1 : 0.7,
                    cursor: 'pointer',
                  }}
                  onClick={() => onChange({ ...scenario, startingDistance: p.value })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </label>
        </div>
      </div>

      {/* Formation / Kiting Potential (explicit, honest, grouped) */}
      <div
        style={{
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: '1px solid rgba(148,163,184,0.10)',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
          Formation / Kiting Potential
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
          {/* Left: Openness buttons and explanation */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 6,
              minWidth: 320,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {opennessOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  style={{
                    fontSize: 11,
                    padding: '2px 7px',
                    borderRadius: 6,
                    border: '1px solid #444',
                    background: scenario.openness === opt.value ? '#2a3140' : '#181c22',
                    color: '#fff',
                    opacity: scenario.openness === opt.value ? 1 : 0.7,
                    cursor: 'pointer',
                    minWidth: 90,
                  }}
                  onClick={() => setOpennessByValue(opt.value)}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, maxWidth: 320 }}>
              <strong>Note:</strong> "Openness" is not a full terrain simulation. It only affects
              how easily ranged units can kite melee (by scaling retreat speed), and how many units
              are in aura range. It does not simulate obstacles, line of sight, or map features.
            </div>
          </div>
          {/* Right: Kiting control and explanation */}
          <div
            style={{
              minWidth: 260,
              maxWidth: 340,
              borderLeft: '1px solid rgba(148,163,184,0.15)',
              paddingLeft: 24,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={scenario.kitingAllowed && kitingEligible}
                onChange={(e) => onChange({ ...scenario, kitingAllowed: e.target.checked })}
                disabled={!kitingEligible || scenario.openness < 0.5}
                title={
                  kitingEligible
                    ? scenario.openness < 0.5
                      ? 'Requires Mixed or Open formation for kiting.'
                      : 'Allow kiting: Ranged units may maintain distance vs slower melee units. May result in no melee contact if speed & space allow.'
                    : 'Kiting unavailable (requires one side with ranged vs pure melee)'
                }
              />
              <span
                style={{
                  opacity: kitingEligible && scenario.openness >= 0.5 ? 1 : 0.6,
                  fontWeight: 500,
                  fontSize: 15,
                }}
              >
                Allow kiting
              </span>
            </label>
            <div style={{ fontSize: 11, opacity: 0.7, marginLeft: 2, marginTop: 2 }}>
              Ranged units may maintain distance vs slower melee units.
              <br />
              <span style={{ opacity: 0.8 }}>
                May result in no melee contact if speed & space allow.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
