# Medidas DAX: Análisis de Ventas Dos Pinos

Generado por `_build/generate_pbip.js`. Todas viven en la tabla `vtx_cmr_gestion_comercial` del modelo (`Analisis_Ventas_Dos_Pinos.SemanticModel`). Montos en millones de colones (M₡).

> **Mismas definiciones que la metric view.** El plan y el forecast del mes se cargan completos el día 1, así que `% Cumplimiento Plan` compara la venta neta contra el mes completo, igual que `cumplimiento_plan_col` en `vgd_cmr_gestion_comercial`. Para saber si se va atrasado se compara contra `% Avance Esperado` (días laborados / laborables, 15 de 27): `Brecha vs Avance pts` es la diferencia en puntos.

## 1. Ventas (M₡)

### Venta Neta M

Venta neta en millones de colones (venta_neta_col en la metric view). Formato: `#,0.0`.

```dax
Venta Neta M = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), 1000000)
```

### Plan Mes M

Plan del mes completo, cargado el día 1 (venta_plan_col). Formato: `#,0.0`.

```dax
Plan Mes M = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]), 1000000)
```

### FCST Mes M

Forecast comercial del mes completo, cargado el día 1 (venta_fcst_col). Formato: `#,0.0`.

```dax
FCST Mes M = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_FCST_COL]), 1000000)
```

### Falta para Plan M

Venta que falta para cumplir el plan del mes. Formato: `#,0.0`.

```dax
Falta para Plan M = [Plan Mes M] - [Venta Neta M]
```

### Proyeccion Cierre M

Proyección de cierre de Dos Pinos: venta real / días laborados × días laborables (venta_proyectada_col). Formato: `#,0.0`.

```dax
Proyeccion Cierre M = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PROYECTADA_COL]), 1000000)
```

## 2. Cumplimiento

### % Cumplimiento Plan

Venta neta / plan del mes (cumplimiento_plan_col). Formato: `0.0%`.

```dax
% Cumplimiento Plan = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]))
```

### % Cumplimiento FCST

Venta neta / forecast del mes (cumplimiento_fcst_col). Formato: `0.0%`.

```dax
% Cumplimiento FCST = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_FCST_COL]))
```

### % Avance Esperado

Días laborados / días laborables del mes: lo que debería llevarse vendido hoy. Formato: `0.0%`.

```dax
% Avance Esperado = DIVIDE(MAX(vtx_cmr_gestion_comercial[D_LABOR]), MAX(vtx_cmr_gestion_comercial[LABOR_MES_ACT]))
```

### Brecha vs Avance pts

Puntos de cumplimiento por encima (+) o por debajo (-) del avance esperado. Formato: `+0.0;-0.0;0.0`.

```dax
Brecha vs Avance pts = ([% Cumplimiento Plan] - [% Avance Esperado]) * 100
```

### % Proyeccion vs Plan

Proyección de cierre / plan del mes. Formato: `0.0%`.

```dax
% Proyeccion vs Plan = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PROYECTADA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]))
```

## 3. Avance diario

### Venta Acumulada M

Venta neta acumulada hasta el día del mes. Formato: `#,0.0`.

```dax
Venta Acumulada M = CALCULATE([Venta Neta M], FILTER(ALL(vtx_cmr_gestion_comercial[DIA_MES]), vtx_cmr_gestion_comercial[DIA_MES] <= MAX(vtx_cmr_gestion_comercial[DIA_MES])))
```

### Plan Prorrateado Acumulado M

Plan del mes prorrateado por los días laborados hasta el día del mes. Formato: `#,0.0`.

```dax
Plan Prorrateado Acumulado M = CALCULATE([Plan Mes M], ALL(vtx_cmr_gestion_comercial[DIA_MES])) * DIVIDE(CALCULATE(DISTINCTCOUNT(vtx_cmr_gestion_comercial[DIA_MES]), FILTER(ALL(vtx_cmr_gestion_comercial[DIA_MES]), vtx_cmr_gestion_comercial[DIA_MES] <= MAX(vtx_cmr_gestion_comercial[DIA_MES]))), MAX(vtx_cmr_gestion_comercial[LABOR_MES_ACT]))
```

## 4. Calidad comercial

### % Descuento

Descuento sobre venta bruta. Formato: `0.0%`.

```dax
% Descuento = DIVIDE(SUM(vtx_cmr_gestion_comercial[DESC_COL]), SUM(vtx_cmr_gestion_comercial[VTAB_COL]))
```

### % Devolucion

Devolución sobre venta bruta (DEV_COL viene en negativo). Formato: `0.00%`.

```dax
% Devolucion = DIVIDE(-SUM(vtx_cmr_gestion_comercial[DEV_COL]), SUM(vtx_cmr_gestion_comercial[VTAB_COL]))
```

### Clientes Activos

