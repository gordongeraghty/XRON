## 2025-02-18 - Tailwind Custom Toggles Require Explicit Focus
**Learning:** Custom toggle switches, formats selection groups, and tabs built with Tailwind in this app lack default keyboard accessibility out of the box. They require manual addition of `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500` alongside structural ARIA properties (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` for tabs and `aria-pressed` for custom toggle buttons) to be screen-reader and keyboard navigable.
**Action:** Always append explicit `focus-visible` styling to interactive Tailwind elements, use standard tablist `role` attributes for tabbed navigation, and ensure `aria-pressed` tracks boolean interactive states on custom buttons.


## 2026-07-16 - Structured Empty States for Multi-Select Filters
**Learning:** When all options in a multi-select filter (like format toggles) are disabled, leaving a simple text message or blank screen creates a dead end for users.
**Action:** Always implement a visually structured empty state (e.g., with a dashed border) that includes a clear call-to-action button (like 'Reset to defaults') to provide an immediate path to recovery.
