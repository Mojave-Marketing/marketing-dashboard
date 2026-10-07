// One-off inventory of surveys/* blobs. Shows what's in storage so you can
// decide whether to migrate.
//
// Usage:
//   vercel env pull --environment=production .env.production.local
//   node --env-file=.env.production.local scripts/inventory-blobs.mjs

import { list } from "@vercel/blob";

const { blobs } = await list({ prefix: "surveys/" });

const oldShape = []; // surveys/{formId}.json  (aggregated, legacy)
const newShape = []; // surveys/{formId}/{ts}.json  (per-submission)
const other = [];

for (const b of blobs) {
  const parts = b.pathname.split("/");
  if (parts.length === 2 && parts[1].endsWith(".json")) oldShape.push(b);
  else if (parts.length === 3) newShape.push(b);
  else other.push(b);
}

console.log(`Total blobs under surveys/: ${blobs.length}`);
console.log("");
console.log(`Legacy aggregated shape (surveys/{formId}.json): ${oldShape.length}`);
for (const b of oldShape) {
  console.log(`  - ${b.pathname}  (${b.size} bytes, uploaded ${b.uploadedAt.toISOString()})`);
}
console.log("");
console.log(`New per-submission shape (surveys/{formId}/{ts}.json): ${newShape.length}`);
const byForm = {};
for (const b of newShape) {
  const form = b.pathname.split("/")[1];
  byForm[form] = (byForm[form] || 0) + 1;
}
for (const [form, count] of Object.entries(byForm)) {
  console.log(`  - ${form}: ${count} submissions`);
}
if (other.length > 0) {
  console.log("");
  console.log(`Unexpected shape (manual review): ${other.length}`);
  for (const b of other) console.log(`  - ${b.pathname}`);
}
