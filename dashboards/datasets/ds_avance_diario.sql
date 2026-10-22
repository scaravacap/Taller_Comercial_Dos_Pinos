WITH fechas AS (
  SELECT DISTINCT FECHA_CONTAB AS fecha FROM vtx_cmr_gestion_comercial
), dims AS (
  SELECT DISTINCT GERENCIA_BASE AS gerencia_base, CLIGRP3_DESC AS canal_nivel3 FROM vtx_cmr_gestion_comercial
), diario AS (
  SELECT FECHA_CONTAB AS fecha, GERENCIA_BASE AS gerencia_base, CLIGRP3_DESC AS canal_nivel3,
         SUM(VTA_COL) AS venta_dia, SUM(VTA_PLAN_COL) AS plan_mes
  FROM vtx_cmr_gestion_comercial GROUP BY ALL
), grilla AS (
  SELECT f.fecha, d.gerencia_base, d.canal_nivel3,
         COALESCE(x.venta_dia, 0) AS venta_dia,
         SUM(COALESCE(x.plan_mes, 0)) OVER (PARTITION BY d.gerencia_base, d.canal_nivel3) AS plan_mes,
         DENSE_RANK() OVER (ORDER BY f.fecha) AS dia_laboral
  FROM fechas f CROSS JOIN dims d
  LEFT JOIN diario x ON x.fecha = f.fecha AND x.gerencia_base = d.gerencia_base AND x.canal_nivel3 = d.canal_nivel3
)
SELECT fecha, gerencia_base, canal_nivel3, venta_dia,
       SUM(venta_dia) OVER (PARTITION BY gerencia_base, canal_nivel3 ORDER BY fecha) AS venta_acumulada,
       plan_mes * dia_laboral / 27 AS plan_prorrateado
FROM grilla
ORDER BY fecha
