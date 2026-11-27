// The tab title: exactly '<project> > <Orca tab>' from the owner's orca-title helper when it exists, else the repo
// folder name. Only an optional ' · <short name>' may follow it (titleOk). DV_TITLE_CMD names another helper. Runs once, in the folder the command was started from.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const run = (cmd, args, cwd) => { try { return execFileSync(cmd, args, { cwd, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

export function tabTitle() {
  const helper = process.env.DV_TITLE_CMD || path.join(os.homedir(), '.agents/bin/orca-title');
  // Orca finds the tab by its worktree, so ask from that folder, not from the site's folder
  const wt = (process.env.ORCA_WORKTREE_ID || '').split('::')[1], cwd = wt && existsSync(wt) ? wt : undefined;
  const t = existsSync(helper) ? run(helper, [], cwd) : '';
  if (t) return t.split('\n')[0];
  const top = run('git', ['rev-parse', '--show-toplevel']);
  return path.basename(top || process.cwd());
}


// Several pages from one chat may add ' · <short name>' after the tab title, such as 'proj > tab · A1'.
// Any other change is wrong: a short name has no '·', '<' or '>', no outer spaces, and at most 40 characters.
export const titleOk = (t, want) => t === want || (t.startsWith(want + ' · ') && /^[^\s·<>](?:[^·<>]{0,38}[^\s·<>])?$/.test(t.slice(want.length + 3)));
// The text of a page's own <title>, with &gt; &lt; &amp; decoded.
export const pageTitle = (html) => ((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').trim()
  .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
