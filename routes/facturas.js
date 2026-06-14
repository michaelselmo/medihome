const { db } = require("../db/database");
const { authMiddleware, requireAdmin } = require("../middleware/auth");
const { escHtml } = require("../utils/validators");
const path = require("path");

module.exports = function(app) {
app.get("/api/admin/facturas", authMiddleware, (req, res) => {
  let query = `SELECT f.*, c.codigo_cita, c.fecha as cita_fecha, c.hora as cita_hora, s.nombre as servicio_nombre
    FROM facturas f LEFT JOIN citas c ON f.cita_id=c.id LEFT JOIN servicios s ON f.servicio_id=s.id WHERE 1=1`;
  const params = [];
  const { estado, busqueda, cobertura_estado } = req.query;
  if (estado) {
    query += " AND f.estado=?";
    params.push(estado);
  }
  if (cobertura_estado) {
    query += " AND f.cobertura_estado=?";
    params.push(cobertura_estado);
  }
  if (busqueda) {
    query +=
      " AND (f.numero_factura LIKE ? OR f.paciente_nombre LIKE ? OR f.cedula LIKE ?)";
    params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
  }
  query += " ORDER BY f.created_at DESC";
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get("/api/admin/facturas/:id", authMiddleware, (req, res) => {
  db.get(
    `SELECT f.*, c.codigo_cita, c.fecha as cita_fecha, c.hora as cita_hora, c.nombre_paciente, c.telefono, c.direccion, c.ciudad, c.modalidad,
    s.nombre as servicio_nombre, s.precio
    FROM facturas f LEFT JOIN citas c ON f.cita_id=c.id LEFT JOIN servicios s ON f.servicio_id=s.id WHERE f.id=?`,
    [req.params.id],
    (err, factura) => {
      if (err || !factura)
        return res.status(404).json({ error: "Factura no encontrada" });
      res.json(factura);
    },
  );
});

app.put("/api/admin/facturas/:id/pagar", authMiddleware, (req, res) => {
  const { metodo, referencia, observaciones } = req.body;
  if (!metodo)
    return res.status(400).json({
      error:
        "Método de pago requerido (efectivo, transferencia, tarjeta, pago_movil)",
    });

  db.get(
    "SELECT * FROM facturas WHERE id=? AND estado IN ('pendiente','pendiente_de_pago')",
    [req.params.id],
    (err, factura) => {
      if (err || !factura)
        return res
          .status(400)
          .json({ error: "La factura no está pendiente o no existe" });

      const monto = factura.monto_pagar;
      db.run(
        "INSERT INTO pagos (factura_id, monto, metodo, referencia, observaciones) VALUES (?,?,?,?,?)",
        [req.params.id, monto, metodo, referencia || "", observaciones || ""],
        function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });

          db.run(
            "UPDATE facturas SET estado='pagada', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            [req.params.id],
            function (err3) {
              if (err3) return res.status(500).json({ error: err3.message });

              // Auto-confirmar la cita
              db.run(
                "UPDATE citas SET estado='confirmada', updated_at=CURRENT_TIMESTAMP WHERE id=? AND estado NOT IN ('cancelada','completada')",
                [factura.cita_id],
                function (err4) {
                  if (err4)
                    console.error(
                      "[pago] Error al confirmar cita:",
                      err4.message,
                    );
                },
              );

              // Notificar a admins
              db.all(
                "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
                [],
                function (err5, admins) {
                  if (err5 || !admins) return;
                  var stmt = db.prepare(
                    "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
                  );
                  admins.forEach(function (a) {
                    stmt.run(
                      a.id,
                      "Pago registrado",
                      "Pago de " +
                        factura.paciente_nombre +
                        " — " +
                        (factura.servicio_nombre || "") +
                        " — $" +
                        monto,
                      "factura_pagada",
                      factura.cita_id,
                      factura.paciente_nombre,
                      factura.servicio_nombre,
                    );
                  });
                  stmt.finalize();
                },
              );

              res.json({
                mensaje:
                  "Pago registrado correctamente. Factura marcada como pagada y cita confirmada.",
              });
            },
          );
        },
      );
    },
  );
});

