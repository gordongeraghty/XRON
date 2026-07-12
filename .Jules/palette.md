## 2024-05-10 - App-Wide Missing Keyboard Focus Indicators
**Learning:** This application's custom interactive elements built with Tailwind (especially links formatted as buttons and toggle icons) systematically omit `focus-visible` styling and accessible states (`aria-pressed`, `aria-expanded`). This causes a severe accessibility gap where keyboard users cannot visually track their focus path across the primary navigation or interactive panels.
**Action:** When working on UI components in this app, always proactively append `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color]-500` (along with semantic ARIA state bindings like `aria-pressed` or `aria-expanded`) to any new or existing intractable element.

## 2026-07-12 - Empty State Actionability
**Learning:** The format panel empty state correctly showed a message, but left the user stranded without a quick way to restore the interface to a working state if they deselected everything by mistake.
**Action:** Always provide a clear, actionable path to recovery (like a 'Reset to defaults' button) in empty states, ensuring it follows accessibility guidelines with proper focus states.
