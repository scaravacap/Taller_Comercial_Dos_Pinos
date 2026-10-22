WITH observado AS (
  SELECT FECHA_CONTAB AS fecha, GERENCIA_BASE AS gerencia_base, SUM(VTA_COL) AS venta_neta
  FROM vtx_cmr_gestion_comercial
  WHERE FECHA_CONTAB > DATE'2026-10-01'
  GROUP BY ALL
), pronostico AS (
  SELECT * FROM ai_forecast(
    observed => TABLE(observado),
    horizon => '2026-10-31',
    time_col => 'fecha',
    value_col => 'venta_neta',
    group_col => 'gerencia_base',
    prediction_interval_width => 0.8,
    frequency => 'D')
)
SELECT fecha, gerencia_base, venta_neta AS venta_real, CAST(NULL AS DOUBLE) AS venta_pronostico,
       CAST(NULL AS DOUBLE) AS limite_inferior, CAST(NULL AS DOUBLE) AS limite_superior
FROM observado
UNION ALL
SELECT p.fecha, p.gerencia_base, NULL, p.venta_neta_forecast, p.venta_neta_lower, p.venta_neta_upper
FROM pronostico p
WHERE p.fecha > (SELECT MAX(fecha) FROM observado) AND DAYOFWEEK(p.fecha) <> 1
ORDER BY fecha
