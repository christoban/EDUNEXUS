import { Database } from "bun:sqlite";
const db = new Database("C:/Users/USER/.local/share/mimocode/mimocode.db", { readonly: true });

const projId = "bfff4f30-16eb-4f0f-bba1-f78cd942ade4";

// Check a sample message data
const sample = db.query(`
  SELECT m.data FROM message m
  JOIN session s ON s.id = m.session_id
  WHERE s.project_id = ? AND json_extract(m.data, '$.role') = 'user'
  LIMIT 1
`).get(projId) as any;
console.log("User message data:", JSON.stringify(JSON.parse(sample.data), null, 2).slice(0, 1000));

// Check a sample assistant message part
const partSample = db.query(`
  SELECT p.data FROM part p
  JOIN message m ON m.id = p.message_id
  JOIN session s ON s.id = m.session_id
  WHERE s.project_id = ? AND json_extract(m.data, '$.role') = 'user'
  LIMIT 1
`).get(projId) as any;
console.log("\nPart data:", JSON.stringify(JSON.parse(partSample.data), null, 2).slice(0, 1000));

// Now search for durable knowledge using the correct path
console.log("\n\n=== USER MESSAGES WITH RULE KEYWORDS ===");
const keywords = ["toujours", "jamais", "règle", "décision", "important", "convention", "il faut", "on ne", "absolute", "never", "always"];
for (const kw of keywords) {
  const rows = db.query(`
    SELECT m.session_id, m.time_created, m.data
    FROM message m
    JOIN session s ON s.id = m.session_id
    WHERE s.project_id = ?
      AND json_extract(m.data, '$.role') = 'user'
      AND m.data LIKE ?
    ORDER BY m.time_created DESC
    LIMIT 2
  `).all(projId, `%${kw}%`) as any[];

  if (rows.length > 0) {
    console.log(`\n--- Keyword: "${kw}" (${rows.length} hits) ---`);
    for (const r of rows) {
      const d = new Date(r.time_created);
      const parsed = JSON.parse(r.data);
      const content = parsed.content || parsed.text || "(no content field)";
      console.log(`  [${d.toISOString().slice(0,10)}] ${r.session_id}`);
      console.log(`  ${(typeof content === 'string' ? content : JSON.stringify(content)).slice(0, 500)}`);
    }
  }
}

db.close();
