/* =========================================================
   ClientGate – Shared Leaderboard (Cloudflare Worker)
   Put this file next to ClientGate.html

   1. Deploy the worker (folder clientgate-worker/):
        cd clientgate-worker
        npm i
        npx wrangler login
        npx wrangler kv namespace create CLIENTGATE_LB
        # paste the id into wrangler.toml → id = "..."
        npx wrangler deploy
   2. Copy the workers.dev URL below
   ========================================================= */

window.CG_LB_API = "https://clientgate-lb.PASTE_SUBDOMAIN.workers.dev";

/* do not edit below */
window.CG_FB_READY = false; // legacy flag – worker path uses CG_LB_API
window.CG_LB_READY = false;
(function () {
  var u = window.CG_LB_API || "";
  if (!u || u.indexOf("PASTE_") !== -1) {
    console.warn("[ClientGate] lb-config.js: set CG_LB_API to your worker URL");
    return;
  }
  window.CG_LB_READY = true;
  window.CG_FB_READY = true; // reuse existing html hooks
  console.log("[ClientGate] shared leaderboard API:", u);
})();
