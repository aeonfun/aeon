*HN Digest — 2026-05-07*

_AI tooling dominates: agent infra, Anthropic compute deal, Chrome shipping a 4GB on-device model. DNSSEC outage and Valve CAD release round it out._

1. **[AI & agents]** [Chrome silently installs a 4GB AI model without consent](https://www.thatprivacyguy.com/blog/chrome-silent-nano-install/) — 1668 pts · 1101 comments
   Why it matters: Chrome ships Gemini Nano weights with no opt-in — a consent precedent every browser-shipped local model will inherit.
   HN take: "Tech companies just don't understand consent... a flag to disable LLMs exists but is buried and non-obvious." — _jacquesm_
   [Discussion](https://news.ycombinator.com/item?id=48019219)

2. **[AI & agents]** [Higher Claude limits and a SpaceX compute deal](https://www.anthropic.com/news/higher-limits-spacex) — 451 pts · 407 comments
   Why it matters: Anthropic raises rate limits and signals interest in orbital compute; question is whether launch cost ever clears the gap vs terrestrial DCs.
   HN take: "A rack plus solar in the $15m+ range just to launch... the ~$7B Colossus 1 would be ~$50B on Falcon 9, ignoring cooling and batteries." — _runako_
   [Discussion](https://news.ycombinator.com/item?id=48037986)

3. **[AI & agents]** [Agents can create Cloudflare accounts, buy domains, deploy](https://blog.cloudflare.com/agents-stripe-projects/) — 634 pts · 356 comments
   Why it matters: Cloudflare + Stripe wire end-to-end agent account creation and domain purchase, lowering the floor for auto-deploys and for abuse.
   HN take: "Domain registration has been API driven for decades. DropCatch owns 1,000+ registrars for direct routes to Verisign's .com registry." — _fontain_
   [Discussion](https://news.ycombinator.com/item?id=48031684)

4. **[Infra & devtools]** [Vibe coding and agentic engineering are getting closer than I'd like](https://simonwillison.net/2026/May/6/vibe-coding-and-agentic-engineering/) — 561 pts · 596 comments
   Why it matters: Willison argues the line between throwaway vibe coding and production agentic engineering is collapsing.
   HN take: "My company spends 40% less time on feature dev since AI agents went en masse and pushes 50% more tickets without noticeable regressions." — _Daishiman_
   [Discussion](https://news.ycombinator.com/item?id=48037128)

5. **[Infra & devtools]** [DNSSEC disruption affecting .de domains](https://status.denic.de/pages/incident/592577eab611ce1e0d00046f/69fa60ef9d12f5057a974f38) — 737 pts · 404 comments
   Why it matters: A DENIC signature failure broke validating resolvers across the .de TLD — DNSSEC failures cascade silently for strict resolvers.
   HN take: "unbound-host -t A www.denic.de works; -D mode: validation failure, signature crypto failed from 194.246.96.1" — _fweimer_
   [Discussion](https://news.ycombinator.com/item?id=48027897)

6. **[Security & policy]** [Google Cloud fraud defense, the next evolution of reCAPTCHA](https://cloud.google.com/blog/products/identity-security/introducing-google-cloud-fraud-defense-the-next-evolution-of-recaptcha/) — 285 pts · 273 comments
   Why it matters: Google rebrands reCAPTCHA as broader fraud defense as LLMs erode classic bot-detection.
   HN take: "Web CAPTCHAs are too easy to reverse engineer with Claude now. Multiple people broke botguard within the last year." — _pixelmelt_
   [Discussion](https://news.ycombinator.com/item?id=48039362)

7. **[Science & culture]** [Valve releases Steam Controller CAD files under CC](https://www.digitalfoundry.net/news/2026/05/valve-releases-steam-controller-cad-files-under-creative-commons-license) — 1330 pts · 405 comments
   Why it matters: Valve open-sources external Steam Controller CAD, enabling third-party shells and accessories but not functional clones.
   HN take: "It doesn't include any internal topology. This is CAD for the external shell of the Steam Controller and Puck." — _kube-system_
   [Discussion](https://news.ycombinator.com/item?id=48037555)
