// Server-only: open the operator's browser at `url`. The dashboard runs on the
// operator's own machine, so the auth routes (Grok device-auth, MCP OAuth) can
// drive it directly.
import { execFile } from 'child_process'

// Fire-and-forget; a failure to auto-open isn't fatal — every caller also
// surfaces the URL to the operator.
export function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'cmd'
    : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  execFile(cmd, args, () => {})
}
