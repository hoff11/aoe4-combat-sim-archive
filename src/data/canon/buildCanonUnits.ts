import type { CanonUnit, CanonUnitVariation, CanonWeapon, CanonArmor, Age } from './canonTypes'

function toAge(x: any): Age {
  const n = Number(x)
  if (n === 1 || n === 2 || n === 3 || n === 4) return n
  return 1
}

function num(x: any, fallback = 0): number {
  const n = Number(x)
  return Number.isFinite(n) ? n : fallback
}

function parseArmor(rawArmor: any): CanonArmor {
  // Case A: [] or [{type,value}, ...]
  if (Array.isArray(rawArmor)) {
    let melee = 0
    let ranged = 0
    for (const it of rawArmor) {
      const t = String(it?.type ?? '').toLowerCase()
      const v = num(it?.value, 0)
      if (t === 'melee') melee = v
      if (t === 'ranged') ranged = v
    }
    return { melee, ranged }
  }

  // Case B: object { melee, ranged } (future-proof)
  if (rawArmor && typeof rawArmor === 'object') {
    return {
      melee: num((rawArmor as any).melee ?? (rawArmor as any).meleeArmor, 0),
      ranged: num((rawArmor as any).ranged ?? (rawArmor as any).rangedArmor, 0),
    }
  }

  return { melee: 0, ranged: 0 }
}
function parseCost(rawCosts: any): Record<string, number> | undefined {
  if (!rawCosts || typeof rawCosts !== 'object') return undefined

  // Include all resources, including oliveoil for Byzantine mercenaries
  const food = num((rawCosts as any).food, 0)
  const wood = num((rawCosts as any).wood, 0)
  const gold = num((rawCosts as any).gold, 0)
  const stone = num((rawCosts as any).stone, 0)
  const oliveoil = num((rawCosts as any).oliveoil, 0)

  if (food === 0 && wood === 0 && gold === 0 && stone === 0 && oliveoil === 0) return undefined
  return { food, wood, gold, stone, oliveoil }
}
function normDamageType(raw: any): string {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()

  // MELEE
  if (t === 'melee' || t.includes('melee') || t.includes('hand') || t.includes('handheld')) {
    return 'melee'
  }

  // RANGED
  if (
    t === 'ranged' ||
    t.includes('ranged') ||
    t.includes('projectile') ||
    t.includes('arrow') ||
    t.includes('bolt') ||
    t.includes('thrown') ||
    t.includes('gun') ||
    t.includes('bow')
  ) {
    return 'ranged'
  }

  // SIEGE
  if (t === 'siege' || t.includes('siege') || t.includes('cannon') || t.includes('explosive')) {
    return 'siege'
  }

  // FIRE / MAGIC (rare but explicit)
  if (t.includes('fire')) return 'fire'
  if (t.includes('magic')) return 'magic'

  return 'other'
}

