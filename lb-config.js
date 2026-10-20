/* =========================================================
   ClientGate – Shared Leaderboard Config
   Put this file NEXT TO ClientGate.html on GitHub.
   Fill in the Firebase values once → every visitor shares scores.
   =========================================================

   SETUP (one time, free):
   1. https://console.firebase.google.com  → Create project
   2. Build → Realtime Database → Create Database
   3. ⚙️ Project settings → Your apps → Web → register app
   4. Copy the config values into CG_FB below
   5. Realtime Database → Rules → paste this and Publish:

   {
     "rules": {
       "lb": {
         "$game": {
           ".read": true,
           "$name": {
             ".write": true,
             ".validate": "newData.hasChildren(['n','s','t']) && newData.child('n').isString() && newData.child('n').val().length >= 2 && newData.child('n').val().length <= 14 && newData.child('s').isNumber() && newData.child('t').isNumber()"
           }
         }
       }
     }
   }

   ========================================================= */

window.CG_FB = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_PROJECT-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "PASTE_PROJECT"
};

/* do not edit below */
window.CG_FB_READY = false;
(function () {
  try {
    if (!window.CG_FB || !CG_FB.apiKey || String(CG_FB.apiKey).indexOf("PASTE_") === 0) {
      console.warn("[ClientGate] lb-config.js: Firebase not filled in yet – leaderboard stays local.");
      return;
    }
    if (typeof firebase === "undefined") {
      console.warn("[ClientGate] Firebase SDK missing.");
      return;
    }
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(CG_FB);
    window.CG_DB = firebase.database();
    window.CG_FB_READY = true;
    console.log("[ClientGate] shared leaderboard online");
  } catch (e) {
    console.warn("[ClientGate] Firebase init failed", e);
  }
})();
