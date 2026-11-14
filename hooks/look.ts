import type { ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

export { NEON_RAIN_ALT, NEON_RAIN_SCENE } from './scene'

// Palette: deep navy surfaces, pink accent. Dark only (the scene is a night city).
const { theme, problems } = makeColors({
  label: 'Neon Rain',
  only: 'dark',
  roles: { accent: '#ff5fa2', danger: '#ff4d5e', success: '#4fe3b0', warning: '#f3c56b', pro: '#a98bff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0c1020',
        'surface-1': '#121830',
        'surface-2': '#192040',
        'surface-3': '#192040', // in dark mode surface-3 can't be lighter than text-muted tolerates
        'text-primary': '#e3e8f6',
        'text-secondary': '#bcc6e0',
        'text-muted': '#929dc4',
      },
    },
  },
})

/** Lines that would make Desktop ignore the whole theme (empty = fine). */
export const paintProblems = (): string[] => problems.filter(l => l.startsWith("Desktop won't paint"))

export const neonRain: ThemeSetArgs = {
  colors: theme,
  overrideColorScheme: 'dark',
  // A veil over the conversation column so text stays readable on top of the animation.
  backdrop: { scene: 'neon-rain', glass: { blur: 0, tint: '#0c1020', opacity: 0.8 } },
}
