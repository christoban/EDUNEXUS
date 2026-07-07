import { Database } from "bun:sqlite";
const db = new Database("C:/Users/USER/.local/share/mimocode/mimocode.db", { readonly: true });

const projId = "bfff4f30-16eb-4f0f-bba1-f78cd942ade4";

// Get user messages to find durable rules/decisions
console.log("=== USER MESSAGES (content snippets) ===");
const userMsgs = db.query(`
  SELECT m.session_id, substr(json_extract(m.data, '$.content'), 1, 600) as content
  FROM message m
  JOIN session s ON s.id = m.session_id
  WHERE s.project_id = ? AND json_extract(m.data, '$.role') = 'user'
  ORDER BY m.time_created
`).all(projId) as any[];

for (const m of userMsgs) {
  console.log(`\n--- [${m.session_id}] ---`);
  console.log(m.content);
}

// Also check assistant messages for key decisions / architecture insights
console.log("\n\n=== ASSISTANT MESSAGES (key parts) ===");
const assistantMsgs = db.query(`
  SELECT m.session_id, m.id as msg_id,
    (SELECT json_extract(p.data, '$.text')
     FROM part p WHERE p.message_id = m.id AND json_extract(p.data, '$.type') = 'text'
     ORDER BY p.time_created LIMIT 1) as text_part
  FROM message m
  JOIN session s ON s.id = m.session_id
  WHERE s.project_id = ? AND json_extract(m.data, '$.role') = 'assistant'
  ORDER BY m.time_created
`).all(projId) as any[];

for (const m of assistantMsgs) {
  if (m.text_part && m.text_part.length > 50) {
    console.log(`\n--- [${m.session_id}] msg ${m.msg_id} ---`);
    console.log(m.text_part.slice(0, 500));
  }
}

db.close();
