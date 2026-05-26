# Session 08 — Multi-Modal Outputs

> **Goal:** Add voice notes (TTS), screenshot reading, and video generation as first-class skill output modalities. Replicate is already wired for image gen.
>
> **Effort:** ~2 weeks.
> **Risk:** Low.
> **Author gate:** No.
> **Reference:** [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) Option #8.

---

## The prompt to paste

```
You are adding multi-modal outputs to the Aeon framework. Read these dossier
docs first:
  - docs/contributor-dossier/03-subsystems/runtime.md
  - docs/contributor-dossier/03-subsystems/notifications.md
  - scripts/postprocess-replicate.sh (existing image-gen integration)

Your task: extend the runtime so a skill can declare multi-modal outputs
that get post-processed into voice/video/screenshot reads:

  - Voice: skill writes .pending-voice/${id}.json with { text, voice_id,
    notify_channel }. Postprocess script calls ElevenLabs (or OpenAI TTS),
    saves MP3 to articles/voice/, sends as voice note via Telegram/Discord.
  - Video: skill writes .pending-video/${id}.json with prompt + duration.
    Postprocess via Replicate (Sora/Kling/Runway adapters), saves MP4.
  - Screenshot read: skill calls a new WebFetch-equivalent that fetches a
    URL via headless browser and returns the rendered screenshot for Claude
    to vision-parse on the next step.

Constraints:
  - Each modality is opt-in per skill via a new field in the skill's
    metadata or inline declaration.
  - Costs logged separately in memory/token-usage.csv with a new column
    `modality`.
  - Notify routing: voice notes go to channels that support them
    (Telegram, Discord); fall back to text + link.
  - No skill is REQUIRED to use multi-modal output — it's purely additive.

Out of scope:
  - Building a TTS server. Use ElevenLabs or OpenAI.
  - Real-time voice conversation. (One-shot voice notes only.)
  - Image gen — already exists.
```

## Punchlist

- [ ] `scripts/postprocess-voice.sh` — ElevenLabs / OpenAI TTS adapter; outputs MP3; sends as voice note.
- [ ] `scripts/postprocess-video.sh` — Replicate adapter for Sora / Kling / Runway; saves MP4.
- [ ] New skill helper: `./screenshot <url>` — fetches via headless browser, returns image artifact + extracted text via vision.
- [ ] Update `./notify` to handle voice/video artifacts (Telegram sendVoice, Discord file upload, Slack file).
- [ ] 2 reference skills demoing the new modalities:
  - `morning-brief` gains optional `output_modality: voice` (1-minute audio brief).
  - `weekly-shiplog` gains optional `output_modality: video` (10-second highlight reel).
- [ ] Cost tracking column added to `memory/token-usage.csv`.
- [ ] Doc: `docs/contributor-dossier/03-subsystems/multimodal.md`.

## Files touched

| Path | Action |
|---|---|
| `scripts/postprocess-voice.sh` | New |
| `scripts/postprocess-video.sh` | New |
| `./screenshot` | New helper |
| `./notify` (workflow inline) | Handle voice/video artifact types |
| `articles/voice/`, `articles/video/` | New directories |
| `skills/morning-brief/SKILL.md` | Optional modality |
| `skills/weekly-shiplog/SKILL.md` | Optional modality |
| `memory/token-usage.csv` | New column `modality` |
| `docs/contributor-dossier/03-subsystems/multimodal.md` | New |

## Dependencies

- **`ELEVENLABS_API_KEY`** OR `OPENAI_API_KEY` for TTS.
- **`REPLICATE_API_TOKEN`** for video (already exists for image).
- **Headless browser** for screenshot (Playwright; runs in postprocess script).
- Channels: Telegram + Discord support native voice/file. Slack supports file uploads.

## Risks

| Risk | Mitigation |
|---|---|
| Cost surprise | Per-modality budget cap in `aeon.yml` config; alert if daily spend exceeds threshold. |
| Voice clone misuse | Use generic voices by default; voice cloning gated behind operator opt-in + clear consent docs. |
| Storage bloat (MP3/MP4 in git) | Articles/voice and articles/video gitignored beyond N days; janitor archives or deletes. |
| Channel limits (Telegram has file size caps) | Auto-transcode or fall back to text + hosted URL. |

## Doctor check

- ✓ At least one ref skill with `output_modality: voice` ran successfully
- ✓ Generated MP3 is reachable from the corresponding article markdown
- ✓ Token-usage CSV has rows with `modality` populated

## Related dossier docs

- [`../03-subsystems/runtime.md`](../03-subsystems/runtime.md) — postprocess hook
- [`../03-subsystems/notifications.md`](../03-subsystems/notifications.md) — channel-specific delivery
- [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) § Option #8
