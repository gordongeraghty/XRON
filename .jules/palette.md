## 2025-02-18 - Tailwind Custom Toggles Require Explicit Focus
**Learning:** Custom toggle switches, formats selection groups, and tabs built with Tailwind in this app lack default keyboard accessibility out of the box. They require manual addition of `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500` alongside structural ARIA properties (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` for tabs and `aria-pressed` for custom toggle buttons) to be screen-reader and keyboard navigable.
**Action:** Always append explicit `focus-visible` styling to interactive Tailwind elements, use standard tablist `role` attributes for tabbed navigation, and ensure `aria-pressed` tracks boolean interactive states on custom buttons.

## 2024-03-24 - Structured Empty States for Multi-Selects
**Learning:** When all options in a multi-select filter (like the format toggles) are disabled, leaving a completely blank screen or a simple text message provides a poor experience. Users need a clear path to recovery.
**Action:** Always implement a visually structured empty state that includes a clear call-to-action button (like 'Reset to defaults') to provide an immediate path to recovery when all options are deselected. Ensure the button has proper focus styles for accessibility.