app.put("/api/admin/facturas/:id/anular", authMiddleware, (req, res) => {
  db.run(
    "UPDATE facturas SET estado='anulada', updated_at=CURRENT_TIMESTAMP WHERE id=? AND estado IN ('pendiente','pendiente_de_validacion','pendiente_de_pago')",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res
          .status(400)
          .json({ error: "La factura no está pendiente o no existe" });
      res.json({ mensaje: "Factura anulada" });
    },
  );
});

app.get("/api/facturas/:cita_id", authMiddleware, (req, res) => {
  db.get(
    "SELECT * FROM facturas WHERE cita_id=?",
    [req.params.cita_id],
    (err, factura) => {
      if (err || !factura)
        return res.status(404).json({ error: "Factura no encontrada" });
      res.json(factura);
    },
  );
});

app.put(
  "/api/admin/facturas/:id/validar-cobertura",
  authMiddleware,
  (req, res) => {
    const {
      tipo_calculo,
      porcentaje_autorizado,
      monto_autorizado,
      numero_autorizacion,
      observacion_ars,
      cobertura_estado,
    } = req.body;

    db.get(
      "SELECT * FROM facturas WHERE id=?",
      [req.params.id],
      (err, factura) => {
        if (err || !factura)
          return res.status(404).json({ error: "Factura no encontrada" });
        const ce = factura.cobertura_estado;
        if (
          ce !== "pendiente_de_validacion" &&
          ce !== "pendiente" &&
          ce !== null
        ) {
          return res
            .status(400)
            .json({ error: "La cobertura ya fue validada o no aplica" });
        }

        const precio_base = factura.precio_base;
        let monto_cubierto = 0;
        let monto_pagar = precio_base;
        const newCoberturaEstado = cobertura_estado || "autorizada";

        if (newCoberturaEstado === "rechazada") {
          monto_cubierto = 0;
          monto_pagar = precio_base;
        } else if (tipo_calculo === "porcentaje") {
          const pct = parseFloat(porcentaje_autorizado) || 0;
          monto_cubierto = Math.round(precio_base * (pct / 100));
          monto_pagar = precio_base - monto_cubierto;
        } else if (tipo_calculo === "monto_fijo") {
          monto_cubierto = Math.min(
            parseFloat(monto_autorizado) || 0,
            precio_base,
          );
          monto_pagar = precio_base - monto_cubierto;
        }

        if (monto_pagar < 0) monto_pagar = 0;

        db.run(
          `UPDATE facturas SET
      cobertura_estado=?, numero_autorizacion=?, observacion_ars=?, tipo_calculo=?,
      porcentaje_autorizado=?, monto_autorizado=?, monto_cubierto=?, monto_pagar=?,
      estado='pendiente_de_pago', updated_at=CURRENT_TIMESTAMP
      WHERE id=?`,
          [
            newCoberturaEstado,
            numero_autorizacion || "",
            observacion_ars || "",
            tipo_calculo || "",
            parseFloat(porcentaje_autorizado) || 0,
            parseFloat(monto_autorizado) || 0,
            monto_cubierto,
            monto_pagar,
            req.params.id,
          ],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            // Notificar a admins
            var estadoLabel =
              newCoberturaEstado === "rechazada" ? "rechazada" : "autorizada";
            db.all(
              "SELECT id FROM usuarios_admin WHERE activo=1 AND rol != 'medico'",
              [],
              function (err2, admins) {
                if (err2 || !admins) return;
                var stmt = db.prepare(
                  "INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, cita_id, paciente_nombre, servicio) VALUES (?,?,?,?,?,?,?)",
                );
                admins.forEach(function (a) {
                  stmt.run(
                    a.id,
                    "Cobertura " + estadoLabel,
                    "Cobertura " +
                      estadoLabel +
                      " para " +
                      factura.paciente_nombre +
                      " — " +
                      (factura.servicio_nombre || ""),
                    "cobertura_" + estadoLabel,
                    factura.cita_id,
                    factura.paciente_nombre,
                    factura.servicio_nombre,
                  );
                });
                stmt.finalize();
              },
            );
            res.json({
              mensaje: "Cobertura validada correctamente",
              monto_cubierto,
              monto_pagar,
            });
          },
        );
      },
    );
  },
);

