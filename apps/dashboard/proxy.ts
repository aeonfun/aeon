import { NextRequest, NextResponse } from "next/server";
import { gateRequest } from "@/lib/security/api-gate";

/**
 * Gate every `/api/*` request behind a loopback Host-header allowlist
 * + same-origin check on state-changing methods. See
 * `apps/dashboard/lib/security/api-gate.ts` for the threat-model rationale.
 *
 * The dashboard's `/api/*` routes (skills/[name]/run, secrets,
 * auth) write GitHub secrets and trigger GitHub Actions on the
 * operator's behalf — they assume "the OS user owns localhost", so
 * any path that delivers a forged request to the loopback socket
 * (DNS rebinding, browser cross-origin POST) is an
 * unauthenticated-write surface without this gate.
 *
 * Operators can extend the allowlist via
 * `AEON_DASHBOARD_ALLOWED_HOSTS=host1,host2,…` or bypass the gate
 * entirely via `AEON_DASHBOARD_ALLOW_ANY_HOST=1` (intended only for
 * trusted-reverse-proxy setups).
 */
export function proxy(req: NextRequest) {
  const rejected = gateRequest(req);
  if (rejected) return rejected;
  return NextResponse.next();
}

export const config = {
  // Run on every `/api/*` route. The static page tree, RSC payloads,
  // and `outputs/` static assets are not the attack surface — they
  // don't have side effects worth gating, and refusing the document
  // would just produce a confusing UX during a rebinding probe.
  matcher: ["/api/:path*"],
};
