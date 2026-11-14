import type { Register } from 'claude-code'

import { neonRain, NEON_RAIN_ALT, NEON_RAIN_SCENE, paintProblems } from './look'

export const register: Register = on => {
  // Draws the animated city when the theme asks for the `neon-rain` scene.
  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    if (e.props.scene !== 'neon-rain') return next(e)
    const { Svg } = $.ui.resolve(e)
    return <Svg source={NEON_RAIN_SCENE} alt={NEON_RAIN_ALT} isInteractive />
  })

  // Mods run per session, so the theme is set each time a session starts.
  on('session.start', async ($, e, next) => {
    const bad = paintProblems()
    if (bad.length > 0) $.ui.toast(bad[0]!)
    await $.theme.set(neonRain)
    await $.command.register({ name: 'neon-rain', description: 'Turn the Neon Rain theme on' })
    await $.command.register({ name: 'neon-rain-off', description: 'Take the Neon Rain theme off' })
    return next(e)
  })

  on('command.run', { command: 'neon-rain' }, async $ => {
    await $.theme.set(neonRain)
    return { text: 'Neon Rain on.' }
  })

  on('command.run', { command: 'neon-rain-off' }, async $ => {
    await $.theme.clear()
    return { text: 'Neon Rain off.' }
  })
}