// ── PAYMENTS ──

app.get("/api/admin/pagos", authMiddleware, (req, res) => {
  let query = `SELECT p.*, f.numero_factura, f.paciente_nombre, f.cedula
    FROM pagos p JOIN facturas f ON p.factura_id=f.id WHERE 1=1`;
  const params = [];
  const { metodo, desde, hasta } = req.query;
  if (metodo) {
    query += " AND p.metodo=?";
    params.push(metodo);
  }
  if (desde) {
    query += " AND p.fecha_pago>=?";
    params.push(desde);
  }
  if (hasta) {
    query += " AND p.fecha_pago<=?";
    params.push(hasta);
  }
  query += " ORDER BY p.created_at DESC";
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get("/api/admin/facturas/:id/pagos", authMiddleware, (req, res) => {
  db.all(
    "SELECT * FROM pagos WHERE factura_id=? ORDER BY created_at DESC",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    },
  );
});

app.get("/api/admin/facturas/:id/pdf", (req, res) => {
  // Allow token via query param for direct download links
  const queryToken = req.query.token;
  if (!queryToken) {
    // If no query token, require normal auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autorizado" });
    }
    const headerToken = authHeader.split(" ")[1];
    try {
      const decoded = require("jsonwebtoken").verify(headerToken, SECRET);
      req.admin = decoded;
    } catch (e) {
      return res.status(401).json({ error: "Token inválido" });
    }
  } else {
    try {
      const decoded = require("jsonwebtoken").verify(queryToken, SECRET);
      req.admin = decoded;
    } catch (e) {
      return res.status(401).json({ error: "Token inválido" });
    }
  }
  db.get(
    `SELECT f.*, c.codigo_cita, c.fecha as cita_fecha, c.hora as cita_hora, c.nombre_paciente,
    c.telefono, c.direccion, c.ciudad, c.modalidad, s.nombre as servicio_nombre, s.precio
    FROM facturas f LEFT JOIN citas c ON f.cita_id=c.id LEFT JOIN servicios s ON f.servicio_id=s.id WHERE f.id=?`,
    [req.params.id],
    (err, factura) => {
      if (err || !factura)
        return res.status(404).json({ error: "Factura no encontrada" });

      try {
        const PDFDocument = require("pdfkit");
        const doc = new PDFDocument({ margin: 50, size: "LETTER" });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="factura-${factura.numero_factura}.pdf"`,
        );
        doc.pipe(res);

        const coberturaLabels = {
          autorizada: "Autorizada",
          rechazada: "Rechazada",
          no_aplica: "No aplica",
          pendiente_de_validacion: "Pendiente",
        };
        const estadoLabels = {
          pendiente_de_validacion: "Pendiente Validación",
          pendiente_de_pago: "Pendiente de Pago",
          pagada: "Pagada",
          anulada: "Anulada",
          pendiente: "Pendiente",
        };

        const top = 50;
        // Header
        doc
          .fontSize(22)
          .font("Helvetica-Bold")
          .fillColor("#2563eb")
          .text("MediHomeRD", top, top, { align: "center" });
        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor("#64748b")
          .text("Plataforma de Salud Digital", { align: "center" });
        doc.moveDown(0.5);

        // Title
        doc
          .fontSize(16)
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("FACTURA DE SERVICIO MÉDICO", { align: "center" });
        doc.moveDown(0.3);

        // Separator
        doc
          .moveTo(50, doc.y)
          .lineTo(565, doc.y)
          .strokeColor("#e2e8f0")
          .stroke();
        doc.moveDown(0.5);

        const leftX = 50;
        const rightX = 350;
        const colY = doc.y;

        // Left column - patient info
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("DATOS DEL PACIENTE", leftX, colY);
        let ly = doc.y + 4;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Paciente: `, leftX, ly, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(factura.nombre_paciente || factura.paciente_nombre);
        ly = doc.y + 2;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Cédula: `, leftX, ly, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(factura.cedula || "—");
        ly = doc.y + 2;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Dirección: `, leftX, ly, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(
            (factura.direccion || "") +
              (factura.ciudad ? ", " + factura.ciudad : ""),
          );
        ly = doc.y + 2;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Teléfono: `, leftX, ly, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(factura.telefono || "—");

        // Right column - invoice info
        const invoiceY = colY;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`N. Factura: `, rightX, invoiceY, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#2563eb")
          .text(factura.numero_factura);
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Código Cita: `, rightX, doc.y + 2, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(factura.codigo_cita || "—");
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Fecha Emisión: `, rightX, doc.y + 2, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(
            factura.created_at
              ? new Date(factura.created_at + "Z").toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "—",
          );
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc
          .text(`Estado: `, rightX, doc.y + 2, { continued: true })
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text(estadoLabels[factura.estado] || factura.estado);

        doc.moveDown(1.5);
        const tableTop = doc.y;

        // Table header
        doc.rect(50, tableTop, 515, 20).fill("#f8fafc");
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a");
        doc.text("Servicio", 60, tableTop + 5, { width: 200 });
        doc.text("Precio Base", 270, tableTop + 5, {
          width: 90,
          align: "center",
        });
        doc.text("Cobertura ARS", 360, tableTop + 5, {
          width: 90,
          align: "center",
        });
        doc.text("Total Pagar", 460, tableTop + 5, {
          width: 90,
          align: "center",
        });

        // Table row
        const rowY = tableTop + 22;
        doc.fontSize(9).font("Helvetica").fillColor("#0f172a");
        doc.text(factura.servicio_nombre || "—", 60, rowY, { width: 200 });
        doc.text(
          `RD$ ${Number(factura.precio_base || 0).toLocaleString()}`,
          270,
          rowY,
          { width: 90, align: "center" },
        );
        doc.text(
          `RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}`,
          360,
          rowY,
          { width: 90, align: "center" },
        );
        doc
          .font("Helvetica-Bold")
          .fillColor("#2563eb")
          .text(
            `RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}`,
            460,
            rowY,
            { width: 90, align: "center" },
          );

        // Separator
        const sepY = rowY + 22;
        doc.moveTo(50, sepY).lineTo(565, sepY).strokeColor("#e2e8f0").stroke();

        // Summary
        const sumY = sepY + 10;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc.text("Precio Base:", 380, sumY);
        doc.text(
          `RD$ ${Number(factura.precio_base || 0).toLocaleString()}`,
          470,
          sumY,
          { align: "right" },
        );
        doc.text(
          `Cobertura ARS (${coberturaLabels[factura.cobertura_estado] || factura.cobertura_estado}):`,
          380,
          doc.y + 2,
        );
        doc
          .font("Helvetica")
          .fillColor("#059669")
          .text(
            `RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}`,
            470,
            doc.y - 12,
            { align: "right" },
          );
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a");
        doc.text("TOTAL A PAGAR:", 350, doc.y + 6);
        doc
          .font("Helvetica-Bold")
          .fillColor("#2563eb")
          .text(
            `RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}`,
            470,
            doc.y - 14,
            { align: "right" },
          );

        // ARS info
        doc.moveDown(1);
        const arsY = doc.y + 6;
        doc.fontSize(9).font("Helvetica").fillColor("#475569");
        doc.text(`ARS: ${factura.ars_nombre || "—"}`, 50, arsY);
        if (factura.numero_autorizacion)
          doc.text(
            `Autorización: ${factura.numero_autorizacion}`,
            50,
            doc.y + 2,
          );
        if (factura.observacion_ars)
          doc.text(`Observación: ${factura.observacion_ars}`, 50, doc.y + 2);

        // Footer
        const footerY = doc.y + 30;
        doc.moveTo(50, footerY).strokeColor("#e2e8f0").stroke();
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#94a3b8")
          .text("MediHomeRD — Plataforma de Salud Digital", 50, footerY + 6, {
            align: "center",
          });

        doc.end();
      } catch (err) {
        console.error("[pdf] Error:", err.message);
        res.status(500).json({ error: "Error al generar PDF: " + err.message });
      }
    },
  );
});

// ── SEND INVOICE EMAIL ──

app.put("/api/admin/facturas/:id/enviar-email", authMiddleware, (req, res) => {
  db.get(
    `SELECT f.*, c.correo, c.nombre_paciente FROM facturas f
    LEFT JOIN citas c ON f.cita_id=c.id WHERE f.id=?`,
    [req.params.id],
    (err, factura) => {
      if (err || !factura)
        return res.status(404).json({ error: "Factura no encontrada" });

      if (
        factura.cobertura_estado === "pendiente_de_validacion" &&
        factura.ars_nombre !== "No tengo seguro"
      ) {
        return res.status(400).json({
          error: "Debe validar la cobertura antes de enviar la factura",
        });
      }

      const emailDestino = factura.correo || factura.email_destino;
      if (!emailDestino)
        return res.status(400).json({
          error: "El paciente no tiene correo electrónico registrado",
        });

      const coberturaLabels = {
        autorizada: "Autorizada",
        rechazada: "Rechazada",
        no_aplica: "No aplica",
        pendiente_de_validacion: "Pendiente de validación",
      };
      const estadoLabels = {
        pendiente_de_validacion: "Pendiente de validación",
        pendiente_de_pago: "Pendiente de pago",
        pagada: "Pagada",
        anulada: "Anulada",
        pendiente: "Pendiente",
      };

      const html = `
<div style="font-family:Inter, system-ui, sans-serif; max-width:560px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 8px 30px rgba(0,0,0,0.04)">
  <div style="background:linear-gradient(135deg,#2563eb,#0ea5e5); padding:28px 32px; text-align:center">
    <h1 style="color:#fff; font-size:1.3rem; margin:0; font-weight:700">Factura de Servicio Médico</h1>
    <p style="color:rgba(255,255,255,0.85); font-size:0.85rem; margin:6px 0 0">MediHomeRD &mdash; Plataforma de Salud Digital</p>
  </div>
  <div style="padding:28px 32px">
    <p style="color:#0f172a; font-size:0.95rem; margin:0 0 20px">Estimado(a) <strong>${escHtml(factura.nombre_paciente || factura.paciente_nombre)}</strong>, se ha generado su factura de servicio médico.</p>
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px">
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600; width:140px">N. Factura</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#2563eb; font-weight:700">${escHtml(factura.numero_factura)}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Servicio</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${escHtml(factura.servicio_nombre)}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Precio Base</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">RD$ ${Number(factura.precio_base || 0).toLocaleString()}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">ARS</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${escHtml(factura.ars_nombre || "—")}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Cobertura ARS</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#059669">RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Estado Cobertura</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${coberturaLabels[factura.cobertura_estado] || factura.cobertura_estado}</td></tr>
      <tr style="font-weight:700"><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.9rem; background:#f8fafc; color:#0f172a">Total a Pagar</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.9rem; color:#2563eb">RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Estado</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${estadoLabels[factura.estado] || factura.estado}</td></tr>
      <tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Fecha Emisión</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${factura.created_at ? new Date(factura.created_at + "Z").toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }) : "—"}</td></tr>
    </table>
  </div>
  <div style="background:#f8fafc; padding:20px 32px; text-align:center; border-top:1px solid #e2e8f0">
    <p style="font-size:0.72rem; color:#94a3b8; margin:0">MediHomeRD &mdash; Plataforma de Salud Digital<br>© 2026 MediHomeRD. Todos los derechos reservados.</p>
  </div>
