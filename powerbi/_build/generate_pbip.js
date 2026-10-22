#!/usr/bin/env node
/*
 * Generador del proyecto PBIP "Analisis_Ventas_Dos_Pinos" (taller comercial Dos Pinos).
 * Replica el reporte "ANÁLISIS DE VENTAS TOTALES": modelo semantico TMDL conectado a
 * Azure Databricks (tabla vtx_cmr_gestion_comercial) + reporte PBIR con medidas DAX.
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
  ["MES_L", "string", "type text"],
  ["LABOR_MES_ACT", "double", "type number", "0"],
  ["D_LABOR", "double", "type number", "0"],
  ["D_PENDI", "double", "type number", "0"],
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
  ["VTA_FCST_POND_COL", "double", "type number", "#,0"],
  ["VTA_PLAN_POND_COL", "double", "type number", "#,0"],
  ["VTA_POND_COL", "double", "type number", "#,0"],
  ["VTA_PROYECTADA_COL", "double", "type number", "#,0"],
  ["KL", "double", "type number", "#,0.0"],
  ["CANTB", "double", "type number", "#,0"],
];

// ── Medidas DAX: [nombre, expresion, formato, carpeta, descripcion] ──────────
const M = "#,0.0";
const PCT = "0.0%";
const INT = "#,0";
const c = (col) => `${T}[${col}]`;

const MEASURES = [
  // Montos en millones de colones
  ["Venta Real M", `DIVIDE(SUM(${c("VTA_COL")}), 1000000)`, M, "1. Ventas (M₡)", "Venta neta en millones de colones."],
  ["Venta Bruta M", `DIVIDE(SUM(${c("VTAB_COL")}), 1000000)`, M, "1. Ventas (M₡)", "Venta bruta en millones de colones."],
  ["Plan Mes M", `DIVIDE(SUM(${c("VTA_PLAN_COL")}), 1000000)`, M, "1. Ventas (M₡)", "Plan del mes completo (se carga el día 1)."],
  ["FCST Mes M", `DIVIDE(SUM(${c("VTA_FCST_COL")}), 1000000)`, M, "1. Ventas (M₡)", "Forecast del mes completo (se carga el día 1)."],
  ["Plan Pond M", `DIVIDE(SUM(${c("VTA_PLAN_POND_COL")}), 1000000)`, M, "1. Ventas (M₡)", "Plan ponderado a los días laborados (plan mes × laborados / laborables)."],
  ["FCST Pond M", `DIVIDE(SUM(${c("VTA_FCST_POND_COL")}), 1000000)`, M, "1. Ventas (M₡)", "Forecast ponderado a los días laborados."],
  ["Venta Proyectada M", `DIVIDE(SUM(${c("VTA_PROYECTADA_COL")}), 1000000)`, M, "1. Ventas (M₡)", "Proyección de cierre: venta real / laborados × laborables."],
  ["Dif vs Plan M", `[Venta Real M] - [Plan Pond M]`, M, "1. Ventas (M₡)", "Δ₡ contra el plan ponderado."],
  ["Dif vs FCST M", `[Venta Real M] - [FCST Pond M]`, M, "1. Ventas (M₡)", "Δ₡ contra el forecast ponderado."],
  // Cumplimiento
  ["% Cump Plan", `DIVIDE(SUM(${c("VTA_COL")}), SUM(${c("VTA_PLAN_POND_COL")}))`, PCT, "2. Cumplimiento", "Venta real / plan ponderado (como el reporte original)."],
  ["% Cump FCST", `DIVIDE(SUM(${c("VTA_COL")}), SUM(${c("VTA_FCST_POND_COL")}))`, PCT, "2. Cumplimiento", "Venta real / forecast ponderado."],
  ["% Avance Plan Mes", `DIVIDE(SUM(${c("VTA_COL")}), SUM(${c("VTA_PLAN_COL")}))`, PCT, "2. Cumplimiento", "Venta real / plan del mes completo."],
  ["% Avance FCST Mes", `DIVIDE(SUM(${c("VTA_COL")}), SUM(${c("VTA_FCST_COL")}))`, PCT, "2. Cumplimiento", "Venta real / forecast del mes completo."],
  ["% Proyeccion vs Plan", `DIVIDE(SUM(${c("VTA_PROYECTADA_COL")}), SUM(${c("VTA_PLAN_COL")}))`, PCT, "2. Cumplimiento", "Proyección de cierre / plan del mes."],
  // Avance diario
  ["Venta Acumulada M", `CALCULATE([Venta Real M], FILTER(ALL(${c("DIA_MES")}), ${c("DIA_MES")} <= MAX(${c("DIA_MES")})))`, M, "3. Avance diario", "Venta real acumulada hasta el día del mes."],
  ["Plan Pond Acumulado M", `CALCULATE([Plan Mes M], ALL(${c("DIA_MES")})) * DIVIDE(CALCULATE(DISTINCTCOUNT(${c("DIA_MES")}), FILTER(ALL(${c("DIA_MES")}), ${c("DIA_MES")} <= MAX(${c("DIA_MES")}))), MAX(${c("LABOR_MES_ACT")}))`, M, "3. Avance diario", "Plan del mes prorrateado por días con venta hasta el día del mes."],
  // Calidad comercial
  ["% Descuento", `DIVIDE(SUM(${c("DESC_COL")}), SUM(${c("VTAB_COL")}))`, PCT, "4. Calidad comercial", "Descuento sobre venta bruta."],
  ["% Devolucion", `DIVIDE(-SUM(${c("DEV_COL")}), SUM(${c("VTAB_COL")}))`, PCT, "4. Calidad comercial", "Devolución sobre venta bruta (DEV_COL viene en negativo)."],
  ["Clientes Activos", `DISTINCTCOUNT(${c("CLIENTE_ID")})`, INT, "4. Calidad comercial", "Clientes con movimiento."],
  ["SKUs", `DISTINCTCOUNT(${c("MAT_ID")})`, INT, "4. Calidad comercial", "Materiales distintos con movimiento."],
  ["Volumen KL", `SUM(${c("KL")})`, M, "4. Calidad comercial", "Volumen en kilolitros."],
  ["Venta Top 10 Material M", `IF(RANKX(ALLSELECTED(${c("MAT_DESC")}), [Venta Real M]) <= 10, [Venta Real M])`, M, "4. Calidad comercial", "Venta real solo para los 10 materiales de mayor venta en el filtro actual."],
  // Calendario comercial
  ["Dias Laborados", `MAX(${c("D_LABOR")})`, "0", "5. Calendario", "Días laborados del mes."],
  ["Dias Laborables", `MAX(${c("LABOR_MES_ACT")})`, "0", "5. Calendario", "Días laborables del mes."],
  ["Dias Pendientes", `MAX(${c("D_PENDI")})`, "0", "5. Calendario", "Días laborables pendientes."],
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

const MATRIX_VALUES = () => [
  projM("Venta Real M", "VENTA REAL"),
  projM("Plan Pond M", "PLAN POND."),
  projM("Dif vs Plan M", "Δ₡ PLAN"),
  projM("Dif vs FCST M", "Δ₡ FCST"),
  projM("% Cump Plan", "% CUMP PLAN"),
  projM("% Cump FCST", "% CUMP FCST"),
];
const matrixObjects = {
  columnHeaders: [{ properties: { backColor: color(GREEN), fontColor: color(WHITE), fontSize: num(9) } }],
  rowHeaders: [{ properties: { fontSize: num(9) } }],
  values: [{ properties: { fontSize: num(9) } }],
};
const matrix = (pageKey, box, rowCol, rowLabel, title) =>
  visual(pageKey, "pivotTable", box, {
    roles: { Rows: [projC(rowCol, rowLabel)], Values: MATRIX_VALUES() },
    title,
    objects: matrixObjects,
    sort: sortDesc("Venta Real M"),
  });

// ═══════════════════════════════════════════════════════════════════════════
// Pagina 1: Análisis de Ventas Totales (replica del reporte original)
// ═══════════════════════════════════════════════════════════════════════════
const P1 = "analisis";
const page1 = {
  key: P1,
  title: "Análisis de Ventas Totales",
  visuals: [
    textbox(P1, [20, 8, 720, 62], "ANÁLISIS DE VENTAS TOTALES", "Análisis de ventas en millones de colones · Plan y FCST ponderados a días laborados"),
    card(P1, [780, 10, 150, 60], "Dias Laborados", "LABORADOS"),
    card(P1, [945, 10, 150, 60], "Dias Laborables", "LABORABLES"),
    card(P1, [1110, 10, 150, 60], "Dias Pendientes", "PENDIENTES"),
    visual(P1, "lineClusteredColumnComboChart", [20, 80, 400, 260], {
      roles: {
        Category: [projC("DIA_MES", "Día del mes")],
        Y: [projM("Venta Acumulada M", "Venta acumulada")],
        Y2: [projM("Plan Pond Acumulado M", "Plan ponderado acumulado")],
      },
      title: "Avance de venta acumulada vs Plan ponderado",
      objects: {
        dataPoint: [
          { properties: { fill: color(GREEN_LIGHT) } },
          { properties: { fill: color(ORANGE) }, selector: { metadata: `${T}.Plan Pond Acumulado M` } },
        ],
      },
    }),
    card(P1, [20, 350, 126, 90], "% Cump Plan", "CUM% PLAN"),
    card(P1, [157, 350, 126, 90], "% Cump FCST", "CUM% FCST"),
    card(P1, [294, 350, 126, 90], "Venta Real M", "VENTA REAL (M₡)"),
    slicer(P1, [20, 450, 400, 80], "CLIGRP3_DESC", "Canal"),
    slicer(P1, [20, 540, 400, 80], "PROV_DESC", "Provincia"),
    slicer(P1, [20, 630, 400, 80], "MARCA", "Marca"),
    matrix(P1, [440, 80, 820, 290], "GERENCIA_BASE", "GERENCIA", "Reporte de Ventas por Gerencia (mes actual, Plan y FCST ponderados)"),
    matrix(P1, [440, 380, 820, 330], "CATEG", "CATEGORÍA", "Reporte de Ventas por Categoría (mes actual, Plan y FCST ponderados)"),
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Pagina 2: Detalle por Cliente y Material
// ═══════════════════════════════════════════════════════════════════════════
const P2 = "detalle";
const page2 = {
  key: P2,
  title: "Detalle por Cliente y Material",
  visuals: [
    textbox(P2, [20, 8, 900, 62], "DETALLE POR CLIENTE Y MATERIAL", "Venta, descuentos y devoluciones en millones de colones · mes actual"),
    card(P2, [20, 80, 236, 80], "Venta Real M", "VENTA REAL (M₡)"),
    card(P2, [266, 80, 236, 80], "Clientes Activos", "CLIENTES ACTIVOS"),
    card(P2, [512, 80, 236, 80], "SKUs", "SKUs"),
    card(P2, [758, 80, 246, 80], "% Descuento", "% DESCUENTO"),
    card(P2, [1014, 80, 246, 80], "% Devolucion", "% DEVOLUCIÓN"),
    visual(P2, "tableEx", [20, 170, 620, 540], {
      roles: {
        Values: [
          projC("CLIENTE_NOMBRE3", "CLIENTE"),
          projM("Venta Real M", "VENTA REAL"),
          projM("% Avance Plan Mes", "% AVANCE PLAN MES"),
          projM("% Descuento", "% DESC."),
          projM("% Devolucion", "% DEV."),
          projM("SKUs", "SKUs"),
        ],
      },
      title: "Venta por Cliente",
      objects: { columnHeaders: matrixObjects.columnHeaders, values: matrixObjects.values },
      sort: sortDesc("Venta Real M"),
    }),
    visual(P2, "clusteredBarChart", [650, 170, 610, 330], {
      roles: {
        Category: [projC("MAT_DESC", "Material")],
        Y: [projM("Venta Top 10 Material M", "Venta real (M₡)")],
      },
      title: "Top 10 materiales por venta",
      objects: { dataPoint: [{ properties: { fill: color(GREEN) } }] },
      sort: sortDesc("Venta Top 10 Material M"),
    }),
    visual(P2, "donutChart", [650, 510, 400, 200], {
      roles: {
        Category: [projC("NEGOCIO", "Negocio")],
        Y: [projM("Venta Real M", "Venta real (M₡)")],
      },
      title: "Venta por Negocio",
    }),
    slicer(P2, [1060, 510, 200, 95], "CLIGRP3_DESC", "Canal"),
    slicer(P2, [1060, 615, 200, 95], "MARCA", "Marca"),
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
  md += `> **Plan y FCST ponderados.** El plan y el forecast del mes se cargan completos el día 1. `;
  md += `\`VTA_PLAN_POND_COL\` y \`VTA_FCST_POND_COL\` ya vienen prorrateados a los días laborados `;
  md += `(15 de 27), así que \`% Cump Plan\` compara contra lo que se esperaba vender a la fecha, igual que el reporte original. `;
  md += `\`% Avance Plan Mes\` compara contra el mes completo.\n\n`;
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
  md += `EVALUATE\n\tSUMMARIZECOLUMNS(\n\t\t${T}[GERENCIA_BASE],\n\t\t"Venta Real M", [Venta Real M],\n\t\t"% Cump Plan", [% Cump Plan],\n\t\t"% Cump FCST", [% Cump FCST]\n\t)\n\`\`\`\n`;
  writeText(path.join(OUT, "medidas_dax.md"), md);
}

build([page1, page2]);
writeMeasuresDoc();
console.log("Listo. Salida en:", OUT);
