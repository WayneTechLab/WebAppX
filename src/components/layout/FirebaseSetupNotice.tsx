import { AppLink } from '@/components/navigation/AppLink'
import { firebaseRuntime } from '@/config/firebase'

/** Unset Firebase is a supported starting point for the public template. */
export function FirebaseSetupNotice() {
  if (firebaseRuntime.authAvailable) return null

  return (
    <aside aria-label="Optional Firebase setup" className="border-b border-sky-200 bg-sky-50 px-6 py-3 text-sm text-sky-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1">
        <p><strong>Account-free mode.</strong> Firebase is not configured. HR, CMS and CRM sample workspaces are available without an account.</p>
        <AppLink to="/portals" className="font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">Open mock portals</AppLink>
        <p>Optional sign-in setup: add your Firebase web configuration to <code>.env.local</code> using <code>.env.example</code>, then restart.</p>
        <AppLink to="/docs" className="font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">Read setup docs</AppLink>
      </div>
    </aside>
  )
}
