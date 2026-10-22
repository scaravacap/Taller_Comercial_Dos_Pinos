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
