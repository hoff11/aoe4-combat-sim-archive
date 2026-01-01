// src/ui/Tour.tsx
import { useMemo, useState } from 'react'
import Joyride, { STATUS, type CallBackProps, type Step } from 'react-joyride'

const STORAGE_KEY = 'aoe4sim_tour_done_v2'

export function Tour({
  requestRun,
  onRequestRunHandled,
}: {
  requestRun: boolean
  onRequestRunHandled: () => void
}) {
  const [nonce, setNonce] = useState(0)

  const steps = useMemo<Step[]>(
    () => [
      {
        target: '[data-tour="civage-selector"]',
        content:
          'Select your civilization and age. Age determines which units and upgrades are available.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="blacksmith"]',
        content: 'Blacksmith upgrades boost melee/ranged damage and armor for your units.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="university"]',
        content: 'University upgrades provide special bonuses and strategic advantages.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="unit-add"]',
        content:
          'Add units to your army. Select a unit, set the count, and click "Add Unit". You can add the same unit multiple times.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="team-summary"]',
        content:
          'This shows the total resource cost and population of your army. Use it to balance team compositions.',
        placement: 'top',
      },
      {
        target: '[data-tour="unit-list"]',
        content:
          'Your roster of units. Each row shows HP, DPS, armor stats and available unit upgrades.',
        placement: 'top',
      },
      {
        target: '[data-tour="sim-controls"]',
        content:
          'Run the simulation when both teams have units. Adjust settings for seed, duration, and tick rate if needed.',
        placement: 'top',
      },
      {
        target: '[data-tour="results"]',
        content: 'After simulation completes, the battle graph and detailed results appear here.',
        placement: 'top',
      },
    ],
    [],
  )

  const run = (() => {
    void nonce
    const done = localStorage.getItem(STORAGE_KEY) === '1'
    return requestRun || !done
  })()

  function handleCallback(data: CallBackProps) {
    const status = data.status
    const finished = status === STATUS.FINISHED || status === STATUS.SKIPPED
    if (!finished) return

    localStorage.setItem(STORAGE_KEY, '1')

    if (requestRun) onRequestRunHandled()

    setNonce((n) => n + 1)
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      callback={handleCallback}
      continuous
      scrollToFirstStep
      showSkipButton
      showProgress
      disableOverlayClose
      styles={{ options: { zIndex: 10000 } }}
    />
  )
}
