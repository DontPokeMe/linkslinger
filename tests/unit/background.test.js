const test = require("node:test");
const assert = require("node:assert/strict");
const { loadBackground, loadContent, get, plain } = require("./helpers");

const bg = loadBackground();
const sm = get(bg, "settingsManager");

test("normalizeSettings: null/garbage input yields defaults", () => {
  assert.deepEqual(plain(sm.normalizeSettings(null)), plain(sm.initDefaults()));
  assert.deepEqual(plain(sm.normalizeSettings("nope")), plain(sm.initDefaults()));
});

test("normalizeSettings is idempotent on defaults and on messy input", () => {
  const once = sm.normalizeSettings(sm.initDefaults());
  assert.deepEqual(plain(sm.normalizeSettings(once)), plain(once));

  const messy = {
    actions: { "101": { action: "window", color: "red", options: { copy: 99 } }, "bad": null },
    blocked: ["foo", 3, null],
    profiles: [
      { trigger: { kind: "key", key: " Q ", mods: { shift: 1 } }, actionId: "101" },
      { trigger: { kind: "key", key: "q", mods: { shift: true } }, actionId: "101" }
    ]
  };
  const n1 = sm.normalizeSettings(messy);
  assert.deepEqual(plain(sm.normalizeSettings(n1)), plain(n1));
});

test("normalizeSettings does not mutate its input", () => {
  const input = { actions: { "101": { action: "window" } }, profiles: [] };
  const snapshot = JSON.stringify(input);
  sm.normalizeSettings(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test("normalizeSettings migrates 'window' -> 'win' and rejects unknown actions", () => {
  const out = sm.normalizeSettings({ actions: { "101": { action: "window" }, "102": { action: "launch" } } });
  assert.equal(out.actions["101"].action, "win");
  assert.equal(out.actions["102"].action, "tabs");
});

test("normalizeSettings validates colors and copy format", () => {
  const out = sm.normalizeSettings({
    actions: {
      "101": { action: "copy", color: "#12abEF", options: { copy: 6 } },
      "102": { action: "copy", color: "blue", options: { copy: 7 } }
    }
  });
  assert.equal(out.actions["101"].color, "#12abEF");
  assert.equal(out.actions["101"].options.copy, 6);
  assert.equal(out.actions["102"].color, "#FFA500");
  assert.equal(out.actions["102"].options.copy, 1);
});

test("normalizeSettings always ensures Bookmark action 104", () => {
  const out = sm.normalizeSettings({ actions: { "101": { action: "tabs" } } });
  assert.equal(out.actions["104"].action, "bm");
});

test("normalizeSettings lowercases keys, drops duplicate triggers and dangling actionIds", () => {
  const out = sm.normalizeSettings({
    actions: { "101": { action: "tabs" } },
    profiles: [
      { id: "a", trigger: { kind: "key", key: "X" }, actionId: "101" },
      { id: "b", trigger: { kind: "key", key: "x" }, actionId: "101" },
      { id: "c", trigger: { kind: "key", key: "y" }, actionId: "999" }
    ]
  });
  assert.deepEqual(plain(out.profiles.map((p) => p.id)), ["a", "c"]);
  assert.equal(out.profiles[0].trigger.key, "x");
  assert.equal(out.profiles[1].actionId, "101");
});

test("formatLink covers all 7 copy formats", () => {
  const formatLink = get(bg, "formatLink");
  const link = { url: "https://a.test/x", title: "A" };
  assert.equal(formatLink(link, 0), "A\thttps://a.test/x\n");
  assert.equal(formatLink(link, 1), "https://a.test/x\n");
  assert.equal(formatLink(link, 2), "https://a.test/x ");
  assert.equal(formatLink(link, 3), "A\n");
  assert.equal(formatLink(link, 4), '<a href="https://a.test/x">A</a>\n');
  assert.equal(formatLink(link, 5), '<li><a href="https://a.test/x">A</a></li>\n');
  assert.equal(formatLink(link, 6), "[A](https://a.test/x)\n");
});

test("triggerSig (background) and triggerSigContent (content) stay in parity", () => {
  const triggerSig = get(bg, "triggerSig");
  const { context: ct } = loadContent();
  const triggerSigContent = get(ct, "triggerSigContent");
  const cases = [
    { kind: "key", key: "z", mods: {}, mouseButton: 0 },
    { kind: "key", key: "Z", mods: { shift: true, meta: true }, mouseButton: 2 },
    { kind: "key", key: " c ", mods: { alt: true }, mouseButton: 0 },
    { kind: "mods", mods: { ctrl: true } },
    { kind: "key", key: "", mods: { shift: true }, mouseButton: 1 }
  ];
  for (const t of cases) {
    assert.equal(triggerSigContent(t), triggerSig(t), JSON.stringify(t));
  }
});
