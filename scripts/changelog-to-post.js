#!/usr/bin/env node
/**
 * Generate a Jekyll blog post announcing a LinkSlinger release.
 *
 * Reads the section for a given version out of CHANGELOG.md and writes a
 * dated Jekyll post (YAML front matter) into the target _posts directory.
 * The post is created with `published: false` (a Jekyll draft) unless
 * --publish is passed, so it stays invisible on the site until flipped.
 *
 * Usage:
 *   node scripts/changelog-to-post.js \
 *     --version 4.0.9 \
 *     --changelog CHANGELOG.md \
 *     --out /path/to/dontpokeme-web/blog/_posts \
 *     [--publish]
 *
 * Prints the path of the written file to stdout.
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = { publish: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--publish") args.publish = true;
    else if (a === "--version") args.version = argv[++i];
    else if (a === "--changelog") args.changelog = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.version) throw new Error("--version is required");
  if (!args.changelog) args.changelog = "CHANGELOG.md";
  if (!args.out) throw new Error("--out is required");
  return args;
}

// Extract the body and date for a `## [version] - YYYY-MM-DD` section.
function extractSection(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingRe = new RegExp(`^##\\s*\\[${escaped}\\]\\s*-\\s*(\\d{4}-\\d{2}-\\d{2})`);
  const anyHeadingRe = /^##\s+/;

  let start = -1;
  let date = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m) {
      start = i + 1;
      date = m[1];
      break;
    }
  }
  if (start === -1) {
    throw new Error(`No changelog section found for version ${version} (expected "## [${version}] - YYYY-MM-DD")`);
  }

  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (anyHeadingRe.test(lines[i])) {
      end = i;
      break;
    }
  }

  const body = lines.slice(start, end).join("\n").trim();
  if (!body) throw new Error(`Changelog section for ${version} is empty`);
  return { body, date };
}

// Derive a one-line excerpt from the first bullet or paragraph of the section.
function deriveExcerpt(body, version) {
  const firstBullet = body.split(/\r?\n/).find((l) => /^\s*[-*]\s+/.test(l));
  if (firstBullet) {
    const text = firstBullet.replace(/^\s*[-*]\s+/, "").replace(/[`*_]/g, "").trim();
    return `LinkSlinger ${version}: ${text}`;
  }
  return `What's new in LinkSlinger ${version}.`;
}

function yamlEscape(s) {
  return s.replace(/"/g, '\\"');
}

function buildPost({ version, date, body, publish }) {
  const excerpt = deriveExcerpt(body, version);
  const frontMatter = [
    "---",
    `title: "LinkSlinger ${version} released"`,
    `date: ${date} 10:00:00 +0000`,
    "categories:",
    "  - product",
    "tags:",
    "  - linkslinger",
    "  - release",
    "excerpt: \"" + yamlEscape(excerpt) + "\"",
    "author: dontpoke",
    `published: ${publish ? "true" : "false"}`,
    "---",
    "",
  ].join("\n");

  const intro = `We've shipped **LinkSlinger ${version}**. Here's what changed in this release.`;
  const links = [
    "",
    "---",
    "",
    `**Get it:** [Chrome Web Store](https://chromewebstore.google.com/detail/linkslinger/pnjblgjiiomcbkgngghcdmnicjblcapo) · ` +
      `[Release notes on GitHub](https://github.com/DontPokeMe/linkslinger/releases/tag/v${version})`,
    "",
  ].join("\n");

  return `${frontMatter}${intro}\n\n${body}\n${links}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const changelog = fs.readFileSync(args.changelog, "utf8");
  const { body, date } = extractSection(changelog, args.version);

  const slug = `linkslinger-${args.version.replace(/\./g, "-")}`;
  const filename = `${date}-${slug}.md`;
  const outPath = path.join(args.out, filename);

  const post = buildPost({ version: args.version, date, body, publish: args.publish });

  fs.mkdirSync(args.out, { recursive: true });
  fs.writeFileSync(outPath, post, "utf8");
  process.stdout.write(outPath + "\n");
}

main();
