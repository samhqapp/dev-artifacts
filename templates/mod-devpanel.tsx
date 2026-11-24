// devpanel: a terminal options picker for a Claude Code mod pane.
// Give it option groups; it keeps a pick and a comment per group in one atom,
// draws a dock row (back/next, segmented options, comment, Copy choices) and
// builds the Copy choices text as a Markdown list. Nothing here knows the mod.
//
// A hooks module may not pass `$` to a helper, so the pane hook hands in an
// `io` of closures it spells itself:
//   const design = atom({ plugin: 'my-mod', key: 'design' } as const, devInitial, { shape: 'design-1' })
//   const io: DevIo = {
//     get: () => read($, design), set: f => update($, design, f),
//     copy: (text, surface) => $.ui.copy({ text, surface }),
//     save: text => $.fs.write(path, text),          // optional fallback file
//   }
//   ...{dev.dock($.ui.resolve(e), io, await read($, design), tab)}
import type { Elements, RenderSurface } from 'claude-code'

export type DevOption = { name: string; note?: string }
export type DevGroup = {
  id: string
  name: string
  note?: string
  /** Empty: a comment-only group. */
  options: DevOption[]
  /** The comment is kept per tab of the pane (the tab is passed to `dock`). */
  perTab?: boolean
}
/** Declare the atom's key as `Shaped<DevState>` in the mod's PluginState. */
export type DevState = { at: number; picks: Record<string, number>; comments: Record<string, string> }
export const devInitial: DevState = { at: 0, picks: {}, comments: {} }
export type DevIo = {
  get(): Promise<DevState>
  set(f: (s: DevState) => DevState): Promise<DevState>
  copy(text: string, surface: RenderSurface): Promise<unknown>
  save?(text: string): Promise<unknown>
}
type Els = Pick<Elements[RenderSurface], 'Box' | 'Text' | 'Button' | 'Input'>

export function devPanel(cfg: { groups: DevGroup[]; heading: string }) {
  const { groups, heading } = cfg
  const commentKey = (g: DevGroup, tab?: string) => (g.perTab && tab ? `${g.id}:${tab}` : g.id)
  const pick = (s: DevState, id: string) => s.picks[id] ?? 0

  /** Copy choices: the heading, then `- Group: N Option - comment` per group. */
  function text(s: DevState): string {
    const lines = groups.map(g => {
      // Per-tab comments are named by their tab, like the web overlay's view tabs.
      const note = Object.entries(s.comments)
        .filter(([k, v]) => v.trim() && (k === g.id || k.startsWith(`${g.id}:`)))
        .map(([k, v]) => (k === g.id ? v.trim() : `${k.slice(g.id.length + 1)}: ${v.trim()}`))
        .join(' - ')
      if (g.options.length === 0) return `- ${g.name}${note ? `: ${note}` : ''}`
      const i = pick(s, g.id)
      return `- ${g.name}: ${i + 1} ${g.options[i]?.name ?? '?'}${note ? ` - ${note}` : ''}`
    })
    return [heading, ...lines].join('\n')
  }

  async function change(io: DevIo, fn: (s: DevState) => DevState) {
    const s = await io.set(fn)
    // The file is only a fallback copy; a failed write must not lose a pick.
    await io.save?.(text(s) + '\n').catch(() => undefined)
  }

  /** The dock: drawn at the bottom of the pane. Keys: p/n group, digits pick, y copy. */
  function dock(els: Els, io: DevIo, s: DevState, tab?: string) {
    const { Box, Text, Button, Input } = els as Elements['terminal']
    const at = Math.min(s.at, groups.length - 1)
    const g = groups[at]!
    const picked = pick(s, g.id)
    const key = commentKey(g, tab)
    const go = (d: number) => change(io, v => ({ ...v, at: (at + d + groups.length) % groups.length }))
    const note = (v: string) => change(io, x => ({ ...x, comments: { ...x.comments, [key]: v } }))
    return (
      <Box flexDirection="column" borderStyle="single" borderDimColor paddingX={1}>
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Button key="dev-back" plain hotkey="p" onPress={() => go(-1)}>◀</Button>
          <Text dimColor>{at + 1}/{groups.length}</Text>
          <Button key="dev-next" plain hotkey="n" onPress={() => go(1)}>▶</Button>
          <Text bold>{g.name}:</Text>
          {g.options.map((o, i) => (
            <Button
              key={`dev-opt-${i}`}
              hotkey={String(i + 1)}
              variant={i === picked ? 'primary' : 'secondary'}
              onPress={() => change(io, v => ({ ...v, picks: { ...v.picks, [g.id]: i } }))}
            >
              {`${i + 1} ${o.name}`}
            </Button>
          ))}
          {g.options.length === 0 && <Text dimColor>comment only</Text>}
        </Box>
        <Text dimColor>{g.options[picked]?.note ?? g.note ?? ''}</Text>
        <Box flexDirection="row" columnGap={1}>
          <Box flexGrow={1}>
            <Input
              key="dev-comment"
              label="Comment"
              placeholder={g.perTab && tab ? `about the ${tab} tab` : 'what should change'}
              value={s.comments[key] ?? ''}
              submitLabel="save"
              onInput={v => void note(v)}
              onSubmit={v => void note(v)}
            />
          </Box>
          <Button key="dev-copy" hotkey="y" variant="primary" onPress={async p => io.copy(text(await io.get()), p.surface)}>
            Copy choices
          </Button>
        </Box>
        {/* Arrow keys belong to Claude Code (← opens its sessions list), so name the keys that work. */}
        <Text dimColor>Keys: n p group · 1 2 3 pick · Tab comment, Enter save · y copy. No arrows: ← opens Claude's session list (Esc returns). Keys not working? Click the pane.</Text>
      </Box>
    )
  }

  return { text, pick, dock }
}
