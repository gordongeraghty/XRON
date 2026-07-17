## 2024-05-10 - App-Wide Missing Keyboard Focus Indicators
**Learning:** This application's custom interactive elements built with Tailwind (especially links formatted as buttons and toggle icons) systematically omit `focus-visible` styling and accessible states (`aria-pressed`, `aria-expanded`). This causes a severe accessibility gap where keyboard users cannot visually track their focus path across the primary navigation or interactive panels.
**Action:** When working on UI components in this app, always proactively append `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color]-500` (along with semantic ARIA state bindings like `aria-pressed` or `aria-expanded`) to any new or existing intractable element.

## 2026-07-17 - Add Empty State for Formats
**Learning:** When all items are deselected from a list of toggles, presenting a blank space or plain text leaves users without a clear path forward. Providing a visually structured empty state with a call-to-action button (like 'Reset to defaults') offers an immediate recovery path.
**Action:** Always include a visual empty state and actionable recovery path for multi-select component edge cases.
