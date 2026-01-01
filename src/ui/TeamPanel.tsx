import { UiTeamState, UiUnitRow } from './uiStateTypes'
import React from 'react'
import { CivSelector } from './CivSelector'
import { AgeSelector } from './AgeSelector'
import { ResourceIcon } from './ResourceIcon'
import { loadRawSnapshot } from '../data/raw/loadRawSnapshot'
import { buildCanonTechnologies } from '../data/canon/buildCanonTechnologies'
import { buildCanonUnits } from '../data/canon/buildCanonUnits'
import { buildCanonAbilities } from '../data/canon/buildCanonAbilities'
import { isUnitExcludedAtAge } from '../data/canon/unitAgeExclusions'
import { hasVeteranTier, hasEliteTier } from '../data/canon/tierLookup'
import { pickVariationByRequestedTier } from '../data/resolve/resolveScenario'
import {
  buildTechIndex,
  resolveTeamCombatMods,
  resolveUnitCombatMods,
} from '../data/resolve/resolveCombatMods'
import { applyCombatModsToVariation } from '../data/resolve/applyCombatMods'
import { expandTechSelection } from '../data/canon/resolveTechPrereqs'
import './TeamPanel.css'

export type TeamPanelProps = {
  teamState: UiTeamState
  onTeamChange: (newTeam: UiTeamState) => void
}

// civ list moved to CivSelector

