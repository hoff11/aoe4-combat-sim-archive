# AoE4 Combat Simulator (Archive)

**Status:** Frozen / Archived  
**Purpose:** Technical showcase and reference — no active development.

🔗 **Live Demo:** https://aoe4-combat-sim.vercel.app/

---

## Overview

This repository hosts a deterministic combat simulation originally built to explore combat math in *Age of Empires IV*. It was developed as an engineering and learning exercise focused on simulation design, data resolution, and system architecture.

This version is preserved as a **reference and educational showcase**. Active development has concluded.

---

## What This Project Demonstrates

- Layered architecture separating data resolution, simulation engine, and UI
- Deterministic combat outcomes for identical inputs
- Game-data–driven modeling and stat resolution
- End-to-end ownership: data → engine → UI
- TypeScript + React + Vite implementation

---

## What This Is *Not*

- A full in-game emulator
- A balance authority or prediction engine
- A maintained or supported product
- A model of player micro, terrain, formations, or tactics

Many real-game factors are **explicitly out of scope** by design.

---

## Running the Project (Optional)

The recommended way to explore this project is via the hosted demo linked above.

Local execution is optional and provided for reference only:

```bash
git clone https://github.com/hoff11/aoe4-combat-sim-archive.git
cd aoe4-combat-sim-archive
npm install
npm run dev
```

## Project Status

Phase 1 goals completed

- Engine and UI frozen
- No new features planned
- Pull requests not accepted
- Issues not monitored

This repository exists as a snapshot of completed work, not an active development effort.

## License

This project is source-available.

You may view and clone the repository for personal, non-commercial, educational use.
Redistribution, modification for publication, or commercial use is not permitted.

See the LICENSE file for details.

## Disclaimer

This project is unofficial and not affiliated with Microsoft, World’s Edge, or Relic Entertainment.
All referenced game data is derived from publicly available sources.

## Closing Note

Building this project significantly deepened my appreciation for the complexity involved in large-scale game systems and deterministic simulation design.

The work here directly informed a pivot toward kinematics, robotics, and motion visualization, where similar techniques can be applied to real-world engineering and educational problems.

This repository is preserved as a record of that journey.