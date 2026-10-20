import validateConfig from '../../../scripts/validate-config.js'

// The scheduler's cron rules live once, in scripts/validate-config.js, which
// the CLI and CI already use; scripts/cron-due.sh treats anything they reject
// as never due.
const { validateSchedule } = validateConfig

// normalizeSchedule collapses whitespace to single spaces, so the value saved to
// aeon.yml is the one that was validated: the scheduler reads it back with a
// regex, and a stray newline or tab would leave a valid-looking cron that
// never fires.
export function normalizeSchedule(schedule: string): string {
  return schedule.trim().split(/\s+/).join(' ')
}

// scheduleError returns why the scheduler would never run a schedule, or null
// when it is one it runs.
export function scheduleError(schedule: string): string | null {
  return validateSchedule(normalizeSchedule(schedule))
}
