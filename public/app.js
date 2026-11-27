(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseIso = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
  const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const SLOTS = ["breakfast", "lunch", "dinner", "snack"];
  const SLOT_ORDER = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  const SLOT_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const phoneMQ = matchMedia("(max-width: 759px)");
  const hoverMQ = matchMedia("(hover: hover)");
  const haptic = () => { try { navigator.vibrate?.(8); } catch {} };

  function mondayOf(date) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  const shortDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  function weekRangeText(monday) {
    const sunday = addDays(monday, 6);
    if (monday.getMonth() === sunday.getMonth()) return `${monday.getDate()}–${sunday.getDate()} ${MONTHS[monday.getMonth()]}`;
    return `${shortDate(monday)} – ${shortDate(sunday)}`;
  }
  function siteOf(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } }
  function titleFromUrl(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean).filter((p) => !/^\d+$/.test(p) && !/^(recipes?|recipe|en|uk|us)$/i.test(p));
      let slug = parts.pop() || "";
      slug = slug.replace(/\.(html?|php|aspx?)$/i, "").replace(/[-_+]+/g, " ").replace(/\b\d{4,}\b/g, "").trim();
      if (!slug || /^\d+$/.test(slug)) return "";
      return slug.charAt(0).toUpperCase() + slug.slice(1);
    } catch { return ""; }
  }
  function recipeId(url) { let h = 5381; const s = url.trim().toLowerCase(); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "r" + h.toString(16) + s.length.toString(16); }
  function normalizeUrl(v) { v = (v || "").trim(); if (!v) return ""; if (!/^https?:\/\//i.test(v)) v = "https://" + v; try { const u = new URL(v); return u.hostname.includes(".") ? u.toString() : null; } catch { return null; } }
  const looksLikeUrl = (v) => /^(https?:\/\/|www\.)\S+$/i.test(v.trim()) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(v.trim());
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function newId() { return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  // Same as dishKeyOf in server.js: a rating belongs to the dish, so it follows it from week to week.
  const normTitle = (t) => String(t || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
  const dishKey = (x) => (x.url ? recipeId(x.url) : "t:" + normTitle(x.title));
  const initial = (s) => (String(s || "").trim()[0] || "?").toUpperCase();
  const HUES = [340, 200, 24, 268, 150, 300, 45, 182];
  const hueOf = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUES[h % HUES.length]; };
  const store = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const recall = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  // Only touch the page when something really changed, so nothing flickers or re-animates.
  const setHTML = (el, html) => { if (el._html !== html) { el.innerHTML = html; el._html = html; } };

  // ---------- icons ----------
  const ICONS = {
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    calplus: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
    book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7.5h6"/>',
    cart: '<path d="M3 4h2l2.4 10.2a1.5 1.5 0 0 0 1.5 1.1h7.7a1.5 1.5 0 0 0 1.4-1l2-6.3H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.8 14.6c2.3.1 4 1.6 4.6 4.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
    fork: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 3v18"/><path d="M17 21V3c-2 1.5-3 4-3 7 0 2 1 3.5 3 3.5"/>',
    share: '<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 17.5h2"/>',
    logout: '<path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    open: '<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z"/><path d="M12 6v13.5"/>',
  };
  const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  const INK = "#231A2B";
  function face(v) {
    const fill = v === 1 ? "#8BD99B" : v === 0 ? "#FFD465" : "#FF9FBA";
    let feat;
    if (v === 1) {
      feat = `<circle cx="8.6" cy="18.4" r="2.1" fill="#FF7FA3" opacity=".45"/><circle cx="23.4" cy="18.4" r="2.1" fill="#FF7FA3" opacity=".45"/>`
        + `<path d="M9.6 14.4q1.7-2.4 3.4 0M19 14.4q1.7-2.4 3.4 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`
        + `<path d="M10.4 18.2Q16 26 21.6 18.2z" fill="${INK}"/><ellipse cx="16" cy="20.9" rx="2.7" ry="1.3" fill="#FF7A9A"/>`;
    } else if (v === 0) {
      feat = `<circle cx="11.4" cy="13.6" r="1.8" fill="${INK}"/><circle cx="20.6" cy="13.6" r="1.8" fill="${INK}"/>`
        + `<path d="M11.6 20.6h8.8" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
    } else {
      feat = `<path d="M9.6 12l3.4 1.8-3.4 1.8M22.4 12L19 13.8l3.4 1.8" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<path d="M10.2 21.6q1.45-1.7 2.9 0t2.9 0 2.9 0 2.9 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return `<svg class="face" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="${fill}"/>${feat}</svg>`;
  }
  const PLATE = `<svg class="plate" viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="50" r="27" fill="#FFF" stroke="#D2E4D8" stroke-width="2"/><circle cx="48" cy="50" r="18.5" fill="#EEF6F1"/><path d="M40.5 47.5q7.5 7.5 15 0" stroke="#8BD99B" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M8 26v12a4 4 0 0 0 8 0V26M12 26v50" stroke="#E2245E" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M88 76V26c-5 3.5-7 9.5-7 15.5 0 4 2.5 6.5 7 6.5" stroke="#E2245E" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  function hydrate(root = document) {
    for (const el of $$("[data-icon]", root)) el.outerHTML = icon(el.dataset.icon);
    for (const el of $$("span[data-face]", root)) el.outerHTML = face(Number(el.dataset.face));
  }

  // Pictures fade in once, and never again when a list is redrawn.
  const loadedImgs = new Set();
  document.addEventListener("load", (e) => {
    const t = e.target;
    if (t.tagName === "IMG" && t.classList.contains("fade")) { t.classList.add("loaded"); loadedImgs.add(t.getAttribute("src")); }
  }, true);
  document.addEventListener("error", (e) => { const t = e.target; if (t.tagName === "IMG" && t.classList.contains("fade")) t.style.visibility = "hidden"; }, true);
  const imgTag = (src, lazy = true) => `<img class="fade${loadedImgs.has(src) ? " loaded" : ""}" src="${esc(src)}" alt="" ${lazy ? 'loading="lazy" ' : ""}decoding="async" draggable="false">`;
  const ph = (seed) => `<div class="ph" style="--h:${hueOf(seed)}">${icon("fork")}</div>`;

  // ---------- toast ----------
  let toastTimer;
  function toast(msg, action) {
    const t = $("#toast");
    const host = $$("dialog[open]").at(-1) || document.body;
    if (t.parentNode !== host) host.appendChild(t);
    t.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : "");
    if (action) t.querySelector("button").onclick = () => { hideToast(); action.run(); };
    t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, action ? 6500 : 2600);
  }
  const hideToast = () => $("#toast").classList.remove("show");

  // ---------- talking to the server ----------
  async function call(method, path, body) {
    const res = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
    let data = {}; try { data = await res.json(); } catch {}
    if (res.status === 401 && user) { user = null; showSignedOut(); }
    if (!res.ok) { const e = new Error(data.error || "Something went wrong. Please try again."); e.status = res.status; throw e; }
    return data;
  }

  // ---------- state ----------
  let user = null, kids = [];
  let weekStart = mondayOf(new Date());
  let meals = [], recipes = [], shared = [], ratings = {};
  let loadingWeek = true, loadedRecipes = false;
  let view = "week", scope = "mine", boxFilter = "all";
  const weekCache = new Map();
  const curIso = () => isoDate(weekStart);
  const isThisWeek = () => curIso() === isoDate(mondayOf(new Date()));
  const todayIndex = () => (isThisWeek() ? (new Date().getDay() + 6) % 7 : -1);
  const bySlot = (a, b) => (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9) || (a.createdAt || 0) - (b.createdAt || 0);
  const mealsOn = (i) => meals.filter((m) => m.dayIndex === i).sort(bySlot);
  const mealBody = (m) => ({ title: m.title, url: m.url || "", site: m.site || "", week: m.week, dayIndex: m.dayIndex, slot: m.slot, notes: m.notes || "", cooked: !!m.cooked, createdAt: m.createdAt || Date.now() });

  async function loadWeek() {
    const wk = curIso();
    try {
      const d = await call("GET", `/api/meals?week=${wk}`);
      weekCache.set(wk, d.meals);
      if (curIso() !== wk) return;
      meals = d.meals; loadingWeek = false;
    } catch (e) {
      console.error(e);
      if (curIso() !== wk) return;
      loadingWeek = false; toast("Couldn't load this week. Check your connection.");
    }
    renderWeek(); if (view === "shop") renderShop();
    prefetch(addDays(weekStart, 7)); prefetch(addDays(weekStart, -7));
  }
  async function prefetch(d) {
    const wk = isoDate(d); if (weekCache.has(wk)) return;
    try { weekCache.set(wk, (await call("GET", `/api/meals?week=${wk}`)).meals); } catch {}
  }
  async function loadRecipes() {
    try { recipes = (await call("GET", "/api/recipes")).recipes; loadedRecipes = true; } catch (e) { console.error(e); }
    renderRecipes(); renderWeek(); if (view === "shop") renderShop();
  }
  async function loadShared() {
    try { shared = (await call("GET", "/api/shared")).recipes.filter((r) => !r.mine); } catch (e) { console.error(e); }
    renderRecipes();
  }
  async function loadRatings() {
    try {
      const next = {};
      for (const r of (await call("GET", "/api/ratings")).ratings) (next[r.dishKey] ||= {})[r.kidId] = r.rating;
      ratings = next;
    } catch (e) { console.error(e); }
    refreshAll();
  }
  function refreshAll() { renderWeek(); renderRecipes(); if (detail.open) renderDetailKids(); }

  // ---------- kids & ratings ----------
  const FACES = [
    { v: 1, cls: "love", label: "Loves it", all: "The kids love it" },
    { v: 0, cls: "ok", label: "It's OK", all: "The kids think it's OK" },
    { v: -1, cls: "no", label: "Not a fan", all: "The kids aren't fans" },
  ];
  const faceOf = (v) => FACES.find((f) => f.v === v);
  const raters = () => (kids.length ? kids : [{ id: "_", name: "The kids" }]);
  function ratingsFor(key) { const r = ratings[key] || {}; return raters().filter((k) => k.id in r).map((k) => ({ kid: k, v: r[k.id] })); }
  function verdict(key) {
    const rs = ratingsFor(key);
    if (!rs.length) return "new";
    if (rs.some((x) => x.v === -1)) return "nope";
    return rs.some((x) => x.v === 1) ? "fav" : "ok";
  }
  const favScore = (key) => ratingsFor(key).reduce((s, x) => s + (x.v === 1 ? 2 : x.v === 0 ? 0.5 : -3), 0);
  function facesMini(key) {
    const rs = ratingsFor(key); if (!rs.length) return "";
    return `<span class="fms">${rs.map(({ kid, v }) => `<span class="fm" title="${esc(kid.name)}: ${faceOf(v).label}">${face(v)}${kids.length > 1 ? `<b>${esc(initial(kid.name))}</b>` : ""}</span>`).join("")}</span>`;
  }
  function faceButtons(key, kid, cur) {
    return `<div class="faces${cur !== undefined ? " rated" : ""}" role="group" aria-label="${esc(kid.name)}">${FACES.map((f) =>
      `<button type="button" class="face-btn ${f.cls}" aria-pressed="${cur === f.v}" data-face="${f.v}" data-kid="${esc(kid.id)}" data-key="${esc(key)}">${face(f.v)}<span>${f.label}</span></button>`).join("")}</div>`;
  }
  function kidRows(key) {
    const r = ratings[key] || {};
    return raters().map((k) => `<div class="kid">${k.id === "_" ? "" : `<span class="who2"><span class="kav" style="--h:${hueOf(k.id)}" aria-hidden="true">${esc(initial(k.name))}</span>${esc(k.name)}</span>`}${faceButtons(key, k, r[k.id])}</div>`).join("");
  }
  async function setRating(key, kidId, v, title) {
    const cur = ratings[key]?.[kidId];
    const next = cur === v ? null : v; // tapping the chosen face again clears it
    ratings[key] = { ...(ratings[key] || {}) };
    if (next === null) delete ratings[key][kidId]; else ratings[key][kidId] = next;
    haptic();
    refreshAll();
    if (next !== null) for (const b of $$(`.face-btn[data-key="${CSS.escape(key)}"][data-kid="${CSS.escape(kidId)}"][data-face="${v}"]`)) b.classList.add("bounce");
    try { await call("PUT", "/api/ratings", { dishKey: key, kidId, rating: next, title }); }
    catch (e) { console.error(e); toast(e.message || "Couldn't save that. Try again."); loadRatings(); }
  }

  // ---------- views ----------
  const VIEWS = ["week", "recipes", "shop", "family"];
  function route() {
    let h = location.hash.slice(1);
    if (h === "shared" || h === "everyone") { scope = "everyone"; h = "recipes"; }
    setView(VIEWS.includes(h) ? h : "week");
  }
  function setView(v) {
    const apply = () => {
      const changed = view !== v;
      view = v;
      for (const s of $$("[data-view]")) s.hidden = s.dataset.view !== v;
      for (const a of $$("[data-nav]")) { if (a.dataset.nav === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }
      if (v === "recipes") renderRecipes(true);
      if (v === "shop") renderShop(true);
      if (v === "family") renderFamily();
      if (v === "week") renderWeek();
      if (changed) window.scrollTo(0, 0);
    };
    if (user && view !== v && document.startViewTransition && !reduced.matches) document.startViewTransition(apply);
    else apply();
  }
  window.addEventListener("hashchange", route);

  // ---------- week ----------
  function boxFor(m) {
    if (m.url) return recipes.find((r) => r.id === recipeId(m.url)) || null;
    const t = normTitle(m.title);
    return recipes.find((r) => !r.url && normTitle(r.title) === t) || null;
  }
  const imgSrc = (r) => (r.ownerId ? `/api/shared/${encodeURIComponent(r.ownerId)}/${encodeURIComponent(r.id)}/image` : `/api/recipes/${encodeURIComponent(r.id)}/image`) + `?v=${encodeURIComponent((r.imageUrl || "").slice(-24))}`;
  const picFor = (r, seed, lazy = true) => (r?.hasImage ? imgTag(imgSrc(r), lazy) : ph(seed));

  function renderWeek() {
    if (!user) return;
    renderWeekHead(); renderStrip(); renderTonight(); renderTip(); renderEmptyWeek(); renderDays();
  }
  function renderWeekHead() {
    const diff = Math.round((weekStart - mondayOf(new Date())) / 864e5 / 7);
    $("#weekLabel").textContent = diff === 0 ? "This week" : diff === 1 ? "Next week" : diff === -1 ? "Last week" : "Week of";
    $("#weekRange").textContent = weekRangeText(weekStart);
    $("#todayBtn").hidden = diff === 0;
    const n = meals.length, cooked = meals.filter((m) => m.cooked).length;
    $("#weekMeta").hidden = loadingWeek || n === 0;
    $("#weekCount").textContent = `${plural(n, "meal")} planned · ${cooked} cooked`;
    $("#weekProg").style.width = n ? `${Math.round((cooked / n) * 100)}%` : "0";
  }
  function renderStrip() {
    const ti = todayIndex();
    let html = "";
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i), ms = mealsOn(i);
      const dots = ms.slice(0, 3).map((m) => `<i class="${m.cooked ? "on" : "planned"}"></i>`).join("");
      html += `<button type="button" data-jump="${i}" class="${i === ti ? "today" : ""}${i === activeDay ? " active" : ""}" aria-label="${DAY_NAMES[i]} ${shortDate(d)}, ${plural(ms.length, "meal")}"><span class="dn">${DAY_NAMES[i].slice(0, 3)}</span><span class="dd">${d.getDate()}</span><span class="dots">${dots}</span></button>`;
    }
    setHTML($("#strip"), html);
  }
  let tonightKey = "";
  function renderTonight() {
    const el = $("#tonight");
    const ti = todayIndex();
    if (ti < 0 || loadingWeek || !meals.length) { setHTML(el, ""); tonightKey = ""; return; }
    const todays = mealsOn(ti);
    let pick = todays.find((m) => !m.cooked) || todays.find((m) => m.cooked && !ratingsFor(dishKey(m)).length);
    let label = "";
    if (pick) label = pick.slot === "dinner" ? "Tonight" : `Today · ${SLOT_LABEL[pick.slot]}`;
    else if (todays.length && ti < 6 && mealsOn(ti + 1).length) { pick = mealsOn(ti + 1)[0]; label = `Tomorrow · ${SLOT_LABEL[pick.slot]}`; }
    const key = pick ? `${pick.id}|${pick.cooked}` : todays.length ? "done" : "empty";
    const enter = key !== tonightKey; tonightKey = key;
    if (pick) {
      const r = boxFor(pick), k = dishKey(pick), rated = ratingsFor(k).length;
      const facts = r?.copyText ? parseCopy(r.copyText).facts : [];
      const time = facts.find((f) => /total/i.test(f.k)) || facts.find((f) => /cook/i.test(f.k));
      const meta = [pick.url ? esc(pick.site || siteOf(pick.url)) : "Your own recipe", time ? `${esc(time.k)} ${esc(time.v)}` : ""].filter(Boolean).join(" · ");
      const askKids = pick.cooked && !rated && !label.startsWith("Tomorrow");
      setHTML(el, `<article class="tonight${r?.hasImage ? "" : " nopic"}${enter ? " enter" : ""}">
        ${r?.hasImage ? `<div class="tpic" data-open-meal="${esc(pick.id)}">${imgTag(imgSrc(r), false)}</div>` : `<span class="deco" aria-hidden="true">${PLATE}</span>`}
        <div class="tbody">
          <p class="eyebrow">${label}</p>
          <h2 class="ttitle" data-open-meal="${esc(pick.id)}">${esc(pick.title)}</h2>
          <div class="tmeta">${meta}</div>
          ${askKids
            ? `<div class="tkids"><span class="q">How did it go? Tap a face.</span>${kidRows(k)}</div>`
            : `<div class="tacts">
                <button type="button" class="btn primary" data-open-meal="${esc(pick.id)}">${icon("open")}${r?.copyText ? "Open recipe" : "Open"}</button>
                ${label.startsWith("Tomorrow") ? "" : `<button type="button" class="btn${pick.cooked ? " herb" : ""}" data-cook="${esc(pick.id)}" aria-pressed="${!!pick.cooked}">${icon("check")}${pick.cooked ? "Cooked" : "Mark as cooked"}</button>`}
              </div>`}
        </div>
      </article>`);
      return;
    }
    if (todays.length) { setHTML(el, ""); return; }
    const sugs = suggestions(8);
    setHTML(el, `<article class="tonight empty${enter ? " enter" : ""}"><div class="tbody">
      <p class="eyebrow">Tonight</p>
      <h2 class="ttitle">Nothing planned for tonight yet</h2>
      <p class="tmeta">${sugs.length ? "Tap a favourite to put it on tonight's table, or plan something new." : "Plan something new, or paste a link from any recipe site."}</p>
      ${sugs.length ? `<div class="sugs">${sugs.map((r) => sugCard(r, ti)).join("")}</div>` : ""}
      <div class="tacts"><button type="button" class="btn primary sm" data-add="${ti}" data-slot="dinner">${icon("plus")}Plan tonight</button></div>
    </div></article>`);
  }
  function suggestions(n) {
    const weekKeys = new Set(meals.map(dishKey));
    return recipes.filter((r) => verdict(dishKey(r)) !== "nope" && !weekKeys.has(dishKey(r)))
      .sort((a, b) => favScore(dishKey(b)) - favScore(dishKey(a)) || (a.lastPlanned || 0) - (b.lastPlanned || 0))
      .slice(0, n);
  }
  function sugCard(r, dayIndex) {
    const fav = verdict(dishKey(r)) === "fav";
    return `<button type="button" class="sug" data-quick="${esc(r.id)}" data-day="${dayIndex}" aria-label="Plan ${esc(r.title)} for ${DAY_NAMES[dayIndex]}"><span class="sp">${picFor(r, r.title)}</span><span class="st">${esc(r.title)}${fav ? "<small>Kid favourite</small>" : ""}</span></button>`;
  }
  function renderTip() { $("#kidsTip").hidden = !!kids.length || recall("wt-kids-tip") === "hidden" || !meals.length; }
  $("#tipX").addEventListener("click", () => { store("wt-kids-tip", "hidden"); renderTip(); });
  function renderEmptyWeek() {
    const el = $("#emptyWeek");
    if (loadingWeek || meals.length) { setHTML(el, ""); return; }
    const target = Math.max(0, todayIndex());
    const sugs = suggestions(8);
    setHTML(el, `<div class="emptyweek">${PLATE}
      <h2>Plan ${isThisWeek() ? "this" : "the"} week</h2>
      <p>${sugs.length ? "Tap a favourite to put it on the table, or add something new." : "Paste a link from any recipe site, or type the name of a meal you know by heart."}</p>
      ${sugs.length ? `<div class="sugs" style="justify-content:${sugs.length < 4 ? "center" : "flex-start"};margin-bottom:18px">${sugs.map((r) => sugCard(r, target)).join("")}</div>` : ""}
      <button type="button" class="btn primary lg" data-act="add">${icon("plus")}Add a meal</button>
    </div>`);
  }
  function renderDays() {
    const ti = todayIndex();
    let html = "";
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i), ms = mealsOn(i);
      const empty = !ms.length && !loadingWeek;
      const sub = i === ti ? "Today" : i === ti + 1 && ti >= 0 ? "Tomorrow" : shortDate(d);
      html += `<section class="day${i === ti ? " today" : ""}${empty ? " empty" : ""}" data-day="${i}" id="day-${i}" aria-label="${DAY_NAMES[i]}">
        <header class="dhead"><span class="dnum">${d.getDate()}</span><span class="dname">${DAY_NAMES[i]}<small>${sub}</small></span></header>
        <div class="dmeals">${loadingWeek && !ms.length ? `<div class="meal sk skel"></div>` : ms.map(mealCard).join("")}</div>
        <button type="button" class="dadd" data-add="${i}" aria-label="Add a meal on ${DAY_NAMES[i]}">${icon("plus")}<span>${empty ? "Plan something" : "Add"}</span></button>
      </section>`;
    }
    setHTML($("#days"), html);
    observeDays();
  }
  function mealCard(m) {
    const r = boxFor(m), key = dishKey(m), rated = ratingsFor(key).length, slot = SLOTS.includes(m.slot) ? m.slot : "dinner";
    return `<article class="meal${m.cooked ? " cooked" : ""}" data-meal="${esc(m.id)}" tabindex="0" aria-label="${esc(m.title)}, ${SLOT_LABEL[slot]}${m.cooked ? ", cooked" : ""}">
      <div class="mimg">${picFor(r, m.title)}</div>
      <div class="mbody">
        <span class="mslot ${slot}">${SLOT_LABEL[slot]}</span>
        <h3 class="mtitle">${esc(m.title)}</h3>
        ${rated ? `<div class="mfoot">${facesMini(key)}</div>` : m.cooked ? `<div class="mfoot"><span class="ask">How did the kids like it?</span></div>` : ""}
      </div>
      <button type="button" class="check${m.cooked ? " on" : ""}" data-cook="${esc(m.id)}" aria-pressed="${!!m.cooked}" aria-label="${m.cooked ? "Cooked" : "Mark as cooked"}" title="${m.cooked ? "Cooked" : "Mark as cooked"}">${icon("check")}</button>
    </article>`;
  }

  // Which day is in view (phones): highlight it in the strip.
  let activeDay = -1, dayObserver = null;
  function observeDays() {
    dayObserver?.disconnect();
    if (!("IntersectionObserver" in window)) return;
    dayObserver = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { activeDay = Number(e.target.dataset.day); for (const b of $$("#strip button")) b.classList.toggle("active", Number(b.dataset.jump) === activeDay); }
    }, { rootMargin: "-40% 0px -55% 0px" });
    for (const d of $$("#days .day")) dayObserver.observe(d);
  }

  async function toggleCooked(id) {
    const m = meals.find((x) => x.id === id); if (!m) return;
    const next = !m.cooked;
    m.cooked = next; haptic();
    renderWeek(); if (detail.open) renderDetail();
    if (next) for (const b of $$(`.check[data-cook="${CSS.escape(id)}"]`)) b.classList.add("pop");
    try { await call("PATCH", `/api/meals/${id}`, { cooked: next }); }
    catch (e) { console.error(e); m.cooked = !next; renderWeek(); if (detail.open) renderDetail(); toast("Couldn't update. Try again."); return; }
    if (next && !ratingsFor(dishKey(m)).length) {
      if (detail.open && sheetCtx?.mealId === id) flashKids();
      else if (!$(`#tonight [data-key="${CSS.escape(dishKey(m))}"]`)) toast("Cooked! Did the kids like it?", { label: "Rate it", run: () => openDetail({ kind: "meal", mealId: id }, true) });
    }
  }
  async function moveMeal(id, dayIndex, from, undoing = false) {
    const m = meals.find((x) => x.id === id); if (!m || m.dayIndex === dayIndex) return;
    const prev = m.dayIndex; m.dayIndex = dayIndex;
    renderWeek(); flipFrom(id, from);
    if (detail.open) renderDetail();
    try {
      await call("PATCH", `/api/meals/${id}`, { dayIndex });
      if (undoing) toast(`Back on ${DAY_NAMES[dayIndex]}`);
      else toast(`Moved to ${DAY_NAMES[dayIndex]}`, { label: "Undo", run: () => moveMeal(id, prev, null, true) });
    } catch (e) { console.error(e); m.dayIndex = prev; renderWeek(); toast("Couldn't move it. Try again."); }
  }
  function flipFrom(id, from) {
    if (!from || reduced.matches) return;
    const el = $(`#days .meal[data-meal="${CSS.escape(id)}"]`); if (!el) return;
    const to = el.getBoundingClientRect();
    const dx = from.left - to.left, dy = from.top - to.top, s = from.width / to.width;
    el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, boxShadow: "0 30px 70px -20px rgba(35,26,43,.38)" }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
  async function deleteMeal(m) {
    const i = meals.indexOf(m); if (i < 0) return;
    meals.splice(i, 1); renderWeek(); if (view === "shop") renderShop();
    try {
      await call("DELETE", `/api/meals/${m.id}`);
      toast(`Removed from ${DAY_NAMES[m.dayIndex]}`, { label: "Undo", run: async () => {
        try { await call("PUT", `/api/meals/${m.id}`, mealBody(m)); if (m.week === curIso()) meals.push(m); renderWeek(); if (view === "shop") renderShop(); } catch (e) { toast(e.message); }
      } });
    } catch (e) { console.error(e); meals.splice(i, 0, m); renderWeek(); toast("Couldn't remove it. Try again."); }
  }
  async function quickPlan(r, dayIndex, slot = "dinner") {
    const m = { id: newId(), title: r.title, url: r.url || "", site: r.url ? (r.site || siteOf(r.url)) : "", week: curIso(), dayIndex, slot, notes: "", cooked: false, createdAt: Date.now() };
    meals.push(m); haptic(); renderWeek();
    try {
      await call("PUT", `/api/meals/${m.id}`, mealBody(m));
      await call("PUT", `/api/recipes/${r.id}`, { ...r, lastPlanned: Date.now(), timesPlanned: (r.timesPlanned || 0) + 1 });
      r.lastPlanned = Date.now(); r.timesPlanned = (r.timesPlanned || 0) + 1;
      const when = dayIndex === todayIndex() && slot === "dinner" ? "tonight" : DAY_NAMES[dayIndex];
      toast(`Added to ${when}`, { label: "Undo", run: () => deleteMeal(m) });
    } catch (e) { console.error(e); meals.splice(meals.indexOf(m), 1); renderWeek(); toast(e.message); }
  }

  const goWeek = (d, dir) => {
    const apply = () => {
      weekStart = d;
      const c = weekCache.get(curIso());
      meals = c || []; loadingWeek = !c; activeDay = -1;
      renderWeek(); if (view === "shop") renderShop(true);
    };
    if (document.startViewTransition && !reduced.matches && view === "week") {
      document.documentElement.dataset.dir = dir < 0 ? "prev" : "next";
      document.startViewTransition(apply).finished.finally(() => { delete document.documentElement.dataset.dir; });
    } else apply();
    loadWeek();
  };
  $("#prevWeek").addEventListener("click", () => goWeek(addDays(weekStart, -7), -1));
  $("#nextWeek").addEventListener("click", () => goWeek(addDays(weekStart, 7), 1));
  $("#todayBtn").addEventListener("click", () => { const t = mondayOf(new Date()); goWeek(t, t < weekStart ? -1 : 1); });

  // ---------- drag a meal to another day (mouse: drag; touch: press and hold) ----------
  const drag = { card: null, id: null, sx: 0, sy: 0, x: 0, y: 0, pid: null, type: "", active: false, timer: 0, armTimer: 0, clone: null, offX: 0, offY: 0, over: null, raf: 0 };
  const daysEl = $("#days");
  daysEl.addEventListener("pointerdown", (e) => {
    const card = e.target.closest(".meal:not(.sk)");
    if (!card || e.button > 0 || e.target.closest(".check") || drag.card) return;
    Object.assign(drag, { card, id: card.dataset.meal, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, pid: e.pointerId, type: e.pointerType, active: false });
    if (e.pointerType !== "mouse") {
      drag.armTimer = setTimeout(() => card.classList.add("arming"), 140);
      drag.timer = setTimeout(startDrag, 380);
    }
    window.addEventListener("pointermove", onDragMove, { passive: false });
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", onDragCancel);
  });
  document.addEventListener("touchmove", (e) => { if (drag.active) e.preventDefault(); }, { passive: false });
  daysEl.addEventListener("contextmenu", (e) => { if (drag.card && drag.type !== "mouse") e.preventDefault(); });
  function onDragMove(e) {
    if (e.pointerId !== drag.pid) return;
    drag.x = e.clientX; drag.y = e.clientY;
    const dist = Math.hypot(drag.x - drag.sx, drag.y - drag.sy);
    if (!drag.active) {
      if (drag.type === "mouse") { if (dist > 6) startDrag(); else return; }
      else { if (dist > 10) resetDrag(); return; }
    }
    e.preventDefault();
    placeClone(); hitTest();
  }
  function startDrag() {
    if (!drag.card) return;
    clearTimeout(drag.timer); clearTimeout(drag.armTimer);
    drag.card.classList.remove("arming");
    drag.active = true; haptic();
    const r = drag.card.getBoundingClientRect();
    drag.offX = drag.sx - r.left; drag.offY = drag.sy - r.top;
    const c = drag.card.cloneNode(true);
    c.classList.add("dragclone"); c.removeAttribute("id");
    c.style.width = `${r.width}px`; c.style.height = `${r.height}px`;
    document.body.appendChild(c); drag.clone = c;
    drag.card.classList.add("ghosted");
    document.body.classList.add("dragging");
    placeClone(true);
    autoScroll();
  }
  function placeClone(first) {
    if (!drag.clone) return;
    const t = `translate(${drag.x - drag.offX}px, ${drag.y - drag.offY}px) rotate(${first ? 0 : 2}deg) scale(${first ? 1 : 1.04})`;
    if (first && !reduced.matches) {
      drag.clone.style.transform = `translate(${drag.x - drag.offX}px, ${drag.y - drag.offY}px)`;
      drag.clone.animate([{ transform: drag.clone.style.transform }, { transform: `translate(${drag.x - drag.offX}px, ${drag.y - drag.offY}px) rotate(2deg) scale(1.04)` }], { duration: 160, easing: "ease-out" });
    }
    drag.clone.style.transform = t.replace(/rotate\(0deg\) scale\(1\)/, "rotate(2deg) scale(1.04)");
  }
  function hitTest() {
    const el = document.elementFromPoint(drag.x, drag.y);
    const day = el?.closest?.("#days .day") || null;
    if (day !== drag.over) { drag.over?.classList.remove("drop"); day?.classList.add("drop"); drag.over = day; }
  }
  function autoScroll() {
    cancelAnimationFrame(drag.raf);
    const step = () => {
      if (!drag.active) return;
      const edge = 90, bottomEdge = innerHeight - (phoneMQ.matches || innerWidth < 900 ? 150 : 90);
      let v = 0;
      if (drag.y < edge) v = -Math.ceil((edge - drag.y) / 6);
      else if (drag.y > bottomEdge) v = Math.ceil((drag.y - bottomEdge) / 6);
      if (v) { window.scrollBy(0, v); hitTest(); }
      drag.raf = requestAnimationFrame(step);
    };
    drag.raf = requestAnimationFrame(step);
  }
  function onDragEnd(e) {
    if (e.pointerId !== drag.pid) return;
    if (!drag.active) return resetDrag();
    const day = drag.over, id = drag.id, card = drag.card, clone = drag.clone;
    const from = clone.getBoundingClientRect();
    swallowClick();
    const target = day ? Number(day.dataset.day) : null;
    const m = meals.find((x) => x.id === id);
    if (m && target !== null && target !== m.dayIndex) {
      clone.remove(); drag.clone = null;
      resetDrag();
      moveMeal(id, target, from);
    } else {
      const to = card.getBoundingClientRect();
      if (reduced.matches) { clone.remove(); drag.clone = null; resetDrag(); return; }
      clone.animate([{ transform: clone.style.transform }, { transform: `translate(${to.left}px, ${to.top}px)` }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }).finished.finally(() => { clone.remove(); });
      drag.clone = null;
      setTimeout(() => card.classList.remove("ghosted"), 200);
      resetDrag(true);
    }
  }
  function onDragCancel(e) { if (e.pointerId === drag.pid) { drag.clone?.remove(); drag.clone = null; resetDrag(); } }
  function resetDrag(keepGhost) {
    clearTimeout(drag.timer); clearTimeout(drag.armTimer); cancelAnimationFrame(drag.raf);
    drag.card?.classList.remove("arming");
    if (!keepGhost) drag.card?.classList.remove("ghosted");
    drag.over?.classList.remove("drop");
    document.body.classList.remove("dragging");
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", onDragCancel);
    Object.assign(drag, { card: null, id: null, active: false, over: null, pid: null });
  }
  function swallowClick() {
    const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 60);
  }

  // ---------- sheets ----------
  let openSheets = 0;
  function openSheet(d) {
    if (d.open && d.dataset.state !== "closing") return;
    if (!d.open) { d.showModal(); openSheets++; document.documentElement.style.overflow = "hidden"; }
    d.dataset.state = "";
    const panel = $(".panel", d); panel.style.transform = "";
    requestAnimationFrame(() => requestAnimationFrame(() => { d.dataset.state = "open"; }));
  }
  function closeSheet(d) {
    return new Promise((resolve) => {
      if (!d.open || d.dataset.state === "closing") return resolve();
      d.dataset.state = "closing";
      const panel = $(".panel", d); panel.style.transform = "";
      let done = false;
      const fin = () => {
        if (done) return; done = true;
        if (d.dataset.state === "closing") { d.close(); d.dataset.state = ""; }
        openSheets = Math.max(0, $$("dialog.sheet[open]").length);
        if (!openSheets) document.documentElement.style.overflow = "";
        resolve();
      };
      if (reduced.matches) return fin();
      panel.addEventListener("transitionend", (e) => { if (e.target === panel && e.propertyName === "transform") fin(); });
      setTimeout(fin, 460);
    });
  }
  for (const d of $$("dialog.sheet")) {
    d.addEventListener("cancel", (e) => { e.preventDefault(); closeSheet(d); });
    d.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(d); });
    // Pull the sheet down by its handle to close it (phones).
    const panel = $(".panel", d), grab = $(".grab", d);
    let sy = 0, dy = 0, t0 = 0, on = false;
    grab.addEventListener("pointerdown", (e) => { if (!phoneMQ.matches) return; on = true; sy = e.clientY; dy = 0; t0 = performance.now(); grab.setPointerCapture(e.pointerId); panel.style.transition = "none"; });
    grab.addEventListener("pointermove", (e) => { if (!on) return; dy = Math.max(0, e.clientY - sy); panel.style.transform = `translateY(${dy}px)`; });
    const end = () => {
      if (!on) return; on = false; panel.style.transition = "";
      const v = dy / Math.max(1, performance.now() - t0);
      if (dy > 110 || (dy > 30 && v > 0.6)) closeSheet(d); else panel.style.transform = "";
    };
    grab.addEventListener("pointerup", end); grab.addEventListener("pointercancel", end);
  }
  function confirmSheet(title, text, ok = "Remove") {
    return new Promise((resolve) => {
      const d = $("#confirm"); let yes = false;
      $("#cTitle").textContent = title; $("#cText").textContent = text; $("#cOk").textContent = ok;
      $("#cOk").onclick = () => { yes = true; closeSheet(d); };
      d.addEventListener("close", () => resolve(yes), { once: true });
      openSheet(d);
    });
  }

  // ---------- recipe text: facts, ingredients, method ----------
  function headingOf(l) {
    let m = /^#{1,4}\s+(.+)$/.exec(l); if (m) return m[1].replace(/[*_]/g, "").trim();
    if (/^(INGREDIENTS|METHOD|[A-Z][A-Z \-&]{3,})$/.test(l)) return l;
    m = /^\**(ingredients|method|instructions|directions|steps|preparation)\**\s*:?$/i.exec(l); if (m) return m[1];
    return null;
  }
  function parseCopy(text) {
    const out = { intro: [], facts: [], ings: [], steps: [], extra: [] };
    let sec = "intro";
    for (const raw of String(text || "").split("\n")) {
      const l = raw.trim(); if (!l) continue;
      const h = headingOf(l);
      if (h !== null) {
        sec = /ingredient/i.test(h) ? "ings" : /method|instruction|direction|step|preparation|how to/i.test(h) ? "method" : "other";
        if (sec === "other") out.extra.push({ h: h.charAt(0) + h.slice(1).toLowerCase(), lines: [] });
        continue;
      }
      if (!out.facts.length && /^(serves|makes|yield|prep|cook|total|time)\b[^:]{0,20}:/i.test(l)) {
        const f = l.split(/\s*[·|]\s*/).map((s) => { const i = s.indexOf(":"); return i > 0 ? { k: s.slice(0, i).trim(), v: s.slice(i + 1).trim() } : null; }).filter((x) => x && x.v);
        if (f.length) { out.facts = f; continue; }
      }
      const b = /^[-*•]\s+(.*)$/.exec(l), n = /^\d+[.)]\s+(.*)$/.exec(l);
      if (sec === "other") { out.extra.at(-1).lines.push(b ? b[1] : n ? n[1] : l); continue; }
      if (b) { (sec === "method" ? out.steps : out.ings).push(b[1]); continue; }
      if (n) { (sec === "ings" ? out.ings : out.steps).push(n[1]); continue; }
      if (sec === "intro") out.intro.push(l);
      else if (sec === "method") out.steps.push(l);
      else out.ings.push(l);
    }
    return out;
  }

  // ---------- the detail sheet: one meal or recipe, opened ----------
  const detail = $("#detail");
  let sheetCtx = null; // { kind: "meal", mealId } | { kind: "mine", id } | { kind: "shared", sid }
  function findShared(sid) { const [o, id] = String(sid).split("/"); return shared.find((r) => r.ownerId === o && r.id === id); }
  function sheetData() {
    if (!sheetCtx) return null;
    if (sheetCtx.kind === "meal") { const m = meals.find((x) => x.id === sheetCtx.mealId); return m ? { meal: m, recipe: boxFor(m), title: m.title, url: m.url } : null; }
    const r = sheetCtx.kind === "mine" ? recipes.find((x) => x.id === sheetCtx.id) : findShared(sheetCtx.sid);
    return r ? { recipe: r, title: r.title, url: r.url } : null;
  }
  let tickKey = "", stepKey = "";
  const loadSet = (k) => { try { return new Set(JSON.parse(recall(k) || "[]")); } catch { return new Set(); } };
  const saveSet = (k, s) => store(k, s.size ? JSON.stringify([...s]) : undefined);
  function renderDetail() {
    const d = sheetData(); if (!d) { closeSheet(detail); return; }
    const { meal, recipe, title, url } = d;
    const hero = $("#dHero");
    hero.classList.toggle("nopic", !recipe?.hasImage);
    hero.innerHTML = recipe?.hasImage ? imgTag(imgSrc(recipe), false) : ph(title);
    $(".grab", detail).classList.toggle("onhero", !!recipe?.hasImage);
    let eyebrow;
    if (meal) eyebrow = `${DAY_NAMES[meal.dayIndex]} ${shortDate(addDays(parseIso(meal.week), meal.dayIndex))} · ${SLOT_LABEL[meal.slot] || "Dinner"}`;
    else if (sheetCtx.kind === "shared") eyebrow = `Shared by ${recipe.ownerName}`;
    else eyebrow = recipe.timesPlanned ? `Recipe box · planned ${recipe.timesPlanned === 1 ? "once" : `${recipe.timesPlanned} times`}` : "Recipe box";
    $("#dEyebrow").textContent = eyebrow;
    $("#dTitle").textContent = title;
    const site = $("#dSite"); site.hidden = !url;
    if (url) { site.href = url; site.innerHTML = `${esc(siteOf(url))}${icon("external")}`; }
    const ext = url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${icon("external")}Original</a>` : "";
    $("#dActs").innerHTML = meal
      ? `<button type="button" class="btn ${meal.cooked ? "herb" : "primary"}" data-dcook aria-pressed="${!!meal.cooked}">${icon("check")}${meal.cooked ? "Cooked" : "Mark as cooked"}</button>${ext}<button type="button" class="btn ghost" data-dedit>${icon("edit")}Edit</button>`
      : sheetCtx.kind === "mine"
        ? `<button type="button" class="btn primary" data-dplan>${icon("calplus")}Plan it</button>${ext}<button type="button" class="btn ghost" data-dedit>${icon("edit")}Edit</button>`
        : `<button type="button" class="btn primary" data-dplan>${icon("calplus")}Plan it</button><button type="button" class="btn" data-dcopy>${icon("plus")}Add to my box</button>${ext}`;
    $("#dMove").hidden = !meal;
    if (meal) {
      const ti = parseIso(meal.week).getTime() === mondayOf(new Date()).getTime() ? (new Date().getDay() + 6) % 7 : -1;
      $("#dMoveChips").innerHTML = DAY_NAMES.map((n, i) => `<button type="button" class="mc${i === ti ? " today" : ""}" data-move="${i}" aria-pressed="${meal.dayIndex === i}" aria-label="${n}"><small>${n.slice(0, 3)}</small><b>${addDays(parseIso(meal.week), i).getDate()}</b></button>`).join("");
    }
    renderDetailKids();
    const notes = [meal?.notes, recipe?.notes].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join("\n\n");
    $("#dNotes").hidden = !notes; $("#dNotes").textContent = notes;
    const owner = recipe ? (recipe.ownerId || "me") : "";
    tickKey = recipe ? `wt-ticks:${owner}:${recipe.id}` : ""; stepKey = recipe ? `wt-steps:${owner}:${recipe.id}` : "";
    $("#dRecipe").innerHTML = recipeHtml(recipe, url);
    applyTicks();
  }
  function recipeHtml(recipe, url) {
    if (!recipe?.copyText) return `<p class="hint">${url ? "No saved copy of this recipe yet. Open the original, or edit to fetch it from the link." : "No recipe text saved yet. Edit to paste it in."}</p>`;
    const p = parseCopy(recipe.copyText);
    const facts = p.facts.length ? `<div class="facts">${p.facts.map((f) => `<div class="fact"><small>${esc(f.k)}</small><b>${esc(f.v)}</b></div>`).join("")}</div>` : "";
    const intro = p.intro.length ? `<p class="intro">${esc(p.intro.join(" "))}</p>` : "";
    const wake = "wakeLock" in navigator ? `<label class="switch"><input type="checkbox" id="wakeT"${wakeLock ? " checked" : ""}> Keep screen on</label>` : "";
    const extra = p.extra.filter((x) => x.lines.length).map((x) => `<div class="extra"><p class="colhead"><span class="ct">${esc(x.h)}</span></p>${x.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div>`).join("");
    if (!p.ings.length && !p.steps.length) return `<div class="dsec"><div class="sechead"><h3>Recipe</h3>${wake}</div><div style="display:flex;flex-direction:column;gap:12px">${facts}${intro}${extra}</div></div>`;
    const ings = p.ings.map((t, i) => /:$/.test(t) && t.length < 60
      ? `<li class="colhead" style="margin:10px 0 2px"><span>${esc(t.replace(/:$/, ""))}</span></li>`
      : `<li><label class="tick"><input type="checkbox" data-ing="${i}"><span>${esc(t)}</span></label></li>`).join("");
    const steps = p.steps.map((t, i) => `<li data-step="${i}"><span>${esc(t)}</span></li>`).join("");
    return `<div class="dsec">
      <div class="sechead"><h3>Recipe</h3>${wake}</div>
      <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:${facts || intro ? 18 : 0}px">${facts}${intro}</div>
      <div class="recipe" data-tab="ings">
        ${p.ings.length && p.steps.length ? `<div class="seg rtabs" role="group" aria-label="Recipe part"><button type="button" data-rtab="ings" aria-pressed="true">Ingredients<span class="n">${p.ings.length}</span></button><button type="button" data-rtab="method" aria-pressed="false">Method<span class="n">${p.steps.length}</span></button></div>` : ""}
        ${p.ings.length ? `<div class="rings"><p class="colhead"><span class="ct">Ingredients</span><button type="button" class="linkbtn" data-untick hidden>Untick all</button></p><ul class="ings">${ings}</ul></div>` : ""}
        ${p.steps.length ? `<div class="rmethod"><p class="colhead"><span class="ct">Method</span></p><ol class="method">${steps}</ol></div>` : ""}
      </div>
      ${extra}
    </div>`;
  }
  function applyTicks() {
    const ticked = loadSet(tickKey), done = loadSet(stepKey);
    for (const b of $$("#dRecipe input[data-ing]")) { b.checked = ticked.has(Number(b.dataset.ing)); b.closest(".tick").classList.toggle("done", b.checked); }
    for (const li of $$("#dRecipe [data-step]")) li.classList.toggle("done", done.has(Number(li.dataset.step)));
    const u = $("#dRecipe [data-untick]"); if (u) u.hidden = ticked.size === 0 && done.size === 0;
  }
  function renderDetailKids() {
    const d = sheetData(); if (!d) return;
    $("#dKidsTitle").textContent = d.meal?.cooked ? "Did the kids like it?" : "What do the kids think?";
    $("#dKidsSetup").textContent = kids.length ? "Edit kids" : "Add their names";
    $("#dKidRows").innerHTML = kidRows(dishKey(d));
  }
  function flashKids() {
    const b = $("#dKids"); b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash");
    b.scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth", block: "center" });
  }
  function openDetail(ctx, focusKids = false) {
    sheetCtx = ctx; renderDetail();
    if (!sheetData()) return;
    $("#dScroll").scrollTop = 0;
    openSheet(detail);
    if (focusKids) setTimeout(flashKids, 380);
  }
  detail.addEventListener("close", () => { sheetCtx = null; if (wakeLock) setWake(false); });
  detail.addEventListener("change", async (e) => {
    const b = e.target.closest("input[data-ing]");
    if (b) { const t = loadSet(tickKey); b.checked ? t.add(Number(b.dataset.ing)) : t.delete(Number(b.dataset.ing)); saveSet(tickKey, t); applyTicks(); return; }
    if (e.target.id === "wakeT") setWake(e.target.checked);
  });
  detail.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-face],[data-dcook],[data-dedit],[data-dplan],[data-dcopy],[data-move],[data-rtab],[data-untick],[data-step],#dKidsSetup"); if (!t) return;
    const d = sheetData(); if (!d) return;
    const ds = t.dataset;
    if (ds.face !== undefined) return setRating(ds.key, ds.kid, Number(ds.face), d.title);
    if (ds.step !== undefined) { const s = loadSet(stepKey), i = Number(ds.step); s.has(i) ? s.delete(i) : s.add(i); saveSet(stepKey, s); applyTicks(); return; }
    if (ds.rtab) { const rc = t.closest(".recipe"); rc.dataset.tab = ds.rtab; for (const b of $$("[data-rtab]", rc)) b.setAttribute("aria-pressed", String(b === t)); return; }
    if (ds.untick !== undefined) { store(tickKey, undefined); store(stepKey, undefined); applyTicks(); return; }
    if (t.id === "dKidsSetup") { await closeSheet(detail); return openKids(); }
    if (ds.dcook !== undefined) return toggleCooked(d.meal.id);
    if (ds.move !== undefined) return moveMeal(d.meal.id, Number(ds.move));
    if (ds.dedit !== undefined) { closeSheet(detail); return d.meal ? openAdd({ meal: d.meal }) : openRecipeForm(d.recipe); }
    if (ds.dplan !== undefined) {
      closeSheet(detail);
      if (sheetCtx?.kind === "shared" || d.recipe.ownerId) { try { openAdd({ recipe: await copyShared(d.recipe) }); } catch (ex) { toast(ex.message); } }
      else openAdd({ recipe: d.recipe });
      return;
    }
    if (ds.dcopy !== undefined) { try { await copyShared(d.recipe); toast("Added to your recipe box"); } catch (ex) { toast(ex.message); } }
  });
  // Keep the screen awake while cooking.
  let wakeLock = null;
  async function setWake(on) {
    try {
      if (on) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); toast("The screen stays on while this recipe is open"); }
      else { const w = wakeLock; wakeLock = null; await w?.release(); }
    } catch { wakeLock = null; const t = $("#wakeT"); if (t) t.checked = false; if (on) toast("Couldn't keep the screen on here"); }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && detail.open && $("#wakeT")?.checked && !wakeLock) setWake(true); });

  async function copyShared(r) {
    const d = await call("POST", `/api/shared/${encodeURIComponent(r.ownerId)}/${encodeURIComponent(r.id)}/copy`);
    await loadRecipes();
    return d.recipe;
  }

  // ---------- add or edit a meal ----------
  const addSheet = $("#addSheet");
  let add = {};
  const desktopFocus = (el) => { if (hoverMQ.matches && !phoneMQ.matches) setTimeout(() => el.focus(), 60); };
  function defaultDay() { const ti = todayIndex(); return ti >= 0 ? ti : 0; }
  function openAdd({ meal = null, dayIndex = null, recipe = null, slot = null } = {}) {
    add = { meal, recipe: meal ? boxFor(meal) : recipe, link: null, dayIndex: meal ? meal.dayIndex : (dayIndex ?? defaultDay()), slot: meal?.slot || slot || "dinner" };
    $("#addQ").value = "";
    $("#addTitle").textContent = dayIndex !== null && dayIndex !== undefined ? `Plan ${dayIndex === todayIndex() ? "for today" : DAY_NAMES[dayIndex]}` : "Add a meal";
    $("#formErr").hidden = true;
    if (meal || recipe) {
      fillStep2({ title: meal?.title || recipe.title, url: meal ? meal.url : recipe.url, copy: add.recipe?.copyText || "", notes: meal?.notes || "" });
      showStep(2, false);
    } else {
      renderAddList();
      showStep(1, false);
      desktopFocus($("#addQ"));
    }
    openSheet(addSheet);
  }
  function showStep(n, animate = true) {
    const s1 = $("#step1"), s2 = $("#step2");
    if (!animate) { s1.style.transition = s2.style.transition = "none"; requestAnimationFrame(() => { s1.style.transition = s2.style.transition = ""; }); }
    s1.setAttribute("aria-hidden", String(n !== 1)); s2.setAttribute("aria-hidden", String(n !== 2));
    s1.inert = n !== 1; s2.inert = n !== 2;
  }
  function pickRow(r) {
    const key = dishKey(r), meta = [r.url ? esc(r.site || siteOf(r.url)) : "Your own recipe", r.timesPlanned ? `planned ${r.timesPlanned}×` : ""].filter(Boolean).join(" · ");
    return `<button type="button" class="pick" data-pick="${esc(r.id)}"><span class="pt">${picFor(r, r.title)}</span><span class="pn"><b>${esc(r.title)}</b><small>${meta}</small></span>${facesMini(key)}<span class="go">${icon("right")}</span></button>`;
  }
  function renderAddList() {
    const q = $("#addQ").value.trim(), list = $("#addList");
    if (q && looksLikeUrl(q)) return renderLinkCard(normalizeUrl(q));
    add.link = null;
    const ql = q.toLowerCase();
    let html = "";
    if (q) {
      const hits = recipes.filter(matchQ(ql)).sort((a, b) => favScore(dishKey(b)) - favScore(dishKey(a)) || a.title.localeCompare(b.title)).slice(0, 40);
      if (hits.length) html += `<p class="picksec">From your recipe box</p>` + hits.map(pickRow).join("");
      if (!hits.some((r) => normTitle(r.title) === normTitle(q))) html += `<p class="picksec">Something new</p><button type="button" class="pick new" data-newname><span class="pt">${icon("plus")}</span><span class="pn"><b>Add “${esc(q)}”</b><small>A meal without a link. You can add one later.</small></span><span class="go">${icon("right")}</span></button>`;
    } else if (recipes.length) {
      const favs = recipes.filter((r) => verdict(dishKey(r)) === "fav").sort((a, b) => favScore(dishKey(b)) - favScore(dishKey(a))).slice(0, 6);
      const recent = recipes.filter((r) => !favs.includes(r) && r.lastPlanned).sort((a, b) => b.lastPlanned - a.lastPlanned).slice(0, 6);
      const rest = recipes.filter((r) => !favs.includes(r) && !recent.includes(r)).sort((a, b) => a.title.localeCompare(b.title));
      if (favs.length) html += `<p class="picksec">${face(1)}Kid favourites</p>` + favs.map(pickRow).join("");
      if (recent.length) html += `<p class="picksec">Recently planned</p>` + recent.map(pickRow).join("");
      if (rest.length) html += `<p class="picksec">${favs.length || recent.length ? "Everything else" : "Your recipe box"}</p>` + rest.map(pickRow).join("");
    } else {
      html = `<div class="nothing" style="padding:28px 12px">${PLATE}<strong>Your first meal</strong>Paste a link from any recipe site above, or type the name of a meal you know by heart.</div>`;
    }
    list.innerHTML = html;
  }
  function renderLinkCard(url) {
    const list = $("#addList");
    if (!url) { list.innerHTML = `<p class="hint err" style="padding:8px">That link doesn't look right. Copy it again from the address bar.</p>`; return; }
    const existing = recipes.find((r) => r.id === recipeId(url));
    if (existing) { add.link = null; list.innerHTML = `<p class="picksec">Already in your recipe box</p>` + pickRow(existing); return; }
    if (add.link?.url !== url) { add.link = { url, status: "busy", r: null }; fetchLink(url); }
    const L = add.link, r = L.r;
    const name = r?.title || titleFromUrl(url) || siteOf(url);
    let status;
    if (L.status === "busy") status = `<span class="status busy">Reading the recipe…</span>`;
    else if (r?.text) status = `<span class="status ok">${icon("check")}${r.structured ? `Saved a copy: ${plural(r.ingredients, "ingredient")}, ${plural(r.steps, "step")}` : "Saved the page text"}</span>`;
    else status = `<span class="status">Couldn't read this website automatically. You can still add it and paste the recipe in later.</span>`;
    list.innerHTML = `<div class="linkcard">${r?.image ? `<div class="lpic"><img class="fade" src="${esc(r.image)}" alt="" referrerpolicy="no-referrer"></div>` : ""}<div class="lb"><small class="hint">${esc(siteOf(url))}</small><b>${esc(name)}</b>${status}<div style="margin-top:4px"><button type="button" class="btn primary" data-linknext${L.status === "busy" ? " disabled" : ""}>Choose a day${icon("right")}</button></div></div></div>`;
  }
  async function fetchLink(url) {
    let r = null;
    try { r = (await call("POST", "/api/fetch-recipe", { url })).recipe; } catch (e) { console.error(e); }
    if (add.link?.url !== url) return;
    add.link.r = r; add.link.status = r ? "done" : "fail";
    if ($("#step2").getAttribute("aria-hidden") === "true" && addSheet.open) renderAddList();
  }
  $("#addQ").addEventListener("input", renderAddList);
  $("#addQ").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const first = $("#addList [data-linknext]:not([disabled]), #addList [data-pick], #addList [data-newname]");
    first?.click();
  });
  $("#addList").addEventListener("click", (e) => {
    const t = e.target.closest("[data-pick],[data-newname],[data-linknext]"); if (!t) return;
    if (t.dataset.pick) {
      const r = recipes.find((x) => x.id === t.dataset.pick); if (!r) return;
      add.recipe = r; add.link = null;
      fillStep2({ title: r.title, url: r.url, copy: r.copyText || "", notes: "" });
    } else if (t.dataset.newname !== undefined) {
      add.recipe = null; add.link = null;
      fillStep2({ title: $("#addQ").value.trim(), url: "", copy: "", notes: "" });
    } else {
      const L = add.link; if (!L) return;
      add.recipe = null;
      fillStep2({ title: L.r?.title || titleFromUrl(L.url) || "", url: L.url, copy: L.r?.text || "", notes: "" });
    }
    showStep(2);
  });
  $("#addBack").addEventListener("click", () => { if (add.meal) return closeSheet(addSheet); showStep(1); renderAddList(); });
  function fillStep2({ title, url, copy, notes }) {
    const r = add.recipe, L = add.link;
    const pic = r?.hasImage ? imgTag(imgSrc(r), false) : L?.r?.image ? `<img class="fade" src="${esc(L.r.image)}" alt="" referrerpolicy="no-referrer">` : ph(title || "new");
    $("#chosen").innerHTML = `<span class="pt">${pic}</span><span class="cn"><input class="input" id="fTitle" value="${esc(title)}" maxlength="120" aria-label="Name of the meal" placeholder="Name of the meal"><small>${url ? esc(siteOf(url)) : "Your own recipe"}</small></span>`;
    $("#fUrl").value = url || "";
    $("#fCopy").value = copy || "";
    $("#fNotes").value = notes || "";
    $("#fStatus").textContent = ""; $("#fStatus").className = "status";
    $("#fMore").open = false;
    $("#step2Title").textContent = add.meal ? "Edit meal" : "When?";
    $("#addBack").hidden = false;
    $("#deleteBtn").hidden = !add.meal;
    $("#formErr").hidden = true;
    renderDayPick(); renderSlotPick();
    if (add.meal) $("#dayLabel").textContent = "Day";
  }
  function renderDayPick() {
    const ti = todayIndex(), wk = add.meal ? parseIso(add.meal.week) : weekStart;
    $("#dayPick").innerHTML = DAY_NAMES.map((n, i) => `<button type="button" class="mc${i === ti && !add.meal ? " today" : ""}" data-day="${i}" aria-pressed="${add.dayIndex === i}" aria-label="${n}"><small>${n.slice(0, 3)}</small><b>${addDays(wk, i).getDate()}</b></button>`).join("");
    $("#saveBtn").textContent = add.meal ? "Save" : `Add to ${add.dayIndex === ti ? "today" : DAY_NAMES[add.dayIndex]}`;
  }
  function renderSlotPick() {
    $("#slotPick").innerHTML = SLOTS.map((s) => `<button type="button" class="chip" style="--c:var(--s-${s})" data-slot="${s}" aria-pressed="${add.slot === s}">${SLOT_LABEL[s]}</button>`).join("");
  }
  $("#dayPick").addEventListener("click", (e) => { const b = e.target.closest("[data-day]"); if (!b) return; add.dayIndex = Number(b.dataset.day); haptic(); renderDayPick(); });
  $("#slotPick").addEventListener("click", (e) => { const b = e.target.closest("[data-slot]"); if (!b) return; add.slot = b.dataset.slot; haptic(); renderSlotPick(); });
  // Changing the link while editing fetches a fresh copy of the recipe.
  $("#fUrl").addEventListener("change", async () => {
    const url = normalizeUrl($("#fUrl").value), st = $("#fStatus");
    if (!url) { st.textContent = ""; return; }
    st.className = "status busy"; st.textContent = "Reading the recipe…";
    try {
      const { recipe: r } = await call("POST", "/api/fetch-recipe", { url });
      if (normalizeUrl($("#fUrl").value) !== url) return;
      add.link = { url, status: r ? "done" : "fail", r };
      if (r?.text) { $("#fCopy").value = r.text; st.className = "status ok"; st.innerHTML = `${icon("check")}Saved a fresh copy`; }
      else { st.className = "status"; st.textContent = "Couldn't read this website automatically. You can paste the recipe in below."; }
      const ti = $("#fTitle"); if (r?.title && (!ti.value.trim() || ti.value.trim() === titleFromUrl(url))) ti.value = r.title;
    } catch { st.className = "status"; st.textContent = "Couldn't read this website automatically."; }
  });
  $("#addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#formErr"); err.hidden = true;
    const url = normalizeUrl($("#fUrl").value);
    if (url === null) { err.textContent = "That link doesn't look right. Copy it again from the address bar."; err.hidden = false; $("#fMore").open = true; return; }
    const title = $("#fTitle").value.trim();
    if (!title) { err.textContent = "Give the meal a name."; err.hidden = false; $("#fTitle").focus(); return; }
    const editing = add.meal;
    const m = editing || { id: newId(), cooked: false, createdAt: Date.now(), week: curIso() };
    const data = { ...mealBody({ ...m, title, url: url || "", site: url ? siteOf(url) : "", dayIndex: add.dayIndex, slot: add.slot, notes: $("#fNotes").value.trim() }) };
    const copy = $("#fCopy").value.trim();
    $("#saveBtn").disabled = true;
    try {
      if (url) {
        const rid = recipeId(url), prev = recipes.find((r) => r.id === rid);
        await call("PUT", `/api/recipes/${rid}`, { title: prev?.title || title, url, site: data.site, notes: prev?.notes || "", copyText: copy || prev?.copyText || "", imageUrl: add.link?.url === url ? (add.link.r?.image || "") : "", shared: prev ? prev.shared : true, addedAt: prev?.addedAt || Date.now(), lastPlanned: Date.now(), timesPlanned: (prev?.timesPlanned || 0) + (editing ? 0 : 1) });
      } else if (add.recipe && !editing) {
        const prev = add.recipe;
        await call("PUT", `/api/recipes/${prev.id}`, { ...prev, copyText: copy || prev.copyText || "", lastPlanned: Date.now(), timesPlanned: (prev.timesPlanned || 0) + 1 });
      }
      await call("PUT", `/api/meals/${m.id}`, data);
      Object.assign(m, data);
      if (!editing && m.week === curIso()) meals.push(m);
      await closeSheet(addSheet);
      renderWeek();
      if (editing) toast("Saved");
      else toast(`Added to ${m.dayIndex === todayIndex() ? "today" : DAY_NAMES[m.dayIndex]}`, { label: "Undo", run: () => deleteMeal(m) });
      loadRecipes(); loadWeek();
    } catch (ex) { console.error(ex); err.textContent = ex.message; err.hidden = false; }
    finally { $("#saveBtn").disabled = false; }
  });
  $("#deleteBtn").addEventListener("click", async () => { const m = add.meal; if (!m) return; await closeSheet(addSheet); deleteMeal(m); });

  // ---------- add or edit a recipe in the box ----------
  const recipeSheet = $("#recipeSheet");
  let editingRecipe = null, rLink = null, rTimer = 0;
  function openRecipeForm(recipe = null) {
    editingRecipe = recipe; rLink = null;
    $("#rTitleH").textContent = recipe ? "Edit recipe" : "Add a recipe";
    $("#rUrl").value = recipe?.url || "";
    $("#rTitle").value = recipe?.title || "";
    $("#rNotes").value = recipe?.notes || "";
    $("#rCopy").value = recipe?.copyText || "";
    $("#rShared").checked = recipe ? !!recipe.shared : true;
    $("#rMore").open = !!recipe && !recipe.url;
    $("#rStatus").textContent = ""; $("#rStatus").className = "status";
    $("#rPreview").innerHTML = recipe?.hasImage ? `<div class="linkcard" style="animation:none"><div class="lpic">${imgTag(imgSrc(recipe), false)}</div></div>` : "";
    $("#rDeleteBtn").hidden = !recipe;
    $("#rformErr").hidden = true;
    openSheet(recipeSheet);
    if (!recipe) desktopFocus($("#rUrl"));
    if (recipe?.url && (!recipe.copyText || !recipe.hasImage)) rFetch(true);
  }
  async function rFetch(force = false) {
    const url = normalizeUrl($("#rUrl").value), st = $("#rStatus");
    if (!url) { st.textContent = ""; return; }
    if (!force && rLink?.url === url) return;
    rLink = { url, r: null };
    st.className = "status busy"; st.textContent = "Reading the recipe…"; $("#rFetchBtn").disabled = true;
    try {
      const { recipe: r } = await call("POST", "/api/fetch-recipe", { url });
      if (normalizeUrl($("#rUrl").value) !== url) return;
      rLink.r = r;
      if (!r) { st.className = "status"; st.textContent = "Couldn't read this website automatically. You can paste the recipe in below."; return; }
      if (r.image) $("#rPreview").innerHTML = `<div class="linkcard"><div class="lpic"><img class="fade" src="${esc(r.image)}" alt="" referrerpolicy="no-referrer"></div></div>`;
      if (r.text && (force || !$("#rCopy").value.trim())) $("#rCopy").value = r.text;
      const ti = $("#rTitle"); if (r.title && (!ti.value.trim() || ti.value.trim() === titleFromUrl(url))) ti.value = r.title;
      if (r.text) { st.className = "status ok"; st.innerHTML = `${icon("check")}${r.structured ? `Saved a copy: ${plural(r.ingredients, "ingredient")}, ${plural(r.steps, "step")}` : "Saved the page text. Tidy it up if you like."}`; }
      else { st.className = "status"; st.textContent = r.image ? "Saved the picture, but couldn't read the recipe text." : "Couldn't read this website automatically."; }
    } catch (e) { console.error(e); st.className = "status"; st.textContent = "Couldn't read this website automatically. You can paste the recipe in below."; }
    finally { $("#rFetchBtn").disabled = false; }
  }
  $("#rUrl").addEventListener("input", () => {
    const u = normalizeUrl($("#rUrl").value);
    if (u && !$("#rTitle").value.trim()) { const t = titleFromUrl(u); if (t) $("#rTitle").value = t; }
    clearTimeout(rTimer); rTimer = setTimeout(() => rFetch(false), 600);
  });
  $("#rFetchBtn").addEventListener("click", () => rFetch(true));
  $("#rform").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#rformErr"); err.hidden = true;
    const url = normalizeUrl($("#rUrl").value);
    if (url === null) { err.textContent = "That link doesn't look right. Copy it again from the address bar."; err.hidden = false; return; }
    const title = $("#rTitle").value.trim();
    if (!title) { err.textContent = "Give the recipe a name."; err.hidden = false; $("#rTitle").focus(); return; }
    const id = url ? recipeId(url) : (editingRecipe?.id || "n" + newId());
    const prev = recipes.find((r) => r.id === id) || editingRecipe;
    $("#rSaveBtn").disabled = true;
    try {
      if (editingRecipe && editingRecipe.id !== id) await call("DELETE", `/api/recipes/${editingRecipe.id}`);
      await call("PUT", `/api/recipes/${id}`, { title, url: url || "", site: url ? siteOf(url) : "", notes: $("#rNotes").value.trim(), copyText: $("#rCopy").value.trim(), imageUrl: rLink?.url === url ? (rLink.r?.image || "") : "", shared: $("#rShared").checked, addedAt: prev?.addedAt || Date.now(), lastPlanned: prev?.lastPlanned || 0, timesPlanned: prev?.timesPlanned || 0 });
      await closeSheet(recipeSheet);
      toast(editingRecipe ? "Saved" : "Added to your recipe box");
      await loadRecipes(); loadShared();
    } catch (ex) { console.error(ex); err.textContent = ex.message; err.hidden = false; }
    finally { $("#rSaveBtn").disabled = false; }
  });
  $("#rDeleteBtn").addEventListener("click", async () => {
    const r = editingRecipe; if (!r) return;
    if (!(await confirmSheet(`Remove “${r.title}”?`, "It leaves your recipe box. Meals already planned stay where they are."))) return;
    try { await call("DELETE", `/api/recipes/${r.id}`); await closeSheet(recipeSheet); toast("Removed from your recipe box"); await loadRecipes(); loadShared(); }
    catch (ex) { console.error(ex); toast("Couldn't remove it. Try again."); }
  });
  $("#addRecipeBtn").addEventListener("click", () => openRecipeForm());

  // ---------- recipes view ----------
  const matchQ = (q) => (r) => !q || [r.title, r.site, r.notes, r.copyText, r.ownerName].some((v) => (v || "").toLowerCase().includes(q));
  const SORTS = {
    recent: (a, b) => (b.lastPlanned || b.addedAt || 0) - (a.lastPlanned || a.addedAt || 0),
    fav: (a, b) => favScore(dishKey(b)) - favScore(dishKey(a)) || (b.timesPlanned || 0) - (a.timesPlanned || 0),
    az: (a, b) => a.title.localeCompare(b.title),
    new: (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
  };
  function recipeCard(r, isShared) {
    const key = dishKey(r), sid = isShared ? `${r.ownerId}/${r.id}` : r.id;
    const meta = isShared
      ? [`From ${esc(r.ownerName)}`, r.url ? esc(r.site || siteOf(r.url)) : ""].filter(Boolean).join(" · ")
      : [r.url ? esc(r.site || siteOf(r.url)) : "Your own recipe", r.timesPlanned ? `planned ${r.timesPlanned}×` : ""].filter(Boolean).join(" · ");
    return `<article class="rcard" ${isShared ? `data-sopen="${esc(sid)}"` : `data-ropen="${esc(r.id)}"`} tabindex="0" aria-label="${esc(r.title)}">
      <div class="rimg">${picFor(r, r.title)}
        ${verdict(key) === "fav" ? `<span class="fav" title="Kid favourite">${face(1)}</span>` : ""}
        <span class="plan"><button type="button" class="iconbtn glass" ${isShared ? `data-splan="${esc(sid)}"` : `data-plan="${esc(r.id)}"`} aria-label="Plan ${esc(r.title)}" title="Plan it">${icon("calplus")}</button></span>
      </div>
      <div class="rb"><h3 class="rt">${esc(r.title)}</h3><span class="rm">${meta}</span>${ratingsFor(key).length ? `<div class="rk">${facesMini(key)}</div>` : ""}</div>
    </article>`;
  }
  function renderRecipes(animate = false) {
    if (!user) return;
    const q = ($("#search").value || "").trim().toLowerCase();
    $("#nMine").textContent = recipes.length ? ` ${recipes.length}` : "";
    $("#nEveryone").textContent = shared.length ? ` ${shared.length}` : "";
    for (const b of $$("[data-scope]")) b.setAttribute("aria-pressed", String(b.dataset.scope === scope));
    $("#recipesTitle").textContent = scope === "mine" ? "Your recipe box" : "Everyone's recipes";
    $("#search").placeholder = scope === "mine" ? "Search your recipes" : "Search everyone's recipes";
    $("#rfilters").hidden = scope !== "mine" || !recipes.length;
    const grid = $("#rgrid");
    grid.classList.toggle("stagger", animate);
    if (scope === "everyone") {
      const list = shared.filter(matchQ(q)).sort((a, b) => a.title.localeCompare(b.title));
      grid.innerHTML = list.length ? list.map((r) => recipeCard(r, true)).join("")
        : `<div class="nothing">${PLATE}<strong>${q ? "No matches" : "Nothing shared yet"}</strong>${q ? "No shared recipes match that search." : "Recipes the other members share will appear here."}</div>`;
      stagger(grid, animate);
      return;
    }
    const base = recipes.filter(matchQ(q));
    const counts = { all: base.length, fav: 0, new: 0, nope: 0 };
    for (const r of base) { const v = verdict(dishKey(r)); if (v in counts) counts[v]++; }
    const chip = (k, label) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${boxFilter === k}">${label}<span class="n">${counts[k]}</span></button>`;
    $("#chips").innerHTML = chip("all", "All") + chip("fav", `${face(1)}Kid favourites`) + chip("new", "Not rated yet") + chip("nope", `${face(-1)}Not a hit`);
    const list = base.filter((r) => boxFilter === "all" || verdict(dishKey(r)) === boxFilter).sort(SORTS[$("#boxSort").value] || SORTS.recent);
    let empty = "";
    if (!list.length) {
      empty = !recipes.length ? `<strong>Your recipe box is empty</strong>Add a recipe from any website, or plan a meal with a link and it lands here too.<div style="margin-top:16px"><button type="button" class="btn primary" data-act="newrecipe">${icon("plus")}Add a recipe</button></div>`
        : q ? `<strong>No matches</strong>No recipes match that search.`
        : boxFilter === "fav" ? `<strong>No kid favourites yet</strong>Open a recipe and tap the happy face when the kids love it.`
        : boxFilter === "nope" ? `<strong>Nothing the kids dislike</strong>Nice!` : `<strong>All rated</strong>Every recipe here has been rated.`;
    }
    grid.innerHTML = list.length ? list.map((r) => recipeCard(r, false)).join("") : `<div class="nothing">${PLATE}${empty}</div>`;
    stagger(grid, animate);
  }
  function stagger(grid, animate) {
    if (!animate) return;
    $$(":scope > *", grid).forEach((el, i) => { el.style.animationDelay = `${Math.min(i, 14) * 28}ms`; });
  }
  $("#chips").addEventListener("click", (e) => { const c = e.target.closest("[data-filter]"); if (!c) return; boxFilter = c.dataset.filter; renderRecipes(true); });
  $("#boxSort").addEventListener("change", () => { store("wt-sort", $("#boxSort").value); renderRecipes(true); });
  if (SORTS[recall("wt-sort")]) $("#boxSort").value = recall("wt-sort");
  $("#search").addEventListener("input", () => renderRecipes());
  for (const b of $$("[data-scope]")) b.addEventListener("click", () => { scope = b.dataset.scope; renderRecipes(true); });

  // ---------- shopping list ----------
  function ingredientsOf(text) {
    const p = parseCopy(text);
    return p.ings.filter((t) => !(/:$/.test(t) && t.length < 60));
  }
  let shopKey = "", shopGroups = [];
  const shopTicks = () => loadSet(shopKey);
  function renderShop(animate = false) {
    if (!user) return;
    shopKey = `wt-shop:${curIso()}`;
    $("#shopLabel").textContent = isThisWeek() ? "Shopping list · this week" : "Shopping list";
    $("#shopRange").textContent = weekRangeText(weekStart);
    const order = meals.filter((m) => !m.cooked).sort((a, b) => a.dayIndex - b.dayIndex || bySlot(a, b));
    const cookedCount = meals.length - order.length;
    const groups = new Map(), missing = [];
    for (const m of order) {
      const key = dishKey(m);
      if (groups.has(key)) { groups.get(key).days.push(m.dayIndex); continue; }
      const r = boxFor(m), ings = ingredientsOf(r?.copyText);
      if (!ings.length) { if (!missing.includes(m.title)) missing.push(m.title); continue; }
      groups.set(key, { key, title: m.title, r, days: [m.dayIndex], ings });
    }
    shopGroups = [...groups.values()];
    const ticks = shopTicks();
    const total = shopGroups.reduce((s, g) => s + g.ings.length, 0);
    const done = shopGroups.reduce((s, g) => s + g.ings.filter((_, i) => ticks.has(`${g.key}#${i}`)).length, 0);
    $("#shopSub").textContent = loadingWeek ? "" : !meals.length ? "Nothing planned for this week yet."
      : !order.length ? "Every meal this week is already cooked."
      : `Everything you need for the ${plural(order.length, "meal")} still to cook${cookedCount ? ` (${cookedCount} already cooked, left out)` : ""}.`;
    $("#shopBar").hidden = !shopGroups.length;
    $("#shopCount").textContent = `${done} of ${total} ticked off`;
    $("#shopProg").style.width = total ? `${Math.round((done / total) * 100)}%` : "0";
    $("#shopShare").innerHTML = `${icon(navigator.share ? "share" : "copy")}${navigator.share ? "Share" : "Copy"}`;
    const body = $("#shopBody");
    if (loadingWeek) { body.innerHTML = `<div class="sgroup skel" style="height:180px"></div>`; return; }
    if (!meals.length) { body.innerHTML = `<div class="card" style="align-items:center;text-align:center">${PLATE}<h2>Nothing to buy yet</h2><p>Plan a few meals and their ingredients gather here.</p><button type="button" class="btn primary" data-act="add">${icon("plus")}Add a meal</button></div>`; return; }
    body.classList.toggle("stagger", animate);
    body.innerHTML = shopGroups.map((g) => `<section class="sgroup">
        <div class="sh"><span class="th">${picFor(g.r, g.title)}</span><h3>${esc(g.title)}<small>${g.days.map((i) => DAY_NAMES[i]).join(", ")}</small></h3></div>
        <div>${g.ings.map((x, i) => { const id = `${g.key}#${i}`, on = ticks.has(id); return `<label class="tick${on ? " done" : ""}"><input type="checkbox" data-shop="${esc(id)}"${on ? " checked" : ""}><span>${esc(x)}</span></label>`; }).join("")}</div>
      </section>`).join("")
      + (missing.length ? `<p class="missing">No saved ingredients for ${missing.map((t) => `“${esc(t)}”`).join(", ")}. Check ${missing.length === 1 ? "that recipe" : "those recipes"} yourself.</p>` : "");
    stagger(body, animate);
  }
  $("#shopBody").addEventListener("change", (e) => {
    const b = e.target.closest("[data-shop]"); if (!b) return;
    const t = shopTicks(); b.checked ? t.add(b.dataset.shop) : t.delete(b.dataset.shop);
    saveSet(shopKey, t); haptic();
    b.closest(".tick").classList.toggle("done", b.checked);
    const total = shopGroups.reduce((s, g) => s + g.ings.length, 0);
    $("#shopCount").textContent = `${t.size} of ${total} ticked off`;
    $("#shopProg").style.width = total ? `${Math.round((t.size / total) * 100)}%` : "0";
  });
  $("#shopUntick").addEventListener("click", () => { store(shopKey, undefined); renderShop(); });
  $("#shopShare").addEventListener("click", async () => {
    const t = shopTicks();
    const text = shopGroups.map((g) => { const left = g.ings.filter((_, i) => !t.has(`${g.key}#${i}`)); return left.length ? `${g.title}\n${left.map((x) => `- ${x}`).join("\n")}` : ""; }).filter(Boolean).join("\n\n");
    if (!text) return toast("Everything is ticked off");
    if (navigator.share) { try { await navigator.share({ title: `Shopping list ${weekRangeText(weekStart)}`, text }); } catch {} return; }
    navigator.clipboard.writeText(text).then(() => toast("Shopping list copied"), () => toast("Couldn't copy. Try again."));
  });

  // ---------- family & settings ----------
  let kidDraft = [];
  function renderFamily() {
    if (!user) return;
    kidDraft = kids.map((k) => ({ ...k }));
    renderKidEditor();
    $("#setWho").innerHTML = `Signed in as <strong>${esc(user.name || user.email)}</strong>${user.name ? ` (${esc(user.email)})` : ""}`;
    renderInstall();
    loadKeys();
  }
  function renderKidEditor() {
    $("#kidList").innerHTML = kidDraft.length ? kidDraft.map((k, i) => `<div class="kidedit">
      <span class="kav" style="--h:${hueOf(k.id)}" aria-hidden="true">${esc(initial(k.name))}</span>
      <input class="input" type="text" value="${esc(k.name)}" data-kidname="${i}" maxlength="40" placeholder="Child's name" aria-label="Child's name" enterkeyhint="done">
      <button type="button" class="iconbtn ghost" data-kidrm="${i}" aria-label="Remove ${esc(k.name || "this child")}" title="Remove">${icon("trash")}</button>
    </div>`).join("") : `<p class="hint">No names yet.</p>`;
  }
  async function saveKids() {
    const next = kidDraft.map((k) => ({ id: k.id, name: k.name.trim() })).filter((k) => k.name);
    if (JSON.stringify(next) === JSON.stringify(kids)) return;
    try {
      kids = (await call("PUT", "/api/family", { kids: next })).kids;
      user.kids = kids;
      kidDraft = kids.map((k) => ({ ...k })).concat(kidDraft.filter((k) => !k.name.trim()));
      renderKidEditor(); toast("Saved");
      await loadRatings();
    } catch (e) { console.error(e); toast(e.message); }
  }
  function openKids() {
    location.hash = "#family";
    setTimeout(() => {
      if (!kidDraft.some((k) => !k.name.trim())) { kidDraft.push({ id: "k" + Math.random().toString(36).slice(2, 10), name: "" }); renderKidEditor(); }
      $$("#kidList input").find((i) => !i.value)?.focus();
    }, 80);
  }
  $("#addKid").addEventListener("click", () => {
    kidDraft.push({ id: "k" + Math.random().toString(36).slice(2, 10), name: "" });
    renderKidEditor(); $$("#kidList input").at(-1)?.focus();
  });
  $("#kidList").addEventListener("input", (e) => {
    const i = e.target.dataset.kidname; if (i === undefined) return;
    kidDraft[i].name = e.target.value;
    e.target.previousElementSibling.textContent = initial(e.target.value);
  });
  $("#kidList").addEventListener("change", (e) => { if (e.target.dataset.kidname !== undefined) saveKids(); });
  $("#kidList").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.kidname !== undefined) { e.preventDefault(); e.target.blur(); } });
  $("#kidList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-kidrm]"); if (!b) return;
    const k = kidDraft[b.dataset.kidrm];
    if (k.name.trim() && kids.some((x) => x.id === k.id) && !(await confirmSheet(`Remove ${k.name}?`, `Their meal ratings will be deleted too.`))) return;
    kidDraft.splice(kidDraft.indexOf(k), 1); renderKidEditor(); saveKids();
  });
  $("#signOutBtn").addEventListener("click", async () => { try { await call("POST", "/api/logout"); } catch {} user = null; showSignedOut(); });

  // Install as an app
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (view === "family") renderInstall(); });
  function renderInstall() {
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    $("#installCard").hidden = standalone || (!installEvt && !ios);
    $("#installText").textContent = installEvt ? "Install The Weekly Table to open it like an app, full screen, straight from your home screen."
      : "In Safari, tap the Share button, then “Add to Home Screen”. It then opens like an app, full screen.";
    $("#installBtn").hidden = !installEvt;
  }
  $("#installBtn").addEventListener("click", async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch {} installEvt = null; renderInstall(); });

  // Connection keys for Claude (MCP)
  async function loadKeys() {
    let keys = [];
    try { keys = (await call("GET", "/api/tokens")).tokens; } catch (e) { console.error(e); }
    const when = (t) => t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "never";
    $("#keys").innerHTML = keys.map((k) => `<div class="keyrow"><span class="meta"><strong>${esc(k.name)}</strong> · created ${when(k.createdAt)} · last used ${when(k.lastUsed)}</span><button type="button" class="iconbtn ghost" data-delkey="${esc(k.id)}" aria-label="Remove this key" title="Remove">${icon("trash")}</button></div>`).join("");
  }
  $("#newKeyBtn").addEventListener("click", async () => {
    const name = $("#keyName").value.trim() || "Claude Code";
    try {
      const d = await call("POST", "/api/tokens", { name });
      const cmd = `claude mcp add --transport http weekly-table ${location.origin}/mcp --header "Authorization: Bearer ${d.token}"`;
      $("#kKey").textContent = d.token; $("#kCmd").textContent = cmd;
      $("#kCopyKey").onclick = () => navigator.clipboard.writeText(d.token).then(() => toast("Key copied"));
      $("#kCopyCmd").onclick = () => navigator.clipboard.writeText(cmd).then(() => toast("Command copied"));
      openSheet($("#keySheet")); loadKeys();
    } catch (e) { console.error(e); toast(e.message); }
  });
  $("#keys").addEventListener("click", async (e) => {
    const t = e.target.closest("[data-delkey]"); if (!t) return;
    if (!(await confirmSheet("Remove this key?", "Anything using it, like Claude, stops working until you create a new one."))) return;
    try { await call("DELETE", `/api/tokens/${t.dataset.delkey}`); loadKeys(); toast("Key removed"); } catch (ex) { console.error(ex); toast(ex.message); }
  });

  // ---------- page-wide taps ----------
  document.addEventListener("click", async (e) => {
    if (e.composedPath().some((n) => n.tagName === "DIALOG")) return; // sheets handle their own taps (even after they redraw)
    const t = e.target.closest("[data-act],[data-add],[data-cook],[data-face],[data-open-meal],[data-quick],[data-plan],[data-splan],[data-ropen],[data-sopen],[data-jump],[data-week]");
    if (!t) { const card = e.target.closest(".meal:not(.sk)"); if (card) openDetail({ kind: "meal", mealId: card.dataset.meal }); return; }
    const ds = t.dataset;
    if (ds.act === "add") return openAdd();
    if (ds.act === "kids") return openKids();
    if (ds.act === "newrecipe") return openRecipeForm();
    if (ds.add !== undefined) return openAdd({ dayIndex: Number(ds.add), slot: ds.slot || null });
    if (ds.cook) return toggleCooked(ds.cook);
    if (ds.face !== undefined) { const m = meals.find((x) => dishKey(x) === ds.key); return setRating(ds.key, ds.kid, Number(ds.face), m?.title || ""); }
    if (ds.openMeal) return openDetail({ kind: "meal", mealId: ds.openMeal });
    if (ds.quick) { const r = recipes.find((x) => x.id === ds.quick); if (r) quickPlan(r, Number(ds.day)); return; }
    if (ds.plan) return openAdd({ recipe: recipes.find((r) => r.id === ds.plan) });
    if (ds.splan) { const r = findShared(ds.splan); if (!r) return; try { openAdd({ recipe: await copyShared(r) }); } catch (ex) { toast(ex.message); } return; }
    if (ds.ropen) return openDetail({ kind: "mine", id: ds.ropen });
    if (ds.sopen) return openDetail({ kind: "shared", sid: ds.sopen });
    if (ds.jump !== undefined) { $(`#day-${ds.jump}`)?.scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth", block: "start" }); return; }
    if (ds.week) goWeek(addDays(weekStart, 7 * Number(ds.week)), Number(ds.week));
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".meal, .rcard")) { e.preventDefault(); e.target.click(); }
  });
  // Glass edges once the page scrolls.
  const onScroll = () => {
    $("#topbar").classList.toggle("scrolled", scrollY > 4);
    const s = $("#strip"); if (s.offsetParent) s.classList.toggle("stuck", s.getBoundingClientRect().top <= 1 && scrollY > 40);
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  // ---------- sign in / sign up ----------
  let mode = "signin";
  function setMode(m) {
    mode = m;
    $("#nameField").hidden = m !== "signup";
    $("#authTitle").textContent = m === "signup" ? "Create your account" : "Welcome back";
    $("#authIntro").textContent = m === "signup" ? "Free. Your week is private. Recipes are shared with the other members unless you say otherwise." : "Sign in to see your week and your recipe box on any device.";
    $("#authSubmit").textContent = m === "signup" ? "Create account" : "Sign in";
    $("#switchRow").innerHTML = m === "signup" ? `Already have an account? <button type="button" class="linkbtn" id="toSignIn">Sign in</button>` : `New here? <button type="button" class="linkbtn" id="toSignUp">Create an account</button>`;
    $("#aPass").autocomplete = m === "signup" ? "new-password" : "current-password";
    $("#authErr").hidden = true;
  }
  $("#landing").addEventListener("click", (e) => { if (e.target.id === "toSignUp") setMode("signup"); if (e.target.id === "toSignIn") setMode("signin"); });
  $("#authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#authErr"); err.hidden = true;
    const email = $("#aEmail").value.trim(), password = $("#aPass").value;
    if (!email || !password) { err.textContent = "Fill in your email and password."; err.hidden = false; return; }
    $("#authSubmit").disabled = true;
    try {
      const d = await call("POST", mode === "signup" ? "/api/signup" : "/api/login", { email, password, name: $("#aName").value.trim() });
      showSignedIn(d.user);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    finally { $("#authSubmit").disabled = false; }
  });

  function showSignedIn(u) {
    user = u; kids = u.kids || [];
    $("#landing").hidden = true; $("#app").hidden = false;
    $("#meBtn").textContent = initial(u.name || u.email);
    weekStart = mondayOf(new Date()); meals = []; recipes = []; shared = []; ratings = {}; loadingWeek = true; weekCache.clear();
    view = ""; route();
    loadRecipes(); loadWeek(); loadShared(); loadRatings();
  }
  function showSignedOut() {
    for (const d of $$("dialog[open]")) d.close();
    document.documentElement.style.overflow = "";
    $("#landing").hidden = false; $("#app").hidden = true;
    $("#aPass").value = ""; setMode("signin");
  }

  hydrate();
  setMode("signin");
  call("GET", "/api/me").then((d) => (d.user ? showSignedIn(d.user) : showSignedOut())).catch(showSignedOut);
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
})();
