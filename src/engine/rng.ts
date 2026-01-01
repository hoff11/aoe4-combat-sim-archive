// src/engine/rng.ts
// Seeded random number generator (Mulberry32).
// Deterministic for reproducible simulations.

/**
 * Mulberry32: fast, simple seeded PRNG.
 * Returns a function that produces [0,1) floats.
 */
export function mulberry32(seed: number = 0) {
  let m_w = seed
  let m_z = 987654321
  const mask = 0xffffffff

  return function () {
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask
    let result = ((m_z << 16) + (m_w & 65535)) >>> 0
    result /= 4294967296
    return result
  }
}
