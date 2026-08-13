# 0051 — Date is a calendar, time is a list

Date: 2026-08-13

## Context

Native `<input type="date|time">` chrome is inconsistent and unstyleable. React
Aria `DatePicker` gives a calendar popover we can restyle. `TimeField` does
not: it is a segmented type-in with no clock. Due times on tasks are almost
always a quarter-hour, so a list is the picker.

## Decision

- **Date:** React Aria `DatePicker`. Value crosses the component boundary as
  `YYYY-MM-DD`. `CalendarDate` never leaves the picker (iron rule #1).
- **Time:** React Aria `ComboBox` over 15-minute `HH:mm` slots. Not `TimeField`.
- Both sit on the existing field-shell rule and portal above the task dialog
  (`z-[60]`).

`@internationalized/date` is only a conversion helper inside the date picker.
Luxon in `lib/dates.ts` remains the calendar brain.

## Consequences

Journal, projects, and people still use native date/time until those surfaces
are swapped to the same two components.
