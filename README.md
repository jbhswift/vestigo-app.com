# Vestigo website

Static site for vestigo-app.com. Published with GitHub Pages from the repository root (no build step). Design mirrors the iOS app's dark theme, liquid-glass cards, and pill buttons — see `assets/site.css`.

## Structure

- `index.html` — marketing homepage. Tab bar mirrors the app's own five tabs (Home, Search, Watchlist, Collections), with Friends swapped for a web-only Download tab since there's no account system here. Each panel's copy is pulled from the app's own README.
- `friend/index.html` — landing page for friend-invite Universal Links (`https://vestigo-app.com/friend?id=...&rid=...&name=...`). Falls back to this page only when the Vestigo app isn't installed (otherwise iOS opens the app directly, without ever loading it).
- `media/index.html` — landing page for shared media Universal Links (`https://vestigo-app.com/media?id=...&kind=...`). Fetches the title/poster/overview from the same public Supabase proxy endpoint the app itself uses (`VestigoBackendClient`), so it needs no API key.
- `.well-known/apple-app-site-association` — Universal Links config. Must stay in sync with the `com.apple.developer.associated-domains` entitlement in the iOS app (`Vestigo/Vestigo/Vestigo.entitlements`) and with whatever paths `ContentView.swift`'s `onOpenURL`/`onContinueUserActivity` handlers actually match.
- `.nojekyll` — required so GitHub Pages serves `.well-known/` as-is instead of having Jekyll's default build silently drop dotfiles/dotfolders.
- `assets/site.css`, `assets/site.js` — shared styling and behavior (deep-link handoff, optional Sign in with Apple, scroll-in animations) for the functional pages.

## Sign in with Apple

The "Continue with Apple" button on `friend/` and `media/` is optional — there's no account system on this site or in the app. It exists purely so a person can confirm it's them before the page hands off to the app; the id_token isn't verified anywhere (that would need a backend), so nothing security-sensitive depends on it.

To make the button actually work (it's wired up in code but needs one-time setup in the Apple Developer portal):

1. **Identifiers → Services IDs** — create one (e.g. `com.jojovestigo.web`), enable Sign in with Apple, set the Primary App ID to `com.jojovestigo`.
2. Configure its **Website URLs**: Domain `vestigo-app.com`, Return URLs `https://vestigo-app.com/friend` and `https://vestigo-app.com/media`.
3. Apple will ask you to verify domain ownership — download the `apple-developer-domain-association.txt` file it gives you and commit it to `.well-known/apple-developer-domain-association.txt` in this repo.
4. Replace the placeholder `com.jojovestigo.web` client ID in the `appleid-signin-client-id` meta tag in `friend/index.html` and `media/index.html` if you used a different Services ID name.

## Universal Links

For `/friend` and `/media` links to open the app instead of this fallback page, `.well-known/apple-app-site-association` must be reachable at `https://vestigo-app.com/.well-known/apple-app-site-association` with no redirects. GitHub Pages serves this automatically once DNS/HTTPS for the custom domain (`CNAME`) is set up — there's nothing else to deploy.

## Deploying

Push to `main`; GitHub Pages rebuilds automatically (Settings → Pages → source: `main` branch, root).
