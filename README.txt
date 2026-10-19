ClientGate – Deploy mit globalem Leaderboard
============================================

Struktur
  public/        -> die Webseite (index.html, Logo)
  worker.js      -> Backend fuer das Leaderboard (API unter /api/*)
  wrangler.toml  -> Cloudflare-Config (Assets + Durable Object mit SQLite)

Deploy (im Ordner dieser Datei)
  npx wrangler login      (nur beim ersten Mal)
  npx wrangler deploy

Der Durable Object "Board" wird beim ersten Deploy automatisch angelegt
(Migration v1) - du musst nichts manuell in Cloudflare erstellen.

Lokal testen:  npx wrangler dev

Hinweise
  * Drag&Drop-Upload im Dashboard reicht nicht mehr, weil das Backend
    ein Worker ist. Entweder wrangler deploy oder Git-Verbindung nutzen.
  * Es gibt absichtlich keinen Reset-/Delete-Endpunkt.
  * Pro Spieler (Name) zaehlt pro Spiel nur der beste Score.
  * Server prueft: gueltiges Spiel, plausibler Wertebereich, Name 2-14 Zeichen,
    Rate-Limit pro IP. Spiele laufen im Browser - ein entschlossener Cheater
    kann trotzdem Scores innerhalb der erlaubten Grenzen senden.
