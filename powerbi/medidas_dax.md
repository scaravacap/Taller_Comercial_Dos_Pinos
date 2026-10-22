# Medidas DAX: Análisis de Ventas Dos Pinos

Generado por `_build/generate_pbip.js`. Todas viven en la tabla `vtx_cmr_gestion_comercial` del modelo (`Analisis_Ventas_Dos_Pinos.SemanticModel`). Montos en millones de colones (M₡).

> **Plan y FCST ponderados.** El plan y el forecast del mes se cargan completos el día 1. `VTA_PLAN_POND_COL` y `VTA_FCST_POND_COL` ya vienen prorrateados a los días laborados (15 de 27), así que `% Cump Plan` compara contra lo que se esperaba vender a la fecha, igual que el reporte original. `% Avance Plan Mes` compara contra el mes completo.

## 1. Ventas (M₡)

### Venta Real M

Venta neta en millones de colones. Formato: `#,0.0`.

```dax
Venta Real M = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), 1000000)
```

### Venta Bruta M

Venta bruta en millones de colones. Formato: `#,0.0`.

```dax
Venta Bruta M = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTAB_COL]), 1000000)
```

### Plan Mes M

Plan del mes completo (se carga el día 1). Formato: `#,0.0`.

```dax
Plan Mes M = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]), 1000000)
```

### FCST Mes M

Forecast del mes completo (se carga el día 1). Formato: `#,0.0`.

```dax
FCST Mes M = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_FCST_COL]), 1000000)
```

### Plan Pond M

Plan ponderado a los días laborados (plan mes × laborados / laborables). Formato: `#,0.0`.

```dax
Plan Pond M = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PLAN_POND_COL]), 1000000)
```

### FCST Pond M

Forecast ponderado a los días laborados. Formato: `#,0.0`.

```dax
FCST Pond M = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_FCST_POND_COL]), 1000000)
```

### Venta Proyectada M

Proyección de cierre: venta real / laborados × laborables. Formato: `#,0.0`.

```dax
Venta Proyectada M = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PROYECTADA_COL]), 1000000)
```

### Dif vs Plan M

Δ₡ contra el plan ponderado. Formato: `#,0.0`.

```dax
Dif vs Plan M = [Venta Real M] - [Plan Pond M]
```

### Dif vs FCST M

Δ₡ contra el forecast ponderado. Formato: `#,0.0`.

```dax
Dif vs FCST M = [Venta Real M] - [FCST Pond M]
```

## 2. Cumplimiento

### % Cump Plan

Venta real / plan ponderado (como el reporte original). Formato: `0.0%`.

```dax
% Cump Plan = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_PLAN_POND_COL]))
```

### % Cump FCST

Venta real / forecast ponderado. Formato: `0.0%`.

```dax
% Cump FCST = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_FCST_POND_COL]))
```

### % Avance Plan Mes

Venta real / plan del mes completo. Formato: `0.0%`.

```dax
% Avance Plan Mes = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]))
```

### % Avance FCST Mes

Venta real / forecast del mes completo. Formato: `0.0%`.

```dax
% Avance FCST Mes = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_FCST_COL]))
```

### % Proyeccion vs Plan

Proyección de cierre / plan del mes. Formato: `0.0%`.

```dax
% Proyeccion vs Plan = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PROYECTADA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]))
```

## 3. Avance diario

### Venta Acumulada M

Venta real acumulada hasta el día del mes. Formato: `#,0.0`.

```dax
Venta Acumulada M = CALCULATE([Venta Real M], FILTER(ALL(vtx_cmr_gestion_comercial[DIA_MES]), vtx_cmr_gestion_comercial[DIA_MES] <= MAX(vtx_cmr_gestion_comercial[DIA_MES])))
```

### Plan Pond Acumulado M

Plan del mes prorrateado por días con venta hasta el día del mes. Formato: `#,0.0`.

```dax
Plan Pond Acumulado M = CALCULATE([Plan Mes M], ALL(vtx_cmr_gestion_comercial[DIA_MES])) * DIVIDE(CALCULATE(DISTINCTCOUNT(vtx_cmr_gestion_comercial[DIA_MES]), FILTER(ALL(vtx_cmr_gestion_comercial[DIA_MES]), vtx_cmr_gestion_comercial[DIA_MES] <= MAX(vtx_cmr_gestion_comercial[DIA_MES]))), MAX(vtx_cmr_gestion_comercial[LABOR_MES_ACT]))
```

## 4. Calidad comercial

### % Descuento

Descuento sobre venta bruta. Formato: `0.0%`.

```dax
% Descuento = DIVIDE(SUM(vtx_cmr_gestion_comercial[DESC_COL]), SUM(vtx_cmr_gestion_comercial[VTAB_COL]))
```

### % Devolucion

Devolución sobre venta bruta (DEV_COL viene en negativo). Formato: `0.0%`.

```dax
% Devolucion = DIVIDE(-SUM(vtx_cmr_gestion_comercial[DEV_COL]), SUM(vtx_cmr_gestion_comercial[VTAB_COL]))
```

### Clientes Activos

Clientes con movimiento. Formato: `#,0`.

```dax
Clientes Activos = DISTINCTCOUNT(vtx_cmr_gestion_comercial[CLIENTE_ID])
```

### SKUs

Materiales distintos con movimiento. Formato: `#,0`.

```dax
SKUs = DISTINCTCOUNT(vtx_cmr_gestion_comercial[MAT_ID])
```

### Volumen KL

Volumen en kilolitros. Formato: `#,0.0`.

```dax
Volumen KL = SUM(vtx_cmr_gestion_comercial[KL])
```

