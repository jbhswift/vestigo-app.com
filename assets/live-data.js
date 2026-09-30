// Real data for the homepage tabs — pulled live from the same public,
// no-auth TMDb proxy the app itself calls (VestigoBackendClient). No API key
// needed here for the same reason the app doesn't need one client-side.

const TMDB_BACKEND = "https://mtttuyvpjyugudkevchj.supabase.co/functions/v1/vestigo-api";
const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
const CARD_WIDTH = 120;
const CARD_GAP = 14;
const DESKTOP_BREAKPOINT = 700;
const MOBILE_ROW_LIMIT = 12;
const EXPANDED_ROW_LIMIT = 24;

// Cache of fetched items per row, so the chevron can expand/collapse without
// re-fetching, and so a window resize can re-fit the collapsed row.
const rowState = {};

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

// How many cards fit in the row's own width with no horizontal scroll —
// sideways scrolling is fine on a touch device, awkward with a mouse.
function computeFitCount(el) {
  const style = getComputedStyle(el);
  const available = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  return Math.max(1, Math.floor((available + CARD_GAP) / (CARD_WIDTH + CARD_GAP)));
}

function renderRow(containerId) {
  const state = rowState[containerId];
  const el = document.getElementById(containerId);
  if (!state || !el) return;

  const isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
  let visible = state.items;

  if (state.expanded) {
    visible = state.items.slice(0, EXPANDED_ROW_LIMIT);
  } else if (isDesktop) {
    visible = state.items.slice(0, computeFitCount(el));
  } else {
    visible = state.items.slice(0, MOBILE_ROW_LIMIT);
  }

  el.classList.toggle("media-row-wrap", state.expanded);
  el.classList.toggle("media-row-center", !state.expanded && isDesktop);
  el.innerHTML = visible.length
    ? visible.map((item) => mediaCardHTML(item, state.fallbackKind)).join("")
    : `<p class="small row-error">Nothing to show right now.</p>`;

  const header = document.querySelector(`.section-header[data-row="${containerId}"]`);
  if (header) header.classList.toggle("expanded", state.expanded);
}

async function loadRow(containerId, path, fallbackKind, extraQuery = "") {
  if (rowState[containerId]) return;
  const el = document.getElementById(containerId);
  if (!el) return;
  rowState[containerId] = { items: [], fallbackKind, expanded: false, path };
  try {
    const items = (await fetchTMDbList(path, extraQuery)).filter((item) => item.media_type !== "person");
    rowState[containerId].items = items;
    renderRow(containerId);
  } catch (err) {
    console.warn(`Couldn't load ${path}:`, err);
    delete rowState[containerId];
    el.innerHTML = `<p class="small row-error">Couldn't load live data right now.</p>`;
  }
}

function toggleRowExpanded(containerId) {
  const state = rowState[containerId];
  if (!state) return;
  state.expanded = !state.expanded;
  renderRow(containerId);
}

function initSectionHeaders() {
  document.querySelectorAll(".section-header").forEach((header) => {
    const rowId = header.dataset.row;
    header.addEventListener("click", () => toggleRowExpanded(rowId));
    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleRowExpanded(rowId);
      }
    });
  });
}

// Re-fit every collapsed desktop row when the window resizes.
window.addEventListener("resize", () => {
  Object.keys(rowState).forEach((containerId) => {
    if (!rowState[containerId].expanded) renderRow(containerId);
  });
});

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
