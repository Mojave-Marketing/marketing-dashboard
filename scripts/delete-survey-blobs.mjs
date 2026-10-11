// Delete all blobs under a given surveys/{formId}/ prefix in Vercel Blob
// storage. Use for one-off cleanups when a form's existing data is pre-
// production test content and needs to be wiped.
//
// Dry run first (no deletes):
//   node --env-file=.env.local.prod scripts/delete-survey-blobs.mjs rep-company-feedback --dry-run
// Then for real:
//   node --env-file=.env.local.prod scripts/delete-survey-blobs.mjs rep-company-feedback
//
// Requires .env.local.prod with BLOB_READ_WRITE_TOKEN. Create with:
//   vercel env pull --environment=production .env.local.prod
// Remember to `rm .env.local.prod` after.

import { del, list } from "@vercel/blob";

const formId = process.argv[2];
const DRY_RUN = process.argv.includes("--dry-run");

if (!formId || formId.startsWith("--")) {
  console.error("Usage: node scripts/delete-survey-blobs.mjs <formId> [--dry-run]");
  console.error("  formId examples: arctidry-training, rep-company-feedback, arctidry-feedback");
  process.exit(1);
}

const prefix = `surveys/${formId}/`;
console.log(`Scanning ${prefix}${DRY_RUN ? " (DRY RUN)" : ""}\n`);

const { blobs } = await list({ prefix });

if (blobs.length === 0) {
  console.log("No blobs found. Nothing to delete.");
  process.exit(0);
}

console.log(`Found ${blobs.length} blob${blobs.length === 1 ? "" : "s"}:`);
for (const b of blobs) {
  console.log(`  - ${b.pathname}  (${b.size} bytes, uploaded ${b.uploadedAt.toISOString()})`);
}
console.log();

if (DRY_RUN) {
  console.log(`Would delete ${blobs.length} blob${blobs.length === 1 ? "" : "s"}. Re-run without --dry-run to actually delete.`);
  process.exit(0);
}

let deleted = 0;
for (const b of blobs) {
  await del(b.url);
  deleted++;
  console.log(`  deleted ${b.pathname}`);
}
console.log(`\nDone. Deleted ${deleted} of ${blobs.length} blob${blobs.length === 1 ? "" : "s"}.`);
