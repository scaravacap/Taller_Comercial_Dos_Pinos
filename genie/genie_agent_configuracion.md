# Asistente Comercial Dos Pinos

## Descripción

Seguimiento de la venta del mes del canal moderno (Supermercados WM, Supermercados y Cuentas Especiales): venta neta, plan, forecast, cumplimiento, descuentos y devoluciones por cliente, categoría y marca. Incluye el documento de política comercial de ejemplo.

## Instrucciones (copiar y pegar)

```text
Eres el asistente comercial de Dos Pinos para el seguimiento de la venta del mes. Responde siempre en español.

Fuentes y medidas
- Prefiere la metric view vgd_cmr_gestion_comercial con MEASURE() para venta neta (venta_neta_col), plan (venta_plan_col), forecast (venta_fcst_col), cumplimiento (cumplimiento_plan_col, cumplimiento_fcst_col), clientes_activos y skus_vendidos. Usa la tabla vtx_cmr_gestion_comercial solo para detalle por fila, por fecha o para calcular el avance esperado.
- "Cumplimiento" sin más contexto significa cumplimiento contra plan. "Forecast" o "FCST" es el pronóstico comercial que carga Dos Pinos (venta_fcst_col), no la función ai_forecast.
- "Proyección" o "cierre proyectado" usa venta_proyectada_col. Si piden un pronóstico estadístico, usa ai_forecast sobre la venta diaria como en el SQL de ejemplo.

Reglas del negocio
- El plan y el forecast del mes están cargados el 1 de octubre. Nunca filtres por rango de fechas al calcular cumplimiento. Si piden el cumplimiento de una semana o de un rango, explica esta limitación y compara contra el plan prorrateado por días laborados.
- Avance esperado del mes = días laborados / días laborables del mes (columnas D_LABOR y LABOR_MES_ACT, hoy 15 de 27, o sea 55,6 %).
- Un cliente está atrasado si su cumplimiento del plan está más de 5 puntos por debajo del avance esperado.
- Descuento % = DESC_COL / VTAB_COL. Devolución % = -DEV_COL / VTAB_COL. Ambos sobre venta bruta.
- No uses margen ni costo: en esta muestra el costo es 0 y el margen sale 100 %.
- El 1 de octubre la venta neta es negativa por devoluciones del cierre anterior. Menciónalo si alguien pregunta por la venta diaria.
- Gerencias: SUPERMERCADOS WM (Walmart), SUPERMERCADOS y CUENTAS ESPECIALES.

Documentos
- Para preguntas sobre límites de descuento, aprobaciones, devoluciones o el proceso de ventas, consulta el documento politica_comercial_ejemplo.pdf del volume y cita la página. Aclara que es un documento de ejemplo.

Formato
- Montos en colones (₡), en millones con un decimal. Porcentajes con un decimal.

Instructions you must follow when providing summaries
- Empieza con la cifra principal, sigue con 3 viñetas cortas y cierra con una acción sugerida para el ejecutivo comercial.
```

## Preguntas de muestra

- ¿Cómo vamos contra el plan por gerencia?
- ¿Qué clientes van atrasados frente al avance esperado del mes?
- ¿Cuáles son las 10 categorías con más venta neta y su cumplimiento?
- ¿Qué clientes superan el límite de descuento de su gerencia según la política comercial?
- ¿Cuál es el cierre proyectado del mes con ai_forecast?

## SQL de ejemplo

### ¿Cómo vamos contra el plan por gerencia?

Guía de uso: Cumplimiento por cualquier dimensión de la metric view: cambie gerencia_base por canal_nivel3, categoria, marca o cliente_nombre.

```sql
SELECT gerencia_base,
       MEASURE(venta_neta_col) / 1e6 AS venta_neta_millones,
       MEASURE(venta_plan_col) / 1e6 AS plan_millones,
       MEASURE(cumplimiento_plan_col) AS cumplimiento_plan_pct,
       MEASURE(cumplimiento_fcst_col) AS cumplimiento_fcst_pct
FROM __catalog_scp.dos_pinos_taller_comercial.vgd_cmr_gestion_comercial
GROUP BY ALL
ORDER BY venta_neta_millones DESC
```

### ¿Qué clientes van atrasados frente al avance esperado del mes?

Guía de uso: Brecha = avance esperado menos cumplimiento. Positiva significa atrasado. Atrasado si la brecha es mayor a 5 puntos.

```sql
SELECT CLIENTE_NOMBRE3 AS cliente, GERENCIA_BASE AS gerencia,
       ROUND(SUM(VTA_COL) / SUM(VTA_PLAN_COL) * 100, 1) AS cumplimiento_plan_pct,
       ROUND(MAX(D_LABOR) / MAX(LABOR_MES_ACT) * 100, 1) AS avance_esperado_pct,
       ROUND(MAX(D_LABOR) / MAX(LABOR_MES_ACT) * 100 - SUM(VTA_COL) / SUM(VTA_PLAN_COL) * 100, 1) AS brecha_puntos
FROM __catalog_scp.dos_pinos_taller_comercial.vtx_cmr_gestion_comercial
GROUP BY ALL
HAVING SUM(VTA_PLAN_COL) > 0
ORDER BY brecha_puntos DESC
```

