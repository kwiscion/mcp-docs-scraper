/**
 * Quick test of real cache directory location.
 */
import { CacheManager } from "../src/services/cache-manager.js";

async function main() {
  const cache = new CacheManager();
  console.log("Cache dir:", cache.getCacheDir());
  await cache.initialize();
  console.log("✅ Real cache directory initialized");
  const entries = await cache.listEntries();
  console.log("Existing entries:", entries.length);
}

main();

