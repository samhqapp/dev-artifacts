// The tab title: exactly '<project> > <Orca tab>' from the owner's orca-title helper when it exists, else the repo
// folder name. Nothing is ever added after it. DV_TITLE_CMD names another helper. Runs once, in the folder the command was started from.
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

