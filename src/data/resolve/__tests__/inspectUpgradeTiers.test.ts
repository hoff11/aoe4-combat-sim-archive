import { describe, it } from 'vitest'
import { loadRawSnapshotNode } from '../../raw/loadRawSnapshot.node'
import { buildCanonUpgrades } from '../../canon/buildCanonUpgrades'

describe('inspect upgrade tier shapes (dev-only)', () => {
  it('prints a few likely Veteran/Elite upgrade variations', () => {
    const raw = loadRawSnapshotNode()
    const upgrades = buildCanonUpgrades(raw.upgrades.data)

    const hits: Array<{
      upgradeId: string
      upgradeName: string
      varId: string
      varName: string
      civs: string[]
      keys: string[]
      raw: any
    }> = []

    for (const up of upgrades) {
      const upName = String(up.name ?? '')
      const isLikelyTier =
        /veteran|elite/i.test(upName) ||
        /veteran|elite/i.test(String(up.id ?? '')) ||
        /veteran|elite/i.test(String((up as any)?.type ?? ''))

      for (const v of up.variations) {
        const vName = String(v.name ?? '')
        const isVarTier = /veteran|elite/i.test(vName) || /veteran|elite/i.test(String(v.id ?? ''))
        if (!isLikelyTier && !isVarTier) continue

        const rv: any = v.raw
        hits.push({
          upgradeId: up.id,
          upgradeName: up.name,
          varId: v.id,
          varName: v.name,
          civs: v.civs,
          keys: rv && typeof rv === 'object' ? Object.keys(rv).sort() : [],
          raw: rv,
        })

        if (hits.length >= 6) break
      }

      if (hits.length >= 6) break
    }

    console.log(`SNAPSHOT ${raw.version} tier-like upgrade samples: ${hits.length}`)
    for (const h of hits) {
      console.log('---')

      console.log('UPGRADE', h.upgradeId, h.upgradeName)

      console.log('VAR', h.varId, h.varName, 'civs=', h.civs)

      console.log('RAW keys:', h.keys)

      console.log(
        'RAW.baseId:',
        h.raw?.baseId,
        'RAW.attribName:',
        h.raw?.attribName,
        'RAW.type:',
        h.raw?.type,
      )

      console.log('RAW.hitpoints:', h.raw?.hitpoints)

      console.log('RAW.armor:', h.raw?.armor)

      console.log(
        'RAW.weapons:',
        Array.isArray(h.raw?.weapons)
          ? h.raw.weapons.map((w: any) => ({ name: w?.name, type: w?.type, damage: w?.damage }))
          : h.raw?.weapons,
      )
    }
  })
})
