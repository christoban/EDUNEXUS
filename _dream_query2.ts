import { Database } from "bun:sqlite";
const db = new Database("C:/Users/USER/.local/share/mimocode/mimocode.db", { readonly: true });

const projId = "bfff4f30-16eb-4f0f-bba1-f78cd942ade4";

// Search for user messages containing rule-like keywords
const keywords = ["toujours", "jamais", "règle", "décision", "on ne", "il faut", "absolute", "never", "always", "rule", "important", "convention", "pattern", "architecture"];

console.log("=== USER MESSAGES WITH RULE KEYWORDS ===");
for (const kw of keywords) {
  const rows = db.query(`
    SELECT m.session_id, m.time_created, substr(json_extract(m.data, '$.content'), 1, 800) as content
    FROM message m
    JOIN session s ON s.id = m.session_id
    WHERE s.project_id = ?
      AND json_extract(m.data, '$.role') = 'user'
      AND json_extract(m.data, '$.content') LIKE ?
    ORDER BY m.time_created DESC
    LIMIT 3
  `).all(projId, `%${kw}%`) as any[];
  
  if (rows.length > 0) {
    console.log(`\n--- Keyword: "${kw}" (${rows.length} hits) ---`);
    for (const r of rows) {
      const d = new Date(r.time_created);
      console.log(`  [${d.toISOString().slice(0,10)}] ${r.session_id}`);
      console.log(`  ${r.content}`);
    }
  }
}

// Search for error/fix patterns
console.log("\n\n=== ASSISTANT MESSAGES WITH ERROR/BUG KEYWORDS ===");
const errorKeywords = ["bug", "error", "fix", "correction", "problème", "erreur"];
for (const kw of errorKeywords) {
  const rows = db.query(`
    SELECT m.session_id, m.time_created,
      (SELECT json_extract(p.data, '$.text')
       FROM part p WHERE p.message_id = m.id AND json_extract(p.data, '$.type') = 'text'
       ORDER BY p.time_created LIMIT 1) as text_part
    FROM message m
    JOIN session s ON s.id = m.session_id
    WHERE s.project_id = ?
      AND json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(m.data, '$.content') LIKE ?
    ORDER BY m.time_created DESC
    LIMIT 2
  `).all(projId, `%${kw}%`) as any[];

  if (rows.length > 0) {
    console.log(`\n--- Keyword: "${kw}" (${rows.length} hits) ---`);
    for (const r of rows) {
      const d = new Date(r.time_created);
      const text = r.text_part || r.content || "";
      if (text.length > 20) {
        console.log(`  [${d.toISOString().slice(0,10)}] ${r.session_id}`);
        console.log(`  ${text.slice(0, 400)}`);
      }
    }
  }
}

db.close();
