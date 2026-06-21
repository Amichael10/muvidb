import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

async function run() {
  const { data: logs, error } = await supabase
    .from("sync_logs")
    .select("id, created_at, source, status, message, duration_ms, items_processed, items_created, items_updated, items_failed")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(logs, null, 2));
  }
}

run();