Clientes con movimiento (clientes_activos). Formato: `#,0`.

```dax
Clientes Activos = DISTINCTCOUNT(vtx_cmr_gestion_comercial[CLIENTE_ID])
```

### SKUs Vendidos

Materiales distintos con movimiento (skus_vendidos). Formato: `#,0`.

```dax
SKUs Vendidos = DISTINCTCOUNT(vtx_cmr_gestion_comercial[MAT_ID])
```

### Volumen KL

Volumen en kilolitros (kilolitros). Formato: `#,0.0`.

```dax
Volumen KL = SUM(vtx_cmr_gestion_comercial[KL])
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

## Bloque para "Vista de consulta DAX"

Pega esto en la vista de consulta DAX de Power BI Desktop para probar las medidas sueltas:

```dax
DEFINE
	MEASURE vtx_cmr_gestion_comercial[Venta Neta M] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), 1000000)
	MEASURE vtx_cmr_gestion_comercial[Plan Mes M] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]), 1000000)
	MEASURE vtx_cmr_gestion_comercial[FCST Mes M] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_FCST_COL]), 1000000)
	MEASURE vtx_cmr_gestion_comercial[Falta para Plan M] = [Plan Mes M] - [Venta Neta M]
	MEASURE vtx_cmr_gestion_comercial[Proyeccion Cierre M] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PROYECTADA_COL]), 1000000)
	MEASURE vtx_cmr_gestion_comercial[% Cumplimiento Plan] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]))
	MEASURE vtx_cmr_gestion_comercial[% Cumplimiento FCST] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_FCST_COL]))
	MEASURE vtx_cmr_gestion_comercial[% Avance Esperado] = DIVIDE(MAX(vtx_cmr_gestion_comercial[D_LABOR]), MAX(vtx_cmr_gestion_comercial[LABOR_MES_ACT]))
	MEASURE vtx_cmr_gestion_comercial[Brecha vs Avance pts] = ([% Cumplimiento Plan] - [% Avance Esperado]) * 100
	MEASURE vtx_cmr_gestion_comercial[% Proyeccion vs Plan] = DIVIDE(SUM(vtx_cmr_gestion_comercial[VTA_PROYECTADA_COL]), SUM(vtx_cmr_gestion_comercial[VTA_PLAN_COL]))
	MEASURE vtx_cmr_gestion_comercial[Venta Acumulada M] = CALCULATE([Venta Neta M], FILTER(ALL(vtx_cmr_gestion_comercial[DIA_MES]), vtx_cmr_gestion_comercial[DIA_MES] <= MAX(vtx_cmr_gestion_comercial[DIA_MES])))
	MEASURE vtx_cmr_gestion_comercial[Plan Prorrateado Acumulado M] = CALCULATE([Plan Mes M], ALL(vtx_cmr_gestion_comercial[DIA_MES])) * DIVIDE(CALCULATE(DISTINCTCOUNT(vtx_cmr_gestion_comercial[DIA_MES]), FILTER(ALL(vtx_cmr_gestion_comercial[DIA_MES]), vtx_cmr_gestion_comercial[DIA_MES] <= MAX(vtx_cmr_gestion_comercial[DIA_MES]))), MAX(vtx_cmr_gestion_comercial[LABOR_MES_ACT]))
	MEASURE vtx_cmr_gestion_comercial[% Descuento] = DIVIDE(SUM(vtx_cmr_gestion_comercial[DESC_COL]), SUM(vtx_cmr_gestion_comercial[VTAB_COL]))
	MEASURE vtx_cmr_gestion_comercial[% Devolucion] = DIVIDE(-SUM(vtx_cmr_gestion_comercial[DEV_COL]), SUM(vtx_cmr_gestion_comercial[VTAB_COL]))
	MEASURE vtx_cmr_gestion_comercial[Clientes Activos] = DISTINCTCOUNT(vtx_cmr_gestion_comercial[CLIENTE_ID])
	MEASURE vtx_cmr_gestion_comercial[SKUs Vendidos] = DISTINCTCOUNT(vtx_cmr_gestion_comercial[MAT_ID])
	MEASURE vtx_cmr_gestion_comercial[Volumen KL] = SUM(vtx_cmr_gestion_comercial[KL])
	MEASURE vtx_cmr_gestion_comercial[Dias Laborados] = MAX(vtx_cmr_gestion_comercial[D_LABOR])
	MEASURE vtx_cmr_gestion_comercial[Dias Laborables] = MAX(vtx_cmr_gestion_comercial[LABOR_MES_ACT])
EVALUATE
	SUMMARIZECOLUMNS(
		vtx_cmr_gestion_comercial[GERENCIA_BASE],
		"Venta Neta M", [Venta Neta M],
		"% Cumplimiento Plan", [% Cumplimiento Plan],
		"Brecha vs Avance pts", [Brecha vs Avance pts]
	)
```
