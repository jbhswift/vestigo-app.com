// Real data for the homepage tabs — pulled live from the same public,
// no-auth TMDb proxy the app itself calls (VestigoBackendClient). No API key
// needed here for the same reason the app doesn't need one client-side.

const TMDB_BACKEND = "https://mtttuyvpjyugudkevchj.supabase.co/functions/v1/vestigo-api";
const POSTER_BASE = "https://image.tmdb.org/t/p/w185";

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function mediaCardHTML(item, fallbackKind) {
  const kind = item.media_type === "tv" ? "tv" : item.media_type === "movie" ? "movie" : fallbackKind;
  const title = item.title ?? item.name ?? "Untitled";
  const date = item.release_date ?? item.first_air_date ?? "";
  const year = date ? date.slice(0, 4) : "";
  const rating = typeof item.vote_average === "number" && item.vote_average > 0 ? item.vote_average.toFixed(1) : null;
  const posterTag = item.poster_path
    ? `<img src="${POSTER_BASE}${item.poster_path}" alt="" loading="lazy">`
    : "";
  return `
    <a class="media-card" href="/media/?id=${item.id}&kind=${kind}">
      <div class="media-card-poster">${posterTag}</div>
      <div class="media-card-title">${escapeHTML(title)}</div>
      <div class="media-card-meta">${[year, rating ? `★ ${rating}` : null].filter(Boolean).join(" · ")}</div>
    </a>
  `;
}

async function fetchTMDbList(path, extraQuery = "") {
  const url = `${TMDB_BACKEND}/tmdb-proxy?path=${encodeURIComponent(path)}${extraQuery}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.results ?? [];
}

async function loadRow(containerId, path, fallbackKind) {
  const el = document.getElementById(containerId);
  if (!el || el.dataset.loaded) return;
  el.dataset.loaded = "pending";
  try {
    const items = (await fetchTMDbList(path))
      .filter((item) => item.media_type !== "person")
      .slice(0, 12);
    el.innerHTML = items.length
      ? items.map((item) => mediaCardHTML(item, fallbackKind)).join("")
      : `<p class="small row-error">Nothing to show right now.</p>`;
    el.dataset.loaded = "true";
  } catch (err) {
    console.warn(`Couldn't load ${path}:`, err);
    el.innerHTML = `<p class="small row-error">Couldn't load live data right now.</p>`;
    el.dataset.loaded = "";
  }
}

let searchDebounce;
async function runSearch(query) {
  const el = document.getElementById("search-results");
  if (!el) return;
  if (!query.trim()) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<p class="small row-loading">Searching…</p>`;
  try {
    const items = (await fetchTMDbList("/search/multi", `&query=${encodeURIComponent(query)}`))
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .slice(0, 18);
    el.innerHTML = items.length
      ? items.map((item) => mediaCardHTML(item)).join("")
      : `<p class="small row-error">No results for "${escapeHTML(query)}".</p>`;
  } catch (err) {
    console.warn("Search failed:", err);
    el.innerHTML = `<p class="small row-error">Search is unavailable right now.</p>`;
  }
}

function initSearchBox() {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  if (!form || !input) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch(input.value);
  });
  input.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => runSearch(input.value), 400);
  });
}

// Loads the row(s) for a given tab the first time it's shown, not up front —
// no point spending a request on data nobody scrolled to.
function loadDataForPanel(panel) {
  switch (panel) {
    case "home": loadRow("row-trending", "/trending/all/week", "movie"); break;
    case "watchlist": loadRow("row-upcoming", "/movie/upcoming", "movie"); break;
    case "collections": loadRow("row-popular", "/movie/popular", "movie"); break;
    default: break;
  }
}