function normalizeProducedBy(raw: string, classes: string[]): string {
  const normalized = raw.toLowerCase()

  // Map unit-specific producedBy to building types first
  const buildingMap: Record<string, string> = {
    // Buildings (normalize to standard names)
    barracks: 'barracks',
    'archery-range': 'archery-range',
    stable: 'stable',
    'siege-workshop': 'siege-workshop',
    dock: 'dock',
    harbor: 'dock',
    'town-center': 'town-center',
    'capital-town-center': 'town-center',
    keep: 'keep',
    monastery: 'monastery',
    market: 'market',

    // Golden Horde unique buildings
    // 'golden-tent': removed - let it use heuristic (produces cavalry)
    ovoo: 'barracks',
    'relic-ovoo': 'barracks',

    // House of Lancaster unique buildings
    'berkshire-palace': 'keep',
    'lancaster-castle': 'keep',
    'the-white-tower': 'keep',

    // Chinese unique buildings
    'jiangnan-tower': 'barracks',

    // Sengoku Daimyo unique buildings
    'hojo-clan-daimyo-estate': 'barracks',
    'takeda-clan-daimyo-estate': 'stable',
    'oda-clan-daimyo-estate': 'archery-range',
    matsuri: 'market',

    // Macedonia unique buildings
    'imperial-hippodrome': 'stable',
    'varangian-stronghold': 'barracks',
    'varangian-warcamp': 'barracks',

    // Other civ unique military buildings
    'burgrave-palace': 'barracks',
    'council-hall': 'archery-range',
    // 'khaganate-palace': removed - let it use heuristic (spawns siege units)
    'kings-palace': 'town-center',
    // 'mercenary-house': removed - let it use heuristic based on unit classes
    // 'military-school': removed - let it use heuristic (produces cavalry)
    'school-of-cavalry': 'stable',
    'wynguard-palace': 'barracks',
    'foreign-engineering-company': 'siege-workshop',
    'college-of-artillery': 'siege-workshop',

    // Byzantine mercenary buildings - preserve as-is
    'golden-horn-tower': 'golden-horn-tower',
    'mercenary-house': 'mercenary-house',
    'palatine-school': 'palatine-school',

    // Religious/special buildings
    'house-of-wisdom': 'monastery',
    'dome-of-the-faith': 'monastery',
    mosque: 'monastery',
    'prayer-tent': 'monastery',
    'buddhist-temple': 'monastery',
    pagoda: 'monastery',
    'shinto-shrine': 'monastery',
    'shaolin-monastery': 'monastery',

    // Other unique production buildings
    'hunting-cabin': 'barracks',
    'farimba-garrison': 'barracks',
    'tanegashima-gunsmith': 'archery-range',
    'koka-township': 'barracks',
    'tughlaqabad-fort': 'town-center',

    // Barracks units
    spearman: 'barracks',
    'spearman-levy': 'barracks',
    'man-at-arms': 'barracks',
    militia: 'barracks',
    landsknecht: 'barracks',
    'gilded-man-at-arms': 'barracks',
    'gilded-spearman': 'barracks',
    'gilded-landsknecht': 'barracks',
    'heavy-spearman': 'barracks',
    limitanei: 'barracks',
    serjeant: 'barracks',
    'palace-guard': 'barracks',
    'varangian-guard': 'barracks',
    'jeanne-darc-woman-at-arms': 'barracks',
    'teutonic-knight': 'barracks',
    samurai: 'barracks',
    'katana-bannerman': 'barracks',
    'kanabo-samurai': 'barracks',
    'naginata-samurai': 'barracks',
    'naginata-samurai-levy': 'barracks',
    atgeirmadr: 'barracks',
    bogmadr: 'barracks',

    // Archery range units
    archer: 'archery-range',
    crossbowman: 'archery-range',
    handcannoneer: 'archery-range',
    longbowman: 'archery-range',
    arbaletrier: 'archery-range',
    'gilded-archer': 'archery-range',
    'gilded-crossbowman': 'archery-range',
    'gilded-handcannoneer': 'archery-range',
    'genoese-crossbowman': 'archery-range',
    'javelin-thrower': 'archery-range',
    grenadier: 'archery-range',
    streltsy: 'archery-range',
    janissary: 'archery-range',
    'yumi-ashigaru': 'archery-range',
    'yumi-ashigaru-levy': 'archery-range',
    'yumi-bannerman': 'archery-range',
    'tanegashima-ashigaru': 'archery-range',
    'tanegashima-ashigaru-levy': 'archery-range',
    'handcannon-ashigaru': 'archery-range',
    ozutsu: 'archery-range',
    'zhuge-nu': 'archery-range',

    // Stable units
    horseman: 'stable',
    scout: 'stable',
    'hospitaller-knight': 'stable',
    'camel-lancer': 'stable',
    'desert-raider': 'stable',
    ghulam: 'stable',
    'bedouin-skirmisher': 'stable',
    'bedouin-swordsman': 'stable',
  }

  if (buildingMap[normalized]) return buildingMap[normalized]

  // Heuristic: infer building by unit classes if no direct mapping
  const cls = classes.map((c) => c.toLowerCase())
  const has = (needle: string) => cls.some((c) => c.includes(needle))
  const hasExact = (needle: string) => cls.includes(needle.toLowerCase())

  if (has('naval') || has('ship')) return 'dock'
  // Check for exact 'siege' class, not substring match (to avoid 'find_non_siege_land_military')
  if (hasExact('siege') || hasExact('siege_workshop')) return 'siege-workshop'
  if (has('cavalry') || has('mounted') || has('horse')) return 'stable'
  if (has('archer') || has('ranged') || has('crossbow') || has('gunpowder')) return 'archery-range'
  if (has('infantry') || has('melee')) return 'barracks'

  return normalized
}

function parseWeapon(rw: any): CanonWeapon | null {
  if (!rw || typeof rw !== 'object') return null

  const name = String((rw as any).name ?? 'Unknown')
  const rawType = (rw as any).type ?? (rw as any).damageType ?? (rw as any).damage_type
  const damageType = normDamageType(rawType).toLowerCase()

  const damage = (rw as any).damage
  const damageMin = typeof damage === 'number' ? num(damage, 0) : num((rw as any).damageMin, 0)
  const damageMax =
    typeof damage === 'number' ? num(damage, 0) : num((rw as any).damageMax, damageMin)

  const speed = (rw as any).speed
  const attackPeriod = typeof speed === 'number' ? num(speed, 1) : num((rw as any).attackPeriod, 1)

  const range = (rw as any).range
  const rangeMin =
    range && typeof range === 'object' ? num(range.min, 0) : num((rw as any).rangeMin, 0)
  const rangeMax =
    range && typeof range === 'object' ? num(range.max, 0) : num((rw as any).rangeMax, 0)

  // Preserve modifiers (e.g., +17 vs cavalry)
  const modifiers = Array.isArray((rw as any).modifiers) ? (rw as any).modifiers : undefined

  return {
    name,
    damageMin,
    damageMax,
    attackPeriod,
    rangeMin,
    rangeMax,
    damageType,
    modifiers,
  }
}

