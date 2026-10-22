# Power BI: Análisis de Ventas Totales (Dos Pinos)

Proyecto de Power BI (PBIP) que replica el reporte comercial **ANÁLISIS DE VENTAS TOTALES**,
conectado a Azure Databricks. Sirve para el último bloque del taller: abrirlo en Power BI
Desktop, mostrar que lee desde Databricks, exportarlo como plantilla `.pbit` y migrarlo a un
dashboard AI/BI con el comando `/import-bi` de Genie Code.

El proyecto no trae datos ni credenciales. Los datos se leen de Databricks al refrescar.

## Qué contiene

| Ruta | Contenido |
|------|-----------|
| `Analisis_Ventas_Dos_Pinos.pbip` | El archivo que se abre con doble clic |
| `Analisis_Ventas_Dos_Pinos.SemanticModel/` | Modelo en TMDL: 1 tabla, 32 columnas y 25 medidas DAX |
| `Analisis_Ventas_Dos_Pinos.Report/` | Reporte en PBIR: 2 páginas y 24 visuales |
| `medidas_dax.md` | Todas las medidas DAX con su descripción |
| `_build/generate_pbip.js` | Generador del proyecto (Node.js, sin dependencias) |
| `_build/validate_pbir.js` | Validador de los JSON contra los esquemas oficiales de Microsoft |

### Páginas

1. **Análisis de Ventas Totales.** Días laborados, laborables y pendientes; CUM% PLAN, CUM% FCST y
   venta real; avance de la venta acumulada contra el plan ponderado por día del mes; matrices por
   gerencia y por categoría con venta real, plan ponderado, Δ₡ plan, Δ₡ FCST, % cumplimiento de plan
   y de FCST. Filtros por canal, provincia y marca.
2. **Detalle por Cliente y Material.** Venta, % de avance contra el plan del mes, % de descuento,
   % de devolución y SKUs por cliente; top 10 materiales por venta; venta por negocio.

Las columnas de año anterior (Δ AA, % VAR AA) del reporte original no están, porque la tabla no
tiene historia del año anterior.

## Fuente de datos

| Parámetro | Valor |
|-----------|-------|
| Server hostname | variable `DATABRICKS_HOST` (por defecto un valor de ejemplo) |
| HTTP path | variable `DATABRICKS_HTTP_PATH` |
| Tabla | `DATABRICKS_CATALOG`.`DATABRICKS_SCHEMA`.`vtx_cmr_gestion_comercial` (por defecto `prd_gold.bix_cmr_ab_nacional`) |

El proyecto del repo trae valores de ejemplo. Para generarlo contra su workspace:

```bash
DATABRICKS_HOST=adb-xxxx.azuredatabricks.net DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/xxxx node _build/generate_pbip.js
```

También pueden abrir el proyecto y cambiar el servidor en **Transformar datos > Configuración de origen de datos**.
| Conector | Azure Databricks, `Databricks.Catalogs(..., [Implementation="2.0"])` |
| Modo | Import |

Power BI lee la **tabla**. No puede leer las métricas de Unity Catalog (metric views), por eso
toda la lógica de negocio vive aquí como DAX y hay que mantenerla en dos lugares. En producción
el reporte original usa DirectQuery; aquí usamos Import porque la tabla del taller es pequeña
(unas 5.900 filas).

## Abrir y refrescar

1. Copia la carpeta completa (el `.pbip` y las dos carpetas `.Report` y `.SemanticModel` deben
   quedar juntos).
2. Doble clic en `Analisis_Ventas_Dos_Pinos.pbip`. El reporte abre con los visuales vacíos: es
   normal, todavía no hay datos.
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
