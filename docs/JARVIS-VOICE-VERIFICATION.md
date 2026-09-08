# Jarvis hologram and device voice verification

Verified on Windows, September 7, 2026.

Story: microphone or typed question → existing Jarvis API/history → written answer
→ explicitly selected browser voice → speaking-state particle face. Proposed
record changes still require approval.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Production build | Pass | Next production build, lint and TypeScript checks |
| Unit/integration suite | Pass | 119 passed; one macOS-only test skipped on Windows |
| Jarvis UI | Pass | Production page renders; dashboard navigation works; no browser exceptions |
| Voice selection | Pass | Simulated enhanced/local preference, saved explicit voice and speed, preview/stop, missing-voice error |
| Voice privacy | Pass | Online voices excluded by default; explicit online opt-in required; no silent fallback for missing selection |
| Hologram | Pass | Canvas rendered; listening/speaking/idle transitions; pause and system reduced-motion produce a static frame |
| Client/API | Pass | Real missing-key response; microphone consent gates; simulated transcript submitted through UI |
| History and records | Pass | Real history/reload endpoints; no task before approval; actual approved task created and linked to contact |
| Mobile | Pass | Simulated iPhone layout has no horizontal overflow; unsupported microphone fallback shown |

The browser test uses synthetic records in a guarded port-3100 workspace, a
simulated Claude response and simulated speech events. It cleans up the records
it creates. Production has no synthetic voice or answer mode. No personal vault,
Google account, paid Claude call or premium voice service was used in these checks.

Still requires target-Mac acceptance: listen to Preview voice, confirm desired
installed voices appear, grant microphone permission, and speak a real question.
These checks do not establish subjective voice quality or phoneme-accurate lip-sync.

Implementation follows the React/Next.js guidance for client-only browser APIs,
cleaned-up observers/timers and narrow effects. Browser-verification guidance drove
the production-page, saved-preference, speech-state, approval and mobile checks.
