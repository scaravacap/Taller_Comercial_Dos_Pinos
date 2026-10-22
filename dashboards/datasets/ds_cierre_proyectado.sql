WITH observado AS (
  SELECT FECHA_CONTAB AS fecha, SUM(VTA_COL) AS venta_neta
  FROM vtx_cmr_gestion_comercial
  WHERE FECHA_CONTAB > DATE'2026-10-01'
  GROUP BY ALL
), resto AS (
  SELECT SUM(venta_neta_forecast) AS venta_pronosticada_resto,
         SUM(venta_neta_lower) AS resto_escenario_bajo,
         SUM(venta_neta_upper) AS resto_escenario_alto
  FROM ai_forecast(
    observed => TABLE(observado), horizon => '2026-10-31', time_col => 'fecha',
    value_col => 'venta_neta', prediction_interval_width => 0.8, frequency => 'D')
  WHERE fecha > (SELECT MAX(fecha) FROM observado) AND DAYOFWEEK(fecha) <> 1
), mes AS (
  SELECT SUM(VTA_COL) AS venta_real_mes, SUM(VTA_PLAN_COL) AS venta_plan,
         SUM(VTA_PROYECTADA_COL) AS proyeccion_dos_pinos
  FROM vtx_cmr_gestion_comercial
)
SELECT venta_real_mes, venta_pronosticada_resto,
       venta_real_mes + venta_pronosticada_resto AS cierre_proyectado,
       venta_plan,
       (venta_real_mes + venta_pronosticada_resto) / venta_plan AS cumplimiento_proyectado,
       (venta_real_mes + resto_escenario_bajo) / venta_plan AS cumplimiento_escenario_bajo,
       (venta_real_mes + resto_escenario_alto) / venta_plan AS cumplimiento_escenario_alto,
       proyeccion_dos_pinos,
       proyeccion_dos_pinos / venta_plan AS cumplimiento_proyeccion_dos_pinos
FROM mes CROSS JOIN resto
