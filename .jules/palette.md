## 2025-02-18 - Tailwind Custom Toggles Require Explicit Focus
**Learning:** Custom toggle switches, formats selection groups, and tabs built with Tailwind in this app lack default keyboard accessibility out of the box. They require manual addition of `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500` alongside structural ARIA properties (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` for tabs and `aria-pressed` for custom toggle buttons) to be screen-reader and keyboard navigable.
**Action:** Always append explicit `focus-visible` styling to interactive Tailwind elements, use standard tablist `role` attributes for tabbed navigation, and ensure `aria-pressed` tracks boolean interactive states on custom buttons.


## 2026-07-15 - Empty State Reset Actions
**Learning:** In multi-select filter components (like the format toggles in Playground), leaving a completely blank or passive empty state when all options are disabled leads to user friction. Adding a clear call-to-action button (like 'Reset to defaults') provides an immediate path to recovery and improves the overall experience.
**Action:** Always implement a visually structured empty state that includes a clear recovery action when building multi-select or filter components.