export function TeamPanel({ teamState, onTeamChange }: TeamPanelProps) {
  const [pendingUnitId, setPendingUnitId] = React.useState<string>('')
  const [pendingCount, setPendingCount] = React.useState<number>(1)
  const [blacksmithExpanded, setBlacksmithExpanded] = React.useState(false)
  const [universityExpanded, setUniversityExpanded] = React.useState(false)
  const [unitDpsMode, setUnitDpsMode] = React.useState<Record<string, 'auto' | 'melee' | 'ranged'>>(
    {},
  )

  // Build canon technologies once for UI gating
  const canonTechs = React.useMemo(() => {
    const raw = loadRawSnapshot()
    return buildCanonTechnologies(raw.technologies.data)
  }, [])

  // Build canon units once for unit picker
  const canonUnits = React.useMemo(() => {
    const raw = loadRawSnapshot()
    return buildCanonUnits(raw.units.data)
  }, [])

  // Build canon abilities once for display (unused currently)
  const _canonAbilities = React.useMemo(() => {
    const raw = loadRawSnapshot()
    return buildCanonAbilities(raw.abilities)
  }, [])

  const availableUnits = React.useMemo(() => {
    const civ = teamState.civ.toLowerCase()
    const age = Number(teamState.age)

    // Standard production buildings (in priority order)
    const standardBuildings = [
      'barracks',
      'archery-range',
      'stable',
      'siege-workshop',
      'dock',
      'town-center',
      'monastery',
      'market',
      'keep',
    ]

    // Specific spawner units that shouldn't be selectable
    const spawnerUnitIds = new Set([
      'earls-retinue',
      'garrison-command',
      'earls-guard',
      'demilancer',
    ])

    const filtered = canonUnits
      .filter((u) => {
        // Exclude known spawner units
        if (spawnerUnitIds.has(u.id)) return false

        // Check if this unit has a variation for this civ at or below current age
        const hasMatchingVariation = u.variations.some(
          (v) => v.civs.length === 1 && v.civs[0] === civ && Number(v.age ?? 1) <= age,
        )
        return hasMatchingVariation
      })
      .filter((u) => !isUnitExcludedAtAge(u.id, civ, age))
      .map((u) => {
        // Get the variation for this civ to determine producedBy
        const variation = u.variations.find(
          (v) => v.civs.length === 1 && v.civs[0] === civ && Number(v.age ?? 1) <= age,
        )
        // Prefer standard buildings over unique buildings
        const buildings = variation?.producedBy || []
        const producedBy =
          standardBuildings.find((b) => buildings.includes(b)) || buildings[0] || 'other'
        return { id: u.id, name: u.name, producedBy }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return filtered
  }, [canonUnits, teamState.civ, teamState.age])

  const groupedUnits = React.useMemo(() => {
    const buildingOrder = [
      'barracks',
      'archery-range',
      'stable',
      'siege-workshop',
      'dock',
      'mercenary-house',
      'golden-horn-tower',
      'foreign-engineering-company',
      'palatine-school',
      'other',
    ]
    const buildingLabels: Record<string, string> = {
      barracks: 'Barracks',
      'archery-range': 'Archery Range',
      stable: 'Stable',
      'siege-workshop': 'Siege Workshop',
      dock: 'Dock',
      'mercenary-house': 'Mercenary House',
      'golden-horn-tower': 'Golden Horn Tower',
      'foreign-engineering-company': 'Foreign Engineering Company',
      'palatine-school': 'Palatine School',
      other: 'Other',
    }

    const grouped = new Map<string, typeof availableUnits>()
    for (const unit of availableUnits) {
      const key = buildingOrder.includes(unit.producedBy) ? unit.producedBy : 'other'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(unit)
    }

    return buildingOrder
      .filter((b) => grouped.has(b))
      .map((b) => ({ building: b, label: buildingLabels[b], units: grouped.get(b)! }))
  }, [availableUnits])
  function handleCivChange(newCiv: string) {
    // Reset team state when civ changes to avoid stale units/techs from previous civ
    onTeamChange({
      ...teamState,
      civ: newCiv,
      age: 1, // Reset to Age 1 when changing civs
      units: [],
      selectedTechIds: [],
    })
    setPendingUnitId('')
  }

  function handleAgeChange(newAge: number) {
    onTeamChange({
      ...teamState,
      age: newAge as 1 | 2 | 3 | 4,
    })
  }

  function handleRemoveUnit(unitId: string) {
    onTeamChange({
      ...teamState,
      units: teamState.units.filter((u) => u.unitId !== unitId),
    })
  }

  function handleUpdateUnit(unitId: string, updates: Partial<UiUnitRow>) {
    onTeamChange({
      ...teamState,
      units: teamState.units.map((u) => (u.unitId === unitId ? { ...u, ...updates } : u)),
    })
  }

  function toggleTeamTech(id: string, enabled: boolean) {
    const prev = teamState.selectedTechIds ?? []
    const next = expandTechSelection(id, enabled, prev, canonTechs)
    onTeamChange({ ...teamState, selectedTechIds: next })
  }

  function addPendingUnit() {
    if (!pendingUnitId) return
    const count = Number.isFinite(pendingCount) ? Math.max(1, Math.floor(pendingCount)) : 1
    const existing = teamState.units.find((u) => u.unitId === pendingUnitId)
    if (existing) {
      handleUpdateUnit(pendingUnitId, { count: existing.count + count })
    } else {
      onTeamChange({
        ...teamState,
        units: [...teamState.units, { unitId: pendingUnitId, count, tier: 'base', unitTechs: [] }],
      })
    }
    setPendingUnitId('')
    setPendingCount(1)
  }

  const teamBlacksmithTechs = React.useMemo(() => {
    const age = Number(teamState.age)
    const civ = teamState.civ.toLowerCase()
    return canonTechs
      .filter((t) => t.producedBy?.includes('blacksmith'))
      .filter((t) => (t.age ? t.age <= age : true))
      .filter((t) => (t.civs?.length ? t.civs.map((c) => c.toLowerCase()).includes(civ) : true))
      .sort((a, b) => (a.age ?? 0) - (b.age ?? 0) || a.name.localeCompare(b.name))
  }, [canonTechs, teamState.age, teamState.civ])

  const teamUniversityTechs = React.useMemo(() => {
    const age = Number(teamState.age)
    const civ = teamState.civ.toLowerCase()
    return canonTechs
      .filter((t) => t.producedBy?.includes('university'))
      .filter((t) => (t.age ? t.age <= age : true))
      .filter((t) => (t.civs?.length ? t.civs.map((c) => c.toLowerCase()).includes(civ) : true))
      .sort((a, b) => (a.age ?? 0) - (b.age ?? 0) || a.name.localeCompare(b.name))
  }, [canonTechs, teamState.age, teamState.civ])

  // Calculate blacksmith bonuses from selected techs
  const blacksmithBonuses = React.useMemo(() => {
    const selected = teamBlacksmithTechs.filter((t) => teamState.selectedTechIds?.includes(t.id))
    let meleeAttack = 0
    let rangedAttack = 0
    let meleeArmor = 0
    let rangedArmor = 0

    for (const tech of selected) {
      const isMelee = tech.classes?.some((c) => c.includes('melee'))
      const isRanged = tech.classes?.some((c) => c.includes('ranged'))
      const isArmor = tech.classes?.some((c) => c.includes('armor'))

      if (isMelee && !isArmor) meleeAttack++
      else if (isRanged && !isArmor) rangedAttack++
      else if (isArmor && isMelee) meleeArmor++
      else if (isArmor && isRanged) rangedArmor++
    }

    return { meleeAttack, rangedAttack, meleeArmor, rangedArmor }
  }, [teamBlacksmithTechs, teamState.selectedTechIds])

  // Calculate team totals for resources
  const teamTotals = React.useMemo(() => {
    if (teamState.units.length === 0) return null

    const totals = { food: 0, wood: 0, gold: 0, stone: 0, oliveoil: 0, pop: 0 }

    for (const unit of teamState.units) {
      const canonUnit = canonUnits.find((u) => u.id === unit.unitId)
      if (!canonUnit) continue

      const variation = pickVariationByRequestedTier({
        vars: canonUnit.variations,
        civ: teamState.civ.toLowerCase(),
        teamAge: teamState.age,
        tier: unit.tier,
        unit: canonUnit,
      })

      if (!variation || !variation.cost) continue

      for (const [resource, amount] of Object.entries(variation.cost)) {
        const key = resource.toLowerCase()
        if (key in totals) {
          totals[key as keyof typeof totals] += amount * unit.count
        }
      }
    }

    return totals
  }, [canonUnits, teamState.units, teamState.civ, teamState.age])

  // Build tech index for combat mods resolution (filtered by current civ)
  const techIndex = React.useMemo(() => {
    const civ = teamState.civ.toLowerCase()
    const civTechs = canonTechs.filter((t) => t.civs.length === 0 || t.civs.includes(civ))
    return buildTechIndex(civTechs)
  }, [canonTechs, teamState.civ])

  // Helper to calculate unit stats with all tech effects applied
  function getUnitStats(
    unitId: string,
    tier: 'base' | 'veteran' | 'elite',
    count: number,
    unitTechIds: string[] = [],
    dpsMode: 'auto' | 'melee' | 'ranged' = 'auto',
  ) {
    const canonUnit = canonUnits.find((u) => u.id === unitId)
    if (!canonUnit) return null

    const variation = pickVariationByRequestedTier({
      vars: canonUnit.variations,
      civ: teamState.civ.toLowerCase(),
      teamAge: teamState.age,
      tier,
      unit: canonUnit,
    })

    if (!variation) return null

    // Resolve team-wide combat mods (blacksmith + university)
    const teamMods = resolveTeamCombatMods({
      techById: techIndex,
      selectedTechIds: teamState.selectedTechIds || [],
    })

    // Resolve unit-specific combat mods
    const unitMods = resolveUnitCombatMods({
      techById: techIndex,
      unitTechIds: unitTechIds,
    })

    // Apply all combat mods to get effective stats
    const effectiveStats = applyCombatModsToVariation({
      variation,
      teamMods,
      unitMods,
    })

    const hp = effectiveStats.hitpoints
    const armor = effectiveStats.armor

    // Separate weapons by type for DPS calculation
    const meleeWeapons = effectiveStats.weapons.filter(
      (w) => w.damageType?.toLowerCase() === 'melee',
    )
    const rangedWeapons = effectiveStats.weapons.filter((w) => {
      const dt = w.damageType?.toLowerCase()
      return dt === 'ranged' || dt === 'siege'
    })

    // Calculate best melee DPS
    let meleeDps = 0
    let meleeWeapon = meleeWeapons[0]
    for (const w of meleeWeapons) {
      const wdps = (w.damageMin + w.damageMax) / 2 / w.attackPeriod
      if (wdps > meleeDps) {
        meleeDps = wdps
        meleeWeapon = w
      }
    }

    // Calculate best ranged DPS
    let rangedDps = 0
    let rangedWeapon = rangedWeapons[0]
    for (const w of rangedWeapons) {
      const wdps = (w.damageMin + w.damageMax) / 2 / w.attackPeriod
      if (wdps > rangedDps) {
        rangedDps = wdps
        rangedWeapon = w
      }
    }

    // Pick DPS based on mode
    let primaryWeapon: typeof meleeWeapon
    let dps: number

    if (dpsMode === 'melee') {
      primaryWeapon = meleeWeapon
      dps = meleeDps
    } else if (dpsMode === 'ranged') {
      primaryWeapon = rangedWeapon
      dps = rangedDps
    } else {
      // Auto: pick highest
      if (meleeDps > rangedDps) {
        primaryWeapon = meleeWeapon
        dps = meleeDps
      } else {
        primaryWeapon = rangedWeapon
        dps = rangedDps
      }
    }

    return {
      hp,
      hpTotal: hp * count,
      armorMelee: armor.melee,
      armorRanged: armor.ranged,
      dps,
      dpsTotal: dps * count,
      weapon: primaryWeapon,
      hasHybridWeapons: meleeWeapons.length > 0 && rangedWeapons.length > 0,
    }
  }

  return (
    <div className="team-panel">
      <div className="team-header" data-tour="civage-selector">
        <CivSelector value={teamState.civ} onChange={handleCivChange} />
        <AgeSelector value={teamState.age as 1 | 2 | 3 | 4} onChange={handleAgeChange} />
      </div>

      <div className="team-upgrades" data-tour="blacksmith">
        <h3
          onClick={() => setBlacksmithExpanded(!blacksmithExpanded)}
          className="tech-section-header"
        >
          <span className="tech-icon">⚔️</span>
          <span>Blacksmith</span>
          {!blacksmithExpanded && (
            <span className="blacksmith-summary">
              {blacksmithBonuses.meleeAttack > 0 && `M.Atk +${blacksmithBonuses.meleeAttack} `}
              {blacksmithBonuses.rangedAttack > 0 && `R.Atk +${blacksmithBonuses.rangedAttack} `}
              {blacksmithBonuses.meleeArmor > 0 && `M.Arm +${blacksmithBonuses.meleeArmor} `}
              {blacksmithBonuses.rangedArmor > 0 && `R.Arm +${blacksmithBonuses.rangedArmor}`}
            </span>
          )}
        </h3>
        {blacksmithExpanded && (
          <div className="tech-groups">
            {teamBlacksmithTechs.length === 0 && (
              <div className="muted">No upgrades available.</div>
            )}
            {(() => {
              // Group techs by category (Melee Attack, Ranged Attack, etc.)
              const groups = new Map<string, typeof teamBlacksmithTechs>()
              for (const tech of teamBlacksmithTechs) {
                // Extract category from displayClasses (e.g., "Melee Damage Technology 1/3" -> "Melee Damage")
                const displayClass = tech.classes?.find(
                  (c) => c.includes('Technology') && /\d\/\d/.test(c),
                )
                if (!displayClass) continue // Skip non-tiered techs
                const category = displayClass.replace(/\s+\d+\/\d+$/, '')
                if (!groups.has(category)) groups.set(category, [])
                groups.get(category)!.push(tech)
              }

              return Array.from(groups.entries()).map(([category, techs]) => (
                <div key={category} className="tech-group">
                  <div className="tech-group-label">{category.replace(' Technology', '')}</div>
                  <div className="tech-tier-row">
                    {techs.map((t) => {
                      const checked = teamState.selectedTechIds?.includes(t.id) ?? false
                      // Extract tier from displayClasses (e.g., "2/3" -> "II")
                      const tierMatch = t.classes
                        ?.find((c) => /\d\/\d/.test(c))
                        ?.match(/(\d+)\/(\d+)/)
                      const tierNum = tierMatch ? tierMatch[1] : ''
                      const tierLabel =
                        tierNum === '1'
                          ? 'I'
                          : tierNum === '2'
                            ? 'II'
                            : tierNum === '3'
                              ? 'III'
                              : tierNum

                      return (
                        <label
                          key={t.id}
                          className="tech-tier-item"
                          title={`${t.name}${t.description ? '\n' + t.description : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleTeamTech(t.id, e.target.checked)}
                            aria-label={t.name}
                          />
                          <span className="tier-label">{tierLabel}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}

        <h3
          onClick={() => setUniversityExpanded(!universityExpanded)}
          className="tech-section-header"
          data-tour="university"
        >
          <span className="tech-icon">📚</span>
          <span>University</span>
        </h3>
        {universityExpanded && (
          <div className="team-upgrade-list-compact">
            {teamUniversityTechs.length === 0 && (
              <div className="muted">No upgrades available.</div>
            )}
            {teamUniversityTechs.map((t) => {
              const checked = teamState.selectedTechIds?.includes(t.id) ?? false
              return (
                <label key={t.id} className="upgrade-item-compact" title={t.description || ''}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleTeamTech(t.id, e.target.checked)}
                    aria-label={t.name}
                  />
                  <span>{t.name}</span>
                </label>
              )
            })}
          </div>
        )}
      </div>

      <div className="unit-add" data-tour="unit-add">
        <h3>Add Unit</h3>
        <div className="unit-add-row">
          <select
            title="Team selection"
            value={pendingUnitId}
            onChange={(e) => setPendingUnitId(e.target.value)}
            className="unit-select"
            aria-label="Select unit to add"
          >
            <option value="">Select unit…</option>
            {groupedUnits.map((group) => (
              <optgroup key={group.building} label={group.label}>
                {group.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            type="number"
            min="1"
            max="200"
            value={pendingCount}
            onChange={(e) => setPendingCount(Number(e.target.value))}
            className="unit-count"
            aria-label="Unit count"
            placeholder="Count"
          />
          <button className="add-button" onClick={addPendingUnit} disabled={!pendingUnitId}>
            ➕ Add Unit
          </button>
        </div>
      </div>

      {teamTotals && (
        <div className="team-summary-card" data-tour="team-summary">
          <div className="team-summary-title">Team Summary</div>
          <div className="team-summary-grid">
            <div className="team-summary-cell">
              <span className="res-icon resFood">
                <ResourceIcon kind="food" />
              </span>
              {Math.round(teamTotals.food)}
            </div>
            <div className="team-summary-cell">
              <span className="res-icon resWood">
                <ResourceIcon kind="wood" />
              </span>
              {Math.round(teamTotals.wood)}
            </div>
            <div className="team-summary-cell">
              <span className="res-icon resGold">
                <ResourceIcon kind="gold" />
              </span>
              {Math.round(teamTotals.gold)}
            </div>
            <div className="team-summary-cell">
              <span className="res-icon resStone">
                <ResourceIcon kind="stone" />
              </span>
              {Math.round(teamTotals.stone)}
            </div>
            {teamTotals.oliveoil > 0 && (
              <div className="team-summary-cell">
                <span className="res-icon resOliveoil">
                  <ResourceIcon kind="oliveoil" />
                </span>
                {Math.round(teamTotals.oliveoil)}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="unit-list" data-tour="unit-list">
        <h3>Units ({teamState.units.length})</h3>
        {teamState.units.length === 0 ? (
          <p className="empty-roster">No units selected</p>
        ) : (
          <ul>
            {teamState.units.map((unit) => {
              const canonUnit = canonUnits.find((u) => u.id === unit.unitId)
              const unitName = canonUnit?.name
              const hasVet = canonUnit ? hasVeteranTier(canonUnit) : true
              const hasEli = canonUnit ? hasEliteTier(canonUnit) : true
              const iconUrl = canonUnit?.icon

              // Get the variation to check cost
              const variation = canonUnit
                ? pickVariationByRequestedTier({
                    vars: canonUnit.variations,
                    civ: teamState.civ.toLowerCase(),
                    teamAge: teamState.age,
                    tier: unit.tier,
                    unit: canonUnit,
                  })
                : null

              // Check if this is a mercenary unit (costs olive oil)
              const isMercenary =
                variation?.cost && (variation.cost as Record<string, number>).oliveoil > 0

              // Get enabled unit tech IDs
              const unitTechIds = (unit.unitTechs ?? [])
                .filter((ut) => ut.enabled)
                .map((ut) => ut.id)

              const dpsMode = unitDpsMode[unit.unitId] || 'auto'
              const stats = getUnitStats(unit.unitId, unit.tier, unit.count, unitTechIds, dpsMode)

              // Get unit-specific techs
              const civNorm = teamState.civ.toLowerCase()
              const unitIdNorm = unit.unitId.toLowerCase()
              const unitTechs = canonTechs
                .filter((t) => {
                  if (
                    t.civs?.length &&
                    !t.civs
                      .map(String)
                      .map((x) => x.toLowerCase())
                      .includes(civNorm)
                  )
                    return false
                  if (t.age && t.age > teamState.age) return false
                  if (!Array.isArray(t.effects)) return false
                  const targetsThisUnit = t.effects.some((e: Record<string, unknown>) => {
                    const selectIds = (
                      (e?.raw as Record<string, unknown>)?.select as
                        | Record<string, unknown>
                        | undefined
                    )?.id
                    if (Array.isArray(selectIds)) {
                      return selectIds.some(
                        (id: unknown) => String(id).toLowerCase() === unitIdNorm,
                      )
                    }
                    return false
                  })
                  return targetsThisUnit
                })
                .sort((a, b) => (a.age ?? -1) - (b.age ?? -1) || a.name.localeCompare(b.name))

              return (
                <li key={unit.unitId} className="unit-row">
                  {/* Row 1: Icon + Name/Count + Tier + Remove */}
                  <div className="unit-row-header">
                    {iconUrl && <img src={iconUrl} alt={unit.unitId} className="unit-icon" />}
                    <div className="unit-name-count">
                      <span className="unit-name">
                        {unitName || unit.unitId}
                        {isMercenary && (
                          <span
                            style={{
                              marginLeft: '6px',
                              fontSize: '10px',
                              padding: '2px 6px',
                              background: 'rgba(218, 165, 32, 0.2)',
                              border: '1px solid rgba(218, 165, 32, 0.5)',
                              borderRadius: '3px',
                              color: '#daa520',
                              fontWeight: '600',
                            }}
                            title="Mercenary unit (costs olive oil)"
                          >
                            🏛️ Merc
                          </span>
                        )}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={unit.count}
                      onChange={(e) =>
                        handleUpdateUnit(unit.unitId, { count: Number(e.target.value) })
                      }
                      className="unit-count"
                      aria-label={`${unit.unitId} count`}
                    />
                    <select
                      value={unit.tier}
                      onChange={(e) =>
                        handleUpdateUnit(unit.unitId, {
                          tier: e.target.value as 'base' | 'veteran' | 'elite',
                        })
                      }
                      className="unit-tier"
                      aria-label={`${unit.unitId} tier`}
                    >
                      <option value="base">Base</option>
                      <option value="veteran" disabled={teamState.age < 3 || !hasVet}>
                        Veteran {!hasVet ? '(N/A)' : teamState.age < 3 ? '(Age 3)' : ''}
                      </option>
                      <option value="elite" disabled={teamState.age < 4 || !hasEli}>
                        Elite {!hasEli ? '(N/A)' : teamState.age < 4 ? '(Age 4)' : ''}
                      </option>
                    </select>
                    <button
                      className="remove-button"
                      onClick={() => handleRemoveUnit(unit.unitId)}
                      aria-label={`Remove ${unit.unitId}`}
                    >
                      ❌
                    </button>
                  </div>

                  {/* Row 2: HP / DPS / Armor Stats */}
                  {stats && (
                    <div className="unit-stats-row">
                      <div className="stat-item">
                        <span className="stat-label">HP:</span>
                        <span className="stat-value">{stats.hpTotal.toLocaleString()}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">DPS:</span>
                        <span className="stat-value">{stats.dpsTotal.toFixed(2)}</span>
                        {stats.hasHybridWeapons && (
                          <select
                            title="Unit selection"
                            value={dpsMode}
                            onChange={(e) =>
                              setUnitDpsMode((prev) => ({
                                ...prev,
                                [unit.unitId]: e.target.value as 'auto' | 'melee' | 'ranged',
                              }))
                            }
                            className="dps-mode-select"
                          >
                            <option value="auto">Auto</option>
                            <option value="melee">M</option>
                            <option value="ranged">R</option>
                          </select>
                        )}
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Armor:</span>
                        <span className="stat-value">
                          M{Math.round(stats.armorMelee)} / R{Math.round(stats.armorRanged)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Row 2.5: Passive Abilities */}
                  {stats && stats.weapon && stats.weapon.isSpearwall && (
                    <div
                      className="stat-item"
                      title="This unit has a Spearwall attack that triggers against cavalry and elephants."
                    >
                      <span className="stat-label">Passive:</span>
                      <span className="stat-value" style={{ color: '#2a7' }}>
                        Spearwall
                      </span>
                    </div>
                  )}
                  {/* Row 3: Unit Techs/Upgrades */}
                  {unitTechs.length > 0 && (
                    <div className="unit-techs">
                      {unitTechs.map((t) => {
                        const checked = (unit.unitTechs ?? []).some(
                          (ut) => ut.enabled && ut.id === t.id,
                        )
                        const disabled = (t.age ?? 1) > teamState.age
                        return (
                          <label key={t.id} className="upgrade-item" title={t.description || ''}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={(e) => {
                                const prev = (unit.unitTechs ?? []).filter((ut) => ut.id !== t.id)
                                if (e.target.checked) {
                                  handleUpdateUnit(unit.unitId, {
                                    unitTechs: [...prev, { id: t.id, enabled: true }],
                                  })
                                } else {
                                  handleUpdateUnit(unit.unitId, { unitTechs: prev })
                                }
                              }}
                            />
                            <span>{t.name}</span>
                            {t.age ? <span className="muted"> (Age {t.age})</span> : null}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
