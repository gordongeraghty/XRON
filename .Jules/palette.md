## 2024-05-10 - App-Wide Missing Keyboard Focus Indicators
**Learning:** This application's custom interactive elements built with Tailwind (especially links formatted as buttons and toggle icons) systematically omit `focus-visible` styling and accessible states (`aria-pressed`, `aria-expanded`). This causes a severe accessibility gap where keyboard users cannot visually track their focus path across the primary navigation or interactive panels.
**Action:** When working on UI components in this app, always proactively append `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color]-500` (along with semantic ARIA state bindings like `aria-pressed` or `aria-expanded`) to any new or existing intractable element.

## 2026-07-04 - Empty States Need Recovery Actions
**Learning:** In multi-select filter components, a completely blank state when all options are disabled provides poor UX and leaves users stranded.
**Action:** Always implement a visually structured empty state that includes a clear call-to-action button (like "Reset to defaults") to provide an immediate path to recovery.
