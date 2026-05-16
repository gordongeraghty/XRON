## 2025-02-18 - Tailwind Custom Toggles Require Explicit Focus
**Learning:** Custom toggle switches, formats selection groups, and tabs built with Tailwind in this app lack default keyboard accessibility out of the box. They require manual addition of `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500` alongside structural ARIA properties (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` for tabs and `aria-pressed` for custom toggle buttons) to be screen-reader and keyboard navigable.
**Action:** Always append explicit `focus-visible` styling to interactive Tailwind elements, use standard tablist `role` attributes for tabbed navigation, and ensure `aria-pressed` tracks boolean interactive states on custom buttons.

## 2025-05-16 - Empty State Recovery in Multi-Toggle UI
**Learning:** When users can toggle off all options in a multi-select filter (like format panels), leaving a completely blank screen causes confusion and removes the immediate path to recovery. A simple "Select at least one" text is easily missed.
**Action:** Always provide a visually distinct "Empty State" component (using dashed borders, icons, and clear text) with an explicit CTA button to "Reset to defaults" or "Select All" to restore functionality in one click.
