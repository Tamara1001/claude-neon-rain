# Neon Rain for Claude Desktop

A dark neon theme for Claude Desktop, built as a mod with Claude's own theme system (`$.theme.set`, `makeColors` and a
`Backdrop` scene). Behind the conversation it draws a night city made of 14 px ASCII cells, with rain, flickering
neon signs, people with umbrellas and the odd lightning strike.

![Neon Rain](docs/neon-rain.png)

*Un tema oscuro de neón para Claude Desktop, hecho con el sistema de temas de Claude. Detrás de la conversación dibuja
una ciudad nocturna en celdas ASCII, con lluvia, carteles de neón, gente con paraguas y relámpagos.*

## Install

Requires Claude Code / Desktop with mods (v2.1.323 or later).

```bash
claude plugin marketplace add Tamara1001/claude-neon-rain
claude plugin install neon-rain@claude-neon-rain
```

Restart Claude Desktop. The theme is applied every time a session starts.

- `/neon-rain` turns the theme on, `/neon-rain-off` takes it off.
- The animation follows Desktop's own rules: with reduced motion on, or software compositing, the scene stays still.
- Mods run per session, so a brand-new chat (the "New" tab, before it has a session) shows the default look until you start it.

## How it works

- `hooks/look.ts` builds the colors with `makeColors` (dark only) and the `backdrop` (`scene: 'neon-rain'` plus a
  `glass` veil so text stays readable).
- `hooks/register.tsx` sets the theme at `session.start` and draws the scene at the `Backdrop` render site.
- `hooks/scene.ts` is **generated** by `node tools/gen-scene.mjs` (an SVG of about 110k characters, under Desktop's
  131,072 limit). Edit the generator, not the output.

Claude Desktop only animates this kind of scene if its CSS has no `round()`/`tan()`/`pow()` math and no `@media`
rules, so the city is generated for a fixed 1400x1050 box and the SVG has a `viewBox` with
`preserveAspectRatio="xMidYMax slice"`: it fills any window, cropped at the sides and top, anchored at the street.

## Credits and license

The scene is a port of the `neon-rain` scene from [0toshigami/claude-desktop-themes](https://github.com/0toshigami/claude-desktop-themes)
(MIT). See [NOTICE.md](NOTICE.md). This repository is MIT licensed; see [LICENSE](LICENSE).
Not affiliated with or endorsed by Anthropic.