</div>`;

      const text =
        `FACTURA DE SERVICIO MÉDICO - MediHomeRD\n\n` +
        `Estimado(a) ${factura.nombre_paciente || factura.paciente_nombre},\n\n` +
        `Se ha generado su factura de servicio médico.\n\n` +
        `N. Factura: ${factura.numero_factura}\n` +
        `Servicio: ${factura.servicio_nombre}\n` +
        `Precio Base: RD$ ${Number(factura.precio_base || 0).toLocaleString()}\n` +
        `ARS: ${factura.ars_nombre || "—"}\n` +
        `Cobertura ARS: RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}\n` +
        `Estado Cobertura: ${coberturaLabels[factura.cobertura_estado] || factura.cobertura_estado}\n` +
        `Total a Pagar: RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}\n` +
        `Estado: ${estadoLabels[factura.estado] || factura.estado}\n` +
        `Fecha Emisión: ${factura.created_at ? new Date(factura.created_at + "Z").toLocaleDateString("es-ES") : "—"}\n\n` +
        `MediHomeRD - Plataforma de Salud Digital`;

      const { sendEmail } = require("../utils/mailer");
      sendEmail({
        to: emailDestino,
        subject: "Factura de servicio médico - Medi Home RD",
        html,
        text,
      }).then((result) => {
        if (!result.sent)
          return res.status(500).json({
            error:
              "Error al enviar el correo: " + (result.reason || "desconocido"),
          });
        db.run(
          "UPDATE facturas SET factura_enviada_email=1, fecha_envio_email=CURRENT_TIMESTAMP, email_destino=? WHERE id=?",
          [emailDestino, req.params.id],
          function (err2) {
            if (err2)
              console.error(
                "[email] Error al actualizar factura:",
                err2.message,
              );
            res.json({
              success: true,
              mensaje:
                "Factura enviada correctamente al correo " + emailDestino,
            });
          },
        );
      });
    },
  );
});

// ── ENVIAR FACTURA POR CORREO (POST) ──

app.post("/api/facturas/:id/enviar-correo", authMiddleware, (req, res) => {
  db.get(
    `SELECT f.*, c.correo, c.nombre_paciente FROM facturas f
    LEFT JOIN citas c ON f.cita_id=c.id WHERE f.id=?`,
    [req.params.id],
    (err, factura) => {
      if (err || !factura)
        return res.status(404).json({ success: false, error: "Factura no encontrada" });

      if (factura.cobertura_estado === "pendiente_de_validacion" && factura.ars_nombre !== "No tengo seguro") {
        return res.status(400).json({
          success: false,
          error: "Debe validar la cobertura antes de enviar la factura",
        });
      }

      const emailDestino = factura.correo || factura.email_destino;
      if (!emailDestino)
        return res.status(400).json({
          success: false,
          error: "El paciente no tiene correo electrónico registrado",
        });

      const coberturaLabels = { autorizada: "Autorizada", rechazada: "Rechazada", no_aplica: "No aplica", pendiente_de_validacion: "Pendiente de validación" };
      const estadoLabels = { pendiente_de_validacion: "Pendiente de validación", pendiente_de_pago: "Pendiente de pago", pagada: "Pagada", anulada: "Anulada", pendiente: "Pendiente" };

      const html = `<div style="font-family:Inter, system-ui, sans-serif; max-width:560px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 8px 30px rgba(0,0,0,0.04)">
