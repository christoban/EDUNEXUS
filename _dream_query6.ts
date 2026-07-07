import { Database } from "bun:sqlite";
const db = new Database("C:/Users/USER/.local/share/mimocode/mimocode.db", { readonly: true });

// Check history_fts contents
const count = db.query("SELECT COUNT(*) as c FROM history_fts").get() as any;
console.log("Total history_fts rows:", count.c);

const sample = db.query("SELECT * FROM history_fts LIMIT 3").all() as any[];
for (const s of sample) {
  console.log("\nRow:", JSON.stringify(s, null, 2).slice(0, 500));
}

// Also check message data more carefully
const projId = "bfff4f30-16eb-4f0f-bba1-f78cd942ade4";
const userParts = db.query(`
  SELECT json_extract(p.data, '$.text') as text, p.time_created, m.session_id
  FROM part p
  JOIN message m ON m.id = p.message_id
  JOIN session s ON s.id = m.session_id
  WHERE s.project_id = ?
    AND json_extract(m.data, '$.role') = 'user'
    AND json_extract(p.data, '$.type') = 'text'
    AND json_extract(p.data, '$.text') NOT LIKE '%<local-command-caveat>%'
  ORDER BY m.time_created
  LIMIT 30
`).all(projId) as any[];

console.log("\n\n=== USER PARTS (text content) ===");
for (const p of userParts) {
  const d = new Date(p.time_created);
  console.log(`\n[${d.toISOString().slice(0,10)}] ${p.session_id}`);
  console.log(p.text?.slice(0, 500));
}

db.close();
