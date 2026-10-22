# Taller comercial Dos Pinos: AI/BI, Genie y AI Functions

Material del taller con el equipo comercial de Cooperativa Dos Pinos (octubre 2026). Parte de lo que el equipo ya tiene en Unity Catalog, una vista de venta y una metric view, y construye encima un tablero AI/BI con IA, un Genie Agent, consultas desde Excel y automatizaciones en Genie One, sin crear tablas nuevas.

**Empiecen por la guía:** [`docs/GUIA_TALLER_PASO_A_PASO.md`](docs/GUIA_TALLER_PASO_A_PASO.md).

## Contenido

| Carpeta | Qué tiene |
|---|---|
| [`docs/`](docs/) | La guía paso a paso de las 7 secciones |
| [`notebooks/`](notebooks/) | `Taller_Comercial_Dos_Pinos.ipynb`: exploración, metadatos opcionales y AI Functions en SQL |
| [`dashboards/`](dashboards/) | El tablero AI/BI en JSON (`.lvdash.json`) y el SQL de cada dataset |
| [`genie/`](genie/) | Configuración del Genie Agent (instrucciones, SQL de ejemplo, benchmarks) y el PDF de política comercial de ejemplo |
| [`powerbi/`](powerbi/) | El reporte de Power BI conectado a Databricks que migramos con `/importBI` |

## Cómo usarlo

1. En su workspace: **Workspace > Create > Git folder** y peguen la URL de este repositorio.
2. Abran `notebooks/Taller_Comercial_Dos_Pinos.ipynb`, conéctenlo a un SQL warehouse Pro o Serverless y ajusten los widgets `catalogo` y `esquema`.
3. Sigan la guía para el tablero, el Genie Agent, Excel y Genie One.

## Sobre los datos

Este repositorio no contiene datos de Dos Pinos: solo SQL, configuración y un documento de ejemplo. Las consultas apuntan a `prd_gold.bix_cmr_ab_nacional`; cambien el catálogo y el esquema para usar otro ambiente.

El PDF `genie/politica_comercial_ejemplo.pdf` es un documento ilustrativo creado para el taller. Sus reglas y porcentajes no representan la política comercial real de Dos Pinos.

## Documentación oficial

- [AI Functions](https://learn.microsoft.com/en-us/azure/databricks/large-language-models/ai-functions)
- [Unity Catalog metric views](https://learn.microsoft.com/en-us/azure/databricks/metric-views/)
- [AI/BI dashboards](https://learn.microsoft.com/en-us/azure/databricks/dashboards/)
- [Genie Agents](https://learn.microsoft.com/en-us/azure/databricks/genie-agents/set-up)
- [Genie One](https://learn.microsoft.com/en-us/azure/databricks/genie-one/)
- [Excel Add-in](https://learn.microsoft.com/en-us/azure/databricks/integrations/excel/connect)
