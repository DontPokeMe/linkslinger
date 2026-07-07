#!/usr/bin/env node
/**
 * Release preparation, run by the npm `version` lifecycle hook.
 *
 * At this point `npm version` has already written the new version into
 * package.json (and package-lock.json). This script brings the rest of the
 * repo in line with that version so the whole bump lands in one commit:
 *
 *   1. Writes the new version into src/manifest.json (and dist/safari/manifest.json
 *      if present) without otherwise reformatting the file.
 *   2. Rolls CHANGELOG.md: renames the `## [Unreleased]` section to
 *      `## [x.y.z] - YYYY-MM-DD` and inserts a fresh empty `## [Unreleased]`
 *      above it.
 *
 * The npm hook is responsible for `git add`-ing the changed files.
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Replace only the first "version": "..." value, preserving all other bytes.
function setManifestVersion(file, version) {
  if (!fs.existsSync(file)) return false;
  const src = fs.readFileSync(file, "utf8");
  const updated = src.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
  if (updated === src) {
    throw new Error(`Could not find a "version" field to update in ${file}`);
  }
  fs.writeFileSync(file, updated);
  return true;
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rollChangelog(file, version, date) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);

  const unreleasedIdx = lines.findIndex((l) => /^##\s*\[Unreleased\]/i.test(l));
  if (unreleasedIdx === -1) {
    throw new Error(`No "## [Unreleased]" heading found in ${file}`);
  }

  // Body runs from just after the Unreleased heading to the next "## " heading.
  let nextHeadingIdx = lines.length;
  for (let i = unreleasedIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      nextHeadingIdx = i;
      break;
    }
  }

  const body = lines.slice(unreleasedIdx + 1, nextHeadingIdx).join("\n").trim();
  const sectionBody = body || "### Changed\n- Maintenance and internal improvements.";

  const replacement = [
    "## [Unreleased]",
    "",
    `## [${version}] - ${date}`,
    "",
    sectionBody,
    "",
  ].join("\n");

  const newLines = [
    ...lines.slice(0, unreleasedIdx),
    replacement,
    ...lines.slice(nextHeadingIdx),
  ];
  fs.writeFileSync(file, newLines.join("\n"));
}

function main() {
  const { version } = readJson(path.join(ROOT, "package.json"));
  if (!version) throw new Error("No version in package.json");

  const manifests = [
    path.join(ROOT, "src", "manifest.json"),
    path.join(ROOT, "dist", "safari", "manifest.json"),
  ];
  for (const m of manifests) {
    if (setManifestVersion(m, version)) {
      console.log(`Synced ${path.relative(ROOT, m)} -> ${version}`);
    }
  }

  rollChangelog(path.join(ROOT, "CHANGELOG.md"), version, today());
  console.log(`Rolled CHANGELOG.md: [Unreleased] -> [${version}] - ${today()}`);
}

main();
