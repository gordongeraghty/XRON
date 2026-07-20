## 2025-02-18 - Tailwind Custom Toggles Require Explicit Focus
**Learning:** Custom toggle switches, formats selection groups, and tabs built with Tailwind in this app lack default keyboard accessibility out of the box. They require manual addition of `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500` alongside structural ARIA properties (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` for tabs and `aria-pressed` for custom toggle buttons) to be screen-reader and keyboard navigable.
**Action:** Always append explicit `focus-visible` styling to interactive Tailwind elements, use standard tablist `role` attributes for tabbed navigation, and ensure `aria-pressed` tracks boolean interactive states on custom buttons.

## 2026-07-20 - Empty states without actions cause friction
**Learning:** When all format toggles are unselected on the Playground, the app presented a generic text-only message, leaving users without an explicit "escape hatch" to return to a default state, worsening the UX.
**Action:** Always implement structured empty states with clear iconography, concise instructional text, and a distinct call-to-action button (like "Reset to defaults") in dynamic filter components.
