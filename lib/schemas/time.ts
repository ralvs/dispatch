import { z } from "zod";

// A wall-clock time in the app timezone (iron rule #1 — never a UTC instant;
// callers convert at the boundary via lib/dates). 24-hour HH:mm, range-guarded
// so an impossible time fails schema-parse rather than reaching a service:
// the capture path degrades to needs_review, the task form rejects the input.
//
// Shared by every surface that accepts a time of day — task due_time (both the
// LLM-facing and the FormData-facing schema) and calendar event start/end.
export const WallClockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