function fallbackWeapon(): CanonWeapon {
  return {
    name: 'Unknown',
    damageMin: 0,
    damageMax: 0,
    attackPeriod: 1,
    rangeMin: 0,
    rangeMax: 0,
    damageType: 'other',
  }
}

export function buildCanonUnits(rawUnits: any[]): CanonUnit[] {
  if (!Array.isArray(rawUnits)) return []

  const out: CanonUnit[] = []

  for (const ru of rawUnits) {
    if (!ru || typeof ru !== 'object') continue

    const unitId = String((ru as any).id ?? '')
    const unitName = String((ru as any).name ?? unitId ?? 'Unknown')

    const civs = Array.isArray((ru as any).civs) ? ((ru as any).civs as any[]).map(String) : []
    const classes = Array.isArray((ru as any).classes)
      ? ((ru as any).classes as any[]).map(String)
      : []
    const displayClasses = Array.isArray((ru as any).displayClasses)
      ? ((ru as any).displayClasses as any[]).map(String)
      : []

    const rawVars = Array.isArray((ru as any).variations) ? ((ru as any).variations as any[]) : []
    const sharedData = (ru as any).shared ?? {} // Optimized files have shared tier data

    const variations: CanonUnitVariation[] = rawVars.map((rv, i) => {
      const varId = String((rv as any)?.id ?? `${unitId}#${i}`)

      // For optimized files: merge data from shared[varId] and unit level
      // For regular files: use variation data directly
      const shared = sharedData[varId] ?? {}
      const _hasSharedData = Object.keys(shared).length > 0

      const varName = String((rv as any)?.name ?? shared.name ?? unitName)

      const hitpoints = num((rv as any)?.hitpoints ?? shared.hitpoints ?? (ru as any).hitpoints, 1)

      const rawWeapons = Array.isArray((rv as any)?.weapons)
        ? ((rv as any).weapons as any[])
        : Array.isArray(shared.weapons)
          ? (shared.weapons as any[])
          : Array.isArray((ru as any)?.weapons)
            ? ((ru as any).weapons as any[])
            : []
      const weapons = rawWeapons.map(parseWeapon).filter((w): w is CanonWeapon => Boolean(w))

      // Extract movement data
      const movement = (() => {
        const rawMovement = (rv as any)?.movement ?? shared.movement ?? (ru as any).movement
        if (rawMovement && typeof rawMovement === 'object') {
          const speed = num(rawMovement.speed, undefined)
          return Number.isFinite(speed) ? { speed } : undefined
        }
        return undefined
      })()

      const variationClasses = Array.isArray((rv as any)?.classes)
        ? ((rv as any).classes as any[]).map(String)
        : Array.isArray(shared.classes)
          ? (shared.classes as any[]).map(String)
          : classes

      // Extract age from variation id (e.g., "archer-2" -> age 2)
      const ageFromId = varId.match(/-(\d)$/)?.[1]
      const age = toAge(
        (rv as any)?.age ?? shared.age ?? ageFromId ?? (ru as any).age ?? (ru as any).minAge,
      )

      return {
        id: varId,
        baseUnitId: unitId,
        name: varName,

        civs: Array.isArray((rv as any)?.civs) ? ((rv as any).civs as any[]).map(String) : civs,
        age,
        classes: variationClasses,

        hitpoints,
        armor: parseArmor((rv as any)?.armor ?? shared.armor ?? (ru as any).armor),
        weapons: weapons.length ? weapons : [fallbackWeapon()],
        movement,

        cost: parseCost((rv as any)?.costs ?? shared.costs ?? (ru as any).costs),
        producedBy: Array.isArray((rv as any)?.producedBy)
          ? ((rv as any).producedBy as any[]).map((pb: any) =>
              normalizeProducedBy(String(pb), variationClasses),
            )
          : Array.isArray(shared.producedBy)
            ? (shared.producedBy as any[]).map((pb: any) =>
                normalizeProducedBy(String(pb), variationClasses),
              )
            : Array.isArray((ru as any).producedBy)
              ? ((ru as any).producedBy as any[]).map((pb: any) =>
                  normalizeProducedBy(String(pb), variationClasses),
                )
              : undefined,
      }
    })

    out.push({
      id: unitId,
      name: unitName,
      civs,
      classes,
      displayClasses, // NEW
      icon: String(ru.icon ?? ''),
      variations,
    })
  }

  return out
}