### Venta Top 10 Material M

Venta real solo para los 10 materiales de mayor venta en el filtro actual. Formato: `#,0.0`.

```dax
Venta Top 10 Material M = IF(RANKX(ALLSELECTED(vtx_cmr_gestion_comercial[MAT_DESC]), [Venta Real M]) <= 10, [Venta Real M])
```

## 5. Calendario

### Dias Laborados

Días laborados del mes. Formato: `0`.

```dax
Dias Laborados = MAX(vtx_cmr_gestion_comercial[D_LABOR])
```

### Dias Laborables

Días laborables del mes. Formato: `0`.

```dax
Dias Laborables = MAX(vtx_cmr_gestion_comercial[LABOR_MES_ACT])
```

### Dias Pendientes

Días laborables pendientes. Formato: `0`.

```dax
Dias Pendientes = MAX(vtx_cmr_gestion_comercial[D_PENDI])
```

## Bloque para "Vista de consulta DAX"

Pega esto en la vista de consulta DAX de Power BI Desktop para probar las medidas sueltas:

```dax
DEFINE
	MEASURE vtx_cmr_gestion_comercial[Venta Real M] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), 1000000)
	MEASURE vtx_cmr_gestion_comercial[Venta Bruta M] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTAB_COL]), 1000000)
	MEASURE vtx_cmr_gestion_comercial[Plan Mes M] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]), 1000000)
	MEASURE vtx_cmr_gestion_comercial[FCST Mes M] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_FCST_COL]), 1000000)
	MEASURE vtx_cmr_gestion_comercial[Plan Pond M] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PLAN_POND_COL]), 1000000)
	MEASURE vtx_cmr_gestion_comercial[FCST Pond M] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_FCST_POND_COL]), 1000000)
	MEASURE vtx_cmr_gestion_comercial[Venta Proyectada M] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PROYECTADA_COL]), 1000000)
	MEASURE vtx_cmr_gestion_comercial[Dif vs Plan M] = [Venta Real M] - [Plan Pond M]
	MEASURE vtx_cmr_gestion_comercial[Dif vs FCST M] = [Venta Real M] - [FCST Pond M]
	MEASURE vtx_cmr_gestion_comercial[% Cump Plan] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_PLAN_POND_COL]))
	MEASURE vtx_cmr_gestion_comercial[% Cump FCST] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_FCST_POND_COL]))
	MEASURE vtx_cmr_gestion_comercial[% Avance Plan Mes] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]))
	MEASURE vtx_cmr_gestion_comercial[% Avance FCST Mes] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_FCST_COL]))
	MEASURE vtx_cmr_gestion_comercial[% Proyeccion vs Plan] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PROYECTADA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]))
	MEASURE vtx_cmr_gestion_comercial[Venta Acumulada M] = CALCULATE([Venta Real M], FILTER(ALL(vtx_cmr_gestion_comercial[DIA_MES]), vtx_cmr_gestion_comercial[DIA_MES] <= MAX(vtx_cmr_gestion_comercial[DIA_MES])))
	MEASURE vtx_cmr_gestion_comercial[Plan Pond Acumulado M] = CALCULATE([Plan Mes M], ALL(vtx_cmr_gestion_comercial[DIA_MES])) * DIVIDE(CALCULATE(DISTINCTCOUNT(vtx_cmr_gestion_comercial[DIA_MES]), FILTER(ALL(vtx_cmr_gestion_comercial[DIA_MES]), vtx_cmr_gestion_comercial[DIA_MES] <= MAX(vtx_cmr_gestion_comercial[DIA_MES]))), MAX(vtx_cmr_gestion_comercial[LABOR_MES_ACT]))
	MEASURE vtx_cmr_gestion_comercial[% Descuento] = DIVIDE(SUM(vtx_cmr_gestion_comercial[DESC_COL]), SUM(vtx_cmr_gestion_comercial[VTAB_COL]))
	MEASURE vtx_cmr_gestion_comercial[% Devolucion] = DIVIDE(-SUM(vtx_cmr_gestion_comercial[DEV_COL]), SUM(vtx_cmr_gestion_comercial[VTAB_COL]))
	MEASURE vtx_cmr_gestion_comercial[Clientes Activos] = DISTINCTCOUNT(vtx_cmr_gestion_comercial[CLIENTE_ID])
	MEASURE vtx_cmr_gestion_comercial[SKUs] = DISTINCTCOUNT(vtx_cmr_gestion_comercial[MAT_ID])
	MEASURE vtx_cmr_gestion_comercial[Volumen KL] = SUM(vtx_cmr_gestion_comercial[KL])
	MEASURE vtx_cmr_gestion_comercial[Venta Top 10 Material M] = IF(RANKX(ALLSELECTED(vtx_cmr_gestion_comercial[MAT_DESC]), [Venta Real M]) <= 10, [Venta Real M])
	MEASURE vtx_cmr_gestion_comercial[Dias Laborados] = MAX(vtx_cmr_gestion_comercial[D_LABOR])
	MEASURE vtx_cmr_gestion_comercial[Dias Laborables] = MAX(vtx_cmr_gestion_comercial[LABOR_MES_ACT])
	MEASURE vtx_cmr_gestion_comercial[Dias Pendientes] = MAX(vtx_cmr_gestion_comercial[D_PENDI])
EVALUATE
	SUMMARIZECOLUMNS(
		vtx_cmr_gestion_comercial[GERENCIA_BASE],
		"Venta Real M", [Venta Real M],
		"% Cump Plan", [% Cump Plan],
		"% Cump FCST", [% Cump FCST]
	)
```
