// Valida cada JSON de un PBIP contra el $schema que declara (descarga refs recursivamente).
const fs = require("fs");
const path = require("path");
const Ajv07 = require("ajv").default;
const Ajv2020 = require("ajv/dist/2020").default;
const Ajv2019 = require("ajv/dist/2019").default;
const addFormats = require("ajv-formats");

const root = process.argv[2];
const cache = {};
async function fetchJSON(u) {
  if (cache[u]) return cache[u];
  const f = path.join(require("os").tmpdir(), "pbir-schemas", encodeURIComponent(u));
  if (fs.existsSync(f)) return (cache[u] = JSON.parse(fs.readFileSync(f, "utf8")));
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`);
  const j = await r.json();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(j));
  return (cache[u] = j);
}
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(json|pbir|pbism|pbip|platform)$/.test(e.name) || e.name === ".platform") out.push(p);
  }
  return out;
}
function collectRefs(obj, base, acc) {
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (k === "$ref" && typeof v === "string" && !v.startsWith("#")) {
        acc.add(new URL(v.split("#")[0], base).href);
      } else collectRefs(v, base, acc);
    }
  }
}
(async () => {
  const files = walk(root);
  let errors = 0;
  const ajvs = {};
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(f, "utf8"));
    const su = doc.$schema;
    if (!su) { console.log("NO $schema:", f); errors++; continue; }
    const schema = await fetchJSON(su);
    const meta = schema.$schema || "";
    const Cls = meta.includes("2020-12") ? Ajv2020 : meta.includes("2019-09") ? Ajv2019 : Ajv07;
    const key = su;
    if (!ajvs[key]) {
      const ajv = new Cls({ strict: false, allErrors: true, loadSchema: fetchJSON });
      addFormats(ajv);
      ajvs[key] = await ajv.compileAsync(schema);
    }
    const ok = ajvs[key](doc);
    const rel = path.relative(root, f);
    if (!ok) {
      errors++;
      console.log("FAIL", rel);
      for (const e of ajvs[key].errors.slice(0, 8)) console.log("   ", e.instancePath, e.message, JSON.stringify(e.params));
    } else console.log("ok  ", rel);
  }
  console.log(`\n${files.length} archivos, ${errors} con errores`);
  process.exit(errors ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
