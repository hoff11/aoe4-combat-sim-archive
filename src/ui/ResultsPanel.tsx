import type { SimResult } from '../engine/types'
import { TimelineGraph } from './TimelineGraph'

export type ResultsPanelProps = {
  result: SimResult
  scenario?: {
    preset: 'Engaged' | 'Skirmish' | 'OpenField' | 'Custom'
    startingDistance: number
    openness: number
    kitingAllowed: boolean
  }
}

export function ResultsPanel({ result, scenario }: ResultsPanelProps) {
  const teamAWins = result.winner === 'A'
  const teamASurvivors = result.survivorsA
  const teamBSurvivors = result.survivorsB

  // Calculate average DPS (total damage / duration)
  const duration = result.seconds || 1
  const dpsA = result.totalDmgDoneA / duration
  const dpsB = result.totalDmgDoneB / duration

  // Calculate efficiency (actual damage vs total including overkill)
  const totalOutputA = result.totalDmgDoneA + result.overkillA
  const totalOutputB = result.totalDmgDoneB + result.overkillB
  const efficiencyA = totalOutputA > 0 ? (result.totalDmgDoneA / totalOutputA) * 100 : 100
  const efficiencyB = totalOutputB > 0 ? (result.totalDmgDoneB / totalOutputB) * 100 : 100

  return (
    <div className="results-panel">
      {/* Engagement Phases Card */}
      <div
        style={{
          margin: '0 0 16px 0',
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid rgba(148, 163, 184, 0.25)',
          background: 'rgba(10, 15, 25, 0.35)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14 }}>Engagement Phases</div>

          {/* Export button */}
          <button
            onClick={async () => {
              // Compress timeline to events only (when changes occur)
              const events = []
              for (let i = 0; i < result.timeline.length; i++) {
                const point = result.timeline[i]
                const prev = i > 0 ? result.timeline[i - 1] : null

                // Always include first point
                if (i === 0) {
                  events.push({
                    t: point.t,
                    alive: { A: point.aliveA, B: point.aliveB },
                    hp: { A: Math.round(point.hpA * 10) / 10, B: Math.round(point.hpB * 10) / 10 },
                    tag: 'start',
                  })
                }
                // Include points where state changes
                else if (
                  prev &&
                  (point.aliveA !== prev.aliveA ||
                    point.aliveB !== prev.aliveB ||
                    Math.abs(point.hpA - prev.hpA) > 0.01 ||
                    Math.abs(point.hpB - prev.hpB) > 0.01)
                ) {
                  const tags = []
                  if (result.timeToContact && Math.abs(point.t - result.timeToContact) < 0.15) {
                    tags.push('contact')
                  }

                  events.push({
                    t: point.t,
                    alive: { A: point.aliveA, B: point.aliveB },
                    hp: { A: Math.round(point.hpA * 10) / 10, B: Math.round(point.hpB * 10) / 10 },
                    ...(tags.length > 0 && { tag: tags[0] }),
                  })
                }
                // Always include last point
                else if (i === result.timeline.length - 1) {
                  events.push({
                    t: point.t,
                    alive: { A: point.aliveA, B: point.aliveB },
                    hp: { A: Math.round(point.hpA * 10) / 10, B: Math.round(point.hpB * 10) / 10 },
                    tag: 'end',
                  })
                }
              }

              const summaryExport = {
                schemaVersion: 1,
                simVersion: '0.9.3',
                input: {
                  scenario: {
                    preset: scenario?.preset ?? result.scenarioPreset,
                    startingDistance: scenario?.startingDistance ?? 0,
                    openness: scenario?.openness ?? 0.5,
                    kitingAllowed: scenario?.kitingAllowed ?? false,
                  },
                },
                result: {
                  winner: result.winner,
                  durationS: Math.round(result.seconds * 10) / 10,
                  teams: {
                    A: {
                      survivors: result.survivorsA,
                      damage: {
                        total: Math.round(result.totalDmgDoneA * 10) / 10,
                        overkill: Math.round(result.overkillA * 10) / 10,
                      },
                    },
                    B: {
                      survivors: result.survivorsB,
                      damage: {
                        total: Math.round(result.totalDmgDoneB * 10) / 10,
                        overkill: Math.round(result.overkillB * 10) / 10,
                      },
                    },
                  },
                  phases: {
                    approach: {
                      durationS:
                        result.timeToContact != null
                          ? Math.round(result.timeToContact * 100) / 100
                          : 0,
                      contactMade: result.contactMade,
                      volley: {
                        shots: {
                          A: result.preContactAttacksA,
                          B: result.preContactAttacksB,
                        },
                        damage: {
                          A: Math.round(result.preContactDamageA * 10) / 10,
                          B: Math.round(result.preContactDamageB * 10) / 10,
                        },
                      },
                    },
                    sustained: {
                      executed: result.sustainedPhaseExecuted ?? true,
                    },
                  },
                  modifiers: {
                    bonusDamage: result.bonusDamage,
                    activeAuras: result.activeAuras,
                    spearwallUsed: result.spearwallUsed,
                  },
                  timeline: {
                    dtS: 0.1,
                    events,
                  },
                },
              }

              const json = JSON.stringify(summaryExport, null, 2)
              try {
                await navigator.clipboard.writeText(json)
                alert('Summary Export JSON copied!')
              } catch {
                window.prompt('Summary Export JSON:', json)
              }
            }}
            style={{
              alignSelf: 'flex-start',
              fontSize: 12,
              padding: '6px 12px',
            }}
          >
            Export…
          </button>
        </div>

        {/* KPI Strip */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              background: 'rgba(100, 200, 150, 0.1)',
              border: '1px solid rgba(100, 200, 150, 0.3)',
              borderRadius: 6,
            }}
          >
            Contact: {result.contactMade ? '✓' : '✗'}
          </div>

          {result.timeToContact != null && (
            <div
              style={{
                padding: '6px 12px',
                background: 'rgba(100, 150, 200, 0.1)',
                border: '1px solid rgba(100, 150, 200, 0.3)',
                borderRadius: 6,
              }}
            >
              Time to contact: <strong>{result.timeToContact.toFixed(2)}s</strong>
            </div>
          )}

          {(result.preContactDamageA > 0 || result.preContactDamageB > 0) && (
            <div
              style={{
                padding: '6px 12px',
                background: 'rgba(255, 150, 100, 0.1)',
                border: '1px solid rgba(255, 150, 100, 0.3)',
                borderRadius: 6,
              }}
            >
              Opening volley:{' '}
              <strong>{Math.floor(result.preContactDamageA + result.preContactDamageB)} dmg</strong>
            </div>
          )}

          {(result.preContactAttacksA > 0 || result.preContactAttacksB > 0) && (
            <div
              style={{
                padding: '6px 12px',
                background: 'rgba(200, 150, 100, 0.1)',
                border: '1px solid rgba(200, 150, 100, 0.3)',
                borderRadius: 6,
              }}
            >
              Shots: A <strong>{result.preContactAttacksA}</strong> / B{' '}
              <strong>{result.preContactAttacksB}</strong>
            </div>
          )}

          <div
            style={{
              padding: '6px 12px',
              background:
                result.kitingEligible && !result.kitingReason
                  ? 'rgba(100, 200, 100, 0.1)'
                  : 'rgba(150, 150, 150, 0.1)',
              border:
                result.kitingEligible && !result.kitingReason
                  ? '1px solid rgba(100, 200, 100, 0.3)'
                  : '1px solid rgba(150, 150, 150, 0.3)',
              borderRadius: 6,
            }}
          >
            Kiting eligible: {result.kitingEligible && !result.kitingReason ? '✓' : '✗'}
          </div>
        </div>

        {/* Impact line */}
        {result.preContactDamageA > 0 && result.timeline[0]?.hpB && (
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: '#ff9966' }}>
            Impact: Opening volley removed ~
            {((result.preContactDamageA / result.timeline[0].hpB) * 100).toFixed(0)}% of Team B HP
            before contact.
          </div>
        )}

        {/* One-liner explanation */}
        <div style={{ fontSize: 12, opacity: 0.75, fontStyle: 'italic' }}>
          {result.scenarioExplanation}
        </div>

        {/* Advanced details (collapsible) */}
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, opacity: 0.7 }}>
            ▸ Debug details
          </summary>
          <div
            style={{
              fontSize: 12,
              marginTop: 8,
              display: 'grid',
              gap: 4,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            <div>
              Sustained phase: {result.sustainedPhaseExecuted ? 'executed' : 'not executed'}
            </div>
            {!result.contactMade && result.kitingReason && (
              <div>No contact reason: {result.kitingReason}</div>
            )}
          </div>
        </details>
      </div>

      {/* Sustained Combat Outcome divider */}
      <div
        style={{
          margin: '16px 0',
          height: '1px',
          background: 'rgba(148, 163, 184, 0.15)',
        }}
      />
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Sustained Combat Outcome</div>

      <div className="result-summary">
        <div className={`team-result ${teamAWins ? 'winner' : 'loser'}`}>
          <h3>Team A</h3>
          <p className="result-label">{teamAWins ? 'WINNER' : 'DEFEATED'}</p>
          <p className="survivors">
            {teamASurvivors} survivor{teamASurvivors !== 1 ? 's' : ''}
          </p>
          <p className="damage">Total Damage: {result.totalDmgDoneA.toFixed(0)}</p>
          <p className="dps">Avg DPS: {dpsA.toFixed(2)}</p>
          {result.overkillA > 0 && (
            <p className="overkill" style={{ fontSize: '0.9em', opacity: 0.8 }}>
              Overkill: {result.overkillA.toFixed(0)} ({(100 - efficiencyA).toFixed(1)}% wasted)
            </p>
          )}
        </div>

        <div className="vs-divider">VS</div>

        <div className={`team-result ${!teamAWins ? 'winner' : 'loser'}`}>
          <h3>Team B</h3>
          <p className="result-label">{!teamAWins ? 'WINNER' : 'DEFEATED'}</p>
          <p className="survivors">
            {teamBSurvivors} survivor{teamBSurvivors !== 1 ? 's' : ''}
          </p>
          <p className="damage">Total Damage: {result.totalDmgDoneB.toFixed(0)}</p>
          <p className="dps">Avg DPS: {dpsB.toFixed(2)}</p>
          {result.overkillB > 0 && (
            <p className="overkill" style={{ fontSize: '0.9em', opacity: 0.8 }}>
              Overkill: {result.overkillB.toFixed(0)} ({(100 - efficiencyB).toFixed(1)}% wasted)
            </p>
          )}
        </div>
      </div>

      {(result.activeAuras.length > 0 || result.spearwallUsed || result.bonusDamage) && (
        <div
          className="active-modifiers"
          style={{
            margin: '1rem 0',
            padding: '1rem',
            backgroundColor: 'rgba(150, 100, 200, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(150, 100, 200, 0.3)',
          }}
        >
          <h4 style={{ marginTop: 0, color: '#a080d0' }}>🛡️ Active Modifiers</h4>
          <p style={{ fontSize: '0.85em', marginBottom: '1rem', opacity: 0.8 }}>
            Scenario: <strong>{result.scenarioPreset}</strong>
          </p>

          {/* Show Bonus Damage breakdown */}
          {result.bonusDamage && (result.bonusDamage.teamA || result.bonusDamage.teamB) && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                background: 'rgba(255, 150, 100, 0.08)',
                border: '1px solid rgba(255, 150, 100, 0.2)',
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '1em',
                  marginBottom: '0.5rem',
                  color: '#ff9966',
                }}
              >
                ⚔️ Bonus Damage Applied
              </div>
              {['A', 'B'].map((team) => {
                const teamBonuses =
                  team === 'A' ? result.bonusDamage?.teamA : result.bonusDamage?.teamB
                if (!teamBonuses || teamBonuses.length === 0) return null
                const teamColor = team === 'A' ? '#3b82f6' : '#c4b5fd'

                return (
                  <div key={team} style={{ marginTop: '0.5rem' }}>
                    <div
                      style={{
                        fontSize: '0.9em',
                        fontWeight: 600,
                        color: teamColor,
                        marginBottom: '0.25rem',
                      }}
                    >
                      Team {team}:
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        paddingLeft: '1rem',
                      }}
                    >
                      {teamBonuses.map((bonus, idx) => (
                        <div key={idx} style={{ fontSize: '0.85em', opacity: 0.9 }}>
                          <span style={{ fontWeight: 500 }}>{bonus.unitType}</span> dealt{' '}
                          <span style={{ color: '#ff9966', fontWeight: 600 }}>
                            +{Math.floor(bonus.totalBonus)}
                          </span>{' '}
                          bonus damage vs {bonus.targetClass}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Show Spearwall effect if triggered */}
          {result.spearwallUsed && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                background: 'rgba(200, 180, 100, 0.10)',
                border: '1px solid rgba(200, 180, 100, 0.25)',
                borderRadius: 6,
                color: '#bfa700',
                fontWeight: 600,
                fontSize: '1em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5em',
              }}
            >
              <span role="img" aria-label="Spearwall">
                🗡️
              </span>
              <span>
                <strong>Spearwall triggered:</strong> Spearmen stunned enemy cavalry/elephants on
                contact.
              </span>
            </div>
          )}

          {/* Split modifiers/auras by team */}
          {['A', 'B'].map((team) => {
            const teamAuras = result.activeAuras.filter((a) => a.sourceTeam === team)
            if (teamAuras.length === 0) return null
            const teamColor = team === 'A' ? '#3b82f6' : '#c4b5fd'

            return (
              <div key={team} style={{ marginBottom: '1rem' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: teamColor, fontSize: '0.95em' }}>
                  Team {team} Modifiers
                </h5>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '0.75rem',
                  }}
                >
                  {teamAuras.map((aura, idx) => {
                    const isBuff = aura.sourceTeam === aura.targetTeam
                    const effectDirection = aura.estimatedImpact.startsWith('+') ? '+' : '-'

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem',
                          paddingLeft: '1rem',
                          borderLeft: `3px solid ${isBuff ? 'rgba(100, 200, 100, 0.5)' : 'rgba(200, 100, 100, 0.5)'}`,
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: '4px',
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 0.5rem 0',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.75em',
                              padding: '0.2rem 0.4rem',
                              borderRadius: '3px',
                              backgroundColor: isBuff
                                ? 'rgba(100, 200, 100, 0.2)'
                                : 'rgba(200, 100, 100, 0.2)',
                              color: isBuff ? '#90d090' : '#d09090',
                            }}
                          >
                            {isBuff ? '↑ BUFF' : '↓ DEBUFF'}
                          </span>
                          {aura.abilityName}
                        </p>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.85em', opacity: 0.9 }}>
                          <strong>Target:</strong>{' '}
                          {aura.targetClasses.length > 0
                            ? aura.targetClasses.map((c) => `${c} units`).join(', ')
                            : 'All units'}
                        </p>
                        <p
                          style={{
                            margin: '0.25rem 0',
                            fontSize: '0.85em',
                            display: 'flex',
                            gap: '1rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            title="Percentage of units within aura range based on battle scenario (Engaged: 80%, Skirmish: 50%, Open Field: 30%)"
                            style={{
                              cursor: 'help',
                              borderBottom: '1px dotted rgba(255,255,255,0.3)',
                            }}
                          >
                            <strong>Coverage:</strong> {(aura.coverage * 100).toFixed(0)}%
                          </span>
                          <span title="Percentage of fight duration that aura source units remained alive">
                            <strong>Uptime:</strong> {(aura.averageUptime * 100).toFixed(0)}%
                          </span>
                        </p>
                        <p
                          style={{
                            margin: '0.5rem 0 0 0',
                            fontSize: '0.95em',
                            fontWeight: 'bold',
                            color: effectDirection === '+' ? '#90d090' : '#d09090',
                          }}
                        >
                          {aura.estimatedImpact}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {result.timeline.length > 0 && (
        <div className="timeline-container">
          <TimelineGraph result={result} />
        </div>
      )}
    </div>
  )
}
