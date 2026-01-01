import React from 'react'
import type { CanonTechnology } from '../data/canon/canonTypes'

export type UnitTechSelectorProps = {
  teamAge: 1 | 2 | 3 | 4
  teamCiv: string
  unitId: string
  techs: readonly CanonTechnology[]
  selectedIds: readonly string[]
  onChange: (nextIds: string[]) => void
}

export function UnitTechSelector({
  teamAge,
  teamCiv,
  unitId,
  techs,
  selectedIds,
  onChange,
}: UnitTechSelectorProps) {
  const available = React.useMemo(() => {
    const civNorm = String(teamCiv).toLowerCase()
    const unitIdNorm = unitId.toLowerCase()

    return techs
      .filter((t) => {
        // Filter by civ
        if (
          t.civs?.length &&
          !t.civs
            .map(String)
            .map((x) => x.toLowerCase())
            .includes(civNorm)
        )
          return false
        // Filter by age
        if (t.age && t.age > teamAge) return false

        // Filter by unit-specific techs: check if this tech targets this unit
        const targetsThisUnit = t.effects?.some((e: Record<string, unknown>) => {
          const selectIds = (e.raw as Record<string, unknown>)?.select?.id
          if (Array.isArray(selectIds)) {
            return selectIds.some((id: unknown) => String(id).toLowerCase() === unitIdNorm)
          }
          return false
        })

        if (!targetsThisUnit) return false
        return true
      })
      .sort((a, b) => (a.age ?? -1) - (b.age ?? -1) || a.name.localeCompare(b.name))
  }, [techs, teamAge, teamCiv, unitId])

  function toggle(id: string, enabled: boolean) {
    const prev = new Set(selectedIds.map(String))
    if (enabled) prev.add(id)
    else prev.delete(id)
    onChange(Array.from(prev))
  }

  return (
    <div className="unit-tech-selector">
      <div className="tech-list">
        {available.map((t) => {
          const checked = selectedIds.includes(t.id)
          const disabled = (t.age ?? 1) > teamAge
          return (
            <label key={t.id} className="tech-item">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => toggle(t.id, e.target.checked)}
              />
              <span className="tech-name">{t.name}</span>
              {t.age ? <span className="tech-age"> (Age {t.age})</span> : null}
            </label>
          )
        })}
      </div>
    </div>
  )
}
