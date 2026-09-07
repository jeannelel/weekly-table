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
function currentUser(req) {
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
    return { title: plain(r.name || ""), text: text.trim(), ingredients: ingredients.length, steps: steps.filter((x) => !x.startsWith("## ")).length, structured: true };
  }
  return null;
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
  if (md) { const t = tidyPageText(md); if (t) return { title: "", text: t, structured: false }; }
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
      db.prepare(`INSERT INTO recipes (user_id, id, title, url, site, notes, copy_text, added_at, last_planned, times_planned)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, id) DO UPDATE SET title=excluded.title, url=excluded.url, site=excluded.site, notes=excluded.notes,
        copy_text=excluded.copy_text, last_planned=excluded.last_planned, times_planned=excluded.times_planned`)
        .run(user.id, id, title, clean(b.url, 2000), clean(b.site, 200), clean(b.notes, 4000), clean(b.copyText, 60000),
          Number(b.addedAt) || Date.now(), Number(b.lastPlanned) || 0, Number(b.timesPlanned) || 0);
      return json(res, 200, { ok: true });
    }
    if (m === "DELETE") { db.prepare("DELETE FROM recipes WHERE user_id = ? AND id = ?").run(user.id, id); return json(res, 200, { ok: true }); }
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
const recipeOut = (r) => ({ id: r.id, title: r.title, url: r.url, site: r.site, notes: r.notes, copyText: r.copy_text, addedAt: r.added_at, lastPlanned: r.last_planned, timesPlanned: r.times_planned });

// ---------- static ----------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
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

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  if (url.pathname === "/healthz") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("ok"); }
  if (url.pathname.startsWith("/api/")) {
    try { await api(req, res, url, currentUser(req)); }
    catch (e) { console.error(e); if (!res.headersSent) json(res, 500, { error: "Something went wrong. Please try again." }); }
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url.pathname);
}).listen(PORT, () => console.log(`The Weekly Table listening on :${PORT}, data in ${DATA_DIR}`));
