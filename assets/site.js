// Shared helpers for vestigo-app.com's functional pages (friend/, media/).
// No backend, no accounts — everything here runs client-side only.

const TESTFLIGHT_URL = "https://testflight.apple.com/join/zbvP2WEx";

function openTestFlight() {
  window.open(TESTFLIGHT_URL, "_blank", "noopener");
}

// Only ever called from a button tap — never automatically on page load.
// Forcing an app-open attempt just for visiting a link is hostile; a person
// should see the page's own content first and choose to open the app.
//
// Tries the vestigo:// custom scheme, then falls back to TestFlight if the
// app doesn't actually open. Detection: if the app opens, this tab backgrounds
// (blur/pagehide fires) and we cancel the fallback timer; if nothing happens
// for ~1.5s, assume the app isn't installed and go to TestFlight instead.
function openInVestigoWithFallback(customSchemeURL) {
  let fallbackFired = false;
  const cancel = () => { fallbackFired = true; };
  window.addEventListener("blur", cancel, { once: true });
  window.addEventListener("pagehide", cancel, { once: true });

  window.location.href = customSchemeURL;

  setTimeout(() => {
    if (!fallbackFired) window.location.href = TESTFLIGHT_URL;
  }, 1500);
}

// nav.tabs is fixed, so it doesn't reserve space in flow on any page that
// includes it — measure it and push content down by exactly that much.
function initNavOffset() {
  const nav = document.querySelector("nav.tabs");
  if (!nav) return;
  const sync = () => { document.body.style.paddingTop = nav.offsetHeight + "px"; };
  sync();
  window.addEventListener("resize", sync);
}

// Every page carries the identical nav markup (no page bakes in its own
// "active" class), so highlighting the current tab is just a path match —
// one shared function instead of six near-duplicate copies.
function initNavActiveState() {
  const path = location.pathname.replace(/index\.html$/, "");
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const href = btn.getAttribute("href");
    if (!href) return;
    const isActive = href.replace(/index\.html$/, "") === path;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function initFadeInOnScroll() {
  const targets = document.querySelectorAll(".fade-in");
  if (!("IntersectionObserver" in window) || targets.length === 0) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  targets.forEach((el) => observer.observe(el));
}

// Sign in with Apple is entirely optional here — there's no account system
// on this site. A successful sign-in just confirms who's tapping the button
// before we hand off to the app; the app's own CloudKit-based friend system
// is the actual source of truth. We don't verify the id_token's signature
// (that needs a backend), so nothing security-sensitive is decided here.
function initAppleSignIn({ onIdentity } = {}) {
  const button = document.getElementById("apple-signin");
  if (!button || typeof AppleID === "undefined") return;

  document.addEventListener("AppleIDSignInOnSuccess", (event) => {
    const idToken = event.detail?.authorization?.id_token;
    const givenName = event.detail?.user?.name?.firstName;
    if (idToken && onIdentity) {
      onIdentity({ idToken, givenName, payload: decodeJWTPayload(idToken) });
    }
  });

  document.addEventListener("AppleIDSignInOnFailure", (event) => {
    if (event.detail?.error !== "user_cancelled_authorize") {
      console.warn("Sign in with Apple failed:", event.detail?.error);
    }
  });
}

function decodeJWTPayload(jwt) {
  try {
    const payload = jwt.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
