# Power BI: Gestión Comercial Dos Pinos

Proyecto de Power BI (PBIP) para la demo de `/importBI`: un reporte comercial conectado a Azure
Databricks que se abre en Power BI Desktop, se exporta como plantilla `.pbit` y se migra a un
dashboard AI/BI con Genie Code.

Las medidas DAX usan las mismas definiciones que la metric view `vgd_cmr_gestion_comercial`
(venta neta, plan, forecast, cumplimiento, clientes activos, SKUs). Así, después de importar, los
KPI del tablero AI/BI tienen que coincidir uno a uno con los del reporte.

El proyecto no trae datos ni credenciales. Los datos se leen de Databricks al refrescar.

## Qué contiene

| Ruta | Contenido |
|------|-----------|
| `Analisis_Ventas_Dos_Pinos.pbip` | El archivo que se abre desde Power BI Desktop |
| `Analisis_Ventas_Dos_Pinos.SemanticModel/` | Modelo en TMDL: 1 tabla, 26 columnas y 19 medidas DAX |
| `Analisis_Ventas_Dos_Pinos.Report/` | Reporte en PBIR: 2 páginas y 26 visuales |
| `medidas_dax.md` | Todas las medidas DAX con su descripción |
| `_build/generate_pbip.js` | Generador del proyecto (Node.js, sin dependencias) |
| `_build/validate_pbir.js` | Validador de los JSON contra los esquemas oficiales de Microsoft |

### Páginas

1. **Resumen del mes.** Seis KPI: venta neta, plan del mes, % cumplimiento del plan, avance
   esperado (días laborados / laborables), brecha en puntos y proyección de cierre contra plan.
   Línea de venta acumulada contra plan prorrateado por día, columnas de venta contra plan por
   gerencia y tabla de desempeño por categoría.
2. **Clientes y calidad comercial.** Clientes activos, SKUs, cumplimiento de forecast, % descuento,
   % devolución y volumen en KL; tabla por cliente con cumplimiento, brecha, descuento y devolución;
   venta por marca y participación por gerencia.

Las dos páginas tienen filtros desplegables de gerencia, canal y marca.

El plan y el forecast se cargan el día 1. Si ese día la venta neta es negativa por ajustes, la
venta acumulada arranca por debajo de cero.

## Fuente de datos

| Parámetro | Valor |
|-----------|-------|
| Conector | Azure Databricks, `Databricks.Catalogs(..., [Implementation="2.0"])` |
| Modo | Import |
| Server hostname | variable `DATABRICKS_HOST` (por defecto un valor de ejemplo) |
| HTTP path | variable `DATABRICKS_HTTP_PATH` |
| Tabla | `DATABRICKS_CATALOG`.`DATABRICKS_SCHEMA`.`vtx_cmr_gestion_comercial` (por defecto `prd_gold.bix_cmr_ab_nacional`) |

El proyecto del repo trae valores de ejemplo. Para generarlo contra su workspace:

```bash
DATABRICKS_HOST=adb-xxxx.azuredatabricks.net DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/xxxx node _build/generate_pbip.js
```

También pueden abrir el proyecto y cambiar el servidor en **Transformar datos > Configuración de origen de datos**.

Power BI lee la **tabla**. No puede leer las métricas de Unity Catalog (metric views), por eso
la lógica de negocio vive aquí como DAX y hay que mantenerla en dos lugares. En producción el
reporte original usa DirectQuery; aquí usamos Import porque la tabla del taller es pequeña
(unas 5.900 filas).

## Abrir y refrescar

1. Copia la carpeta completa (el `.pbip` y las dos carpetas `.Report` y `.SemanticModel` deben
   quedar juntos).
2. En Power BI Desktop: **Archivo → Abrir** y elijan `Analisis_Ventas_Dos_Pinos.pbip`. El reporte abre
   con los visuales vacíos y el aviso *Some of the tables have incomplete or no data*: es normal,
   todavía no hay datos.
3. **Inicio → Actualizar.** La primera vez Power BI pide credenciales para Azure Databricks:
   elige **Cuenta de organización / Microsoft Entra ID (Azure AD)**, pulsa **Iniciar sesión** con
   tu cuenta corporativa y luego **Conectar**. Al terminar, los visuales se llenan.
4. No agregues la tabla con *Obtener datos*: ya está en el modelo. Hacerlo crea una tabla
   duplicada que los visuales no usan.

Si al actualizar aparece un error de credenciales, ve a **Archivo → Opciones y configuración →
Configuración de origen de datos**, borra los permisos del servidor de Databricks y vuelve a
actualizar.

## Exportar a `.pbit` y migrar a AI/BI

1. Con el reporte abierto y refrescado: **Archivo → Exportar → Plantilla de Power BI**. Guarda
   `Analisis_Ventas_Dos_Pinos.pbit`. La plantilla lleva el modelo, las medidas DAX y los visuales,
   sin datos.
2. En Databricks, crea un **dashboard AI/BI** nuevo (queda en borrador).
3. Abre **Genie Code** en el dashboard, escribe `/import-bi` y sube el `.pbit`.
4. Genie Code convierte las medidas DAX y arma el dashboard sobre la misma tabla de Unity Catalog.

Referencia: [Importar desde Power BI](https://learn.microsoft.com/en-us/azure/databricks/dashboards/manage/import-bi).

## Regenerar y validar

```bash
cd _build
node generate_pbip.js

# validación offline de los JSON del reporte (instala ajv fuera del repo)
mkdir -p /tmp/pbival && npm i --prefix /tmp/pbival ajv@8 ajv-formats
NODE_PATH=/tmp/pbival/node_modules node validate_pbir.js ..
```

Las versiones de esquema PBIR (`report/3.0.0`, `page/2.0.0`, `visualContainer/2.4.0`) y el
`themeCollection` vacío son a propósito: son las que ya abrieron en Power BI Desktop. No las
subas sin probar.