<div style="background:linear-gradient(135deg,#2563eb,#0ea5e5); padding:28px 32px; text-align:center"><h1 style="color:#fff; font-size:1.3rem; margin:0; font-weight:700">Factura de Servicio M\u00e9dico</h1><p style="color:rgba(255,255,255,0.85); font-size:0.85rem; margin:6px 0 0">MediHomeRD &mdash; Plataforma de Salud Digital</p></div>
<div style="padding:28px 32px"><p style="color:#0f172a; font-size:0.95rem; margin:0 0 20px">Estimado(a) <strong>${escHtml(factura.nombre_paciente || factura.paciente_nombre)}</strong>, se ha generado su factura de servicio m\u00e9dico.</p>
<table style="width:100%; border-collapse:collapse; margin-bottom:20px">
<tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600; width:140px">N. Factura</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#2563eb; font-weight:700">${escHtml(factura.numero_factura)}</td></tr>
<tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Servicio</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${escHtml(factura.servicio_nombre)}</td></tr>
<tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Precio Base</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">RD$ ${Number(factura.precio_base || 0).toLocaleString()}</td></tr>
<tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">ARS</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${escHtml(factura.ars_nombre || "\u2014")}</td></tr>
<tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Cobertura ARS</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#059669">RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}</td></tr>
<tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Estado Cobertura</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${coberturaLabels[factura.cobertura_estado] || factura.cobertura_estado}</td></tr>
<tr style="font-weight:700"><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.9rem; background:#f8fafc; color:#0f172a">Total a Pagar</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.9rem; color:#2563eb">RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}</td></tr>
<tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Estado</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${estadoLabels[factura.estado] || factura.estado}</td></tr>
<tr><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b; background:#f8fafc; font-weight:600">Fecha Emisi\u00f3n</td><td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:0.85rem; color:#0f172a">${factura.created_at ? new Date(factura.created_at + "Z").toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }) : "\u2014"}</td></tr>
</table></div>
<div style="background:#f8fafc; padding:20px 32px; text-align:center; border-top:1px solid #e2e8f0"><p style="font-size:0.72rem; color:#94a3b8; margin:0">MediHomeRD &mdash; Plataforma de Salud Digital<br>\u00a9 2026 MediHomeRD. Todos los derechos reservados.</p></div></div>`;

      const text = `FACTURA DE SERVICIO M\u00c9DICO - MediHomeRD\n\nEstimado(a) ${factura.nombre_paciente || factura.paciente_nombre},\n\nSe ha generado su factura de servicio m\u00e9dico.\n\nN. Factura: ${factura.numero_factura}\nServicio: ${factura.servicio_nombre}\nPrecio Base: RD$ ${Number(factura.precio_base || 0).toLocaleString()}\nARS: ${factura.ars_nombre || "\u2014"}\nCobertura ARS: RD$ ${Number(factura.monto_cubierto || 0).toLocaleString()}\nEstado Cobertura: ${coberturaLabels[factura.cobertura_estado] || factura.cobertura_estado}\nTotal a Pagar: RD$ ${Number(factura.monto_pagar || 0).toLocaleString()}\nEstado: ${estadoLabels[factura.estado] || factura.estado}\nFecha Emisi\u00f3n: ${factura.created_at ? new Date(factura.created_at + "Z").toLocaleDateString("es-ES") : "\u2014"}\n\nMediHomeRD - Plataforma de Salud Digital`;

      const { sendEmail } = require("../utils/mailer");
      sendEmail({ to: emailDestino, subject: "Factura de servicio m\u00e9dico - Medi Home RD", html, text })
        .then((result) => {
          if (!result.sent)
            return res.status(500).json({ success: false, error: "Error al enviar el correo: " + (result.reason || "desconocido") });
          db.run("UPDATE facturas SET factura_enviada_email=1, fecha_envio_email=CURRENT_TIMESTAMP, email_destino=? WHERE id=?",
            [emailDestino, req.params.id],
            function (err2) {
              if (err2) console.error("[email] Error al actualizar factura:", err2.message);
              res.json({ success: true, mensaje: "Factura enviada correctamente al correo " + emailDestino });
            });
        });
    },
  );
});
};
