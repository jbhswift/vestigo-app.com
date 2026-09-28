// Shared helpers for vestigo-app.com's functional pages (friend/, media/).
// No backend, no accounts — everything here runs client-side only.

const TESTFLIGHT_URL = "https://testflight.apple.com/join/zbvP2WEx";

function openTestFlight() {
  window.open(TESTFLIGHT_URL, "_blank", "noopener");
}

// Re-fires the current universal link so iOS can hand off to the app if it's
// installed (tapping "Open" is what lets Safari re-check, since the very
// first automatic attempt on page load can be swallowed by the popup blocker).
function openInVestigo(customSchemeURL) {
  window.location.href = customSchemeURL;
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
