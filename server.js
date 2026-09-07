// The Weekly Table server: static site + JSON API + recipe reader.
// No dependencies beyond Node 24 (built-in sqlite, crypto, fetch).
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const SESSION_DAYS = 90;
const COOKIE = "wt_session";

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "weekly-table.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL DEFAULT '',
    pass_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS meals (
    user_id TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL DEFAULT '',
    site TEXT NOT NULL DEFAULT '', week TEXT NOT NULL, day_index INTEGER NOT NULL, slot TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '', cooked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, id));
  CREATE INDEX IF NOT EXISTS meals_week ON meals (user_id, week);
  CREATE TABLE IF NOT EXISTS recipes (
    user_id TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL DEFAULT '',
    site TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', copy_text TEXT NOT NULL DEFAULT '',
    added_at INTEGER NOT NULL, last_planned INTEGER NOT NULL DEFAULT 0, times_planned INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, id));
`);
for (const col of ["image_url TEXT NOT NULL DEFAULT ''", "image_file TEXT NOT NULL DEFAULT ''", "shared INTEGER NOT NULL DEFAULT 1"]) {
  try { db.exec(`ALTER TABLE recipes ADD COLUMN ${col}`); } catch {}
}
db.exec(`CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL, last_used INTEGER NOT NULL DEFAULT 0)`);
const IMG_DIR = path.join(DATA_DIR, "images");
fs.mkdirSync(IMG_DIR, { recursive: true });

// ---------- helpers ----------
const json = (res, status, body) => {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(data);
};
const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on("data", (c) => { size += c.length; if (size > 1_000_000) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
  req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch (e) { reject(e); } });
  req.on("error", reject);
});
const parseCookies = (req) => Object.fromEntries((req.headers.cookie || "").split(";").map((c) => c.trim().split("=")).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]));
const newId = (n = 16) => crypto.randomBytes(n).toString("base64url");
const clean = (v, max = 4000) => String(v ?? "").slice(0, max);
const safeId = (v) => /^[A-Za-z0-9_-]{1,64}$/.test(v || "") ? v : null;
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function hashPassword(pw, salt = crypto.randomBytes(16)) {
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}
function verifyPassword(pw, stored) {
  const [, salt, hash] = String(stored).split("$");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(pw, Buffer.from(salt, "base64url"), 64, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(hash, "base64url");
  return want.length === check.length && crypto.timingSafeEqual(want, check);
}
function setSession(res, userId) {
  const token = newId(32);
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, Date.now() + SESSION_DAYS * 864e5);
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
}
function clearSession(req, res) {
  const t = parseCookies(req)[COOKIE];
  if (t) db.prepare("DELETE FROM sessions WHERE token = ?").run(t);
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
const sha256 = (v) => crypto.createHash("sha256").update(v).digest("base64url");
function currentUser(req) {
  const auth = req.headers.authorization || "";
  if (/^bearer\s+/i.test(auth)) {
    const row = db.prepare("SELECT t.id AS token_id, u.id, u.email, u.name FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?").get(sha256(auth.replace(/^bearer\s+/i, "").trim()));
    if (row) { db.prepare("UPDATE api_tokens SET last_used = ? WHERE id = ?").run(Date.now(), row.token_id); return { id: row.id, email: row.email, name: row.name }; }
    return null;
  }
  const t = parseCookies(req)[COOKIE]; if (!t) return null;
  const row = db.prepare("SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?").get(t, Date.now());
  return row || null;
}
setInterval(() => db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now()), 3600e3).unref();

// Gentle brake on password guessing: per email, 10 tries per 15 minutes.
const attempts = new Map();
function tooManyTries(key) {
  const now = Date.now(); const a = attempts.get(key) || [];
  const recent = a.filter((t) => now - t < 15 * 60e3);
  recent.push(now); attempts.set(key, recent);
  return recent.length > 10;
}

// ---------- reading a recipe page ----------
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
async function fetchText(url, opts = {}, ms = 15000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal, redirect: "follow" });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; } finally { clearTimeout(t); }
}
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", deg: "°", frac12: "½", frac14: "¼", frac34: "¾", ndash: "–", mdash: "—", hellip: "…", eacute: "é", egrave: "è" };
const decode = (s) => String(s ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
  if (e[0] === "#") { const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(cp) ? String.fromCodePoint(cp) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
const plain = (v) => decode(String(v ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
function isoDuration(d) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(d || ""); if (!m) return "";
  const h = Number(m[1] || 0) * 24 + Number(m[2] || 0), min = Number(m[3] || 0);
  return [h ? `${h} hr` : "", min ? `${min} min` : ""].filter(Boolean).join(" ");
}
function findRecipeNode(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipeNode(n, depth + 1); if (r) return r; } return null; }
  if (typeof node !== "object") return null;
  const type = [].concat(node["@type"] || []);
  if (type.some((t) => /recipe/i.test(String(t)))) return node;
  for (const k of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "hasPart"]) { const r = findRecipeNode(node[k], depth + 1); if (r) return r; }
  return null;
}
function stepsOf(ins) {
  const out = [];
  const walk = (x) => {
    if (!x) return;
    if (typeof x === "string") { x.split(/\n+/).map(plain).filter(Boolean).forEach((t) => out.push(t)); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (x.itemListElement) { if (x.name) out.push(`## ${plain(x.name)}`); walk(x.itemListElement); return; }
    if (x.text || x.name) out.push(plain(x.text || x.name));
  };
  walk(ins); return out;
}
function extractRecipe(html) {
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data; try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const r = findRecipeNode(data); if (!r) continue;
    const ingredients = [].concat(r.recipeIngredient || r.ingredients || []).map(plain).filter(Boolean);
    const steps = stepsOf(r.recipeInstructions);
    if (!ingredients.length && !steps.length) continue;
    const meta = [];
    const yieldv = [].concat(r.recipeYield || [])[0]; if (yieldv) meta.push(`Serves: ${plain(yieldv)}`);
    const prep = isoDuration(r.prepTime), cook = isoDuration(r.cookTime), total = isoDuration(r.totalTime);
    if (prep) meta.push(`Prep: ${prep}`); if (cook) meta.push(`Cook: ${cook}`); if (total) meta.push(`Total: ${total}`);
    let text = "";
    if (r.description) text += plain(r.description) + "\n\n";
    if (meta.length) text += meta.join("  ·  ") + "\n\n";
    if (ingredients.length) text += "INGREDIENTS\n" + ingredients.map((i) => "- " + i).join("\n") + "\n\n";
    if (steps.length) { let n = 0; text += "METHOD\n" + steps.map((st) => st.startsWith("## ") ? "\n" + st.slice(3).toUpperCase() : `${++n}. ${st}`).join("\n"); }
    return { title: plain(r.name || ""), text: text.trim(), image: imageOf(r.image) || ogImage(html), ingredients: ingredients.length, steps: steps.filter((x) => !x.startsWith("## ")).length, structured: true };
  }
  return null;
}
function imageOf(v) {
  if (!v) return "";
  if (typeof v === "string") return /^https?:\/\//.test(v) ? v : "";
  if (Array.isArray(v)) { for (const x of v) { const u = imageOf(x); if (u) return u; } return ""; }
  if (typeof v === "object") return imageOf(v.url || v.contentUrl || v["@id"]);
  return "";
}
function ogImage(html) {
  const m = /<meta[^>]+(?:property|name)\s*=\s*["'](?:og:image|twitter:image)(?::secure_url)?["'][^>]*>/i.exec(html || "");
  if (!m) return "";
  const c = /content\s*=\s*["']([^"']+)["']/i.exec(m[0]);
  return c && /^https?:\/\//.test(c[1]) ? decode(c[1]) : "";
}
async function saveImage(userId, recipeId, imageUrl) {
  // Keep our own copy of the picture next to the recipe, so it survives the original site.
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(imageUrl, { headers: { "User-Agent": UA, "Accept": "image/*" }, signal: ctl.signal, redirect: "follow" });
    if (!res.ok) return "";
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" }[type];
    if (!ext) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000 || buf.length > 6_000_000) return "";
    const dir = path.join(IMG_DIR, userId); fs.mkdirSync(dir, { recursive: true });
    const file = `${recipeId}.${ext}`;
    for (const old of fs.readdirSync(dir)) if (old.startsWith(recipeId + ".") && old !== file) fs.unlinkSync(path.join(dir, old));
    fs.writeFileSync(path.join(dir, file), buf);
    return file;
  } catch { return ""; } finally { clearTimeout(t); }
}
function removeImage(userId, recipeId) {
  const dir = path.join(IMG_DIR, userId);
  try { for (const f of fs.readdirSync(dir)) if (f.startsWith(recipeId + ".")) fs.unlinkSync(path.join(dir, f)); } catch {}
}
function tidyPageText(t) {
  let lines = t.split("\n").map((l) => l.replace(/\s+$/, ""));
  const isItem = (l) => /^\s*([-*•]|\d+[.)])\s+\S/.test(l);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!/^\W*ingredients\W*$/i.test(lines[i].replace(/[#*_]/g, "").trim())) continue;
    const soon = lines.slice(i + 1, i + 6).filter((l) => l.trim());
    if (soon.length && soon.filter(isItem).length >= 2 && !isItem(lines[i])) { start = i; break; }
  }
  if (start < 0) start = lines.findIndex((l, i) => /ingredients/i.test(l) && lines.slice(i + 1, i + 6).some(isItem));
  if (start > 0) lines = lines.slice(Math.max(0, start - 2));
  else if (!/ingredients/i.test(t)) return "";
  let out = lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
  if (out.length > 8000) out = out.slice(0, 8000) + "\n\n[cut short]";
  return out;
}
async function readRecipe(url) {
  // 1. Fetch the page ourselves, looking like a normal browser.
  let html = await fetchText(url, { headers: { "User-Agent": UA, "Accept": "text/html,*/*", "Accept-Language": "en" } });
  if (html && html.length > 800) { const r = extractRecipe(html); if (r) return r; }
  // 2. A free page-reader service, in case the site refuses direct visits.
  const viaReader = await fetchText(`https://r.jina.ai/${url}`, { headers: { "X-Return-Format": "html" } }, 20000);
  if (viaReader && viaReader.length > 800) { const r = extractRecipe(viaReader); if (r) return r; html = html || viaReader; }
  // 3. Fall back to readable page text.
  const md = await fetchText(`https://r.jina.ai/${url}`, { headers: { "Accept": "text/plain" } }, 15000);
  if (md) { const t = tidyPageText(md); if (t) return { title: "", text: t, image: ogImage(html), structured: false }; }
  if (html) { const img = ogImage(html); if (img) return { title: "", text: "", image: img, structured: false }; }
  return null;
}

// ---------- API ----------
async function api(req, res, url, user) {
  const p = url.pathname, m = req.method;
  const need = () => { if (!user) { json(res, 401, { error: "Please sign in." }); return false; } return true; };

  if (p === "/api/me" && m === "GET") return json(res, 200, { user });

  if (p === "/api/signup" && m === "POST") {
    const b = await readBody(req);
    const email = clean(b.email, 200).trim().toLowerCase(), password = String(b.password || ""), name = clean(b.name, 80).trim();
    if (!isEmail(email)) return json(res, 400, { error: "That email address doesn't look right." });
    if (password.length < 6) return json(res, 400, { error: "Choose a password with at least 6 characters." });
    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) return json(res, 409, { error: "There's already an account with that email. Sign in instead." });
    const id = newId(12);
    db.prepare("INSERT INTO users (id, email, name, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(id, email, name, hashPassword(password), Date.now());
    setSession(res, id);
    return json(res, 200, { user: { id, email, name } });
  }
  if (p === "/api/login" && m === "POST") {
    const b = await readBody(req);
    const email = clean(b.email, 200).trim().toLowerCase(), password = String(b.password || "");
    if (tooManyTries(email)) return json(res, 429, { error: "Too many tries. Wait a few minutes and try again." });
    const u = db.prepare("SELECT id, email, name, pass_hash FROM users WHERE email = ?").get(email);
    if (!u || !verifyPassword(password, u.pass_hash)) return json(res, 401, { error: "Email or password is wrong. Try again." });
    setSession(res, u.id);
    return json(res, 200, { user: { id: u.id, email: u.email, name: u.name } });
  }
  if (p === "/api/logout" && m === "POST") { clearSession(req, res); return json(res, 200, { ok: true }); }

  if (p === "/api/meals" && m === "GET") {
    if (!need()) return;
    const week = url.searchParams.get("week") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return json(res, 400, { error: "Bad week." });
    const rows = db.prepare("SELECT * FROM meals WHERE user_id = ? AND week = ?").all(user.id, week);
    return json(res, 200, { meals: rows.map(mealOut) });
  }
  let mm;
  if ((mm = /^\/api\/meals\/([^/]+)$/.exec(p))) {
    if (!need()) return;
    const id = safeId(mm[1]); if (!id) return json(res, 400, { error: "Bad id." });
    if (m === "PUT") {
      const b = await readBody(req);
      const title = clean(b.title, 200).trim(); if (!title) return json(res, 400, { error: "Give the recipe a name." });
      const dayIndex = Math.min(6, Math.max(0, Number(b.dayIndex) || 0));
      const week = /^\d{4}-\d{2}-\d{2}$/.test(b.week) ? b.week : null; if (!week) return json(res, 400, { error: "Bad week." });
      const slot = ["breakfast", "lunch", "dinner", "snack"].includes(b.slot) ? b.slot : "dinner";
      db.prepare(`INSERT INTO meals (user_id, id, title, url, site, week, day_index, slot, notes, cooked, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, id) DO UPDATE SET title=excluded.title, url=excluded.url, site=excluded.site, week=excluded.week,
        day_index=excluded.day_index, slot=excluded.slot, notes=excluded.notes, cooked=excluded.cooked`)
        .run(user.id, id, title, clean(b.url, 2000), clean(b.site, 200), week, dayIndex, slot, clean(b.notes, 4000), b.cooked ? 1 : 0, Number(b.createdAt) || Date.now());
      return json(res, 200, { ok: true });
    }
    if (m === "PATCH") {
      const b = await readBody(req);
      if ("cooked" in b) db.prepare("UPDATE meals SET cooked = ? WHERE user_id = ? AND id = ?").run(b.cooked ? 1 : 0, user.id, id);
      return json(res, 200, { ok: true });
    }
    if (m === "DELETE") { db.prepare("DELETE FROM meals WHERE user_id = ? AND id = ?").run(user.id, id); return json(res, 200, { ok: true }); }
  }

  if (p === "/api/recipes" && m === "GET") {
    if (!need()) return;
    return json(res, 200, { recipes: db.prepare("SELECT * FROM recipes WHERE user_id = ?").all(user.id).map(recipeOut) });
  }
  if ((mm = /^\/api\/recipes\/([^/]+)$/.exec(p))) {
    if (!need()) return;
    const id = safeId(mm[1]); if (!id) return json(res, 400, { error: "Bad id." });
    if (m === "PUT") {
      const b = await readBody(req);
      const title = clean(b.title, 200).trim(); if (!title) return json(res, 400, { error: "Give the recipe a name." });
      const prev = db.prepare("SELECT image_url, image_file FROM recipes WHERE user_id = ? AND id = ?").get(user.id, id) || { image_url: "", image_file: "" };
      const imageUrl = /^https?:\/\//.test(b.imageUrl || "") ? clean(b.imageUrl, 2000) : prev.image_url;
      let imageFile = prev.image_file;
      if (imageUrl && (imageUrl !== prev.image_url || !imageFile)) imageFile = (await saveImage(user.id, id, imageUrl)) || imageFile;
      const prevShared = db.prepare("SELECT shared FROM recipes WHERE user_id = ? AND id = ?").get(user.id, id);
      const shared = "shared" in b ? (b.shared ? 1 : 0) : (prevShared ? prevShared.shared : 1);
      db.prepare(`INSERT INTO recipes (user_id, id, title, url, site, notes, copy_text, added_at, last_planned, times_planned, image_url, image_file, shared)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, id) DO UPDATE SET title=excluded.title, url=excluded.url, site=excluded.site, notes=excluded.notes,
        copy_text=excluded.copy_text, last_planned=excluded.last_planned, times_planned=excluded.times_planned, image_url=excluded.image_url, image_file=excluded.image_file, shared=excluded.shared`)
        .run(user.id, id, title, clean(b.url, 2000), clean(b.site, 200), clean(b.notes, 4000), clean(b.copyText, 60000),
          Number(b.addedAt) || Date.now(), Number(b.lastPlanned) || 0, Number(b.timesPlanned) || 0, imageUrl, imageFile, shared);
      return json(res, 200, { ok: true, hasImage: !!imageFile });
    }
    if (m === "DELETE") { db.prepare("DELETE FROM recipes WHERE user_id = ? AND id = ?").run(user.id, id); removeImage(user.id, id); return json(res, 200, { ok: true }); }
  }
  if (p === "/api/tokens" && m === "GET") {
    if (!need()) return;
    return json(res, 200, { tokens: db.prepare("SELECT id, name, created_at, last_used FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC").all(user.id).map((t) => ({ id: t.id, name: t.name, createdAt: t.created_at, lastUsed: t.last_used })) });
  }
  if (p === "/api/tokens" && m === "POST") {
    if (!need()) return;
    const b = await readBody(req);
    const token = "wt_" + newId(24), id = newId(8);
    db.prepare("INSERT INTO api_tokens (id, user_id, token_hash, name, created_at) VALUES (?, ?, ?, ?, ?)").run(id, user.id, sha256(token), clean(b.name, 80).trim() || "Claude", Date.now());
    return json(res, 200, { id, token });
  }
  if ((mm = /^\/api\/tokens\/([^/]+)$/.exec(p)) && m === "DELETE") {
    if (!need()) return;
    db.prepare("DELETE FROM api_tokens WHERE user_id = ? AND id = ?").run(user.id, safeId(mm[1]) || "");
    return json(res, 200, { ok: true });
  }
  if (p === "/api/recipes/share-all" && m === "POST") {
    if (!need()) return;
    const b = await readBody(req);
    db.prepare("UPDATE recipes SET shared = ? WHERE user_id = ?").run(b.shared ? 1 : 0, user.id);
    return json(res, 200, { ok: true });
  }
  if (p === "/api/shared" && m === "GET") {
    if (!need()) return;
    const rows = db.prepare(`SELECT r.*, u.name AS owner_name, u.email AS owner_email FROM recipes r JOIN users u ON u.id = r.user_id
      WHERE r.shared = 1 ORDER BY r.added_at DESC LIMIT 500`).all();
    return json(res, 200, { recipes: rows.map((r) => ({ ...recipeOut(r), ownerId: r.user_id, ownerName: r.owner_name || r.owner_email.split("@")[0], mine: r.user_id === user.id })) });
  }
  if ((mm = /^\/api\/shared\/([^/]+)\/([^/]+)\/(image|copy)$/.exec(p))) {
    if (!need()) return;
    const ownerId = safeId(mm[1]), id = safeId(mm[2]); if (!ownerId || !id) return json(res, 400, { error: "Bad id." });
    const row = db.prepare("SELECT * FROM recipes WHERE user_id = ? AND id = ? AND shared = 1").get(ownerId, id);
    if (!row) return json(res, 404, { error: "That recipe isn't shared any more." });
    if (mm[3] === "image" && m === "GET") {
      const full = row.image_file ? path.join(IMG_DIR, ownerId, row.image_file) : "";
      if (!full || !fs.existsSync(full)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": MIME["." + path.extname(full).slice(1)] || "image/jpeg", "Cache-Control": "private, max-age=86400" });
      return fs.createReadStream(full).pipe(res);
    }
    if (mm[3] === "copy" && m === "POST") {
      // Copy the recipe, text and picture included, into the current user's own box.
      const mine = db.prepare("SELECT * FROM recipes WHERE user_id = ? AND id = ?").get(user.id, id);
      let imageFile = mine?.image_file || "";
      if (row.image_file && !imageFile) {
        try { const dir = path.join(IMG_DIR, user.id); fs.mkdirSync(dir, { recursive: true }); fs.copyFileSync(path.join(IMG_DIR, ownerId, row.image_file), path.join(dir, row.image_file)); imageFile = row.image_file; } catch {}
      }
      db.prepare(`INSERT INTO recipes (user_id, id, title, url, site, notes, copy_text, added_at, last_planned, times_planned, image_url, image_file, shared)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(user_id, id) DO UPDATE SET copy_text = CASE WHEN excluded.copy_text != '' THEN excluded.copy_text ELSE recipes.copy_text END,
        image_url = CASE WHEN recipes.image_file = '' THEN excluded.image_url ELSE recipes.image_url END, image_file = CASE WHEN recipes.image_file = '' THEN excluded.image_file ELSE recipes.image_file END`)
        .run(user.id, id, row.title, row.url, row.site, "", row.copy_text, Date.now(), 0, 0, row.image_url, imageFile);
      return json(res, 200, { recipe: recipeOut(db.prepare("SELECT * FROM recipes WHERE user_id = ? AND id = ?").get(user.id, id)) });
    }
  }
  if ((mm = /^\/api\/recipes\/([^/]+)\/image$/.exec(p)) && m === "GET") {
    if (!need()) return;
    const id = safeId(mm[1]); if (!id) return json(res, 400, { error: "Bad id." });
    const row = db.prepare("SELECT image_file FROM recipes WHERE user_id = ? AND id = ?").get(user.id, id);
    const full = row && row.image_file ? path.join(IMG_DIR, user.id, row.image_file) : "";
    if (!full || !fs.existsSync(full)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": MIME["." + path.extname(full).slice(1)] || "image/jpeg", "Cache-Control": "private, max-age=86400" });
    return fs.createReadStream(full).pipe(res);
  }

  if (p === "/api/fetch-recipe" && m === "POST") {
    if (!need()) return;
    const b = await readBody(req);
    let target; try { target = new URL(String(b.url || "")); } catch { return json(res, 400, { error: "Bad link." }); }
    if (!/^https?:$/.test(target.protocol) || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1)/.test(target.hostname)) return json(res, 400, { error: "Bad link." });
    const r = await readRecipe(target.toString());
    return json(res, 200, { recipe: r });
  }

  json(res, 404, { error: "Not found." });
}
const mealOut = (r) => ({ id: r.id, title: r.title, url: r.url, site: r.site, week: r.week, dayIndex: r.day_index, slot: r.slot, notes: r.notes, cooked: !!r.cooked, createdAt: r.created_at });
const recipeOut = (r) => ({ id: r.id, title: r.title, url: r.url, site: r.site, notes: r.notes, copyText: r.copy_text, addedAt: r.added_at, lastPlanned: r.last_planned, timesPlanned: r.times_planned, imageUrl: r.image_url || "", hasImage: !!r.image_file, shared: !!r.shared });

// ---------- static ----------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
function serveStatic(req, res, pathname) {
  let file = pathname === "/" ? "/index.html" : pathname;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream", "Cache-Control": file === "/index.html" ? "no-cache" : "public, max-age=3600" });
    fs.createReadStream(full).pipe(res);
  });
}

