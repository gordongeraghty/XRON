## 2024-05-10 - App-Wide Missing Keyboard Focus Indicators
**Learning:** This application's custom interactive elements built with Tailwind (especially links formatted as buttons and toggle icons) systematically omit `focus-visible` styling and accessible states (`aria-pressed`, `aria-expanded`). This causes a severe accessibility gap where keyboard users cannot visually track their focus path across the primary navigation or interactive panels.
**Action:** When working on UI components in this app, always proactively append `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color]-500` (along with semantic ARIA state bindings like `aria-pressed` or `aria-expanded`) to any new or existing intractable element.

## 2024-05-15 - Empty States in Multi-Selects
**Learning:** Users can get stuck in a "blank slate" when un-toggling all options in multi-select filters, leaving no obvious way to restore the previous state.
**Action:** Always provide an explicit "Reset to defaults" call-to-action in empty states for multi-select components to ensure a clear path to recovery.
