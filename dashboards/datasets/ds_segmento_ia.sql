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