// ---------- MCP server (so Claude and other assistants can use the planner) ----------
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function resolveWeek(w) {
  const now = new Date();
  if (!w || w === "this") return mondayOf(now);
  if (w === "next") return addDays(mondayOf(now), 7);
  if (w === "last") return addDays(mondayOf(now), -7);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(w)); if (!m) throw new Error(`Unknown week "${w}". Use "this", "next", "last" or a date like 2026-09-14.`);
  return mondayOf(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}
function resolveDay(day, weekStart) {
  const s = String(day || "").trim().toLowerCase();
  const i = DAYS.findIndex((d) => d.startsWith(s.slice(0, 3)));
  if (s && i >= 0) return { weekStart, dayIndex: i };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) { const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); const ws = mondayOf(d); return { weekStart: ws, dayIndex: Math.round((d - ws) / 864e5) }; }
  if (s === "today") { const d = new Date(); const ws = mondayOf(d); return { weekStart: ws, dayIndex: Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - ws) / 864e5) }; }
  if (s === "tomorrow") { const d = addDays(new Date(), 1); const ws = mondayOf(d); return { weekStart: ws, dayIndex: Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - ws) / 864e5) }; }
  throw new Error(`Unknown day "${day}". Use a weekday name, "today", "tomorrow" or a date like 2026-09-14.`);
}
const siteOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
function recipeIdOf(url) { let h = 5381; const s = url.trim().toLowerCase(); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "r" + h.toString(16) + s.length.toString(16); }
async function upsertRecipeFromUrl(userId, { url, title, notes, shared, planned }) {
  const id = recipeIdOf(url);
  const prev = db.prepare("SELECT * FROM recipes WHERE user_id = ? AND id = ?").get(userId, id);
  let read = null;
  if (!prev || !prev.copy_text || !prev.image_file) read = await readRecipe(url).catch(() => null);
  const finalTitle = (title || "").trim() || prev?.title || read?.title || url;
  const copyText = prev?.copy_text || read?.text || "";
  const imageUrl = prev?.image_url || read?.image || "";
  let imageFile = prev?.image_file || "";
  if (imageUrl && !imageFile) imageFile = await saveImage(userId, id, imageUrl);
  db.prepare(`INSERT INTO recipes (user_id, id, title, url, site, notes, copy_text, added_at, last_planned, times_planned, image_url, image_file, shared)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, id) DO UPDATE SET title=excluded.title, notes=excluded.notes, copy_text=excluded.copy_text, last_planned=excluded.last_planned,
    times_planned=excluded.times_planned, image_url=excluded.image_url, image_file=excluded.image_file, shared=excluded.shared`)
    .run(userId, id, finalTitle, url, siteOf(url), notes ?? prev?.notes ?? "", copyText, prev?.added_at || Date.now(),
      planned ? Date.now() : (prev?.last_planned || 0), (prev?.times_planned || 0) + (planned ? 1 : 0), imageUrl, imageFile,
      shared === undefined ? (prev ? prev.shared : 1) : (shared ? 1 : 0));
  return { id, title: finalTitle, copied: !!copyText, picture: !!imageFile };
}
const mealLine = (r) => `- [${r.id}] ${DAYS[r.day_index][0].toUpperCase() + DAYS[r.day_index].slice(1)} ${r.slot}: ${r.title}${r.cooked ? " (cooked)" : ""}${r.url ? ` <${r.url}>` : ""}${r.notes ? ` — ${r.notes}` : ""}`;
const MCP_TOOLS = [
  { name: "get_week", description: "Show the meal plan for a week: every planned meal with its day, meal slot (breakfast/lunch/dinner/snack), link, notes and whether it was cooked. Meal ids are needed for update_meal and remove_meal.",
    inputSchema: { type: "object", properties: { week: { type: "string", description: '"this" (default), "next", "last", or any date in the week (YYYY-MM-DD)' } } } },
  { name: "plan_meal", description: "Put a recipe on a day of the week. If a link is given, the recipe is also saved to the recipe box with a copy of its ingredients, method and picture.",
    inputSchema: { type: "object", required: ["title", "day"], properties: {
      title: { type: "string", description: "Name of the dish. If a link is given and this is empty, the name is read from the page." },
      day: { type: "string", description: 'Weekday name ("tuesday"), "today", "tomorrow", or a date (YYYY-MM-DD)' },
      week: { type: "string", description: 'Only when day is a weekday name: "this" (default), "next" or "last"' },
      slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"], description: "Default dinner" },
      url: { type: "string", description: "Link to the recipe on the web, if any" },
      notes: { type: "string" } } } },
  { name: "update_meal", description: "Change a planned meal: move it, rename it, add notes, or mark it cooked.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, title: { type: "string" }, day: { type: "string" }, week: { type: "string" }, slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] }, notes: { type: "string" }, cooked: { type: "boolean" } } } },
  { name: "remove_meal", description: "Take a meal off the plan (the recipe stays in the recipe box).", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  { name: "search_recipes", description: "Search the user's recipe box, and optionally the recipes shared by other members. Returns ids for get_recipe.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Words to look for in names, sites, notes and ingredients. Empty lists everything." }, include_shared: { type: "boolean", description: "Also search recipes shared by other members (default true)" }, limit: { type: "number" } } } },
  { name: "get_recipe", description: "Read a saved recipe in full: description, timings, ingredients and method.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, owner_id: { type: "string", description: "Only for a recipe shared by another member (from search_recipes)" } } } },
  { name: "save_recipe", description: "Save a recipe to the recipe box from a link, without planning it. The page is read and a copy of ingredients, method and picture is kept.",
    inputSchema: { type: "object", required: ["url"], properties: { url: { type: "string" }, title: { type: "string" }, notes: { type: "string" }, shared: { type: "boolean", description: "Share with other members (default true)" } } } },
  { name: "read_recipe_page", description: "Read a recipe web page and return its ingredients and method without saving anything.", inputSchema: { type: "object", required: ["url"], properties: { url: { type: "string" } } } },
];
async function mcpTool(user, name, a = {}) {
  const uid = user.id;
  switch (name) {
    case "get_week": {
      const ws = resolveWeek(a.week);
      const rows = db.prepare("SELECT * FROM meals WHERE user_id = ? AND week = ? ORDER BY day_index, created_at").all(uid, isoOf(ws));
      const head = `Week of ${ws.getDate()} ${MONTHS[ws.getMonth()]} – ${addDays(ws, 6).getDate()} ${MONTHS[addDays(ws, 6).getMonth()]} ${ws.getFullYear()} (Monday ${isoOf(ws)}; today is ${isoOf(new Date())})`;
      if (!rows.length) return `${head}\nNothing planned yet.`;
      const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
      rows.sort((x, y) => x.day_index - y.day_index || (order[x.slot] ?? 9) - (order[y.slot] ?? 9));
      return `${head}\n${rows.map(mealLine).join("\n")}`;
    }
    case "plan_meal": {
      const url = a.url ? String(a.url).trim() : "";
      if (url && !/^https?:\/\//i.test(url)) throw new Error("The link must start with http:// or https://");
      const { weekStart, dayIndex } = resolveDay(a.day, resolveWeek(a.week));
      let title = (a.title || "").trim(), saved = null;
      if (url) { saved = await upsertRecipeFromUrl(uid, { url, title, planned: true }); title = saved.title; }
      if (!title) throw new Error("Give the meal a name.");
      const id = "m" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
      db.prepare("INSERT INTO meals (user_id, id, title, url, site, week, day_index, slot, notes, cooked, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)")
        .run(uid, id, title, url, siteOf(url), isoOf(weekStart), dayIndex, ["breakfast", "lunch", "dinner", "snack"].includes(a.slot) ? a.slot : "dinner", clean(a.notes, 4000), Date.now());
      return `Planned "${title}" for ${DAYS[dayIndex]} ${isoOf(addDays(weekStart, dayIndex))} (${a.slot || "dinner"}). Meal id ${id}.` + (saved ? ` Recipe box: ${saved.copied ? "ingredients and method saved" : "couldn't read the page, no copy saved"}${saved.picture ? ", picture saved" : ""} (recipe id ${saved.id}).` : "");
    }
    case "update_meal": {
      const row = db.prepare("SELECT * FROM meals WHERE user_id = ? AND id = ?").get(uid, String(a.id || ""));
      if (!row) throw new Error(`No meal with id ${a.id}. Use get_week to find ids.`);
      let week = row.week, dayIndex = row.day_index;
      if (a.day) { const r = resolveDay(a.day, resolveWeek(a.week || row.week)); week = isoOf(r.weekStart); dayIndex = r.dayIndex; }
      db.prepare("UPDATE meals SET title = ?, week = ?, day_index = ?, slot = ?, notes = ?, cooked = ? WHERE user_id = ? AND id = ?")
        .run((a.title || row.title).trim(), week, dayIndex, ["breakfast", "lunch", "dinner", "snack"].includes(a.slot) ? a.slot : row.slot, a.notes === undefined ? row.notes : clean(a.notes, 4000), a.cooked === undefined ? row.cooked : (a.cooked ? 1 : 0), uid, row.id);
      return "Updated: " + mealLine(db.prepare("SELECT * FROM meals WHERE user_id = ? AND id = ?").get(uid, row.id));
    }
    case "remove_meal": {
      const n = db.prepare("DELETE FROM meals WHERE user_id = ? AND id = ?").run(uid, String(a.id || "")).changes;
      return n ? `Removed meal ${a.id} from the plan.` : `No meal with id ${a.id}.`;
    }
    case "search_recipes": {
      const q = (a.query || "").trim().toLowerCase(), limit = Math.min(100, Math.max(1, Number(a.limit) || 30));
      const match = (r) => !q || [r.title, r.site, r.notes, r.copy_text].some((v) => (v || "").toLowerCase().includes(q));
      const mine = db.prepare("SELECT * FROM recipes WHERE user_id = ? ORDER BY last_planned DESC, added_at DESC").all(uid).filter(match).slice(0, limit);
      let out = mine.length ? `Your recipe box:\n${mine.map((r) => `- [${r.id}] ${r.title}${r.site ? ` (${r.site})` : ""}${r.copy_text ? "" : " [no saved text]"}${r.shared ? "" : " [private]"}`).join("\n")}` : "Your recipe box: no matches.";
      if (a.include_shared !== false) {
        const others = db.prepare("SELECT r.*, u.name AS owner_name FROM recipes r JOIN users u ON u.id = r.user_id WHERE r.shared = 1 AND r.user_id != ? ORDER BY r.added_at DESC").all(uid).filter(match).slice(0, limit);
        out += others.length ? `\n\nShared by other members:\n${others.map((r) => `- [${r.id}, owner ${r.user_id}] ${r.title}${r.site ? ` (${r.site})` : ""} — shared by ${r.owner_name || "a member"}`).join("\n")}` : "\n\nShared by other members: no matches.";
      }
      return out;
    }
    case "get_recipe": {
      const owner = a.owner_id ? String(a.owner_id) : uid;
      const r = db.prepare("SELECT * FROM recipes WHERE user_id = ? AND id = ?" + (owner !== uid ? " AND shared = 1" : "")).get(owner, String(a.id || ""));
      if (!r) throw new Error(`No recipe with id ${a.id}.`);
      return `# ${r.title}\n${r.url ? `Source: ${r.url}\n` : ""}${r.notes ? `Notes: ${r.notes}\n` : ""}\n${r.copy_text || "(No saved text. Use read_recipe_page on the source link.)"}`;
    }
    case "save_recipe": {
      const url = String(a.url || "").trim(); if (!/^https?:\/\//i.test(url)) throw new Error("The link must start with http:// or https://");
      const saved = await upsertRecipeFromUrl(uid, { url, title: a.title, notes: a.notes, shared: a.shared });
      return `Saved "${saved.title}" to the recipe box (id ${saved.id}). ${saved.copied ? "Ingredients and method saved" : "Couldn't read the page automatically, no text saved"}${saved.picture ? ", picture saved" : ""}.`;
    }
    case "read_recipe_page": {
      const url = String(a.url || "").trim(); if (!/^https?:\/\//i.test(url)) throw new Error("The link must start with http:// or https://");
      const r = await readRecipe(url);
      if (!r || !r.text) return "Couldn't read a recipe from that page.";
      return `# ${r.title || url}\n\n${r.text}`;
    }
    default: throw new Error(`Unknown tool ${name}`);
  }
}
async function mcp(req, res, user) {
  if (req.method === "GET") { res.writeHead(405, { "Allow": "POST" }); return res.end(); }
  if (req.method === "DELETE") { res.writeHead(200); return res.end(); }
  if (req.method !== "POST") { res.writeHead(405); return res.end(); }
  if (!user) { res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": 'Bearer realm="weekly-table"' }); return res.end(JSON.stringify({ error: "A connection key is needed: Authorization: Bearer <key>. Create one on the website under Connect Claude." })); }
  let msg; try { msg = await readBody(req); } catch { res.writeHead(400); return res.end(); }
  const reply = (id, result) => json(res, 200, { jsonrpc: "2.0", id, result });
  const fail = (id, code, message) => json(res, 200, { jsonrpc: "2.0", id, error: { code, message } });
  if (msg.id === undefined) { res.writeHead(202); return res.end(); } // notifications
  switch (msg.method) {
    case "initialize": return reply(msg.id, { protocolVersion: msg.params?.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "the-weekly-table", version: "1.0.0" },
      instructions: `The Weekly Table is ${user.name || user.email}'s weekly meal planner. Weeks run Monday to Sunday. Use get_week to see the plan, plan_meal to add a dish to a day (pass the recipe link when there is one so the recipe gets saved with its ingredients), and search_recipes/get_recipe to read saved recipes.` });
    case "ping": return reply(msg.id, {});
    case "tools/list": return reply(msg.id, { tools: MCP_TOOLS });
    case "tools/call": {
      const name = msg.params?.name, args = msg.params?.arguments || {};
      if (!MCP_TOOLS.some((t) => t.name === name)) return fail(msg.id, -32602, `Unknown tool ${name}`);
      try { const text = await mcpTool(user, name, args); return reply(msg.id, { content: [{ type: "text", text }] }); }
      catch (e) { return reply(msg.id, { content: [{ type: "text", text: e.message }], isError: true }); }
    }
    default: return fail(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  if (url.pathname === "/healthz") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("ok"); }
  if (url.pathname === "/mcp") {
    try { await mcp(req, res, currentUser(req)); } catch (e) { console.error(e); if (!res.headersSent) json(res, 500, { error: "Something went wrong." }); }
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    try { await api(req, res, url, currentUser(req)); }
    catch (e) { console.error(e); if (!res.headersSent) json(res, 500, { error: "Something went wrong. Please try again." }); }
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url.pathname);
}).listen(PORT, () => console.log(`The Weekly Table listening on :${PORT}, data in ${DATA_DIR}`));
