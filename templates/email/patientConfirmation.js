function buildPatientHtml(data) {
  const p = (v, fb) =>
    v && v !== "undefined" && v !== "null" ? v : fb || "---";
  const year = new Date().getFullYear();

  const modalidadLabel =
    {
      domicilio: "A domicilio",
      telemedicina: "Telemedicina",
      consulta: "En consultorio",
    }[data.modalidad] || p(data.modalidad);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Confirmacion de cita - MediHomeRD</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0">
    <tr>
      <td align="center" style="padding:0 12px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">

          <tr>
            <td style="background:#0F172A;background:linear-gradient(135deg, #0F172A 0%, #0EA5E9 100%);padding:32px 30px 24px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:34px;font-weight:800;line-height:1.1;letter-spacing:-0.8px"><span style="color:#ffffff;font-weight:700">Medi</span><span style="color:#94A3B8;font-weight:300">Home</span><span style="color:#ffffff;font-weight:700"> RD</span></td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#cbd5e1;padding-top:2px;font-weight:400;letter-spacing:0.3px">Plataforma de Salud Digital</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="height:4px;padding:0;font-size:0;line-height:0;background:linear-gradient(90deg, #0EA5E9, #06B6D4)"></td>
          </tr>

          <tr>
            <td style="padding:8px 30px 0;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.3px">Solicitud recibida</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#64748b;padding-top:4px">Hemos recibido su solicitud de cita correctamente.</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 30px 0;text-align:center">
              <span style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1px">C&oacute;digo de seguimiento</span>
              <br>
              <span style="font-size:20px;font-weight:700;color:#0ea5e9;letter-spacing:1.5px;font-family:'Courier New',Courier,monospace">${p(data.codigo_cita)}</span>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 30px 24px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;margin-bottom:16px;padding:18px 20px">
                <tr>
                  <td style="font-size:12px;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:10px;border-bottom:2px solid #e2e8f0">Detalles de su cita</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 0">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="top" style="font-size:13px;color:#64748b;padding:7px 0;width:100px;white-space:nowrap;border-bottom:1px solid #f1f5f9">Paciente</td>
                        <td valign="top" style="font-size:14px;color:#0f172a;font-weight:500;padding:7px 0;border-bottom:1px solid #f1f5f9">${p(data.nombre_paciente)}</td>
                      </tr>
                      <tr>
                        <td valign="top" style="font-size:13px;color:#64748b;padding:7px 0;width:100px;white-space:nowrap;border-bottom:1px solid #f1f5f9">Servicio</td>
                        <td valign="top" style="font-size:14px;color:#0f172a;font-weight:500;padding:7px 0;border-bottom:1px solid #f1f5f9">${p(data.servicio_nombre)}</td>
                      </tr>
                      <tr>
                        <td valign="top" style="font-size:13px;color:#64748b;padding:7px 0;width:100px;white-space:nowrap;border-bottom:1px solid #f1f5f9">Fecha</td>
                        <td valign="top" style="font-size:14px;color:#0f172a;font-weight:500;padding:7px 0;border-bottom:1px solid #f1f5f9">${p(data.fecha)}</td>
                      </tr>
                      <tr>
                        <td valign="top" style="font-size:13px;color:#64748b;padding:7px 0;width:100px;white-space:nowrap;border-bottom:1px solid #f1f5f9">Hora</td>
                        <td valign="top" style="font-size:14px;color:#0f172a;font-weight:500;padding:7px 0;border-bottom:1px solid #f1f5f9">${p(data.hora)}</td>
                      </tr>
                      <tr>
                        <td valign="top" style="font-size:13px;color:#64748b;padding:7px 0;width:100px;white-space:nowrap;border-bottom:1px solid #f1f5f9">Modalidad</td>
                        <td valign="top" style="font-size:14px;color:#0f172a;font-weight:500;padding:7px 0;border-bottom:1px solid #f1f5f9">${modalidadLabel}</td>
                      </tr>
                      <tr>
                        <td valign="top" style="font-size:13px;color:#64748b;padding:7px 0;width:100px;white-space:nowrap">Direcci&oacute;n</td>
                        <td valign="top" style="font-size:14px;color:#0f172a;font-weight:500;padding:7px 0">${p(data.direccion)}${data.ciudad ? ", " + p(data.ciudad) : ""}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:10px;padding:16px 20px">
                <tr>
                  <td style="font-size:13px;color:#065f46;line-height:1.5;text-align:center">
                    <strong style="font-size:14px">¿Qu&eacute; sigue?</strong><br>
                    Nos comunicaremos con usted para confirmar la cita. Si necesita cambios, cont&aacute;ctenos al <strong>+1 (829) 901-7488</strong>.
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background-color:#0EA5E9;background-image:linear-gradient(135deg, #0EA5E9, #06B6D4)">
                          <a href="https://wa.me/18299017488?text=Hola%20Medi%20Home%20RD%2C%20mi%20c%C3%B3digo%20es%20${p(data.codigo_cita)}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">Contactar por WhatsApp</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td style="background-color:#f8fafc;padding:20px 30px;border-top:1px solid #e2e8f0;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="font-size:13px;font-weight:600;color:#0ea5e9">MediHomeRD</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#94a3b8;padding-top:2px">Plataforma de Salud Digital</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#cbd5e1;padding-top:10px;line-height:1.5">
                    &copy; ${year} MediHomeRD. Todos los derechos reservados.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPatientText(data) {
  const p = (v, fb) =>
    v && v !== "undefined" && v !== "null" ? v : fb || "---";
  const modalidadLabel =
    {
      domicilio: "A domicilio",
      telemedicina: "Telemedicina",
      consulta: "En consultorio",
    }[data.modalidad] || p(data.modalidad);

  return [
    "========================================",
    "  MEDI HOME RD - Solicitud recibida",
    "========================================",
    "",
    `C\u00f3digo: ${p(data.codigo_cita)}`,
    "",
    "--- DETALLES DE SU CITA ---",
    `Paciente:     ${p(data.nombre_paciente)}`,
    `Servicio:     ${p(data.servicio_nombre)}`,
    `Fecha:        ${p(data.fecha)}`,
    `Hora:         ${p(data.hora)}`,
    `Modalidad:    ${modalidadLabel}`,
    `Direcci\u00f3n:    ${p(data.direccion)}${data.ciudad ? ", " + p(data.ciudad) : ""}`,
    "",
    "---",
    "Nos comunicaremos con usted para confirmar la cita.",
    "WhatsApp: https://wa.me/18299017488",
    "",
    "Este correo fue generado autom\u00e1ticamente por MediHomeRD.",
    "",
  ].join("\n");
}

module.exports = { buildPatientHtml, buildPatientText };
