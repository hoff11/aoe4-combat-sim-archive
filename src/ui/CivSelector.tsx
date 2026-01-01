import React from 'react'
import { CIV_OPTIONS, civDisplayNameOrCode } from '../data/canon/civs'

export type CivSelectorProps = {
  value: string
  onChange: (civId: string) => void
}

export function CivSelector({ value, onChange }: CivSelectorProps) {
  const options = CIV_OPTIONS
  const rendered =
    !value || options.some((o) => o.code === value)
      ? options
      : [...options, { code: value, name: civDisplayNameOrCode(value) }]

  return (
    <label>
      Civilization:
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {rendered.map((civ) => (
          <option key={civ.code} value={civ.code}>
            {civ.name}
          </option>
        ))}
      </select>
    </label>
  )
}
