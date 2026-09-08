# Connect Google Calendar

The real OAuth connection UI is in **Integrations → Google Calendar**, directly
under the profile. It needs your Google Cloud OAuth client and account consent
before it can access live events. Saving setup alone is not a successful connection.

## One-time personal testing setup

1. In [Google Cloud](https://console.cloud.google.com/), create/select a project
   and enable **Google Calendar API**.
2. Configure **Google Auth Platform** branding/audience. For an external app in
   Testing, add your Google email as a test user. Workspace administrators may
   restrict third-party authorization.
3. Create an OAuth client of type **Web application**, not Desktop for this flow.
4. Register the exact redirect URI shown in RealtorPro, normally
   `http://127.0.0.1:3000/google/callback`. If you use localhost or another port,
   register that exact URI too. Use the same origin throughout sign-in.
5. Paste the client ID and client secret **into the app**, then **Save Google setup**.
   These are app credentials, not your Google password. Never paste secrets in chat.
6. Click **Connect Google Calendar**, sign in on Google's page and authorize both
   calendar permissions. Use your normal browser if an embedded browser is rejected.
7. On the success page click **Return to RealtorPro Integrations**, then select
   a writable calendar. Only that selected calendar is used by Jarvis.
8. Click **Test / refresh calendar**. An event list or “Connection works. No events…”
   confirms live access. You can also see this list on the Calendar page.

For a private test, Google may show an unverified-app warning. Only continue if
it is the OAuth app you created and its permissions match your intent. Do not
disable browser security. External Testing-mode refresh tokens can expire after
seven days; reconnect when needed. Wider distribution may require verification.
See [Google OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server),
[expiration](https://developers.google.com/identity/protocols/oauth2#expiration)
and [calendar scopes](https://developers.google.com/workspace/calendar/api/auth).

## What is implemented

- Requests `calendar.calendarlist.readonly` and `calendar.events`, not Gmail/Drive.
- Lists up to 100 writable calendars; indicates if more exist.
- Reads up to 100 events per date range (at most 90 days), flagging incomplete lists.
- Shows seven-day Google events separately from the local calendar grid.
- Jarvis proposes new Google events through the review approval gate.
- No attendees/invitations, Google event edits/deletions, automatic two-way sync,
  or duplicate local appointments. Edit/remove Google events in Google Calendar.
- Checks busy events on the selected calendar, not every calendar or attendees'
  availability. A concurrent change can still occur between checking and saving.

## Security and recovery

Authorization uses one-use random state, a browser-bound HttpOnly SameSite=Lax
callback cookie, PKCE S256 and a ten-minute deadline. App session cookies remain
SameSite=Strict. Only the top-level OAuth callback has a cross-site exception.
Credentials/refresh tokens use macOS Keychain or Windows DPAPI; access tokens
remain in server memory. Secrets are excluded from status responses, Jarvis,
Calendar API URLs and SQLite backups. The local reference/encrypted file is
`workspace/google-calendar.secret.json`. Mac items currently share the existing
`app.realtorpro.claude` Keychain service with distinct generated account IDs;
do not remove unrelated Claude items.

Account/calendar changes invalidate pending Google proposals. An approved event
uses a deterministic ID derived from its review; retries check that same ID
before inserting. After an interrupted request, check Google before starting a
new proposal. Deleted Google events are not silently recreated by a retry.
Restoring SQLite does not roll back Google events.

Disconnect disables local use first, then attempts Google token revocation. If
revocation fails, remove access in your Google Account; the app displays a warning.
Previously created events remain. Saving new OAuth settings disconnects the local
account; remove the old grant in Google Account settings if no longer needed.
Moving to another OS requires reconnecting. Keep the app private on loopback;
do not expose it through a tunnel or public server.

## Test boundary

`tests/google-calendar.test.ts` covers OAuth security, refresh, selection, safe
errors, event reads, overlap and duplicate prevention with simulated Google HTTP.
`npm run test:google-browser` uses an isolated workspace and synthetic credentials
to test real UI, encrypted storage, OAuth start and invalid callback handling.
It does not send synthetic credentials to Google. Successful live sign-in and
read/write testing still require your real Cloud client and Google account.
