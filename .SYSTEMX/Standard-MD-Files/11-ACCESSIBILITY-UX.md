# 11 Accessibility And UX Standard

Use this file when an LLM creates or updates UI, forms, navigation, auth, media,
or interactive flows.

## Accessibility Baseline

- Use semantic HTML first.
- Keep keyboard navigation complete.
- Preserve visible focus states.
- Use labels for inputs and accessible names for controls.
- Maintain sufficient color contrast.
- Do not rely on color alone to communicate state.
- Provide alt text for meaningful images.
- Respect reduced-motion preferences for non-essential animation.
- Keep error messages actionable and near the failing field.

## UX Baseline

- Make common workflows obvious and efficient.
- Keep destructive actions explicit and confirmable.
- Keep loading, empty, error, success, and unauthorized states available.
- Use Level 0-5 account logic for access messaging.
- Do not expose admin/private navigation to public users unless the route is
  intentionally public documentation.
- Keep forms recoverable; do not wipe user input after validation errors.

## WTL Site Shell G1

Generated public web apps use the WTL Site Shell G1 pattern unless a project
brief explicitly disables a control:

- **Top right:** persistent hamburger control for global site navigation.
- **Top left:** section-aware page snap menu that uses stable `/#section-id`
  links and appears when a page contains at least two meaningful sections.
- **Bottom left:** safe self-service Help Desk. The template ships approved
  local help content and a human contact handoff; it does not ship an
  unrestricted client-side AI connection.
- **Bottom right:** text size, reading spacing, contrast, reduced-motion, and
  top/bottom page travel controls.

Use semantic `section` elements and explicit `data-snap-label` values for
important page regions. Every fixed trigger must have an accessible name, a
visible focus indicator, a minimum 44 × 44 CSS-pixel touch target, and safe-area
spacing on small screens. Escape closes open drawers and panels.

Level 4/5 staff-only support management must be enforced in backend/Firebase
authorization rules. Hiding an admin link is not authorization. Never expose
provider keys, private CMS content, or privileged tool calls through the public
help panel.

## Required States

For user-facing flows, consider:

- Loading.
- Empty.
- Error.
- Success.
- Unauthorized.
- Offline/degraded.
- Validation failure.
- Permission upgrade required.

## Verification

When possible, run:

```bash
npm run ci:lint
npm run ci:typecheck
npm run ci:build
```

For visual/interactive changes, use browser or Playwright checks at desktop and
mobile widths.
