function buildHtml(data) {
  const p = (v, fallback = '—') => (v && v !== 'undefined' ? v : fallback);
  const now = new Date();
  const year = now.getFullYear();
  const modalidadLabel =
    { domicilio: 'A domicilio', telemedicina: 'Telemedicina', consulta: 'En consultorio' }[
      data.modalidad
    ] || p(data.modalidad);

  const estadoColors = {
    pendiente: { bg: '#fef3c7', text: '#92400e' },
    confirmada: { bg: '#d1fae5', text: '#065f46' },
    en_proceso: { bg: '#dbeafe', text: '#1e40af' },
    completada: { bg: '#d1fae5', text: '#065f46' },
    cancelada: { bg: '#fee2e2', text: '#991b1b' },
  };
  const ec = estadoColors[data.estado] || estadoColors.pendiente;

  const fields = [
    { icon: '👤', label: 'Paciente', value: `${p(data.nombre_paciente)}` },
    { icon: '📞', label: 'Teléfono', value: `${p(data.telefono)}` },
    { icon: '✉️', label: 'Correo', value: `${p(data.correo)}` },
    { icon: '📍', label: 'Dirección', value: `${p(data.direccion)}${data.ciudad ? ', ' + p(data.ciudad) : ''}` },
  ];

  const details = [
    { icon: '🩺', label: 'Servicio', value: `${p(data.servicio_nombre)}` },
    { icon: '👨‍⚕️', label: 'Doctor', value: `${p(data.medico_nombre)}` },
    { icon: '📅', label: 'Fecha', value: `${p(data.fecha)}` },
    { icon: '⏰', label: 'Hora', value: `${p(data.hora)}` },
    { icon: '🚗', label: 'Modalidad', value: `${modalidadLabel}` },
  ];

  function row(icon, label, value) {
    return `<tr>
      <td valign="top" style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;width:90px;white-space:nowrap">${icon} ${label}</td>
      <td valign="top" style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:500">${value}</td>
    </tr>`;
  }

  const fieldsRows = fields.map(f => row(f.icon, f.label, f.value)).join('');
  const detailsRows = details.map(f => row(f.icon, f.label, f.value)).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Nueva cita - MediHome</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:20px 0">
    <tr>
      <td align="center" style="padding:0 10px">
        <!-- MAIN CONTAINER -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.06)">

          <!-- ===== HERO / HEADER ===== -->
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9 0%,#06b6d4 50%,#14b8a6 100%);padding:0">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:40px 30px 24px">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">MediHome</td>
                      </tr>
                      <tr>
                        <td align="center" style="font-size:13px;color:rgba(255,255,255,0.8);padding-top:4px;font-weight:400;letter-spacing:0.3px">SERVICIOS MÉDICOS A DOMICILIO &amp; TELEMEDICINA</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- ECG WAVE DIVIDER -->
                <tr>
                  <td style="padding:0 30px 20px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:0;height:48px;vertical-align:middle">
                          <svg width="540" height="48" viewBox="0 0 540 48" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;max-width:540px;margin:0 auto" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                              <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
                                <stop offset="15%" stop-color="rgba(255,255,255,0.15)"/>
                                <stop offset="35%" stop-color="rgba(255,255,255,0.9)"/>
                                <stop offset="38%" stop-color="#ffffff"/>
                                <stop offset="41%" stop-color="rgba(255,255,255,0.9)"/>
                                <stop offset="60%" stop-color="rgba(255,255,255,0.15)"/>
                                <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
                              </linearGradient>
                            </defs>
                            <!-- base line -->
                            <line x1="0" y1="36" x2="540" y2="36" stroke="url(#ecgGrad)" stroke-width="2" stroke-linecap="round"/>
                            <!-- pulse spike -->
                            <polyline points="120,36 140,36 148,36 154,10 160,36 168,36 180,36" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <!-- small spikes suggesting heartbeat rhythm -->
                            <polyline points="210,36 220,36 224,28 228,36 235,36 240,32 245,36 255,36" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <polyline points="320,36 330,36 334,28 338,36 345,36 350,32 355,36 365,36" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <!-- heart icon -->
                            <text x="440" y="36" font-size="26" text-anchor="middle" dominant-baseline="central" fill="#ffffff" opacity="0.9">&#9829;</text>
                          </svg>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- HERO TEXT -->
                <tr>
                  <td align="center" style="padding:0 30px 36px">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">Nueva cita agendada</td>
                      </tr>
                      <tr>
                        <td align="center" style="font-size:14px;color:rgba(255,255,255,0.85);padding-top:6px;font-weight:400">
                          Se ha registrado una nueva solicitud de atenci&oacute;n en la plataforma.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== BADGE: CODIGO UNICO ===== -->
          <tr>
            <td style="padding:0 30px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#eff6ff,#ecfeff);border-radius:14px;padding:18px 24px;margin-top:-18px;border:1px solid rgba(14,165,233,0.1)">
                <tr>
                  <td align="center">
                    <span style="font-size:12px;color:#0ea5e9;font-weight:600;text-transform:uppercase;letter-spacing:1px">C&oacute;digo de seguimiento</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:6px">
                    <span style="font-size:26px;font-weight:800;color:#0ea5e9;letter-spacing:2px;font-family:'Courier New',Courier,monospace">${p(data.codigo_cita)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== CONTENT BODY ===== -->
          <tr>
            <td style="padding:28px 30px 20px">

              <!-- CARD: DATOS DEL PACIENTE -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:14px;border:1px solid #eef2f6;box-shadow:0 2px 12px rgba(0,0,0,0.04);margin-bottom:16px;overflow:hidden">
                <tr>
                  <td style="background:linear-gradient(90deg,#0ea5e9,#06b6d4);padding:10px 20px">
                    <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.8px">Datos del paciente</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 20px 12px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${fieldsRows}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CARD: DETALLES DE LA CITA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:14px;border:1px solid #eef2f6;box-shadow:0 2px 12px rgba(0,0,0,0.04);margin-bottom:16px;overflow:hidden">
                <tr>
                  <td style="background:linear-gradient(90deg,#14b8a6,#0ea5e9);padding:10px 20px">
                    <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.8px">Detalles de la cita</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 20px 12px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${detailsRows}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CARD: COMENTARIO -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:14px;border:1px solid #eef2f6;box-shadow:0 2px 12px rgba(0,0,0,0.04);margin-bottom:16px;overflow:hidden">
                <tr>
                  <td style="background:linear-gradient(90deg,#f59e0b,#fbbf24);padding:10px 20px">
                    <span style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.8px">Motivo / Comentario</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;color:#334155;line-height:1.6;font-style:italic">${p(data.comentario, 'Sin comentario adicional')}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- INFO ROW: ESTADO + FECHA REGISTRO -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
                <tr>
                  <td width="50%" valign="top" style="padding-right:8px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:14px;border:1px solid #eef2f6;box-shadow:0 2px 12px rgba(0,0,0,0.04);padding:14px 16px">
                      <tr>
                        <td align="center">
                          <span style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Estado</span>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-top:6px">
                          <span style="display:inline-block;background:${ec.bg};color:${ec.text};font-size:13px;font-weight:700;padding:4px 16px;border-radius:20px;text-transform:capitalize">${p(data.estado)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" valign="top" style="padding-left:8px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:14px;border:1px solid #eef2f6;box-shadow:0 2px 12px rgba(0,0,0,0.04);padding:14px 16px">
                      <tr>
                        <td align="center">
                          <span style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Registrada</span>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-top:6px">
                          <span style="font-size:13px;color:#0f172a;font-weight:600">${p(data.created_at)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA BUTTON -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 4px">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);box-shadow:0 4px 16px rgba(14,165,233,0.25)">
                          <a href="${p(data.admin_url)}" target="_blank" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;white-space:nowrap">Ver cita en el panel &rarr;</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ===== FOOTER ===== -->
          <tr>
            <td style="background-color:#f8fafc;padding:24px 30px;border-top:1px solid #eef2f6">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-size:14px;font-weight:700;color:#0ea5e9;letter-spacing:-0.3px">MediHome</td>
                </tr>
                <tr>
                  <td align="center" style="font-size:11px;color:#94a3b8;padding-top:2px;font-weight:500">Sistema de Gesti&oacute;n M&eacute;dica</td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:12px">
                    <span style="font-size:11px;color:#cbd5e1;line-height:1.6">
                      Este correo fue generado autom&aacute;ticamente por MediHome.<br>
                      &copy; ${year} MediHome &mdash; Todos los derechos reservados.
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- END MAIN CONTAINER -->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText(data) {
  const p = (v, fallback = '—') => (v && v !== 'undefined' ? v : fallback);
  return [
    '========================================',
    '  MEDIHOME - Nueva cita agendada',
    '========================================',
    '',
    `Código: ${p(data.codigo_cita)}`,
    '',
    '--- DATOS DEL PACIENTE ---',
    `Nombre:     ${p(data.nombre_paciente)}`,
    `Teléfono:   ${p(data.telefono)}`,
    `Correo:     ${p(data.correo)}`,
    `Dirección:  ${p(data.direccion)}${data.ciudad ? ', ' + p(data.ciudad) : ''}`,
    '',
    '--- DETALLES DE LA CITA ---',
    `Servicio:   ${p(data.servicio_nombre)}`,
    `Doctor:     ${p(data.medico_nombre)}`,
    `Fecha:      ${p(data.fecha)}`,
    `Hora:       ${p(data.hora)}`,
    `Modalidad:  ${p(data.modalidad)}`,
    '',
    '--- INFORMACIÓN DEL REGISTRO ---',
    `Estado:     ${p(data.estado)}`,
    `Registrada: ${p(data.created_at)}`,
    '',
    `Comentario: ${p(data.comentario, 'Sin comentario')}`,
    '',
    '---',
    `Panel admin: ${p(data.admin_url)}`,
    '',
    'Este correo fue generado automáticamente por MediHome.',
    '',
  ].join('\n');
}

module.exports = { buildHtml, buildText };
