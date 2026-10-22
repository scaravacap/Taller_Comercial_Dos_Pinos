# Taller comercial Dos Pinos: AI/BI, Genie y AI Functions sobre sus datos de venta

Este taller parte de lo que el equipo comercial ya tiene en Unity Catalog: **una vista con la venta del mes** (`vtx_cmr_gestion_comercial`) y **una metric view** (`vgd_cmr_gestion_comercial`) con las medidas de negocio. No van a crear tablas nuevas. Todo lo que construimos (consultas con IA, un tablero AI/BI, un Genie Agent, Excel y Genie One) vive encima de esos dos objetos gobernados.

| Sección | Qué van a hacer | Dónde |
|---|---|---|
| 1 | Explorar la tabla y las medidas de la metric view | Notebook |
| 2 | (Opcional) Documentar las columnas sin comentario | Notebook |
| 3 | Consultas con AI Functions: `ai_forecast`, `ai_decide`, `ai_classify`, `ai_extract`, `ai_gen` | Notebook |
| 4 | Construir el tablero AI/BI paso a paso y luego con Genie Code | Interfaz |
| 5 | Construir el Genie Agent paso a paso y luego con Genie Code | Interfaz |
| 6 | Excel: tabla, metric view, tabla dinámica y Genie en Excel | Excel |
| 7 | Genie One: skills y tareas programadas | Genie One |

**Requisitos**

