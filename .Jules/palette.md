## 2024-05-10 - App-Wide Missing Keyboard Focus Indicators
**Learning:** This application's custom interactive elements built with Tailwind (especially links formatted as buttons and toggle icons) systematically omit `focus-visible` styling and accessible states (`aria-pressed`, `aria-expanded`). This causes a severe accessibility gap where keyboard users cannot visually track their focus path across the primary navigation or interactive panels.
**Action:** When working on UI components in this app, always proactively append `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color]-500` (along with semantic ARIA state bindings like `aria-pressed` or `aria-expanded`) to any new or existing intractable element.

## 2024-05-10 - Empty State Recovery Path
**Learning:** In multi-select filter components (e.g., format toggles), leaving a completely blank screen when all options are disabled leads to a dead end. Providing a structured empty state with a clear call-to-action (like 'Reset to defaults') offers an immediate path to recovery.
**Action:** Always implement a visually structured empty state that includes a clear call-to-action button to restore defaults when dealing with multi-select panels.
