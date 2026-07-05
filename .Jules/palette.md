## 2024-05-10 - App-Wide Missing Keyboard Focus Indicators
**Learning:** This application's custom interactive elements built with Tailwind (especially links formatted as buttons and toggle icons) systematically omit `focus-visible` styling and accessible states (`aria-pressed`, `aria-expanded`). This causes a severe accessibility gap where keyboard users cannot visually track their focus path across the primary navigation or interactive panels.
**Action:** When working on UI components in this app, always proactively append `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color]-500` (along with semantic ARIA state bindings like `aria-pressed` or `aria-expanded`) to any new or existing intractable element.

## 2024-05-11 - Missing Empty State Recovery in Format Toggles
**Learning:** In multi-select filter components like format toggles, leaving a completely blank screen when all options are disabled traps the user. A visually structured empty state is needed.
**Action:** Always implement a clear call-to-action button (like "Reset to defaults") in empty states for filter components to provide an immediate path to recovery.
