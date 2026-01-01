///src/data/canon/canonTypes.ts
export type Age = 1 | 2 | 3 | 4
export type CivId = string
export type ClassId = string

// ---------- Weapons ----------
export type CanonWeapon = {
  name: string
  damageMin: number
  damageMax: number
  attackPeriod: number
  rangeMin: number
  rangeMax: number
  damageType: string
  isSpearwall?: boolean
  modifiers?: any[] // Weapon modifiers (e.g., +17 vs cavalry)
}

// ---------- Armor ----------
export type CanonArmor = {
  melee: number
  ranged: number
}

// ---------- Unit Variation ----------
export type CanonUnitVariation = {
  id: string
  baseUnitId: string
  name: string

  civs: CivId[]
  age: Age
  classes: ClassId[]

  hitpoints: number
  armor: CanonArmor
  weapons: CanonWeapon[]
  movement?: { speed: number }

  cost?: Record<string, number>
  producedBy?: string[]
}

// ---------- Unit ----------
export type CanonUnit = {
  id: string
  name: string
  civs: CivId[]
  classes: ClassId[]
  displayClasses: ClassId[] // NEW (keep raw "displayClasses")
  icon?: string // Unit icon URL
  variations: CanonUnitVariation[]
}

// ---------- Technology Effect (raw for now) ----------
export type CanonTechEffect = {
  type: string
  raw: unknown
}

// ---------- Technology ----------
export type CanonTechnology = {
  id: string
  baseId: string
  name: string
  description?: string

  civs: CivId[]
  age?: Age
  classes?: ClassId[]

  producedBy?: string[] // ✅ add (normalized strings like 'blacksmith', 'university', etc.)

  effects: CanonTechEffect[]
}
