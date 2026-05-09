# Skill Routing Tips

Claude Code skill auto-invocation is **probabilistic, not deterministic**. Skills
publish trigger phrases in their descriptions, and Claude decides whether to
route based on reading the request. If phrasing drifts from the published
triggers, the skill may not fire.

## Force skill routing by naming the skill explicitly

Instead of: "polish this hero copy" or "tighten this line"
Prefer:    "use /design:ux-copy to rewrite the hero" or "run /marketing:brand-review on this"

This applies to any skill where you want deterministic invocation — don't
describe the task, name the skill.

## Copy / editing skills worth knowing

- `design:ux-copy` — headlines, subheads, CTAs, microcopy. Trigger: "write copy for"
- `marketing:brand-review` — review content against brand voice, flag deviations
- `marketing:draft-content` — full landing pages, blog posts, email (heavier)
- `compound-engineering:every-style-editor` — Every-style prose rules
- User styles (no em-dash, Pyramid Principle, peer voice) already apply globally

## Landing-page copy workflow

1. Describe the positioning change at a high level
2. Explicitly request `/design:ux-copy` for hero/section headings/CTAs in one pass
3. Run `/marketing:brand-review` after to catch tone drift
4. Skip `/marketing:draft-content` unless generating entirely new sections
