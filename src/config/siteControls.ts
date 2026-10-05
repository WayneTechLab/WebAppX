export type HelpDeskMode = 'off' | 'help' | 'assistant'

/**
 * WTL Site Shell G1 configuration.
 *
 * Keep this file deliberately small and project-owned. A project created from
 * this template can enable or disable a control without rewriting the shared
 * layout components. `assistant` is reserved for a protected, server-backed
 * integration; the template intentionally ships with the safe `help` mode.
 */
export const siteControls = {
  pageSnap: true,
  siteNavigation: true,
  accessibility: true,
  showPageTravel: true,
  helpDesk: 'help' as HelpDeskMode,
}
