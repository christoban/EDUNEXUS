import { Database } from "bun:sqlite";
const db = new Database("C:/Users/USER/.local/share/mimocode/mimocode.db", { readonly: true });

const projId = "bfff4f30-16eb-4f0f-bba1-f78cd942ade4";

// Search using history_fts with the correct kind
console.log("=== USER TEXT MESSAGES (non-command) ===");
const userTexts = db.query(`
  SELECT session_id, body, time_created
  FROM history_fts
  WHERE project_id = ? AND kind = 'user_text'
    AND body NOT LIKE '%<local-command-caveat>%'
    AND body NOT LIKE '%<command-name>%'
    AND body NOT LIKE '%<ide_opened_file>%'
    AND body NOT LIKE '%<system-reminder>%'
    AND body NOT LIKE '%<local-command-stdout>%'
    AND body NOT LIKE '%[Request interrupted%'
    AND length(body) > 20
  ORDER BY time_created
`).all(projId) as any[];

console.log(`Total user text messages: ${userTexts.length}`);
for (const t of userTexts) {
  const d = new Date(t.time_created);
  console.log(`\n[${d.toISOString().slice(0,10)}] ${t.session_id}`);
  console.log(t.body.slice(0, 600));
}

db.close();
