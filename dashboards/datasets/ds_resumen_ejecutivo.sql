WITH g AS (
  SELECT GERENCIA_BASE AS gerencia_base,
         ROUND(SUM(VTA_COL) / 1e6, 1) AS venta_neta_millones,
         ROUND(TRY_DIVIDE(SUM(VTA_COL), SUM(VTA_PLAN_COL)) * 100, 1) AS cumplimiento_plan_pct,
         ROUND(TRY_DIVIDE(SUM(DESC_COL), SUM(VTAB_COL)) * 100, 2) AS descuento_pct
  FROM vtx_cmr_gestion_comercial
  GROUP BY ALL
), cat AS (
  SELECT GERENCIA_BASE AS gerencia_base, MAX_BY(CATEG, venta) AS categoria_lider
  FROM (SELECT GERENCIA_BASE, CATEG, SUM(VTA_COL) AS venta FROM vtx_cmr_gestion_comercial GROUP BY ALL)
  GROUP BY ALL
)
SELECT gerencia_base, venta_neta_millones, cumplimiento_plan_pct, descuento_pct, categoria_lider,
       regexp_replace(
         ai_gen(CONCAT('Eres analista comercial de Dos Pinos. En maximo dos oraciones y en espanol, resume el desempeno de octubre ',
                       'de la gerencia ', gerencia_base, ': venta neta de ', venta_neta_millones, ' millones de colones, ',
                       cumplimiento_plan_pct, '% del plan con 55.6% de los dias laborables transcurridos, descuento de ',
                       descuento_pct, '% sobre venta bruta; su categoria lider es ', categoria_lider,
                       '. Termina con una recomendacion concreta. No uses guiones largos.')),
         '\\s*\u2014\\s*', ', ') AS resumen_ia
FROM g JOIN cat USING (gerencia_base)
ORDER BY venta_neta_millones DESC
