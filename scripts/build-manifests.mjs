import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const toursDir = path.join(rootDir, "src", "lib", "data", "tours");
const staticDir = path.join(rootDir, "static");
const audioRoot = path.join(staticDir, "audio", "tours");

async function listMp3Files(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listMp3Files(entryPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".mp3")) {
      files.push(entryPath);
    }
  }

  return files;
}

async function buildManifestForTour(jsonPath) {
  const raw = await fs.readFile(jsonPath, "utf8");
  const data = JSON.parse(raw);
  const filename = path.basename(jsonPath);
  const fallbackId = filename.replace(/\.json$/i, "");
  const id = typeof data.id === "string" ? data.id : fallbackId;

  const tourAudioDir = path.join(audioRoot, id);
  const mp3Files = await listMp3Files(tourAudioDir);

  const manifestFiles = [];
  let totalBytes = 0;

  for (const filePath of mp3Files) {
    const stat = await fs.stat(filePath);
    totalBytes += stat.size;

    const rel = path.relative(staticDir, filePath).split(path.sep).join("/");
    manifestFiles.push({
      path: rel.startsWith("/") ? rel.slice(1) : rel,
      bytes: stat.size
    });
  }

  manifestFiles.sort((a, b) => a.path.localeCompare(b.path));

  data.offline = {
    totalBytes,
    files: manifestFiles
  };

  const output = JSON.stringify(data, null, 2) + "\n";
  await fs.writeFile(jsonPath, output, "utf8");
  return { id, totalBytes, files: manifestFiles.length };
}

async function main() {
  const entries = await fs.readdir(toursDir);
  const jsonFiles = entries.filter((f) => f.toLowerCase().endsWith(".json"));

  const results = [];
  for (const file of jsonFiles) {
    const fullPath = path.join(toursDir, file);
    const res = await buildManifestForTour(fullPath);
    results.push(res);
  }

  console.log("Offline manifests updated:");
  for (const r of results) {
    const mb = (r.totalBytes / (1024 * 1024)).toFixed(2);
    console.log(`- ${r.id}: ${r.files} files, ${mb} MB`);
  }
}

main().catch((err) => {
  console.error("Failed to build manifests", err);
  process.exit(1);
});
