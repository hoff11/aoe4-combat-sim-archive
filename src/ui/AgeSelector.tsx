import React from 'react'

export type AgeSelectorProps = {
  value: 1 | 2 | 3 | 4
  onChange: (age: 1 | 2 | 3 | 4) => void
}

export function AgeSelector({ value, onChange }: AgeSelectorProps) {
  return (
    <label>
      Age:
      <select value={value} onChange={(e) => onChange(Number(e.target.value) as 1 | 2 | 3 | 4)}>
        <option value={1}>Age I</option>
        <option value={2}>Age II</option>
        <option value={3}>Age III</option>
        <option value={4}>Age IV</option>
      </select>
    </label>
  )
}