- Un SQL warehouse **Pro o Serverless**: las AI Functions no corren en Classic ([AI Functions](https://learn.microsoft.com/en-us/azure/databricks/large-language-models/ai-functions)).
- Cada participante tiene **Consumer access**, **Workspace access** y permiso `CAN USE` sobre el SQL warehouse del taller.
- `SELECT` sobre la tabla y la metric view. La sección 2 además necesita `MODIFY` o ser dueño del objeto.
- Previews activos en el workspace: `ai_decide` (Beta) y, si quieren usar `ai_forecast` versión 2, **Predictive AI Functions**. Para el Genie Agent con documentos: **Analyze Files in Volumes with Genie Agents** (Beta).

**Parámetros.** El notebook usa dos widgets, `catalogo` y `esquema`. Por defecto apuntan a `prd_gold.bix_cmr_ab_nacional`, donde viven los objetos en Dos Pinos. En el ambiente de demostración de Databricks usamos `__catalog_scp.dos_pinos_taller_comercial`.


## 0. Parámetros

Cambien los valores de los widgets si sus objetos viven en otro catálogo o esquema. Todas las consultas usan nombres cortos a partir de aquí.

```sql
CREATE WIDGET TEXT catalogo DEFAULT 'prd_gold';
CREATE WIDGET TEXT esquema DEFAULT 'bix_cmr_ab_nacional';
```

```sql
USE CATALOG IDENTIFIER(:catalogo);
USE SCHEMA IDENTIFIER(:esquema);
SELECT current_catalog() AS catalogo, current_schema() AS esquema;
```

## 1. Exploración de la tabla y de la metric view

**La tabla** `vtx_cmr_gestion_comercial` tiene una fila por fecha contable, cliente y material, con 190 columnas: dimensiones de tiempo, organización de ventas, material, cliente y geografía, y las medidas en colones (`_COL`) y dólares (`_USD`) para real, forecast, plan y proyección.

**La metric view** `vgd_cmr_gestion_comercial` define sobre esa tabla los nombres de negocio (`venta_neta_col`, `cumplimiento_plan_col`, `clientes_activos`...) con comentario, nombre visible y sinónimos. Una metric view separa las **dimensiones** (por qué agrupar) de las **medidas** (cómo agregar), así que un porcentaje como el cumplimiento se calcula siempre como cociente de sumas y nunca como promedio de porcentajes. Se consulta con `MEASURE()` ([Unity Catalog metric views](https://learn.microsoft.com/en-us/azure/databricks/metric-views/), [Query a metric view](https://learn.microsoft.com/en-us/azure/databricks/metric-views/query/)).

Documentación: [DESCRIBE TABLE](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/sql-ref-syntax-aux-describe-table), [information_schema.columns](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/information-schema/columns).

### 1.1 Tamaño, periodo y cardinalidad

```sql
SELECT COUNT(*) AS filas,
       MIN(FECHA_CONTAB) AS primera_fecha,
       MAX(FECHA_CONTAB) AS ultima_fecha,
       COUNT(DISTINCT FECHA_CONTAB) AS fechas_con_venta,
       COUNT(DISTINCT CLIENTE_ID) AS clientes,
       COUNT(DISTINCT MAT_ID) AS materiales,
       COUNT(DISTINCT CATEG) AS categorias,
       COUNT(DISTINCT GERENCIA_BASE) AS gerencias,
       COUNT(DISTINCT CLIGRP3_DESC) AS canales_nivel3,
       COUNT(DISTINCT PROV_DESC) AS provincias,
       MAX(LABOR_MES_ACT) AS dias_laborables_mes,
       MAX(D_LABOR) AS dias_laborados
FROM vtx_cmr_gestion_comercial
```

### 1.2 Esquema y cobertura de comentarios

Los comentarios de columna son el contexto que leen Genie, Genie Code y el Excel Add-in. Esta consulta muestra cuántas columnas de la tabla tienen comentario hoy.

```sql
DESCRIBE TABLE EXTENDED vtx_cmr_gestion_comercial
```

```sql
SELECT COUNT(*) AS columnas,
       COUNT_IF(comment IS NOT NULL AND trim(comment) <> '') AS con_comentario,
       COUNT_IF(comment IS NULL OR trim(comment) = '') AS sin_comentario
FROM information_schema.columns
WHERE table_catalog = current_catalog() AND table_schema = current_schema() AND table_name = 'vtx_cmr_gestion_comercial'
```

### 1.3 La definición de la metric view

`DESCRIBE TABLE EXTENDED` muestra el YAML con cada dimensión y medida, su expresión, comentario y sinónimos.

```sql
DESCRIBE TABLE EXTENDED vgd_cmr_gestion_comercial
```

### 1.4 Las medidas, en una sola consulta

`GROUP BY ALL` agrupa por todas las dimensiones del `SELECT`. Cambien `gerencia_base` por `canal_nivel3`, `categoria`, `marca` o `provincia` para ver el mismo cálculo por otra dimensión.

```sql
SELECT gerencia_base,
       MEASURE(venta_neta_col) / 1e6 AS venta_neta_millones,
       MEASURE(venta_plan_col) / 1e6 AS plan_millones,
       MEASURE(venta_fcst_col) / 1e6 AS forecast_millones,
       MEASURE(cumplimiento_plan_col) AS cumplimiento_plan_pct,
       MEASURE(cumplimiento_fcst_col) AS cumplimiento_fcst_pct,
       MEASURE(clientes_activos) AS clientes_activos,
       MEASURE(skus_vendidos) AS skus_vendidos
FROM vgd_cmr_gestion_comercial
GROUP BY ALL
ORDER BY venta_neta_millones DESC
```

### 1.5 Por qué la metric view: el promedio de porcentajes engaña

Si calculan el cumplimiento de cada cliente y luego lo promedian, cada cliente pesa igual sin importar su tamaño. La metric view siempre divide la suma de la venta entre la suma del plan.

```sql
WITH por_cliente AS (
  SELECT GERENCIA_BASE, CLIENTE_ID, SUM(VTA_COL) / SUM(VTA_PLAN_COL) * 100 AS cumplimiento_cliente
  FROM vtx_cmr_gestion_comercial GROUP BY ALL HAVING SUM(VTA_PLAN_COL) > 0
)
SELECT p.GERENCIA_BASE AS gerencia_base,
       ROUND(AVG(p.cumplimiento_cliente), 1) AS promedio_de_porcentajes,
       ROUND(ANY_VALUE(m.cumplimiento_plan_pct), 1) AS cumplimiento_metric_view
FROM por_cliente p
JOIN (SELECT gerencia_base, MEASURE(cumplimiento_plan_col) AS cumplimiento_plan_pct FROM vgd_cmr_gestion_comercial GROUP BY ALL) m
  ON m.gerencia_base = p.GERENCIA_BASE
GROUP BY ALL
```

### 1.6 Conciliación: la metric view y la tabla dan lo mismo

```sql
SELECT (SELECT SUM(VTA_COL) FROM vtx_cmr_gestion_comercial) AS venta_neta_tabla,
       (SELECT MEASURE(venta_neta_col) FROM vgd_cmr_gestion_comercial) AS venta_neta_metric_view,
       (SELECT SUM(VTA_PLAN_COL) FROM vtx_cmr_gestion_comercial) AS plan_tabla,
       (SELECT MEASURE(venta_plan_col) FROM vgd_cmr_gestion_comercial) AS plan_metric_view
```

### 1.7 Tres particularidades de estos datos

- **El plan y el forecast del mes se cargan el día 1.** Si filtran por un rango de fechas, la venta se reduce pero el plan no aparece, y el cumplimiento sale distorsionado. Por eso el tablero no tiene filtro de fecha y comparamos contra el avance esperado (días laborados entre días laborables).
- **El día 1 la venta neta es negativa** por devoluciones del cierre anterior.
- **El costo viene en 0**, así que el margen sale 100 %. No lo usamos en el taller.

```sql
SELECT FECHA_CONTAB AS fecha,
       ROUND(SUM(VTA_COL) / 1e6, 1) AS venta_neta_millones,
       ROUND(SUM(VTA_PLAN_COL) / 1e6, 1) AS plan_millones
FROM vtx_cmr_gestion_comercial
GROUP BY ALL
ORDER BY fecha
```

## 2. (Opcional) Documentar las columnas sin comentario

De las 190 columnas de la tabla, 70 no tienen comentario: casi todas las medidas (`VTA_COL`, `VTA_PLAN_COL`, `DESC_COL`...) y algunas llaves. La metric view sí tiene un comentario para cada una, así que esta celda **copia ese comentario a la columna de la tabla**.

Reglas de la celda:

- Solo comenta esas 70 columnas.
- **Falla sin modificar nada** si alguna de ellas ya tiene comentario (`SIGNAL SQLSTATE '45000'`). Si la corren dos veces, la segunda falla a propósito.
- Necesita `MODIFY` sobre la tabla o ser dueño de la vista ([COMMENT ON](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/sql-ref-syntax-ddl-comment)). En una vista materializada exige Databricks Runtime 16.3 o superior, o un SQL warehouse.
- Usa SQL scripting (`BEGIN ... END`) ([SQL scripting](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/sql-ref-scripting)).

Si la vista materializada se recrea desde su definición (`CREATE OR REPLACE` o un pipeline), les recomiendo llevar estos comentarios a esa definición para que no se pierdan.

Después de correrla, la consulta de la sección 1.2 debe mostrar 0 columnas sin comentario. Otra opción es generar comentarios con IA desde Catalog Explorer ([AI-generated comments](https://learn.microsoft.com/en-us/azure/databricks/comments/ai-comments)).

```sql
BEGIN
  DECLARE ya_comentadas INT;
  SET ya_comentadas = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_catalog = current_catalog()
      AND table_schema = current_schema()
      AND table_name = 'vtx_cmr_gestion_comercial'
      AND column_name IN ('CANTB', 'VTAB_COL', 'VTA_COL', 'VTA_USD', 'DESC_COL', 'DESC_USD', 'DEV_COL', 'DEV_USD', 'INCC_COL', 'INCC_USD', 'CSTR_COL', 'CSTR_USD', 'VTA_ZAM_COL', 'VTA_ZAM_USD', 'EXEB_COL', 'EXEB_USD', 'KL', 'LF', 'LP', 'CANTB_FCST', 'VTA_FCST_COL', 'VTA_FCST_USD', 'DESC_FCST_COL', 'DESC_FCST_USD', 'DEV_FCST_COL', 'DEV_FCST_USD', 'CST_FCST_COL', 'CST_FCST_USD', 'EXEB_FCST_COL', 'EXEB_FCST_USD', 'KL_FCST', 'LF_FCST', 'LP_FCST', 'CANTB_PLAN', 'VTA_PLAN_COL', 'VTA_PLAN_USD', 'DESC_PLAN_COL', 'DESC_PLAN_USD', 'DEV_PLAN_COL', 'DEV_PLAN_USD', 'CST_PLAN_COL', 'CST_PLAN_USD', 'EXEB_PLAN_COL', 'EXEB_PLAN_USD', 'KL_PLAN', 'LF_PLAN', 'LP_PLAN', 'VTA_POND_COL', 'VTA_PROYECTADA_COL', 'CANTB_PROYECTADA_COL', 'KL_PROYECTADA_COL', 'VTA_POND_USD', 'VTA_FCST_POND_USD', 'VTA_FCST_POND_COL', 'VTA_PLAN_POND_USD', 'VTA_PLAN_POND_COL', 'FECHA_CONTAB', 'ANNO_MES_N', 'MAT_ID_S', 'MAT_DELLADO', 'MAT_ID_S_HH', 'MAT_DELLADO_HH', 'CLIENTE_ID_S', 'CLIENTE_DELLADO', 'pk_CLIENTE', 'pk_RUTA_DIM', 'OFICINA_DELLADA', 'GERENCIA_BASE', 'TIPO_NEGOCIO', 'ZAM_FLAG')
      AND comment IS NOT NULL AND trim(comment) <> '');
  IF ya_comentadas > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La tabla ya tiene metadatos: hay columnas objetivo con comentario. No se modifico nada.';
  END IF;
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CANTB IS 'Cantidad UMB';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTAB_COL IS 'Venta bruta CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_COL IS 'Venta neta CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_USD IS 'Venta neta USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DESC_COL IS 'Descuento CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DESC_USD IS 'Descuento USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DEV_COL IS 'Devolucion CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DEV_USD IS 'Devolucion USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.INCC_COL IS 'Incentivo CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.INCC_USD IS 'Incentivo USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CSTR_COL IS 'Costo CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CSTR_USD IS 'Costo USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_ZAM_COL IS 'Venta ZAM CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_ZAM_USD IS 'Venta ZAM USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.EXEB_COL IS 'EXEB CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.EXEB_USD IS 'EXEB USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.KL IS 'Kilolitros';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.LF IS 'Litros fluidos';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.LP IS 'Libras peso';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CANTB_FCST IS 'Cantidad forecast';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_FCST_COL IS 'Venta forecast CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_FCST_USD IS 'Venta forecast USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DESC_FCST_COL IS 'Descuento forecast CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DESC_FCST_USD IS 'Descuento forecast USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DEV_FCST_COL IS 'Devolucion forecast CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DEV_FCST_USD IS 'Devolucion forecast USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CST_FCST_COL IS 'Costo forecast CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CST_FCST_USD IS 'Costo forecast USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.EXEB_FCST_COL IS 'EXEB forecast CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.EXEB_FCST_USD IS 'EXEB forecast USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.KL_FCST IS 'KL forecast';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.LF_FCST IS 'LF forecast';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.LP_FCST IS 'LP forecast';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CANTB_PLAN IS 'Cantidad plan';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_PLAN_COL IS 'Venta plan CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_PLAN_USD IS 'Venta plan USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DESC_PLAN_COL IS 'Descuento plan CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DESC_PLAN_USD IS 'Descuento plan USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DEV_PLAN_COL IS 'Devolucion plan CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.DEV_PLAN_USD IS 'Devolucion plan USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CST_PLAN_COL IS 'Costo plan CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CST_PLAN_USD IS 'Costo plan USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.EXEB_PLAN_COL IS 'EXEB plan CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.EXEB_PLAN_USD IS 'EXEB plan USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.KL_PLAN IS 'KL plan';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.LF_PLAN IS 'LF plan';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.LP_PLAN IS 'LP plan';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_POND_COL IS 'Venta ponderada CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_PROYECTADA_COL IS 'Venta proyectada CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CANTB_PROYECTADA_COL IS 'Cantidad proyectada';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.KL_PROYECTADA_COL IS 'KL proyectada';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_POND_USD IS 'Venta ponderada USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_FCST_POND_USD IS 'Venta forecast pond USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_FCST_POND_COL IS 'Venta forecast pond CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_PLAN_POND_USD IS 'Venta plan pond USD';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.VTA_PLAN_POND_COL IS 'Venta plan pond CRC';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.FECHA_CONTAB IS 'Fecha contabilizacion';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.ANNO_MES_N IS 'Anio-Mes numerico';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.MAT_ID_S IS 'Material sin ceros';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.MAT_DELLADO IS 'Material ID y Nombre';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.MAT_ID_S_HH IS 'Mat Homologo sin ceros';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.MAT_DELLADO_HH IS 'Mat Homologo del lado';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CLIENTE_ID_S IS 'Cliente sin ceros';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.CLIENTE_DELLADO IS 'Cliente del lado';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.pk_CLIENTE IS 'PK Cliente';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.pk_RUTA_DIM IS 'PK Ruta Dim';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.OFICINA_DELLADA IS 'Oficina del lado';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.GERENCIA_BASE IS 'Gerencia base';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.TIPO_NEGOCIO IS 'Tipo negocio';
  COMMENT ON COLUMN vtx_cmr_gestion_comercial.ZAM_FLAG IS 'Indicador ZAM';
  SELECT 70 AS columnas_comentadas;
END
```

## 3. AI Functions: IA dentro del SQL

Las AI Functions son funciones SQL que llaman a modelos de IA administrados por Databricks. Se usan como cualquier otra función, en una consulta, una vista, un tablero o un job, con los mismos permisos de Unity Catalog ([AI Functions](https://learn.microsoft.com/en-us/azure/databricks/large-language-models/ai-functions)).

| Función | Qué hace | Estado |
|---|---|---|
| `ai_forecast` | Pronostica series de tiempo, con intervalo de confianza y por grupo | Public Preview (v1), Beta (v2) |
| `ai_decide` | Toma decisiones estructuradas sobre datos: elige una opción, da un puntaje y su confianza | Beta |
| `ai_classify` | Clasifica texto en las etiquetas que ustedes definen | GA |
| `ai_extract` | Extrae campos con un esquema JSON a partir de texto | GA |
| `ai_gen` | Genera texto libre a partir de un prompt | Public Preview |
| `ai_summarize`, `ai_translate`, `ai_mask`, `ai_analyze_sentiment` | Resumir, traducir, enmascarar datos personales, sentimiento | Public Preview / GA |
| `ai_query` | Llama a cualquier modelo servido, con salida estructurada | GA |

Tres cosas a tener en cuenta:

- `ai_forecast` corre sobre el cómputo del warehouse, sin costo de inferencia aparte. Las funciones de texto facturan inferencia ([AI Functions](https://learn.microsoft.com/en-us/azure/databricks/large-language-models/ai-functions)).
- Las funciones de texto de propósito general (`ai_gen`, `ai_summarize`, `ai_translate`) están afinadas para inglés. En español funcionan bien, pero revisen la salida.
- Una AI Function sobre miles de filas tarda y cuesta. En un tablero, aplíquenlas sobre datos ya agregados, como hacemos aquí.

### 3.1 `ai_forecast`: ¿cómo cerramos el mes?

`ai_forecast` recibe una tabla con una columna de tiempo y una de valor, y devuelve solo las fechas futuras hasta `horizon` (exclusivo) con `<valor>_forecast`, `_upper` y `_lower` ([ai_forecast](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/functions/ai_forecast)). Aquí pronosticamos la venta diaria del 18 al 30 de octubre, excluimos el día 1 (devoluciones) y los domingos, y sumamos lo real con lo pronosticado. Agregamos la proyección que ya calcula Dos Pinos (`VTA_PROYECTADA_COL`) para compararlas.

`prediction_interval_width => 0.8` pide un intervalo del 80 %: el escenario bajo y el alto. Con 15 días de historia el intervalo es amplio, y ese es justamente el mensaje: el modelo dice cuánto confía en su número.

```sql
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
```

Lo mismo por gerencia, en formato de serie para graficar lo real contra el pronóstico. `group_col` entrena un modelo por cada gerencia.

```sql
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
```

Si su workspace tiene el preview **Predictive AI Functions**, la versión 2 agrega `positive_only` (la venta no puede ser negativa) y `holiday_region`:

```sql
SELECT * FROM ai_forecast(
  observed => TABLE(observado), horizon => '2026-10-31', time_col => 'fecha', value_col => 'venta_neta',
  positive_only => true, version => '2')
```

### 3.2 `ai_decide`: la siguiente acción por cliente

`ai_decide(state, questions)` recibe el estado de cada fila (aquí, un JSON con los KPI del cliente) y un JSON constante con preguntas. Una pregunta `choice` elige una etiqueta y devuelve su probabilidad; una pregunta `score` devuelve un puntaje entre 0 y n-1 según los criterios, ordenados de menor a mayor ([ai_decide](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/functions/ai_decide)). La respuesta es un `VARIANT` que se lee con `:` ([Query variant data](https://learn.microsoft.com/en-us/azure/databricks/semi-structured/variant)).

Dos aprendizajes de construir esta consulta:

- **Calculen los números en SQL y dejen la decisión al modelo.** Le pasamos `brecha_puntos` ya calculada (avance esperado menos cumplimiento) en lugar de pedirle que la calcule.
- **Criterios cortos y numéricos.** Cada etiqueta se describe con la condición exacta que la activa.

`:gerencia` es un parámetro: en el notebook aparece como widget, en el tablero será un filtro. Escriban `TODAS` o el nombre de una gerencia.

```sql
CREATE WIDGET TEXT gerencia DEFAULT 'TODAS';
```

```sql
WITH kpi AS (
  SELECT CLIENTE_NOMBRE3 AS cliente, GERENCIA_BASE AS gerencia_base,
         SUM(VTA_COL) AS venta_neta, SUM(VTA_PLAN_COL) AS venta_plan,
         ROUND(TRY_DIVIDE(SUM(VTA_COL), SUM(VTA_PLAN_COL)) * 100, 1) AS cumplimiento_plan_pct,
         ROUND(MAX(D_LABOR) / MAX(LABOR_MES_ACT) * 100, 1) AS avance_dias_pct,
         ROUND(TRY_DIVIDE(SUM(DESC_COL), SUM(VTAB_COL)) * 100, 2) AS descuento_pct,
         ROUND(TRY_DIVIDE(-SUM(DEV_COL), SUM(VTAB_COL)) * 100, 2) AS devolucion_pct,
         COUNT(DISTINCT MAT_ID) AS skus_vendidos
  FROM vtx_cmr_gestion_comercial
  WHERE (:gerencia = 'TODAS' OR GERENCIA_BASE = :gerencia)
  GROUP BY ALL
  HAVING SUM(VTA_PLAN_COL) > 0
), decision AS (
  SELECT *, ROUND(avance_dias_pct - cumplimiento_plan_pct, 1) AS brecha_puntos,
    ai_decide(
      to_json(named_struct('cliente', cliente,
                           'brecha_puntos', ROUND(avance_dias_pct - cumplimiento_plan_pct, 1),
                           'descuento_pct', descuento_pct,
                           'devolucion_pct', devolucion_pct,
                           'skus_vendidos', skus_vendidos)),
      '{"accion": {"type": "choice",
                   "instructions": "Elige la accion comercial para este cliente de Dos Pinos antes del cierre de mes. brecha_puntos positiva significa que el cliente va atrasado frente a los dias laborados.",
                   "criteria": {"acelerar": "brecha_puntos mayor a 0 y descuento_pct menor a 3 y devolucion_pct menor a 1",
                                "mantener": "brecha_puntos menor o igual a 0 y descuento_pct menor a 3 y devolucion_pct menor a 1",
                                "revisar_descuentos": "descuento_pct mayor o igual a 3",
                                "atender_devoluciones": "devolucion_pct mayor o igual a 1 y descuento_pct menor a 3"}},
        "urgencia": {"type": "score",
                     "instructions": "Que tan urgente es actuar con este cliente segun brecha_puntos?",
                     "criteria": ["Sin presion: brecha_puntos menor o igual a 0",
                                  "Atender esta semana: brecha_puntos entre 0 y 15",
                                  "Actuar hoy: brecha_puntos mayor a 15"]}}'
    ) AS d
  FROM kpi
)
SELECT cliente, gerencia_base, venta_neta, venta_plan, cumplimiento_plan_pct, avance_dias_pct, brecha_puntos,
       descuento_pct, devolucion_pct, skus_vendidos,
       d:response.answers.accion.choice::string AS accion_ia,
       ROUND(d:response.answers.accion.confidence::double, 2) AS confianza_accion,
       ROUND(d:response.answers.urgencia.score::double, 2) AS urgencia_ia
FROM decision
ORDER BY urgencia_ia DESC, brecha_puntos DESC
```

### 3.3 `ai_classify`: segmentos que no existen en el maestro

El maestro de materiales tiene categoría y marca, pero no una segmentación por ocasión de consumo. `ai_classify` la crea a partir del nombre del material ([ai_classify](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/functions/ai_classify)).

```sql
WITH top_materiales AS (
  SELECT MAT_DESC AS material, CATEG AS categoria, SUM(VTA_COL) AS venta_neta, SUM(KL) AS kilolitros
  FROM vtx_cmr_gestion_comercial
  GROUP BY ALL
  ORDER BY venta_neta DESC
  LIMIT 60
)
SELECT material, categoria, venta_neta, kilolitros,
       ai_classify(material, ARRAY('lacteo saludable', 'indulgente o snack', 'bebida no lactea', 'basico de canasta')) AS segmento_ia
FROM top_materiales
ORDER BY venta_neta DESC
```

### 3.4 `ai_extract`: atributos a partir del nombre del producto

`ai_extract` recibe un esquema JSON y devuelve cada campo con su valor ([ai_extract](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/functions/ai_extract)). Comparen el resultado con las columnas `PRESENT` y `SABOR` del maestro: así se valida una extracción antes de usarla.

```sql
WITH materiales AS (
  SELECT MAT_DESC AS material, PRESENT AS presentacion_maestro, SUM(VTA_COL) AS venta
  FROM vtx_cmr_gestion_comercial GROUP BY ALL ORDER BY venta DESC LIMIT 15
), extraido AS (
  SELECT *, ai_extract(material,
    '{"tipo_producto": {"type": "string", "description": "Tipo de producto, por ejemplo leche, yogurt, queso, natilla"},
      "contenido": {"type": "string", "description": "Contenido neto con unidad, por ejemplo 1 L o 200 g"},
      "es_bajo_en_grasa": {"type": "boolean", "description": "Verdadero si es descremado, semidescremado, light o bajo en grasa"}}',
    MAP('version', '2.1')) AS e
  FROM materiales
)
SELECT material, presentacion_maestro,
       e:response.tipo_producto.value::string AS tipo_producto,
       e:response.contenido.value::string AS contenido,
       e:response.es_bajo_en_grasa.value::boolean AS es_bajo_en_grasa
FROM extraido
```

### 3.5 `ai_gen`: un resumen ejecutivo por gerencia

`ai_gen` genera texto a partir de un prompt ([ai_gen](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/functions/ai_gen)). El prompt se arma con `CONCAT` y las cifras ya calculadas, así el modelo redacta pero no inventa números.

```sql
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
```

## 4. Tablero AI/BI paso a paso

Un tablero AI/BI se construye en dos pestañas: **Data**, donde se definen los datasets (una tabla, una metric view o una consulta SQL), y **Canvas**, donde se colocan los widgets ([Create a dashboard](https://learn.microsoft.com/en-us/azure/databricks/dashboards/tutorials/create-dashboard), [Visualization types](https://learn.microsoft.com/en-us/azure/databricks/dashboards/manage/visualizations/types), [Dashboard filters](https://learn.microsoft.com/en-us/azure/databricks/dashboards/manage/filters/), [Dashboard parameters](https://learn.microsoft.com/en-us/azure/databricks/dashboards/manage/filters/parameters)).

Lo que este tablero hace y un reporte tradicional no:

- Los KPI salen de la **metric view**, la misma que usan Genie y Excel. Una sola definición de "cumplimiento".
- La página de IA llama a `ai_forecast`, `ai_decide`, `ai_classify` y `ai_gen` **dentro del dataset**, con el filtro del tablero como parámetro.
- Al publicarlo, cada widget tiene **Ask Genie** y el tablero trae un Genie Agent acompañante ([Genie Agents with dashboards](https://learn.microsoft.com/en-us/azure/databricks/dashboards/genie-spaces)).

El JSON completo del tablero está en [`dashboards/gestion_comercial_dos_pinos.lvdash.json`](../dashboards/gestion_comercial_dos_pinos.lvdash.json). Para importarlo: Dashboards > Create > Import dashboard from file, y luego seleccionen el catálogo y esquema por defecto de los datasets.

### 4.1 Datasets

En la pestaña **Data**, creen estos datasets. Las consultas SQL están en la sección 3 del notebook y en [`dashboards/datasets/`](../dashboards/datasets/).

| Dataset | Tipo | Para qué |
|---|---|---|
| `ds_metricas` | Metric view | Agreguen la metric view `vgd_cmr_gestion_comercial` como fuente (Add data > seleccionar la metric view). |
| `ds_avance_diario` | SQL | Venta diaria y acumulada contra el plan prorrateado por día laboral. |
| `ds_pronostico` | SQL con ai_forecast | Real y pronóstico diario por gerencia, con límites. |
| `ds_cierre_proyectado` | SQL con ai_forecast | Cierre proyectado, escenarios y proyección de Dos Pinos. |
| `ds_gerencias` | SQL | Opciones del selector de gerencia: `SELECT 'TODAS' AS gerencia UNION ALL SELECT DISTINCT GERENCIA_BASE ...`. |
| `ds_decision_ia` | SQL con ai_decide y parámetro | Acción y urgencia por cliente. Declara el parámetro `gerencia` (texto, valor por defecto `TODAS`). |
| `ds_segmento_ia` | SQL con ai_classify | Top 60 materiales con su segmento. |
| `ds_resumen_ejecutivo` | SQL con ai_gen | Resumen ejecutivo por gerencia. |

Para `ds_decision_ia`: al pegar la consulta, el editor detecta `:gerencia` y crea el parámetro. Pongan tipo **String** y valor por defecto `TODAS`.

### 4.2 Páginas y widgets

**Filtros globales**

1. Filtros de selección múltiple sobre `gerencia_base`, `canal_nivel3`, `categoria`, `provincia` y `marca`. En cada filtro, conecten el campo en todos los datasets que lo tengan (la metric view los tiene todos; `ds_avance_diario` y `ds_pronostico` tienen `gerencia_base`).

**Resumen comercial**

1. Texto: título y subtítulo del tablero.
2. 4 contadores sobre `ds_metricas`: **Venta neta** (`MEASURE(venta_neta_col)`, formato moneda compacta), **% Cumplimiento plan** (`cumplimiento_plan_col`), **% Cumplimiento forecast** (`cumplimiento_fcst_col`) y **Clientes activos** (`clientes_activos`).
3. Barras agrupadas **Venta real vs plan por gerencia**: eje X `gerencia_base`, eje Y `venta_neta_col` y `venta_plan_col`.
4. Línea **Avance acumulado vs plan prorrateado** sobre `ds_avance_diario`: eje X `fecha`, eje Y `SUM(venta_acumulada)` y `SUM(plan_prorrateado)`.
5. Tabla **Desempeño por categoría** sobre `ds_metricas`: `categoria`, venta neta, plan, forecast, % cumplimiento plan, descuento y devolución, ordenada por venta neta.
6. Pie **Venta por negocio**: `negocio` y `venta_neta_col`.
7. Mapa de puntos **Clientes** con `latitud`, `longitud` y tamaño por `venta_neta_col`.
8. Texto con la nota: el plan del mes está cargado el día 1, por eso el tablero no filtra por fecha.

**IA: pronóstico y decisiones**

1. Texto: una línea que explica `ai_forecast` y otra que explica `ai_decide`.
2. Contadores sobre `ds_cierre_proyectado`: **Cierre proyectado** (`cierre_proyectado`), **% plan proyectado** (`cumplimiento_proyectado`, formato porcentaje), **Escenario bajo** y **Escenario alto** (`cumplimiento_escenario_bajo`, `cumplimiento_escenario_alto`) y **% plan con proyección Dos Pinos** (`cumplimiento_proyeccion_dos_pinos`).
3. Gráfico de línea con pronóstico sobre `ds_pronostico`: eje X `fecha`, series `venta_real` y `venta_pronostico`, banda entre `limite_inferior` y `limite_superior`.
4. Filtro de selección única **Gerencia para la recomendación IA**, conectado al parámetro `gerencia` de `ds_decision_ia`, con valor por defecto `TODAS`.
5. Tabla **Acción recomendada por cliente** sobre `ds_decision_ia`: `cliente`, `gerencia_base`, `cumplimiento_plan_pct`, `brecha_puntos`, `descuento_pct`, `devolucion_pct`, `accion_ia`, `confianza_accion` y `urgencia_ia`, ordenada por urgencia.
6. Barras **Clientes por acción**: `accion_ia` y conteo de `cliente`.
7. Barras **Venta por segmento IA** sobre `ds_segmento_ia`: `segmento_ia` y `SUM(venta_neta)`.
8. Tabla **Resumen ejecutivo IA** sobre `ds_resumen_ejecutivo`, a todo el ancho.

### 4.3 Publicar y compartir

1. **Publish** con "Share data permissions" para que los usuarios con Consumer access vean el tablero sin permisos sobre el warehouse ([Share a dashboard](https://learn.microsoft.com/en-us/azure/databricks/dashboards/share/share)).
2. Dejen encendido **Enable Genie**. Prueben Ask Genie sobre el gráfico de barras: "¿Por qué Supermercados WM va por debajo del plan?".
3. Programen una suscripción semanal por correo o Microsoft Teams ([Schedules and subscriptions](https://learn.microsoft.com/en-us/azure/databricks/dashboards/share/schedule-subscribe)).

### 4.4 Hágalo con Genie Code

El prompt describe el resultado; las consultas las toma Genie Code del JSON del tablero, así que primero ese archivo tiene que estar en su workspace ([Genie Code for dashboard authoring](https://learn.microsoft.com/en-us/azure/databricks/dashboards/manage/dashboard-agent)).

1. Clonen este repositorio en su workspace: **Workspace > Create > Git folder** con la URL `https://github.com/scaravacap/Taller_Comercial_Dos_Pinos` ([Databricks Git folders](https://learn.microsoft.com/en-us/azure/databricks/repos/)). El archivo queda en `dashboards/gestion_comercial_dos_pinos.lvdash.json`.
2. Abran un tablero nuevo y abran Genie Code (el ícono de chispa).
3. Peguen el prompt. Luego borren `@gestion_comercial_dos_pinos.lvdash.json` y `@vgd_cmr_gestion_comercial` del texto y vuelvan a escribir `@` para elegir cada uno en el selector, o agréguenlos con **Add context**. Así Genie Code los carga como contexto.
4. Genie Code va a proponer el plan; revísenlo y apruébenlo.

```text
Crea un dashboard llamado "Gestión Comercial Dos Pinos con IA" en español, con los colores de Dos Pinos (verde #1B7A3E, verde claro #4FA56C, amarillo #F5C518, gris oscuro #1A1A1A).

Usa @vgd_cmr_gestion_comercial como dataset ds_metricas para todos los KPI con MEASURE().

Los demás datasets ya están escritos en @gestion_comercial_dos_pinos.lvdash.json: toma de ese archivo la consulta SQL de cada dataset (campo queryLines) y úsala sin cambios. Lo que devuelve cada uno:
- ds_avance_diario: venta diaria y acumulada por fecha, gerencia y canal nivel 3, junto al plan del mes prorrateado por día laboral.
- ds_pronostico: venta real y pronóstico diario con ai_forecast por gerencia hasta fin de mes, con límite inferior y superior.
- ds_cierre_proyectado: una sola fila con el cierre proyectado del mes (venta real más el pronóstico de ai_forecast para los días que faltan), los escenarios bajo y alto, el plan y la proyección propia de Dos Pinos.
- ds_gerencias: las opciones del selector de gerencia: TODAS más cada gerencia.
- ds_decision_ia: por cliente, el cumplimiento del plan, la brecha contra el avance esperado del mes, el descuento, la devolución y la acción y urgencia que sugiere ai_decide; filtra por el parámetro :gerencia (texto, por defecto TODAS).
- ds_segmento_ia: los 60 materiales con más venta y el segmento que les asigna ai_classify.
- ds_resumen_ejecutivo: un resumen ejecutivo en español por gerencia, escrito con ai_gen.

Construye estas páginas y widgets, en este orden:

Página "Filtros globales":
- Filtros de selección múltiple sobre gerencia_base, canal_nivel3, categoria, provincia y marca. En cada filtro, conecta el campo en todos los datasets que lo tengan (la metric view los tiene todos; ds_avance_diario y ds_pronostico tienen gerencia_base).

Página "Resumen comercial":
- Texto: título y subtítulo del tablero.
- 4 contadores sobre ds_metricas: Venta neta (MEASURE(venta_neta_col), formato moneda compacta), % Cumplimiento plan (cumplimiento_plan_col), % Cumplimiento forecast (cumplimiento_fcst_col) y Clientes activos (clientes_activos).
- Barras agrupadas Venta real vs plan por gerencia: eje X gerencia_base, eje Y venta_neta_col y venta_plan_col.
- Línea Avance acumulado vs plan prorrateado sobre ds_avance_diario: eje X fecha, eje Y SUM(venta_acumulada) y SUM(plan_prorrateado).
- Tabla Desempeño por categoría sobre ds_metricas: categoria, venta neta, plan, forecast, % cumplimiento plan, descuento y devolución, ordenada por venta neta.
- Pie Venta por negocio: negocio y venta_neta_col.
- Mapa de puntos Clientes con latitud, longitud y tamaño por venta_neta_col.
- Texto con la nota: el plan del mes está cargado el día 1, por eso el tablero no filtra por fecha.

Página "IA: pronóstico y decisiones":
- Texto: una línea que explica ai_forecast y otra que explica ai_decide.
- Contadores sobre ds_cierre_proyectado: Cierre proyectado (cierre_proyectado), % plan proyectado (cumplimiento_proyectado, formato porcentaje), Escenario bajo y Escenario alto (cumplimiento_escenario_bajo, cumplimiento_escenario_alto) y % plan con proyección Dos Pinos (cumplimiento_proyeccion_dos_pinos).
- Gráfico de línea con pronóstico sobre ds_pronostico: eje X fecha, series venta_real y venta_pronostico, banda entre limite_inferior y limite_superior.
- Filtro de selección única Gerencia para la recomendación IA, conectado al parámetro gerencia de ds_decision_ia, con valor por defecto TODAS.
- Tabla Acción recomendada por cliente sobre ds_decision_ia: cliente, gerencia_base, cumplimiento_plan_pct, brecha_puntos, descuento_pct, devolucion_pct, accion_ia, confianza_accion y urgencia_ia, ordenada por urgencia.
- Barras Clientes por acción: accion_ia y conteo de cliente.
- Barras Venta por segmento IA sobre ds_segmento_ia: segmento_ia y SUM(venta_neta).
- Tabla Resumen ejecutivo IA sobre ds_resumen_ejecutivo, a todo el ancho.

Formatos: montos en colones compactos con un decimal. Las columnas que terminan en _pct están en escala 0 a 100. cumplimiento_proyectado, cumplimiento_escenario_bajo, cumplimiento_escenario_alto y cumplimiento_proyeccion_dos_pinos están en escala 0 a 1 y van con formato porcentaje. No agregues filtro de fecha.

Antes de crear los widgets, muéstrame el plan y espera mi aprobación.
```

### 4.5 Migrar el reporte de Power BI con `/importBI`

La carpeta [`powerbi/`](../powerbi/) tiene el reporte "Análisis de Ventas Dos Pinos" conectado a Databricks con el conector de Azure Databricks (modo Import; las instrucciones de conexión están en su README). Tiene dos páginas, **Resumen del mes** y **Clientes y calidad comercial**, y 19 medidas DAX con las mismas definiciones que la metric view. En Genie Code, `/importBI` convierte un reporte de Power BI en un tablero AI/BI y en metric views de Unity Catalog ([Import BI files using Genie Code](https://learn.microsoft.com/en-us/azure/databricks/dashboards/manage/import-bi)).

1. En Power BI Desktop: **Refresh** para cargar los datos y luego File > Export > **Power BI template (.pbit)**. La documentación acepta `.pbit` y `.tmdl`.
2. Tomen una captura de cada página: Genie Code la usa para validar el diseño y los números.
3. En un tablero nuevo, abran Genie Code y escriban `/importBI`, adjunten el `.pbit` y las capturas.
4. Comparen los KPI del tablero importado con el reporte: venta neta, plan, % cumplimiento, avance esperado y proyección de cierre tienen que coincidir, con y sin filtro de gerencia.

## 5. Genie Agent paso a paso

Un Genie Agent es un agente especializado: responde en lenguaje natural **solo con las fuentes, instrucciones y ejemplos que ustedes le dan**. Lo configura un analista y lo usa el equipo comercial ([Create and manage a Genie Agent](https://learn.microsoft.com/en-us/azure/databricks/genie-agents/set-up), [Curate an effective Genie Agent](https://learn.microsoft.com/en-us/azure/databricks/genie-agents/best-practices)).

La configuración completa está en [`genie/genie_agent_configuracion.md`](../genie/genie_agent_configuracion.md) (para copiar y pegar) y en [`genie/genie_agent_serialized_space.json`](../genie/genie_agent_serialized_space.json) (para la API).

### 5.1 Crear el agente y sus fuentes

1. Genie > **New**. Seleccionen la metric view `vgd_cmr_gestion_comercial` y la tabla `vtx_cmr_gestion_comercial`.
2. En **Sources** > tabla > columnas `CATEG, CLIENTE_NOMBRE3, GERENCIA_BASE, MARCA, PROV_DESC`: activen **Entity matching**, así Genie reconoce "Walmart" o "Cartago" aunque el usuario los escriba distinto.
3. **Settings**: título "Asistente Comercial Dos Pinos", la descripción del archivo de configuración y el SQL warehouse.

### 5.2 Instrucciones, preguntas de muestra y SQL de ejemplo

1. **Instructions > Text**: peguen las instrucciones generales del archivo de configuración.
2. **Instructions > SQL queries**: agreguen los 5 SQL de ejemplo con su pregunta y su guía de uso. Genie prioriza un SQL de ejemplo sobre una instrucción de texto ([Tune Genie Agent quality](https://learn.microsoft.com/en-us/azure/databricks/genie-agents/tune-quality)).
3. **Settings > Sample questions**: agreguen las 5 preguntas de muestra.

### 5.3 Documentos: preguntas sobre la política comercial

1. Un admin activa el preview **Analyze Files in Volumes with Genie Agents**.
2. Suban el PDF de ejemplo [`genie/politica_comercial_ejemplo.pdf`](../genie/politica_comercial_ejemplo.pdf) a un volume administrado, por ejemplo `documentos_comerciales`.
3. **Sources > Add > Volume** y seleccionen el volume completo.
4. Pregunten en **Agent mode**: "¿Qué clientes superan el límite de descuento de su gerencia según la política comercial?". Genie cruza la tabla con el documento y cita la página.

Esta parte está en Beta y cada usuario necesita `READ VOLUME` sobre el volume ([Analyze files in volumes](https://learn.microsoft.com/en-us/azure/databricks/genie-agents/volumes)).

### 5.4 Benchmarks: medir antes de compartir

1. Pestaña **Benchmarks** > **Add benchmark**: agreguen las 6 preguntas del archivo de configuración con su SQL de respuesta.
2. **Run all**. Genie compara su resultado con el esperado y marca cada pregunta como Good o Bad.
3. Por cada Bad, agreguen un SQL de ejemplo o ajusten una instrucción, y vuelvan a correr ([Test and monitor a Genie Agent](https://learn.microsoft.com/en-us/azure/databricks/genie-agents/monitor)).

### 5.5 Compartir

Compartan el agente con el grupo comercial con **CAN RUN**. Cada usuario necesita `SELECT` sobre la tabla y la metric view; el cómputo corre con las credenciales del autor.

### 5.6 Hágalo con Genie Code

Al crear un agente nuevo, Genie Code se abre solo. Peguen este prompt:

````text
Crea un Genie agent llamado "Asistente Comercial Dos Pinos" con la descripción: "Seguimiento de la venta del mes del canal moderno (Supermercados WM, Supermercados y Cuentas Especiales): venta neta, plan, forecast, cumplimiento, descuentos y devoluciones por cliente, categoría y marca. Incluye el documento de política comercial de ejemplo."

Fuentes: @vgd_cmr_gestion_comercial y @vtx_cmr_gestion_comercial, y el volume documentos_comerciales con la política comercial. En la tabla, activa entity matching en CATEG, CLIENTE_NOMBRE3, GERENCIA_BASE, MARCA, PROV_DESC.

Usa exactamente estas instrucciones generales:
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

Agrega estas preguntas de muestra:
- ¿Cómo vamos contra el plan por gerencia?
- ¿Qué clientes van atrasados frente al avance esperado del mes?
- ¿Cuáles son las 10 categorías con más venta neta y su cumplimiento?
- ¿Qué clientes superan el límite de descuento de su gerencia según la política comercial?
- ¿Cuál es el cierre proyectado del mes con ai_forecast?

Agrega estos SQL de ejemplo, cada uno con su pregunta:
- "¿Cómo vamos contra el plan por gerencia?":
```sql
SELECT gerencia_base,
       MEASURE(venta_neta_col) / 1e6 AS venta_neta_millones,
       MEASURE(venta_plan_col) / 1e6 AS plan_millones,
       MEASURE(cumplimiento_plan_col) AS cumplimiento_plan_pct,
       MEASURE(cumplimiento_fcst_col) AS cumplimiento_fcst_pct
FROM vgd_cmr_gestion_comercial
GROUP BY ALL
ORDER BY venta_neta_millones DESC
```
- "¿Qué clientes van atrasados frente al avance esperado del mes?":
```sql
SELECT CLIENTE_NOMBRE3 AS cliente, GERENCIA_BASE AS gerencia,
       ROUND(SUM(VTA_COL) / SUM(VTA_PLAN_COL) * 100, 1) AS cumplimiento_plan_pct,
       ROUND(MAX(D_LABOR) / MAX(LABOR_MES_ACT) * 100, 1) AS avance_esperado_pct,
       ROUND(MAX(D_LABOR) / MAX(LABOR_MES_ACT) * 100 - SUM(VTA_COL) / SUM(VTA_PLAN_COL) * 100, 1) AS brecha_puntos
FROM vtx_cmr_gestion_comercial
GROUP BY ALL
HAVING SUM(VTA_PLAN_COL) > 0
ORDER BY brecha_puntos DESC
```
- "¿Qué clientes superan el límite de descuento de su gerencia?":
```sql
SELECT CLIENTE_NOMBRE3 AS cliente, GERENCIA_BASE AS gerencia,
       ROUND(SUM(DESC_COL) / SUM(VTAB_COL) * 100, 2) AS descuento_pct,
       CASE GERENCIA_BASE WHEN 'SUPERMERCADOS WM' THEN 3.0 WHEN 'SUPERMERCADOS' THEN 4.0 ELSE 5.0 END AS limite_pct
FROM vtx_cmr_gestion_comercial
GROUP BY ALL
HAVING SUM(VTAB_COL) > 0
ORDER BY descuento_pct DESC
```
- "¿Cuál es la venta neta diaria del mes?":
```sql
SELECT FECHA_CONTAB AS fecha, SUM(VTA_COL) / 1e6 AS venta_neta_millones
FROM vtx_cmr_gestion_comercial
GROUP BY ALL
ORDER BY fecha
```
- "¿Cuál es el cierre proyectado del mes con ai_forecast?":
```sql
WITH observado AS (
  SELECT FECHA_CONTAB AS fecha, SUM(VTA_COL) AS venta_neta
  FROM vtx_cmr_gestion_comercial
  WHERE FECHA_CONTAB > DATE'2026-10-01'
  GROUP BY ALL
), resto AS (
  SELECT SUM(venta_neta_forecast) AS pronostico_resto
  FROM ai_forecast(observed => TABLE(observado), horizon => '2026-10-31', time_col => 'fecha',
                   value_col => 'venta_neta', frequency => 'D')
  WHERE fecha > (SELECT MAX(fecha) FROM observado) AND DAYOFWEEK(fecha) <> 1
)
SELECT ROUND((SELECT SUM(VTA_COL) FROM vtx_cmr_gestion_comercial) / 1e6, 1) AS venta_real_millones,
       ROUND(pronostico_resto / 1e6, 1) AS pronostico_resto_millones,
       ROUND(((SELECT SUM(VTA_COL) FROM vtx_cmr_gestion_comercial) + pronostico_resto)
             / (SELECT SUM(VTA_PLAN_COL) FROM vtx_cmr_gestion_comercial) * 100, 1) AS cumplimiento_proyectado_pct
FROM resto
```

Agrega estos benchmarks con su SQL de respuesta:
- "¿Cuál es la venta neta total del mes?": `SELECT MEASURE(venta_neta_col) AS venta_neta FROM vgd_cmr_gestion_comercial`
- "¿Qué porcentaje del plan lleva Supermercados WM?": `SELECT MEASURE(cumplimiento_plan_col) AS cumplimiento_plan_pct FROM vgd_cmr_gestion_comercial WHERE gerencia_base = 'SUPERMERCADOS WM'`
- "¿Cuántos clientes activos hay por gerencia?": `SELECT gerencia_base, MEASURE(clientes_activos) AS clientes_activos FROM vgd_cmr_gestion_comercial GROUP BY ALL ORDER BY gerencia_base`
- "Dame las 5 marcas con más venta neta": `SELECT marca, MEASURE(venta_neta_col) AS venta_neta FROM vgd_cmr_gestion_comercial GROUP BY ALL ORDER BY venta_neta DESC LIMIT 5`
- "¿Qué provincia tiene el mayor cumplimiento del plan?": `SELECT provincia, MEASURE(cumplimiento_plan_col) AS cumplimiento_plan_pct FROM vgd_cmr_gestion_comercial GROUP BY ALL ORDER BY cumplimiento_plan_pct DESC LIMIT 1`
- "¿Cuál es el cliente con mayor descuento sobre venta bruta?": `SELECT CLIENTE_NOMBRE3 AS cliente, SUM(DESC_COL) / SUM(VTAB_COL) * 100 AS descuento_pct FROM vtx_cmr_gestion_comercial GROUP BY ALL HAVING SUM(VTAB_COL) > 0 ORDER BY descuento_pct DESC LIMIT 1`

Muéstrame la configuración antes de guardarla.
````

## 6. Excel: la metric view en una tabla dinámica

El Excel Add-in de Databricks importa tablas, vistas y metric views a Excel con los permisos de Unity Catalog de cada usuario ([Set up the Excel Add-in](https://learn.microsoft.com/en-us/azure/databricks/integrations/excel/connect), [Import and query data](https://learn.microsoft.com/en-us/azure/databricks/integrations/excel/query-data), [Use Genie One in Excel](https://learn.microsoft.com/en-us/azure/databricks/integrations/excel/genie)).

**Requisitos:** Databricks SQL access y `CAN USE` sobre un SQL warehouse; Excel para la web, Windows (Microsoft 365) o Mac.

### 6.1 Instalar y conectar

1. En Excel: **Insert > Get Add-ins**, busquen **Databricks** y agréguenlo.
2. Abran el panel de Databricks, escriban la URL del workspace e inicien sesión.
3. Elijan el SQL warehouse.

### 6.2 Hoja "Tabla": la venta en filas

1. Cambien el nombre de la hoja a **Tabla**.
2. En el panel: **Import** > busquen `vtx_cmr_gestion_comercial`.
3. Seleccionen solo las columnas que necesitan: `FECHA_CONTAB`, `GERENCIA_BASE`, `CLIGRP3_DESC`, `CLIENTE_NOMBRE3`, `CATEG`, `MARCA`, `VTA_COL`, `VTA_PLAN_COL`, `DESC_COL`.
4. Agreguen un filtro `GERENCIA_BASE = SUPERMERCADOS` y un límite de filas. **Import**.

### 6.3 Hoja "Metric view": tabla dinámica

1. Hoja nueva **Metric view**. En el panel: **Import** > `vgd_cmr_gestion_comercial` > **Pivot table**.
2. Filas: `gerencia_base` y luego `categoria`. Columnas: `canal_nivel3`. Valores: `venta_neta_col`, `venta_plan_col` y `cumplimiento_plan_col`.
3. Excel muestra "Sum of" en cada medida, pero la metric view calcula el cumplimiento como cociente: no hay doble agregación.
4. Cambien una fila o una columna: la tabla dinámica vuelve a consultar el warehouse (live query).

### 6.4 Una celda que consulta Databricks

En la hoja **Metric view**, escriban `SUPERMERCADOS WM` en `H2` y en `H4`:

```text
=DATABRICKS.SQL("SELECT MEASURE(cumplimiento_plan_col) FROM vgd_cmr_gestion_comercial WHERE gerencia_base = :g", {"g", H2})
```

Cambien `H2` por otra gerencia y la celda se recalcula. Usen el nombre completo de la metric view (catálogo.esquema.nombre).

### 6.5 Genie en Excel

Abran **Genie** en el panel del add-in y prueben:

1. ¿Cuál es el cumplimiento del plan por gerencia y canal nivel 3?
2. ¿Qué 10 clientes tienen la mayor brecha entre el avance esperado del mes y su cumplimiento del plan?
3. Dame la venta neta por categoría y marca para Supermercados, ordenada de mayor a menor.
4. ¿Qué porcentaje de la venta bruta se fue en descuentos por cliente?
5. Compara la venta real contra el forecast por provincia.

Importen la respuesta a la hoja con **Insert**: llega como filas nativas de Excel.

## 7. Genie One: skills y tareas programadas

Genie One es la experiencia para usuarios de negocio: tableros, Genie Agents y un chat que busca en todo el catálogo, en un solo lugar. Funciona con Consumer access ([Use Genie One](https://learn.microsoft.com/en-us/azure/databricks/genie-one/), [Chat in Genie One](https://learn.microsoft.com/en-us/azure/databricks/genie-one/chat)).

### 7.1 Discover: encontrar los activos del área comercial

La página **Discover** muestra tablas, metric views, tableros, Genie Agents y más, organizados por **dominios** (GA desde el 8 de octubre de 2026). Filtren por tipo, dueño, Certified, favoritos, dominio o fecha de modificación ([Discover page](https://learn.microsoft.com/en-us/azure/databricks/discover/discover-page), [Domains](https://learn.microsoft.com/en-us/azure/databricks/uc-semantics/domains)).

1. Abran Genie One > **Discover** y busquen "gestion comercial".
2. Filtren por tipo **Metric view** y abran `vgd_cmr_gestion_comercial`: verán sus medidas y el botón **Ask Genie**.
3. Marquen como favoritos el tablero de la sección 4 y el agente de la sección 5.

### 7.2 Skills: enseñarle a Genie One cómo trabaja su equipo

Un skill es un conjunto de instrucciones que Genie One carga cuando es relevante, o cuando lo invocan con `/` y el nombre (Public Preview). Se crea pidiéndoselo en el chat; Genie One lo guarda en su carpeta de usuario ([Chat in Genie One](https://learn.microsoft.com/en-us/azure/databricks/genie-one/chat)).

Peguen cada prompt en el chat de Genie One:

**`filtro-ventas-periodo`**

```text
Crea el skill filtro-ventas-periodo. Antes de responder cualquier pregunta sobre ventas, plan, forecast, descuentos o cumplimiento, revisa si el usuario indicó un mes, un trimestre o un rango de fechas. Si no lo indicó, no ejecutes ninguna consulta: pregúntale si quiere un mes, un trimestre o un rango de fechas, y espera su respuesta. Cuando lo indique, aplica el periodo como filtro sobre fecha_contab, menciónalo en la primera línea de la respuesta y, si el periodo es menor a un mes, aclara que el plan se carga el día 1 y compara contra el plan prorrateado por días laborados.
```

**`resumen-ejecutivo-semanal`**

```text
Crea el skill resumen-ejecutivo-semanal. Cuando te pida el resumen ejecutivo, consulta la metric view vgd_cmr_gestion_comercial y entrega: venta neta del mes en millones de colones, cumplimiento del plan contra el avance esperado (días laborados entre días laborables), las 3 gerencias con su cumplimiento, los 3 clientes con mayor brecha y una acción sugerida por cliente. Formato: cifra principal primero, luego viñetas cortas.
```

**`alerta-cumplimiento-plan`**

```text
Crea el skill alerta-cumplimiento-plan. Cuando te pregunte por alertas, lista los clientes cuyo cumplimiento del plan está más de 15 puntos por debajo del avance esperado del mes y los clientes cuyo descuento supera el límite de su gerencia (Supermercados WM 3 %, Supermercados 4 %, Cuentas Especiales 5 %). Para cada uno, da la cifra y el responsable de aprobar según la política comercial.
```

Prueben el primero: escriban "¿Cuánto vendimos en Supermercados?". Genie One debe preguntarles por el periodo antes de consultar. Respondan "octubre 2026".

Para editar un skill: **Customizations > Skills > Edit with Genie**.

### 7.3 Tareas programadas

Una tarea programada corre un prompt con la frecuencia que ustedes definan y entrega el resultado por correo y en un hilo de chat (Public Preview, frecuencia máxima diaria).

En el chat de Genie One:

```text
Corre esta consulta como una tarea programada todos los lunes a las 8 AM, zona horaria America/Costa_Rica, y envíame el resultado por correo: lista los clientes cuyo cumplimiento del plan está más de 5 puntos por debajo del avance esperado del mes, con su gerencia, su cumplimiento, la brecha en puntos y una acción sugerida, usando la metric view vgd_cmr_gestion_comercial y la tabla vtx_cmr_gestion_comercial.
```

Revisen la tarea en **Schedules**, prueben con **Run now** y ajusten instrucciones o zona horaria si hace falta.

## Documentación oficial

- [AI Functions](https://learn.microsoft.com/en-us/azure/databricks/large-language-models/ai-functions): [ai_forecast](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/functions/ai_forecast), [ai_decide](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/functions/ai_decide), [ai_classify](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/functions/ai_classify), [ai_extract](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/functions/ai_extract), [ai_gen](https://learn.microsoft.com/en-us/azure/databricks/sql/language-manual/functions/ai_gen)
- [Unity Catalog metric views](https://learn.microsoft.com/en-us/azure/databricks/metric-views/)
- [AI/BI dashboards](https://learn.microsoft.com/en-us/azure/databricks/dashboards/), [Genie Code para tableros](https://learn.microsoft.com/en-us/azure/databricks/dashboards/manage/dashboard-agent), [Import BI files](https://learn.microsoft.com/en-us/azure/databricks/dashboards/manage/import-bi)
- [Genie Agents](https://learn.microsoft.com/en-us/azure/databricks/genie-agents/set-up), [Volumes en Genie](https://learn.microsoft.com/en-us/azure/databricks/genie-agents/volumes), [Benchmarks](https://learn.microsoft.com/en-us/azure/databricks/genie-agents/monitor)
- [Genie One](https://learn.microsoft.com/en-us/azure/databricks/genie-one/), [Discover](https://learn.microsoft.com/en-us/azure/databricks/discover/discover-page)
- [Excel Add-in](https://learn.microsoft.com/en-us/azure/databricks/integrations/excel/connect)

