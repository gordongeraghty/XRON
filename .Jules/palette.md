## 2024-05-10 - App-Wide Missing Keyboard Focus Indicators
**Learning:** This application's custom interactive elements built with Tailwind (especially links formatted as buttons and toggle icons) systematically omit `focus-visible` styling and accessible states (`aria-pressed`, `aria-expanded`). This causes a severe accessibility gap where keyboard users cannot visually track their focus path across the primary navigation or interactive panels.
**Action:** When working on UI components in this app, always proactively append `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color]-500` (along with semantic ARIA state bindings like `aria-pressed` or `aria-expanded`) to any new or existing intractable element.

## 2024-05-28 - Actionable Empty States in Filters
**Learning:** Multi-select filter components (like format toggles) require a visually structured empty state with a clear call-to-action (e.g., "Reset to defaults") when all options are disabled to prevent users from hitting a dead end.
**Action:** Always implement a recovery path in empty states.
