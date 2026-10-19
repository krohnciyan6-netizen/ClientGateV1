// ClientGate – global leaderboard (Cloudflare Worker + SQLite Durable Object)
// There is intentionally NO delete / reset endpoint.
import { DurableObject } from "cloudflare:workers";

// game -> [min plausible, max plausible, lowerIsBetter?]
const LIM = {
  cube: [1, 5000], cps: [1, 25], rx: [80, 5000, 1], tw: [1, 90], sq: [1, 60],
  snake: [1, 399], mm: [8, 600, 1], aim: [6, 300, 1], mole: [1, 150], jump: [1, 300],
  dodge: [2, 900], math: [1, 120], col: [1, 150], num: [1, 30],
};
const low = (g) => LIM[g][2] === 1;
const TOP_N = 25;
const J = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export class Board extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS scores(g TEXT NOT NULL, n TEXT NOT NULL COLLATE NOCASE, s REAL NOT NULL, t INTEGER NOT NULL, PRIMARY KEY(g,n))"
    );
    this.hits = new Map();
  }

  top(g) {
    return this.sql
      .exec(`SELECT n,s,t FROM scores WHERE g=? ORDER BY s ${low(g) ? "ASC" : "DESC"}, t ASC LIMIT ${TOP_N}`, g)
      .toArray();
  }

  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/api/lb") {
      const games = {};
      for (const g of Object.keys(LIM)) games[g] = this.top(g);
      return J({ ok: true, games, now: Date.now() });
    }

    if (req.method === "POST" && url.pathname === "/api/score") {
      // rate limit per IP: 1 score / 1.5 s, 20 / minute
      const ip = req.headers.get("x-ip") || "0", now = Date.now();
      const h = (this.hits.get(ip) || []).filter((t) => now - t < 60000);
      if (h.length >= 20 || (h.length && now - h[h.length - 1] < 1500)) return J({ ok: false, err: "slow down" }, 429);
      h.push(now);
      this.hits.set(ip, h);
      if (this.hits.size > 5000) this.hits.clear();

      const raw = await req.text();
      if (raw.length > 300) return J({ ok: false, err: "too big" }, 413);
      let b;
      try { b = JSON.parse(raw); } catch { return J({ ok: false, err: "bad json" }, 400); }

      const g = String(b.g);
      if (!(g in LIM)) return J({ ok: false, err: "unknown game" }, 400);
      let s = Number(b.s);
      if (!Number.isFinite(s)) return J({ ok: false, err: "bad score" }, 400);
      s = Math.round(s * 100) / 100;
      if (s < LIM[g][0] || s > LIM[g][1]) return J({ ok: false, err: "implausible score" }, 400);
      const n = String(b.n ?? "")
        .normalize("NFKC")
        .replace(/[^\p{L}\p{N} _.\-]/gu, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 14);
      if (n.length < 2) return J({ ok: false, err: "name too short" }, 400);

      const cur = this.sql.exec("SELECT s FROM scores WHERE g=? AND n=?", g, n).toArray()[0];
      let improved = false, best = s;
      if (!cur) {
        this.sql.exec("INSERT INTO scores(g,n,s,t) VALUES(?,?,?,?)", g, n, s, now);
        improved = true;
      } else if (low(g) ? s < cur.s : s > cur.s) {
        this.sql.exec("UPDATE scores SET s=?, t=?, n=? WHERE g=? AND n=?", s, now, n, g, n);
        improved = true;
      } else best = cur.s;

      const rank = this.sql
        .exec(`SELECT COUNT(*)+1 AS r FROM scores WHERE g=? AND s ${low(g) ? "<" : ">"} ?`, g, best)
        .toArray()[0].r;
      return J({ ok: true, improved, best, rank, top: this.top(g) });
    }

    return J({ ok: false, err: "not found" }, 404);
  }
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (!u.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);

    if (req.method === "POST") {
      const o = req.headers.get("origin");
      if (o && new URL(o).host !== u.host) return J({ ok: false, err: "forbidden" }, 403);
    }
    const stub = env.LB.get(env.LB.idFromName("main"));
    const h = new Headers(req.headers);
    h.set("x-ip", req.headers.get("cf-connecting-ip") || "0");
    const fwd = new Request(req, { headers: h });

    // short edge cache for the read endpoint (works on custom domains)
    if (req.method === "GET" && u.pathname === "/api/lb") {
      const key = new Request(u.origin + "/api/lb");
      const hit = await caches.default.match(key);
      if (hit) return hit;
      const res = new Response((await stub.fetch(fwd)).body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=10" } });
      ctx.waitUntil(caches.default.put(key, res.clone()));
      return res;
    }
    const res = await stub.fetch(fwd);
    if (req.method === "POST") ctx.waitUntil(caches.default.delete(new Request(u.origin + "/api/lb")));
    return res;
  },
};
