import { useState, useMemo, useEffect } from 'react'
import './styles.css'
import type { UiScenarioState, UiTeamState } from './uiStateTypes'
import { makeEmptyScenarioState } from './uiStateTypes'
import { buildSimInputsFromUi } from '../data/resolve/buildSimInputFromUi'
import { runSim } from '../engine/sim'
import type { SimResult } from '../engine/types'
import { TeamPanel } from './TeamPanel'
import { ResultsPanel } from './ResultsPanel'
import { ScenarioPanel } from './ScenarioPanel'
import { AboutModal } from './AboutModal'
import { Tour } from './Tour'
import { importScenarioState, exportScenarioToUrl, importScenarioFromUrl } from './exportImport'
import { createExportSummary } from './createExportSummary'

export default function App() {
  const [uiState, setUiState] = useState<UiScenarioState>(() => {
    // Try to load scenario from URL parameter first
    const urlState = importScenarioFromUrl()
    return urlState ?? makeEmptyScenarioState()
  })
  const [result, setResult] = useState<SimResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showTeamsPanel, setShowTeamsPanel] = useState(true)
  const [requestTour, setRequestTour] = useState(false)

  // Sim options
  const [seed, setSeed] = useState(42)
  const [maxSeconds, setMaxSeconds] = useState(120)
  const [tickInterval, setTickInterval] = useState(0.1)

  const canRun = useMemo(() => {
    const teamA = uiState.teams.A
    const teamB = uiState.teams.B
    return teamA.units.length > 0 && teamB.units.length > 0
  }, [uiState])

  async function handleRun() {
    if (!canRun) return

    setIsRunning(true)
    setError(null)
    setResult(null)
    setShowTeamsPanel(false)

    try {
      // Build engine inputs using new combat mods resolution system
      const { teamA, teamB } = buildSimInputsFromUi(uiState)

      // Run the simulation
      // Build scenario params from UI controls
      const preset = uiState.scenarioPreset ?? 'Engaged'
      const startingDistance = uiState.startingDistance ?? 5
      const openness = uiState.openness ?? 0.2
      const kitingEnabled = uiState.kitingAllowed ?? false
      // Map openness to aura coverage (clumped 0.8 → open 0.3)
      const auraCoverage = Math.max(0, Math.min(1, 0.8 - 0.5 * openness))

      const simResult = runSim(teamA, teamB, {
        seed,
        maxSeconds,
        tickInterval,
        scenarioParams: {
          preset,
          startingDistance,
          opennessFactor: openness,
          kitingEnabled,
          auraCoverage,
        },
      })

      setResult(simResult)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      console.error('Simulation error:', e)
      setError(message)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <svg
            className="logo-icon"
            viewBox="0 0 200 220"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 10L30 50V150L100 210L170 150V50L100 10Z"
              fill="#1e2a3d"
              stroke="#d4af37"
              strokeWidth="6"
            />
            <path
              d="M100 10L30 50V150L100 210L170 150V50L100 10Z"
              fill="url(#shield-gradient)"
              fillOpacity="0.3"
            />
            <path
              d="M70 80L75 130L80 135L85 140H115L120 135L125 130L130 80L100 60L70 80Z"
              fill="#e8e8e8"
              stroke="#808080"
              strokeWidth="2"
            />
            <path d="M85 85L90 125L95 130H105L110 125L115 85L100 70L85 85Z" fill="#c0c0c0" />
            <path
              d="M60 90L100 50L140 90"
              stroke="#d4af37"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="75" cy="120" r="3" fill="#4a90e2" />
            <circle cx="85" cy="125" r="3" fill="#4a90e2" />
            <circle cx="95" cy="128" r="3" fill="#4a90e2" />
            <defs>
              <linearGradient id="shield-gradient" x1="100" y1="10" x2="100" y2="210">
                <stop offset="0%" stopColor="#2a3f5f" />
                <stop offset="100%" stopColor="#0f1520" />
              </linearGradient>
            </defs>
          </svg>
          <h1>AoE4 Combat Simulator</h1>
        </div>
        <div className="export-import">
          <button onClick={() => setShowAbout(true)}>About</button>
          <button onClick={() => setRequestTour(true)}>🎯 Tour</button>
          <button
            onClick={async () => {
              try {
                const url = exportScenarioToUrl(uiState)
                await navigator.clipboard.writeText(url)
                alert('Link copied to clipboard!')
              } catch {
                const url = exportScenarioToUrl(uiState)
                window.prompt('Copy this link:', url)
              }
            }}
          >
            📋 Copy Link
          </button>
          <button
            onClick={async () => {
              const summary = createExportSummary(uiState, result)
              const json = JSON.stringify(summary, null, 2)
              try {
                await navigator.clipboard.writeText(json)
                alert('Simulation summary copied to clipboard')
              } catch {
                // Fallback: show prompt with JSON
                window.prompt('Copy summary:', json)
              }
            }}
          >
            Export Summary
          </button>
          <button
            onClick={() => {
              const input = window.prompt('Paste scenario JSON:')
              if (!input) return
              try {
                const next = importScenarioState(input)
                setUiState(next)
                alert('Scenario imported')
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e)
                alert('Import failed: ' + msg)
              }
            }}
          >
            Import
          </button>
          <select
            className="export-import-menu"
            defaultValue=""
            title="Export/Import Menu"
            onChange={async (e) => {
              const action = e.target.value
              if (action === 'about') {
                setShowAbout(true)
              } else if (action === 'copy-link') {
                try {
                  const url = exportScenarioToUrl(uiState)
                  await navigator.clipboard.writeText(url)
                  alert('Link copied to clipboard!')
                } catch {
                  const url = exportScenarioToUrl(uiState)
                  window.prompt('Copy this link:', url)
                }
              } else if (action === 'export') {
                const summary = createExportSummary(uiState, result)
                const json = JSON.stringify(summary, null, 2)
                try {
                  await navigator.clipboard.writeText(json)
                  alert('Simulation summary copied to clipboard')
                } catch {
                  window.prompt('Copy summary:', json)
                }
              } else if (action === 'import') {
                const input = window.prompt('Paste scenario JSON:')
                if (!input) return
                try {
                  const next = importScenarioState(input)
                  setUiState(next)
                  alert('Scenario imported')
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e)
                  alert('Import failed: ' + msg)
                }
              } else if (action === 'tour') {
                setRequestTour(true)
              }
              e.target.value = ''
            }}
          >
            <option value="">Menu</option>
            <option value="about">About</option>
            <option value="tour">Tour</option>
            <option value="copy-link">Copy Link</option>
            <option value="export">Export JSON</option>
            <option value="import">Import</option>
          </select>
        </div>
      </header>

      <main className="app-main">
        {showTeamsPanel && (
          <section className="teams-section fade-in">
            <div className="team-container">
              <h2>Team A</h2>
              <TeamPanel
                teamState={uiState.teams.A}
                onTeamChange={(newTeam: UiTeamState) => {
                  setUiState((prev) => ({
                    ...prev,
                    teams: { ...prev.teams, A: newTeam },
                  }))
                }}
              />
            </div>

            <div className="team-container">
              <h2>Team B</h2>
              <TeamPanel
                teamState={uiState.teams.B}
                onTeamChange={(newTeam: UiTeamState) => {
                  setUiState((prev) => ({
                    ...prev,
                    teams: { ...prev.teams, B: newTeam },
                  }))
                }}
              />
            </div>
          </section>
        )}

        <section className="simulation-section" data-tour="sim-controls">
          <ScenarioPanel
            scenario={{
              preset: uiState.scenarioPreset ?? 'Engaged',
              startingDistance: uiState.startingDistance ?? 5,
              openness: uiState.openness ?? 0.2,
              kitingAllowed: uiState.kitingAllowed ?? false,
            }}
            teamAUnits={uiState.teams.A.units}
            teamBUnits={uiState.teams.B.units}
            onChange={(next) => {
              setUiState((prev) => ({
                ...prev,
                scenarioPreset: next.preset,
                startingDistance: next.startingDistance,
                openness: next.openness,
                kitingAllowed: next.kitingAllowed,
              }))
            }}
          />
          {!showTeamsPanel && result && (
            <div className="edit-team-details-container">
              <button className="settings-button" onClick={() => setShowTeamsPanel(true)}>
                ✏️ Edit Team Details
              </button>
            </div>
          )}

          <div className="simulation-controls">
            <button
              className="settings-button"
              onClick={() => setShowSettings(!showSettings)}
              disabled={isRunning}
            >
              ⚙️ Simulation Settings
            </button>
            <button className="run-button" onClick={handleRun} disabled={!canRun || isRunning}>
              {isRunning ? 'Running...' : '▶ Run Simulation'}
            </button>
          </div>

          {showSettings && (
            <div className="sim-options">
              <label>
                Seed:
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value))}
                  disabled={isRunning}
                />
              </label>
              <label>
                Max Seconds:
                <input
                  type="number"
                  value={maxSeconds}
                  onChange={(e) => setMaxSeconds(Number(e.target.value))}
                  disabled={isRunning}
                  step="10"
                />
              </label>
              <label>
                Tick Interval:
                <input
                  type="number"
                  value={tickInterval}
                  onChange={(e) => setTickInterval(Number(e.target.value))}
                  disabled={isRunning}
                  step="0.05"
                />
              </label>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </section>

        {result && (
          <section className="results-section fade-in" data-tour="results">
            <h2>Results</h2>
            <ResultsPanel result={result} />
          </section>
        )}
      </main>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      <Tour requestRun={requestTour} onRequestRunHandled={() => setRequestTour(false)} />
    </div>
  )
}
