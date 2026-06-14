const { db } = require("../db/database");
const { authMiddleware, requireAdmin } = require("../middleware/auth");

module.exports = function(app) {
app.get("/api/reportes", authMiddleware, (req, res) => {
  const { periodo } = req.query;
  let dateFilter;
  const now = new Date();
  switch (periodo) {
    case "hoy":
      dateFilter = "DATE(c.fecha)=DATE('now')";
      break;
    case "semana":
      dateFilter = "c.fecha >= DATE('now','-7 days')";
      break;
    case "anio":
      dateFilter = "strftime('%Y',c.fecha)=strftime('%Y','now')";
      break;
    default:
      dateFilter = "c.fecha >= DATE('now','-30 days')";
      break;
  }

  try {
    const resumen = {};
    const queries = [
      new Promise((resolve, reject) =>
        db.get(
          `SELECT COUNT(*) as total FROM citas c WHERE ${dateFilter}`,
          (err, r) =>
            err ? reject(err) : resolve((resumen.totalCitas = r?.total || 0)),
        ),
      ),
      new Promise((resolve, reject) =>
        db.get(
          `SELECT COUNT(*) as total FROM citas c WHERE ${dateFilter} AND c.estado='completada'`,
          (err, r) =>
            err ? reject(err) : resolve((resumen.completadas = r?.total || 0)),
        ),
      ),
      new Promise((resolve, reject) =>
        db.get(
          `SELECT COUNT(*) as total FROM citas c WHERE ${dateFilter} AND c.estado='cancelada'`,
          (err, r) =>
            err ? reject(err) : resolve((resumen.canceladas = r?.total || 0)),
        ),
      ),
      new Promise((resolve, reject) =>
        db.get(
          `SELECT COALESCE(SUM(s.precio),0) as total FROM citas c JOIN servicios s ON c.servicio_id=s.id WHERE ${dateFilter} AND c.estado='completada'`,
          (err, r) =>
            err
              ? reject(err)
              : resolve((resumen.ingresosCompletadas = r?.total || 0)),
        ),
      ),
      new Promise((resolve, reject) =>
        db.get(
          `SELECT COUNT(*) as total FROM pacientes WHERE created_at >= DATE('now','-30 days')`,
          (err, r) =>
            err
              ? reject(err)
              : resolve((resumen.pacientesNuevos = r?.total || 0)),
        ),
      ),
      new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as total FROM citas c WHERE ${dateFilter} AND c.estado='cancelada'`,
          (err, cancel) => {
            db.get(
              `SELECT COUNT(*) as total FROM citas c WHERE ${dateFilter}`,
              (err2, total) => {
                const t = total?.total || 0;
                resolve(
                  (resumen.tasaCancelacion =
                    t > 0 ? Math.round(((cancel?.total || 0) / t) * 100) : 0),
                );
              },
            );
          },
        );
      }),
      new Promise((resolve, reject) =>
        db.all(
          `SELECT c.estado, COUNT(*) as total FROM citas c WHERE ${dateFilter} GROUP BY c.estado`,
          (err, rows) => resolve((resumen.citasPorEstado = rows || [])),
        ),
      ),
      new Promise((resolve, reject) =>
        db.all(
          `SELECT s.nombre, COUNT(c.id) as total FROM citas c JOIN servicios s ON c.servicio_id=s.id WHERE ${dateFilter} GROUP BY c.servicio_id ORDER BY total DESC LIMIT 10`,
          (err, rows) =>
            resolve((resumen.serviciosMasSolicitados = rows || [])),
        ),
      ),
      new Promise((resolve, reject) =>
        db.all(
          `SELECT c.fecha as label, COUNT(*) as total FROM citas c WHERE ${dateFilter} GROUP BY c.fecha ORDER BY c.fecha`,
          (err, rows) => resolve((resumen.citasPorDia = rows || [])),
        ),
      ),
      new Promise((resolve, reject) =>
        db.all(
          `SELECT rc.*, c.nombre_paciente, s.nombre as servicio_nombre, m.nombre as medico_nombre FROM resultados_citas rc JOIN citas c ON rc.cita_id=c.id LEFT JOIN servicios s ON c.servicio_id=s.id LEFT JOIN usuarios_admin m ON c.medico_id=m.id ORDER BY rc.created_at DESC LIMIT 20`,
          (err, rows) => resolve((resumen.resultadosRegistrados = rows || [])),
        ),
      ),
      new Promise((resolve, reject) =>
        db.all(
          `SELECT c.nombre_paciente, COUNT(c.id) as total FROM citas c WHERE ${dateFilter} GROUP BY c.nombre_paciente, c.telefono ORDER BY total DESC LIMIT 5`,
          (err, rows) => resolve((resumen.pacientesFrecuentes = rows || [])),
        ),
      ),
    ];

    Promise.all(queries).then(() => {
      const insights = [];
      if (resumen.completadas > resumen.canceladas) {
        insights.push({
          tipo: "positivo",
          titulo: "Buen ritmo de atención",
          texto: `${resumen.completadas} citas completadas superan las canceladas.`,
        });
      }
      if (resumen.canceladas > 3) {
        insights.push({
          tipo: "alerta",
          titulo: "Tasa de cancelación elevada",
          texto: `${resumen.canceladas} cancelaciones. Revise la agenda.`,
        });
      }
      if (resumen.pacientesNuevos > 0) {
        insights.push({
          tipo: "info",
          titulo: "Nuevos pacientes",
          texto: `${resumen.pacientesNuevos} pacientes nuevos registrados.`,
        });
      }
      if (resumen.ingresosCompletadas > 0) {
        insights.push({
          tipo: "azul",
          titulo: "Ingresos del período",
          texto: `RD$${Number(resumen.ingresosCompletadas).toLocaleString()} generados.`,
        });
      }
      resumen.insights = insights;
      res.json({
        success: true,
        resumen,
        citasPorEstado: resumen.citasPorEstado,
        serviciosMasSolicitados: resumen.serviciosMasSolicitados,
        citasPorDia: resumen.citasPorDia,
        resultadosRegistrados: resumen.resultadosRegistrados,
        pacientesFrecuentes: resumen.pacientesFrecuentes,
        insights,
      });
    });
  } catch (err) {
    console.error("[reportes] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

};
