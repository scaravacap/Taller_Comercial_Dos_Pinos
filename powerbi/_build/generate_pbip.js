#!/usr/bin/env node
/*
 * Generador del proyecto PBIP "Analisis_Ventas_Dos_Pinos" (taller comercial Dos Pinos).
 * Reporte de gestion comercial para la demo de /importBI: modelo semantico TMDL conectado a
 * Azure Databricks (tabla vtx_cmr_gestion_comercial) + reporte PBIR con medidas DAX alineadas
 * a la metric view vgd_cmr_gestion_comercial.
 * Basado en el generador de taller-aibi-dashboards, que ya abre en Power BI Desktop.
 *
 * Uso:    node generate_pbip.js
 * Salida: ../Analisis_Ventas_Dos_Pinos.pbip (+ .Report/ y .SemanticModel/) y ../medidas_dax.md
 *
 * El PBIP no lleva datos ni credenciales: Desktop pide iniciar sesion al refrescar.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const OUT = path.resolve(__dirname, "..");
const PROJECT = "Analisis_Ventas_Dos_Pinos";
const DISPLAY = "Análisis de Ventas Dos Pinos";

// IDs deterministas: regenerar no ensucia el diff de git.
const hash = (s, n) => crypto.createHash("sha1").update(s).digest("hex").slice(0, n);
const uuidFrom = (s) => {
  const h = hash(s, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// ── Conexion Databricks ──────────────────────────────────────────────────────
const HOST = process.env.DATABRICKS_HOST || "adb-0000000000000000.0.azuredatabricks.net";
const HTTP_PATH = process.env.DATABRICKS_HTTP_PATH || "/sql/1.0/warehouses/0000000000000000";
const CATALOG = process.env.DATABRICKS_CATALOG || "prd_gold";
const SCHEMA = process.env.DATABRICKS_SCHEMA || "bix_cmr_ab_nacional";
const T = "vtx_cmr_gestion_comercial";

// ── Esquemas PBIR (versiones que ya abrieron en Desktop; no subirlas) ────────
const S = {
  vc: "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.4.0/schema.json",
  page: "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json",
  pages: "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
  report: "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.0.0/schema.json",
  version: "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json",
  pbir: "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
  pbism: "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json",
  pbip: "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
  platform: "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
};

// ── Paleta Dos Pinos (colores a nivel de visual, sin archivo de tema) ────────
const GREEN = "#00843D";
const GREEN_LIGHT = "#5DB760";
const ORANGE = "#F2A900";
const WHITE = "#FFFFFF";
const PAGE_BG = "#F2F5F3";

// ── Columnas del modelo: [nombre, tipoTMDL, tipoM, formato] ───────────────────
const COLS = [
  ["FECHA_CONTAB", "dateTime", "type date", "Short Date"],
  ["DIA_MES", "int64", "Int64.Type"],
  ["LABOR_MES_ACT", "double", "type number", "0"],
  ["D_LABOR", "double", "type number", "0"],
  ["GERENCIA_BASE", "string", "type text"],
  ["CLIGRP3_DESC", "string", "type text"],
  ["FORMATO_DESC", "string", "type text"],
  ["CADENA_DESC", "string", "type text"],
  ["PROV_DESC", "string", "type text"],
  ["EJECUTIVO_DESC", "string", "type text"],
  ["CLIENTE_NOMBRE3", "string", "type text"],
  ["CLIENTE_ID", "string", "type text"],
  ["CATEG", "string", "type text"],
  ["SUBCATEG", "string", "type text"],
  ["MARCA", "string", "type text"],
  ["MAT_DESC", "string", "type text"],
  ["MAT_ID", "string", "type text"],
  ["NEGOCIO", "string", "type text"],
  ["VTA_COL", "double", "type number", "#,0"],
  ["VTAB_COL", "double", "type number", "#,0"],
  ["DESC_COL", "double", "type number", "#,0"],
  ["DEV_COL", "double", "type number", "#,0"],
  ["VTA_FCST_COL", "double", "type number", "#,0"],
  ["VTA_PLAN_COL", "double", "type number", "#,0"],
  ["VTA_PROYECTADA_COL", "double", "type number", "#,0"],
  ["KL", "double", "type number", "#,0.0"],
];

// ── Medidas DAX: [nombre, expresion, formato, carpeta, descripcion] ──────────
const M = "#,0.0";
const PCT = "0.0%";
const INT = "#,0";
const c = (col) => `${T}[${col}]`;

const PTS = "+0.0;-0.0;0.0";
const MEASURES = [
  // Montos en millones de colones; mismas definiciones que la metric view vgd_cmr_gestion_comercial
  ["Venta Neta M", `DIVIDE(SUM(${c("VTA_COL")}), 1000000)`, M, "1. Ventas (M₡)", "Venta neta en millones de colones (venta_neta_col en la metric view)."],
  ["Plan Mes M", `DIVIDE(SUM(${c("VTA_PLAN_COL")}), 1000000)`, M, "1. Ventas (M₡)", "Plan del mes completo, cargado el día 1 (venta_plan_col)."],
  ["FCST Mes M", `DIVIDE(SUM(${c("VTA_FCST_COL")}), 1000000)`, M, "1. Ventas (M₡)", "Forecast comercial del mes completo, cargado el día 1 (venta_fcst_col)."],
  ["Falta para Plan M", `[Plan Mes M] - [Venta Neta M]`, M, "1. Ventas (M₡)", "Venta que falta para cumplir el plan del mes."],
  ["Proyeccion Cierre M", `DIVIDE(SUM(${c("VTA_PROYECTADA_COL")}), 1000000)`, M, "1. Ventas (M₡)", "Proyección de cierre de Dos Pinos: venta real / días laborados × días laborables (venta_proyectada_col)."],
  // Cumplimiento
  ["% Cumplimiento Plan", `DIVIDE(SUM(${c("VTA_COL")}), SUM(${c("VTA_PLAN_COL")}))`, PCT, "2. Cumplimiento", "Venta neta / plan del mes (cumplimiento_plan_col)."],
  ["% Cumplimiento FCST", `DIVIDE(SUM(${c("VTA_COL")}), SUM(${c("VTA_FCST_COL")}))`, PCT, "2. Cumplimiento", "Venta neta / forecast del mes (cumplimiento_fcst_col)."],
  ["% Avance Esperado", `DIVIDE(MAX(${c("D_LABOR")}), MAX(${c("LABOR_MES_ACT")}))`, PCT, "2. Cumplimiento", "Días laborados / días laborables del mes: lo que debería llevarse vendido hoy."],
  ["Brecha vs Avance pts", `([% Cumplimiento Plan] - [% Avance Esperado]) * 100`, PTS, "2. Cumplimiento", "Puntos de cumplimiento por encima (+) o por debajo (-) del avance esperado."],
  ["% Proyeccion vs Plan", `DIVIDE(SUM(${c("VTA_PROYECTADA_COL")}), SUM(${c("VTA_PLAN_COL")}))`, PCT, "2. Cumplimiento", "Proyección de cierre / plan del mes."],
  // Avance diario
  ["Venta Acumulada M", `CALCULATE([Venta Neta M], FILTER(ALL(${c("DIA_MES")}), ${c("DIA_MES")} <= MAX(${c("DIA_MES")})))`, M, "3. Avance diario", "Venta neta acumulada hasta el día del mes."],
  ["Plan Prorrateado Acumulado M", `CALCULATE([Plan Mes M], ALL(${c("DIA_MES")})) * DIVIDE(CALCULATE(DISTINCTCOUNT(${c("DIA_MES")}), FILTER(ALL(${c("DIA_MES")}), ${c("DIA_MES")} <= MAX(${c("DIA_MES")}))), MAX(${c("LABOR_MES_ACT")}))`, M, "3. Avance diario", "Plan del mes prorrateado por los días laborados hasta el día del mes."],
  // Calidad comercial
  ["% Descuento", `DIVIDE(SUM(${c("DESC_COL")}), SUM(${c("VTAB_COL")}))`, PCT, "4. Calidad comercial", "Descuento sobre venta bruta."],
  ["% Devolucion", `DIVIDE(-SUM(${c("DEV_COL")}), SUM(${c("VTAB_COL")}))`, "0.00%", "4. Calidad comercial", "Devolución sobre venta bruta (DEV_COL viene en negativo)."],
  ["Clientes Activos", `DISTINCTCOUNT(${c("CLIENTE_ID")})`, INT, "4. Calidad comercial", "Clientes con movimiento (clientes_activos)."],
  ["SKUs Vendidos", `DISTINCTCOUNT(${c("MAT_ID")})`, INT, "4. Calidad comercial", "Materiales distintos con movimiento (skus_vendidos)."],
  ["Volumen KL", `SUM(${c("KL")})`, M, "4. Calidad comercial", "Volumen en kilolitros (kilolitros)."],
  // Calendario comercial
  ["Dias Laborados", `MAX(${c("D_LABOR")})`, "0", "5. Calendario", "Días laborados del mes."],
  ["Dias Laborables", `MAX(${c("LABOR_MES_ACT")})`, "0", "5. Calendario", "Días laborables del mes."],
];

// ── TMDL ─────────────────────────────────────────────────────────────────────
function tmdlTable() {
  let s = `table ${T}\n\tlineageTag: ${uuidFrom("table:" + T)}\n\n`;
  for (const [name, expr, fmt, folder, desc] of MEASURES) {
    s += `\t/// ${desc}\n`;
    s += `\tmeasure '${name}' = ${expr}\n`;
    s += `\t\tformatString: ${fmt}\n`;
    s += `\t\tdisplayFolder: ${folder}\n`;
    s += `\t\tlineageTag: ${uuidFrom("measure:" + name)}\n\n`;
  }
  for (const [name, dtype, , fmt] of COLS) {
    s += `\tcolumn ${name}\n\t\tdataType: ${dtype}\n`;
    if (fmt) s += `\t\tformatString: ${fmt}\n`;
    s += `\t\tlineageTag: ${uuidFrom("column:" + name)}\n`;
    s += `\t\tsummarizeBy: none\n\t\tsourceColumn: ${name}\n\n`;
  }
  const names = COLS.map(([n]) => `"${n}"`).join(", ");
  const types = COLS.map(([n, , mt]) => `{"${n}", ${mt}}`).join(", ");
  s += `\tpartition ${T} = m\n\t\tmode: import\n\t\tsource =\n`;
  s += `\t\t\t\tlet\n`;
  s += `\t\t\t\t    Source = Databricks.Catalogs("${HOST}", "${HTTP_PATH}", [Implementation="2.0"]),\n`;
  s += `\t\t\t\t    Catalogo = Source{[Name="${CATALOG}",Kind="Database"]}[Data],\n`;
  s += `\t\t\t\t    Esquema = Catalogo{[Name="${SCHEMA}",Kind="Schema"]}[Data],\n`;
  s += `\t\t\t\t    Tabla = Esquema{[Name="${T}",Kind="Table"]}[Data],\n`;
  s += `\t\t\t\t    Columnas = Table.SelectColumns(Tabla, {${names}}),\n`;
  s += `\t\t\t\t    Tipos = Table.TransformColumnTypes(Columnas, {${types}})\n`;
  s += `\t\t\t\tin\n\t\t\t\t    Tipos\n\n`;
  s += `\tannotation PBI_ResultType = Table\n`;
  return s;
}

// ── PBIR helpers ─────────────────────────────────────────────────────────────
const lit = (v) => ({ expr: { Literal: { Value: v } } });
const str = (t) => lit(`'${t.replace(/'/g, "''")}'`);
const color = (hex) => ({ solid: { color: str(hex) } });
const num = (n) => lit(`${n}D`);
const TRUE = lit("true");

const colRef = (col) => ({ Column: { Expression: { SourceRef: { Entity: T } }, Property: col } });
const msrRef = (m) => ({ Measure: { Expression: { SourceRef: { Entity: T } }, Property: m } });
const projC = (col, displayName) => ({
  field: colRef(col),
  queryRef: `${T}.${col}`,
  nativeQueryRef: col,
  ...(displayName ? { displayName } : {}),
});
const projM = (m, displayName) => ({
  field: msrRef(m),
  queryRef: `${T}.${m}`,
  nativeQueryRef: m,
  ...(displayName ? { displayName } : {}),
});
const sortDesc = (m) => ({ sort: [{ field: msrRef(m), direction: "Descending" }], isDefaultSort: true });

function containerObjects(title) {
  const o = {
    background: [{ properties: { show: TRUE, color: color(WHITE), transparency: num(0) } }],
  };
  if (title) {
    o.title = [{ properties: { show: TRUE, text: str(title), fontColor: color(GREEN), bold: TRUE, fontSize: num(11) } }];
  }
  return o;
}

let seq = 0;
function visual(pageKey, type, [x, y, w, h], { roles, title, objects, sort } = {}) {
  seq += 1;
  const name = hash(`${pageKey}:${seq}:${type}`, 20);
  const v = { visualType: type };
  if (roles) {
    const queryState = {};
    for (const [role, projs] of Object.entries(roles)) queryState[role] = { projections: projs };
    v.query = { queryState, ...(sort ? { sortDefinition: sort } : {}) };
  }
  if (objects) v.objects = objects;
  v.visualContainerObjects = containerObjects(title);
  if (type === "textbox") delete v.visualContainerObjects.background;
  return {
    $schema: S.vc,
    name,
    position: { x, y, z: seq * 1000, height: h, width: w, tabOrder: seq * 1000 },
    visual: v,
  };
}

const textbox = (pageKey, box, title, subtitle) =>
  visual(pageKey, "textbox", box, {
    objects: {
      general: [
        {
          properties: {
            paragraphs: [
              { textRuns: [{ value: title, textStyle: { fontWeight: "bold", fontSize: "22pt", color: GREEN } }] },
              { textRuns: [{ value: subtitle, textStyle: { fontSize: "10pt", color: "#4D4D4D" } }] },
            ],
          },
        },
      ],
    },
  });

const card = (pageKey, box, measure, label) =>
  visual(pageKey, "cardVisual", box, { roles: { Data: [projM(measure, label)] } });

const slicer = (pageKey, box, col, label) =>
  visual(pageKey, "slicer", box, {
    roles: { Values: [projC(col, label)] },
    title: label,
    objects: { data: [{ properties: { mode: str("Dropdown") } }] },
  });

const tblObjects = {
  columnHeaders: [{ properties: { backColor: color(GREEN), fontColor: color(WHITE), fontSize: num(9) } }],
  values: [{ properties: { fontSize: num(9) } }],
};
const seriesColors = (a, b) => ({
  dataPoint: [
    { properties: { fill: color(GREEN) }, selector: { metadata: `${T}.${a}` } },
    { properties: { fill: color(ORANGE) }, selector: { metadata: `${T}.${b}` } },
  ],
});

// Encabezado comun: titulo + 3 filtros desplegables
const header = (pg, title, subtitle) => [
  textbox(pg, [20, 8, 600, 64], title, subtitle),
  slicer(pg, [640, 8, 200, 64], "GERENCIA_BASE", "Gerencia"),
  slicer(pg, [850, 8, 200, 64], "CLIGRP3_DESC", "Canal"),
  slicer(pg, [1060, 8, 200, 64], "MARCA", "Marca"),
];
// Banda de 6 KPI
const kpis = (pg, list) => list.map(([m, label], i) => card(pg, [20 + i * 208, 84, 196, 96], m, label));

// ═══════════════════════════════════════════════════════════════════════════
// Pagina 1: Resumen del mes
// ═══════════════════════════════════════════════════════════════════════════
const P1 = "resumen";
const page1 = {
  key: P1,
  title: "Resumen del mes",
  visuals: [
    ...header(P1, "GESTIÓN COMERCIAL · OCTUBRE 2026", "Millones de colones. Plan y forecast del mes completo, cargados el día 1."),
    ...kpis(P1, [
      ["Venta Neta M", "Venta neta (M₡)"],
      ["Plan Mes M", "Plan del mes (M₡)"],
      ["% Cumplimiento Plan", "Cumplimiento plan"],
      ["% Avance Esperado", "Avance esperado"],
      ["Brecha vs Avance pts", "Brecha (pts)"],
      ["% Proyeccion vs Plan", "Proyección cierre"],
    ]),
    visual(P1, "lineChart", [20, 192, 620, 262], {
      roles: {
        Category: [projC("DIA_MES", "Día del mes")],
        Y: [projM("Venta Acumulada M", "Venta acumulada"), projM("Plan Prorrateado Acumulado M", "Plan prorrateado")],
      },
      title: "Venta acumulada vs plan prorrateado (M₡)",
      objects: seriesColors("Venta Acumulada M", "Plan Prorrateado Acumulado M"),
    }),
    visual(P1, "clusteredColumnChart", [652, 192, 608, 262], {
      roles: {
        Category: [projC("GERENCIA_BASE", "Gerencia")],
        Y: [projM("Venta Neta M", "Venta neta"), projM("Plan Mes M", "Plan del mes")],
      },
      title: "Venta neta vs plan por gerencia (M₡)",
      objects: seriesColors("Venta Neta M", "Plan Mes M"),
      sort: sortDesc("Venta Neta M"),
    }),
    visual(P1, "tableEx", [20, 466, 1240, 244], {
      roles: {
        Values: [
          projC("CATEG", "Categoría"),
          projM("Venta Neta M", "Venta neta (M₡)"),
          projM("Plan Mes M", "Plan (M₡)"),
          projM("Falta para Plan M", "Falta para plan (M₡)"),
          projM("% Cumplimiento Plan", "% Cumplimiento"),
          projM("Brecha vs Avance pts", "Brecha (pts)"),
          projM("% Descuento", "% Descuento"),
          projM("% Devolucion", "% Devolución"),
        ],
      },
      title: "Desempeño por categoría",
      objects: tblObjects,
      sort: sortDesc("Venta Neta M"),
    }),
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Pagina 2: Clientes y calidad comercial
// ═══════════════════════════════════════════════════════════════════════════
const P2 = "clientes";
const page2 = {
  key: P2,
  title: "Clientes y calidad comercial",
  visuals: [
    ...header(P2, "CLIENTES Y CALIDAD COMERCIAL", "Cumplimiento, descuentos y devoluciones por cliente. Millones de colones."),
    ...kpis(P2, [
      ["Clientes Activos", "Clientes activos"],
      ["SKUs Vendidos", "SKUs vendidos"],
      ["% Cumplimiento FCST", "Cumplimiento FCST"],
      ["% Descuento", "Descuento"],
      ["% Devolucion", "Devolución"],
      ["Volumen KL", "Volumen (KL)"],
    ]),
    visual(P2, "tableEx", [20, 192, 760, 518], {
      roles: {
        Values: [
          projC("CLIENTE_NOMBRE3", "Cliente"),
          projC("GERENCIA_BASE", "Gerencia"),
          projM("Venta Neta M", "Venta neta (M₡)"),
          projM("Plan Mes M", "Plan (M₡)"),
          projM("% Cumplimiento Plan", "% Cumplimiento"),
          projM("Brecha vs Avance pts", "Brecha (pts)"),
          projM("% Descuento", "% Desc."),
          projM("% Devolucion", "% Dev."),
        ],
      },
      title: "Desempeño por cliente",
      objects: tblObjects,
      sort: sortDesc("Venta Neta M"),
    }),
    visual(P2, "clusteredBarChart", [792, 192, 468, 318], {
      roles: {
        Category: [projC("MARCA", "Marca")],
        Y: [projM("Venta Neta M", "Venta neta (M₡)")],
      },
      title: "Venta neta por marca (M₡)",
      objects: { dataPoint: [{ properties: { fill: color(GREEN) } }] },
      sort: sortDesc("Venta Neta M"),
    }),
    visual(P2, "donutChart", [792, 522, 468, 188], {
      roles: {
        Category: [projC("GERENCIA_BASE", "Gerencia")],
        Y: [projM("Venta Neta M", "Venta neta (M₡)")],
      },
      title: "Participación por gerencia",
    }),
  ],
};

// ── Escritura ────────────────────────────────────────────────────────────────
function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}
function writeText(p, txt) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, txt, "utf8");
}

function build(pages) {
  const base = path.join(OUT, PROJECT);
  const rep = base + ".Report";
  const sem = base + ".SemanticModel";
  for (const d of [rep, sem]) fs.rmSync(d, { recursive: true, force: true });

  writeJSON(base + ".pbip", {
    $schema: S.pbip,
    version: "1.0",
    artifacts: [{ report: { path: `${PROJECT}.Report` } }],
    settings: { enableAutoRecovery: true },
  });

  // Modelo semantico
  writeJSON(path.join(sem, ".platform"), {
    $schema: S.platform,
    metadata: { type: "SemanticModel", displayName: DISPLAY },
    config: { version: "2.0", logicalId: uuidFrom("sem:" + PROJECT) },
  });
  writeJSON(path.join(sem, "definition.pbism"), { $schema: S.pbism, version: "4.2", settings: {} });
  writeText(path.join(sem, "definition", "database.tmdl"), `database\n\tcompatibilityLevel: 1567\n`);
  writeText(
    path.join(sem, "definition", "model.tmdl"),
    `model Model\n\tculture: es-ES\n\tdefaultPowerBIDataSourceVersion: powerBI_V3\n\tsourceQueryCulture: es-ES\n\n` +
      `\tannotation PBI_QueryOrder = ["${T}"]\n\n` +
      `ref table ${T}\n`
  );
  writeText(path.join(sem, "definition", "tables", `${T}.tmdl`), tmdlTable());

  // Reporte
  writeJSON(path.join(rep, ".platform"), {
    $schema: S.platform,
    metadata: { type: "Report", displayName: DISPLAY },
    config: { version: "2.0", logicalId: uuidFrom("rep:" + PROJECT) },
  });
  writeJSON(path.join(rep, "definition.pbir"), {
    $schema: S.pbir,
    version: "4.0",
    datasetReference: { byPath: { path: `../${PROJECT}.SemanticModel` } },
  });
  writeJSON(path.join(rep, "definition", "version.json"), { $schema: S.version, version: "2.0.0" });
  // themeCollection vacio: nunca referenciar un baseTheme sin su archivo (rompe la carga).
  writeJSON(path.join(rep, "definition", "report.json"), { $schema: S.report, themeCollection: {} });

  const pageNames = [];
  for (const pg of pages) {
    const pageName = "ReportSection" + hash("page:" + pg.key, 20);
    pageNames.push(pageName);
    const pageDir = path.join(rep, "definition", "pages", pageName);
    writeJSON(path.join(pageDir, "page.json"), {
      $schema: S.page,
      name: pageName,
      displayName: pg.title,
      displayOption: "FitToPage",
      height: 720,
      width: 1280,
      objects: { background: [{ properties: { color: color(PAGE_BG), transparency: num(0) } }] },
    });
    for (const v of pg.visuals) writeJSON(path.join(pageDir, "visuals", v.name, "visual.json"), v);
  }
  writeJSON(path.join(rep, "definition", "pages", "pages.json"), {
    $schema: S.pages,
    pageOrder: pageNames,
    activePageName: pageNames[0],
  });

  const nVis = pages.reduce((a, p) => a + p.visuals.length, 0);
  console.log(`OK  ${PROJECT}  (${pages.length} páginas, ${nVis} visuales, ${MEASURES.length} medidas, ${COLS.length} columnas)`);
}

function writeMeasuresDoc() {
  let md = `# Medidas DAX: Análisis de Ventas Dos Pinos\n\n`;
  md += `Generado por \`_build/generate_pbip.js\`. Todas viven en la tabla \`${T}\` del modelo `;
  md += `(\`${PROJECT}.SemanticModel\`). Montos en millones de colones (M₡).\n\n`;
  md += `> **Mismas definiciones que la metric view.** El plan y el forecast del mes se cargan completos el día 1, `;
  md += `así que \`% Cumplimiento Plan\` compara la venta neta contra el mes completo, igual que \`cumplimiento_plan_col\` `;
  md += `en \`vgd_cmr_gestion_comercial\`. Para saber si se va atrasado se compara contra \`% Avance Esperado\` `;
  md += `(días laborados / laborables, 15 de 27): \`Brecha vs Avance pts\` es la diferencia en puntos.\n\n`;
  let folder = null;
  for (const [name, expr, fmt, f, desc] of MEASURES) {
    if (f !== folder) {
      md += `## ${f}\n\n`;
      folder = f;
    }
    md += `### ${name}\n\n${desc} Formato: \`${fmt}\`.\n\n\`\`\`dax\n${name} = ${expr}\n\`\`\`\n\n`;
  }
  md += `## Bloque para "Vista de consulta DAX"\n\nPega esto en la vista de consulta DAX de Power BI Desktop para probar las medidas sueltas:\n\n\`\`\`dax\nDEFINE\n`;
  for (const [name, expr] of MEASURES) md += `\tMEASURE ${T}[${name}] = ${expr}\n`;
  md += `EVALUATE\n\tSUMMARIZECOLUMNS(\n\t\t${T}[GERENCIA_BASE],\n\t\t"Venta Neta M", [Venta Neta M],\n\t\t"% Cumplimiento Plan", [% Cumplimiento Plan],\n\t\t"Brecha vs Avance pts", [Brecha vs Avance pts]\n\t)\n\`\`\`\n`;
  writeText(path.join(OUT, "medidas_dax.md"), md);
}

build([page1, page2]);
writeMeasuresDoc();
console.log("Listo. Salida en:", OUT);
