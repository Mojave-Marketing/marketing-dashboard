// Migrate legacy surveys/{formId}.json (one aggregated JSON array) to the
// new per-submission shape surveys/{formId}/{ts}.json with access:"private".
//
// Idempotent: safe to run multiple times. Only deletes the old blob after
// every per-submission write succeeds.
//
// Dry run first:
//   node --env-file=.env.production.local scripts/migrate-blobs.mjs --dry-run
// Then for real:
//   node --env-file=.env.production.local scripts/migrate-blobs.mjs

import { del, list, put } from "@vercel/blob";

const DRY_RUN = process.argv.includes("--dry-run");
if (DRY_RUN) console.log("DRY RUN — no writes or deletes will happen\n");

const { blobs } = await list({ prefix: "surveys/" });
const legacy = blobs.filter((b) => {
  const parts = b.pathname.split("/");
  return parts.length === 2 && parts[1].endsWith(".json");
});

if (legacy.length === 0) {
  console.log("No legacy aggregated blobs found. Nothing to migrate.");
  process.exit(0);
}

for (const blob of legacy) {
  const formId = blob.pathname.split("/")[1].replace(/\.json$/, "");
  console.log(`\n→ ${blob.pathname} (form: ${formId})`);

  const res = await fetch(blob.url);
  if (!res.ok) {
    console.log(`  ✗ fetch failed: ${res.status}; skipping`);
    continue;
  }
  const payload = await res.json();
  if (!Array.isArray(payload)) {
    console.log(`  ✗ expected JSON array, got ${typeof payload}; skipping`);
    continue;
  }
  console.log(`  found ${payload.length} submissions`);

  let migrated = 0;
  for (const row of payload) {
    const ts = row._receivedAt ? new Date(row._receivedAt).getTime() : Date.now();
    const key = `surveys/${formId}/${ts}.json`;
    if (DRY_RUN) {
      console.log(`  would write ${key}`);
    } else {
      await put(key, JSON.stringify(row), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
      });
    }
    migrated++;
  }

  if (migrated !== payload.length) {
    console.log(`  ✗ migrated ${migrated}/${payload.length}; keeping legacy blob for safety`);
    continue;
  }

  if (DRY_RUN) {
    console.log(`  would delete ${blob.pathname}`);
  } else {
    await del(blob.url);
    console.log(`  ✓ migrated ${migrated} submissions and deleted legacy blob`);
  }
}

console.log("\nDone.");
