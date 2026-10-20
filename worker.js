/**
 * ClientGate shared leaderboard – Cloudflare Worker + KV
 * Routes:
 *   GET  /lb              → { ok, games: { cube: [...], ... } }
 *   GET  /lb?g=snake      → { ok, g, top: [...] }
 *   POST /score           → body { g, s, n } → { ok, rank, best, improved, top }
 *   OPTIONS *             → CORS
 */

const GAMES = {
  cube: { low: false },
  cps: { low: false },
  rx: { low: true },
  tw: { low: false },
  sq: { low: false },
  snake: { low: false },
  mm: { low: true },
  aim: { low: true },
  mole: { low: false },
  jump: { low: false },
  dodge: { low: false },
  math: { low: false },
  col: { low: false },
  num: { low: false },
};

const MAX_NAME = 14;
const MAX_TOP = 50;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

function cleanName(n) {
  return String(n || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_NAME);
}

function sortList(g, list) {
  const low = !!(GAMES[g] && GAMES[g].low);
  list.sort((a, b) => (low ? a.s - b.s : b.s - a.s));
  return list.slice(0, MAX_TOP);
}

async function readGame(env, g) {
  const raw = await env.LB.get(`lb:${g}`, "json");
  return Array.isArray(raw) ? raw : [];
}

async function writeGame(env, g, list) {
  await env.LB.put(`lb:${g}`, JSON.stringify(sortList(g, list)));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (!env.LB) {
      return json({ ok: false, err: "KV binding LB missing – check wrangler.toml" }, 500);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // GET /lb
    if (request.method === "GET" && (path === "/lb" || path === "/api/lb")) {
      const g = url.searchParams.get("g");
      if (g) {
        if (!GAMES[g]) return json({ ok: false, err: "unknown game" }, 400);
        const top = sortList(g, await readGame(env, g));
        return json({ ok: true, g, top });
      }
      const games = {};
      for (const id of Object.keys(GAMES)) {
        games[id] = sortList(id, await readGame(env, id));
      }
      return json({ ok: true, games });
    }

    // POST /score
    if (request.method === "POST" && (path === "/score" || path === "/api/score")) {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, err: "invalid json" }, 400);
      }
      const g = String(body.g || "");
      const n = cleanName(body.n);
      const s = Number(body.s);
      if (!GAMES[g]) return json({ ok: false, err: "unknown game" }, 400);
      if (n.length < 2) return json({ ok: false, err: "name too short" }, 400);
      if (!Number.isFinite(s) || s < 0 || s > 1e9) return json({ ok: false, err: "bad score" }, 400);

      const low = GAMES[g].low;
      let list = await readGame(env, g);
      const key = n.toLowerCase();
      let idx = list.findIndex((e) => String(e.n).toLowerCase() === key);
      let improved = false;
      let best = s;

      if (idx >= 0) {
        const prev = Number(list[idx].s);
        const better = low ? s < prev : s > prev;
        if (better) {
          list[idx] = { n, s, t: Date.now() };
          improved = true;
          best = s;
        } else {
          best = prev;
        }
      } else {
        list.push({ n, s, t: Date.now() });
        improved = true;
        best = s;
      }

      list = sortList(g, list);
      await writeGame(env, g, list);

      let rank = 0;
      for (let i = 0; i < list.length; i++) {
        if (String(list[i].n).toLowerCase() === key) {
          rank = i + 1;
          break;
        }
      }

      return json({ ok: true, rank, best, improved, top: list });
    }

    return json({
      ok: true,
      service: "clientgate-lb",
      endpoints: ["GET /lb", "GET /lb?g=snake", "POST /score"],
    });
  },
};
