/**
 * Manual exclusions for units that appear in game data at certain ages
 * but are actually gated by building/tech requirements not reflected in unit data.
 *
 * This is necessary because some units have minAge=1 but require Age 2+ landmarks
 * or other prerequisites not captured in the unit variations data.
 */

export type UnitAgeExclusion = {
  unitId: string
  civ?: string // If specified, only applies to this civ
  excludeAtAges: number[]
  reason: string
}

export const UNIT_AGE_EXCLUSIONS: UnitAgeExclusion[] = [
  // Spawner units that shouldn't be directly selectable
  {
    unitId: 'earls-retinue',
    excludeAtAges: [1, 2, 3, 4],
    reason: 'Spawner unit - produces other units, has no HP/weapons data',
  },
  {
    unitId: 'garrison-command',
    excludeAtAges: [1, 2, 3, 4],
    reason: 'Spawner unit - produces other units, has no HP/weapons data',
  },

  // Ayyubids
  {
    unitId: 'atabeg',
    civ: 'ay',
    excludeAtAges: [1],
    reason: 'Requires House of Wisdom (Age 2+ landmark)',
  },

  // House of Lancaster
  {
    unitId: 'demilancer',
    civ: 'hl',
    excludeAtAges: [1],
    reason: 'Requires Lancaster Castle (Age 2+ landmark)',
  },
  {
    unitId: 'earls-guard',
    civ: 'hl',
    excludeAtAges: [1, 2],
    reason: 'Available from Age 3 (from Lancaster buildings)',
  },

  // Order of the Dragon (prelate available Age 3+, not Age 1 like HRE)
  {
    unitId: 'prelate',
    civ: 'od',
    excludeAtAges: [1, 2],
    reason: 'Order of the Dragon gets Prelate at Age 3, not Age 1 like HRE',
  },

  // Macedonia
  {
    unitId: 'hippodrome-horseman',
    civ: 'mac',
    excludeAtAges: [1],
    reason: 'Requires Imperial Hippodrome (Age 2+ landmark)',
  },
  {
    unitId: 'hippodrome-riddari',
    civ: 'mac',
    excludeAtAges: [1],
    reason: 'Requires Imperial Hippodrome (Age 2+ landmark)',
  },
  {
    unitId: 'hippodrome-scout',
    civ: 'mac',
    excludeAtAges: [1],
    reason: 'Requires Imperial Hippodrome (Age 2+ landmark)',
  },

  // Sengoku Daimyo levy units require Daimyo Estate landmarks (Age 2+)
  {
    unitId: 'naginata-samurai-levy',
    civ: 'sen',
    excludeAtAges: [1],
    reason: 'Requires Hojo Clan Daimyo Estate (Age 2+ landmark)',
  },
  {
    unitId: 'spearman-levy',
    civ: 'sen',
    excludeAtAges: [1],
    reason: 'Requires Hojo Clan Daimyo Estate (Age 2+ landmark)',
  },
  {
    unitId: 'yari-cavalry-levy',
    civ: 'sen',
    excludeAtAges: [1],
    reason: 'Requires Takeda Clan Daimyo Estate (Age 2+ landmark)',
  },
  {
    unitId: 'yumi-ashigaru-levy',
    civ: 'sen',
    excludeAtAges: [1],
    reason: 'Requires Oda Clan Daimyo Estate (Age 2+ landmark)',
  },
  // Add more exclusions as discovered during QA
]

/**
 * Check if a unit should be excluded at a given age for a given civ
 */
export function isUnitExcludedAtAge(unitId: string, civ: string, age: number): boolean {
  return UNIT_AGE_EXCLUSIONS.some(
    (exclusion) =>
      exclusion.unitId === unitId &&
      exclusion.excludeAtAges.includes(age) &&
      (!exclusion.civ || exclusion.civ === civ),
  )
}