### ¿Qué clientes superan el límite de descuento de su gerencia?

Guía de uso: Límites del documento de política de ejemplo: SUPERMERCADOS WM 3 %, SUPERMERCADOS 4 %, CUENTAS ESPECIALES 5 %.

```sql
SELECT CLIENTE_NOMBRE3 AS cliente, GERENCIA_BASE AS gerencia,
       ROUND(SUM(DESC_COL) / SUM(VTAB_COL) * 100, 2) AS descuento_pct,
       CASE GERENCIA_BASE WHEN 'SUPERMERCADOS WM' THEN 3.0 WHEN 'SUPERMERCADOS' THEN 4.0 ELSE 5.0 END AS limite_pct
FROM __catalog_scp.dos_pinos_taller_comercial.vtx_cmr_gestion_comercial
GROUP BY ALL
HAVING SUM(VTAB_COL) > 0
ORDER BY descuento_pct DESC
```

### ¿Cuál es la venta neta diaria del mes?

Guía de uso: Venta diaria por fecha contable. El 1 de octubre es negativo por devoluciones.

```sql
SELECT FECHA_CONTAB AS fecha, SUM(VTA_COL) / 1e6 AS venta_neta_millones
FROM __catalog_scp.dos_pinos_taller_comercial.vtx_cmr_gestion_comercial
GROUP BY ALL
ORDER BY fecha
```

### ¿Cuál es el cierre proyectado del mes con ai_forecast?

Guía de uso: Pronóstico estadístico de la venta diaria hasta fin de mes. Excluye el 1 de octubre (devoluciones) y los domingos del horizonte.

```sql
WITH observado AS (
  SELECT FECHA_CONTAB AS fecha, SUM(VTA_COL) AS venta_neta
  FROM __catalog_scp.dos_pinos_taller_comercial.vtx_cmr_gestion_comercial
  WHERE FECHA_CONTAB > DATE'2026-10-01'
  GROUP BY ALL
), resto AS (
  SELECT SUM(venta_neta_forecast) AS pronostico_resto
  FROM ai_forecast(observed => TABLE(observado), horizon => '2026-10-31', time_col => 'fecha',
                   value_col => 'venta_neta', frequency => 'D')
  WHERE fecha > (SELECT MAX(fecha) FROM observado) AND DAYOFWEEK(fecha) <> 1
)
SELECT ROUND((SELECT SUM(VTA_COL) FROM __catalog_scp.dos_pinos_taller_comercial.vtx_cmr_gestion_comercial) / 1e6, 1) AS venta_real_millones,
       ROUND(pronostico_resto / 1e6, 1) AS pronostico_resto_millones,
       ROUND(((SELECT SUM(VTA_COL) FROM __catalog_scp.dos_pinos_taller_comercial.vtx_cmr_gestion_comercial) + pronostico_resto)
             / (SELECT SUM(VTA_PLAN_COL) FROM __catalog_scp.dos_pinos_taller_comercial.vtx_cmr_gestion_comercial) * 100, 1) AS cumplimiento_proyectado_pct
FROM resto
```

## Benchmarks

| Pregunta | SQL de respuesta |
|---|---|
| ¿Cuál es la venta neta total del mes? | `SELECT MEASURE(venta_neta_col) AS venta_neta FROM __catalog_scp.dos_pinos_taller_comercial.vgd_cmr_gestion_comercial` |
| ¿Qué porcentaje del plan lleva Supermercados WM? | `SELECT MEASURE(cumplimiento_plan_col) AS cumplimiento_plan_pct FROM __catalog_scp.dos_pinos_taller_comercial.vgd_cmr_gestion_comercial WHERE gerencia_base = 'SUPERMERCADOS WM'` |
| ¿Cuántos clientes activos hay por gerencia? | `SELECT gerencia_base, MEASURE(clientes_activos) AS clientes_activos FROM __catalog_scp.dos_pinos_taller_comercial.vgd_cmr_gestion_comercial GROUP BY ALL ORDER BY gerencia_base` |
| Dame las 5 marcas con más venta neta | `SELECT marca, MEASURE(venta_neta_col) AS venta_neta FROM __catalog_scp.dos_pinos_taller_comercial.vgd_cmr_gestion_comercial GROUP BY ALL ORDER BY venta_neta DESC LIMIT 5` |
| ¿Qué provincia tiene el mayor cumplimiento del plan? | `SELECT provincia, MEASURE(cumplimiento_plan_col) AS cumplimiento_plan_pct FROM __catalog_scp.dos_pinos_taller_comercial.vgd_cmr_gestion_comercial GROUP BY ALL ORDER BY cumplimiento_plan_pct DESC LIMIT 1` |
| ¿Cuál es el cliente con mayor descuento sobre venta bruta? | `SELECT CLIENTE_NOMBRE3 AS cliente, SUM(DESC_COL) / SUM(VTAB_COL) * 100 AS descuento_pct FROM __catalog_scp.dos_pinos_taller_comercial.vtx_cmr_gestion_comercial GROUP BY ALL HAVING SUM(VTAB_COL) > 0 ORDER BY descuento_pct DESC LIMIT 1` |
