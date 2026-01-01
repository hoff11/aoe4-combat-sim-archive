// src/data/raw/rawTypes.ts
export type RawEnvelope<T> = {
  __note__?: string
  __version__?: string
  data: T[]
}

export type RawUnit = any
export type RawTechnology = any
export type RawUpgrade = any
export type RawAbility = any
