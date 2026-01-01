import { useEffect } from 'react'

export function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2>About AoE4 Combat Simulator</h2>

        <section className="about-section">
          <h3>What is this app?</h3>
          <p>
            The AoE4 Combat Simulator is an interactive tool for simulating and analyzing combat
            scenarios in <strong>Age of Empires IV</strong>. Build custom armies, configure battle
            conditions, and visualize the outcome of engagements between different units and
            civilizations. Designed for players, theorycrafters, and modders who want to understand
            AoE4 combat mechanics in detail.
          </p>
        </section>

        <section className="about-section">
          <h3>Features</h3>
          <ul>
            <li>
              Custom army builder: select units, set counts, ages, and upgrades for both teams
            </li>
            <li>Civilization & age selection</li>
            <li>Scenario presets: Engaged, Skirmish, Open Field, or custom tactical setups</li>
            <li>
              Advanced simulation engine: models ranged/melee combat, opening volleys, auras,
              kiting, and more
            </li>
            <li>Detailed results: HP pool graphs, survivor counts, and combat phase breakdowns</li>
            <li>Export/import: share scenarios via URL or JSON</li>
            <li>Guided tour and tooltips for new users</li>
          </ul>
        </section>

        <section className="about-section">
          <h3>Limitations</h3>
          <ul>
            <li>No real-time micro: assumes basic AI behavior, not pro-level micro</li>
            <li>No terrain/obstacles: all battles are on flat, open ground</li>
            <li>No economy/production: focuses purely on combat</li>
            <li>Snapshot data: uses a specific game patch version</li>
            <li>Some abilities/techs simplified or not fully modeled</li>
            <li>
              Tick-based resolution: HP changes and events are processed at discrete intervals,
              which may cause minor visual offsets in graphs
            </li>
          </ul>
        </section>

        <section className="about-section">
          <h3>How to use</h3>
          <ol>
            <li>
              <strong>Build your armies:</strong> Select civ, age, and add units for both teams.
              Adjust unit counts and apply upgrades/techs as desired.
            </li>
            <li>
              <strong>Configure scenario:</strong> Choose a preset or customize starting distance,
              openness, and kiting.
            </li>
            <li>
              <strong>Run simulation:</strong> Click "Run Simulation" to see results. The HP Pool
              graph shows how each team's health changes over time.
            </li>
            <li>
              <strong>Analyze results:</strong> Review survivors, damage breakdown, and key combat
              events (opening volley, contact, etc.).
            </li>
            <li>
              <strong>Export/import:</strong> Use the menu or buttons to copy a shareable link or
              export/import JSON for scenarios.
            </li>
            <li>
              <strong>Tour & help:</strong> Click "Tour" for a guided walkthrough of the interface.
            </li>
          </ol>
        </section>

        <section className="about-section">
          <h3>Tips and tricks</h3>
          <ul>
            <li>
              Compare upgrades: toggle upgrades or techs to see their real impact on combat outcomes
            </li>
            <li>
              Test kiting: enable kiting in open scenarios to see how ranged units perform with
              hit-and-run tactics
            </li>
            <li>
              Use custom scenarios: adjust starting distance and openness to model different
              tactical situations
            </li>
            <li>
              Share with friends: export your scenario as a link or JSON and challenge others to
              optimize their army
            </li>
            <li>
              Check patch version: the data version is shown in the header; ensure it matches your
              in-game patch for best accuracy
            </li>
          </ul>
        </section>

        <section className="about-section">
          <h3>Disclaimer</h3>
          <p className="disclaimer">
            This tool is <strong>unofficial</strong> and not affiliated with Microsoft, World's
            Edge, or Relic Entertainment. All game data is property of their respective owners.
          </p>
        </section>

        <div className="modal-actions">
          <button onClick={onClose} className="btn-primary">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
