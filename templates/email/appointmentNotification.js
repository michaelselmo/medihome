function svgToUri(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function buildHtml(data) {
  const p = (v, fallback = '—') => (v && v !== 'undefined' ? v : fallback);
  const year = new Date().getFullYear();

  const modalidadLabel =
    { domicilio: 'A domicilio', telemedicina: 'Telemedicina', consulta: 'En consultorio' }[
      data.modalidad
    ] || p(data.modalidad);

  const estadoColors = {
    pendiente: { bg: '#ecfdf5', text: '#059669', badge: '#d1fae5' },
    confirmada: { bg: '#ecfdf5', text: '#059669', badge: '#d1fae5' },
    en_proceso: { bg: '#eff6ff', text: '#2563eb', badge: '#dbeafe' },
    completada: { bg: '#ecfdf5', text: '#059669', badge: '#d1fae5' },
    cancelada: { bg: '#fef2f2', text: '#dc2626', badge: '#fee2e2' },
  };
  const ec = estadoColors[data.estado] || estadoColors.pendiente;

  // ----- SVG data URIs for Gmail-safe icons -----
  const uris = {
    heart: svgToUri(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#14b8a6"/></linearGradient></defs>
        <rect width="100" height="100" rx="24" fill="rgba(14,165,233,0.1)" stroke="rgba(14,165,233,0.15)" stroke-width="1"/>
        <path d="M50 70 C28 56 18 44 18 35 C18 28 23 23 30 23 C35 23 40 26 43 30 L50 38 L57 30 C60 26 65 23 70 23 C77 23 82 28 82 35 C82 44 72 56 50 70Z" fill="url(#g)"/>
        <polyline points="26,42 33,42 35,42 37,34 39,42 43,42 46,42 48,46 50,42 53,42 56,42 58,34 60,42 64,42" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
    ),
    user: svgToUri(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="5" r="3" fill="#fff"/><path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`
    ),
    calendar: svgToUri(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M5 1v4m6-4v4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M2 7h12" stroke="#fff" stroke-width="1"/></svg>`
    ),
    comment: svgToUri(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M14 1H2a1 1 0 00-1 1v9a1 1 0 001 1h3l3 3 3-3h3a1 1 0 001-1V2a1 1 0 00-1-1z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`
    ),
    check: svgToUri(
      `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><path d="M2 7.5l3.5 3.5L12 3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    ),
    clock: svgToUri(
      `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M7 4v4l3 1.5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`
    ),
  };

  // Helper: icon inside colored circle using background-image
  const iconCircle = (uri, size = 32) =>
    `<table cellpadding="0" cellspacing="0" style="display:inline-block"><tr><td style="width:${size}px;height:${size}px;border-radius:50%;background-image:url('${uri}');background-size:${size - 12}px;background-repeat:no-repeat;background-position:center;background-color:#0ea5e9;font-size:0;line-height:0">&zwj;</td></tr></table>`;

  const iconCircleColor = (uri, color, size = 32) =>
    `<table cellpadding="0" cellspacing="0" style="display:inline-block"><tr><td style="width:${size}px;height:${size}px;border-radius:50%;background-image:url('${uri}');background-size:${size - 12}px;background-repeat:no-repeat;background-position:center;background-color:${color};font-size:0;line-height:0">&zwj;</td></tr></table>`;

  function cardRow(label, value, i, len) {
    return `<tr>
      <td valign="top" style="font-size:13px;color:#64748b;padding:8px 0;white-space:nowrap;width:80px;${i < len - 1 ? 'border-bottom:1px solid #f1f5f9' : ''}">${label}</td>
      <td width="10" style="padding:8px 0;${i < len - 1 ? 'border-bottom:1px solid #f1f5f9' : ''}">&nbsp;</td>
      <td valign="top" style="font-size:14px;color:#0f172a;font-weight:500;padding:8px 0;${i < len - 1 ? 'border-bottom:1px solid #f1f5f9' : ''}">${value}</td>
    </tr>`;
  }

  const pacienteFields = [
    { label: 'Nombre', value: p(data.nombre_paciente) },
    { label: 'Teléfono', value: p(data.telefono) },
    { label: 'Correo', value: p(data.correo) },
    { label: 'Dirección', value: `${p(data.direccion)}${data.ciudad ? ', ' + p(data.ciudad) : ''}` },
  ];

  const citaFields = [
    { label: 'Servicio', value: p(data.servicio_nombre) },
    { label: 'Doctor', value: p(data.medico_nombre) },
    { label: 'Fecha', value: p(data.fecha) },
    { label: 'Hora', value: p(data.hora) },
    { label: 'Modalidad', value: modalidadLabel },
  ];

  const pRows = pacienteFields.map((f, i) => cardRow(f.label, f.value, i, pacienteFields.length)).join('');
  const cRows = citaFields.map((f, i) => cardRow(f.label, f.value, i, citaFields.length)).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Nueva cita - MediHome</title>
</head>
<body style="margin:0;padding:0;background-color:#eef4f9;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#0f172a">
  <!--[if mso]><table width="780" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef4f9;padding:32px 0">
    <tr>
      <td align="center" style="padding:0 16px">
        <table role="presentation" width="780" cellpadding="0" cellspacing="0" style="max-width:780px;width:100%;background-color:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.05)">

          <!-- ========== HEADER ========== -->
          <tr>
            <td style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);padding:0">
              <!-- ECG horizontal line -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="height:4px;background:repeating-linear-gradient(90deg,rgba(14,165,233,0.08) 0,rgba(14,165,233,0.08) 2px,transparent 2px,transparent 6px);font-size:0;line-height:0">&zwj;</td></tr>
                <tr><td style="height:1px;background:linear-gradient(90deg,transparent 5%,rgba(14,165,233,0.12) 15%,rgba(14,165,233,0.2) 20%,rgba(14,165,233,0.25) 22%,rgba(14,165,233,0.2) 24%,rgba(14,165,233,0.12) 30%,transparent 40%,transparent 55%,rgba(14,165,233,0.12) 65%,rgba(14,165,233,0.2) 70%,rgba(14,165,233,0.25) 72%,rgba(14,165,233,0.2) 74%,rgba(14,165,233,0.12) 80%,transparent 90%);font-size:0;line-height:0">&zwj;</td></tr>
              </table>
              <!-- Heart + MediHome row -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:20px 36px 14px">
                <tr>
                  <td width="100" valign="middle" align="left" style="padding-right:20px">
                    <table cellpadding="0" cellspacing="0">
                      <tr><td style="width:100px;height:100px;background-image:url('${uris.heart}');background-size:contain;background-repeat:no-repeat;background-position:center;font-size:0;line-height:0">&zwj;</td></tr>
                    </table>
                  </td>
                  <td valign="middle" align="left">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:28px;font-weight:800;color:#0ea5e9;letter-spacing:-0.5px">MediHome</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#64748b;padding-top:2px;font-weight:500;letter-spacing:0.5px">SERVICIOS MÉDICOS A DOMICILIO &amp; TELEMEDICINA</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ========== MAIN SECTION ========== -->
          <tr>
            <td style="padding:22px 36px 0;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td align="center" style="font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.3px">Nueva cita agendada</td>
                </tr>
                <tr>
                  <td align="center" style="font-size:14px;color:#64748b;padding-top:6px;line-height:1.5">Se ha registrado una nueva solicitud de cita en la plataforma.</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ========== CODE BADGE ========== -->
          <tr>
            <td style="padding:20px 36px 0;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border:1px solid #e2e8f0;border-radius:30px;background-color:#ffffff;padding:10px 28px">
                <tr>
                  <td align="center" style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding-bottom:3px">Código de seguimiento</td>
                </tr>
                <tr>
                  <td align="center" style="font-size:18px;font-weight:700;color:#0ea5e9;letter-spacing:2px;font-family:'Courier New',Courier,monospace;background:#eff6ff;border-radius:6px;padding:4px 16px">${p(data.codigo_cita)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ========== CARDS ========== -->
          <tr>
            <td style="padding:28px 36px 8px">

              <!-- CARD: PACIENTE -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbeafe;border-radius:16px;background-color:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.03);margin-bottom:18px;overflow:hidden">
                <tr>
                  <td style="padding:18px 22px 14px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="middle" width="36">${iconCircle(uris.user)}</td>
                        <td valign="middle" style="padding-left:10px;font-size:13px;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:0.5px">Información del paciente</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 16px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${pRows}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CARD: DETALLES -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbeafe;border-radius:16px;background-color:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.03);margin-bottom:18px;overflow:hidden">
                <tr>
                  <td style="padding:18px 22px 14px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="middle" width="36">${iconCircle(uris.calendar)}</td>
                        <td valign="middle" style="padding-left:10px;font-size:13px;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:0.5px">Detalles de la cita</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 16px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${cRows}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CARD: COMENTARIO -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fde68a;border-radius:16px;background-color:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.03);margin-bottom:18px;overflow:hidden">
                <tr>
                  <td style="padding:18px 22px 14px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="middle" width="36">${iconCircleColor(uris.comment, '#d97706')}</td>
                        <td valign="middle" style="padding-left:10px;font-size:13px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.5px">Motivo / Comentario</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;color:#475569;line-height:1.6;font-style:italic;padding:4px 0 0">${p(data.comentario, 'Sin comentario adicional')}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ROW: ESTADO + REGISTRADA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px">
                <tr>
                  <td width="50%" valign="top" style="padding-right:9px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d1fae5;border-radius:14px;background-color:#ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.02);margin-bottom:14px;overflow:hidden">
                      <tr>
                        <td style="padding:14px 18px">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td valign="middle" width="28">${iconCircleColor(uris.check, ec.text, 28)}</td>
                              <td valign="middle" style="padding-left:10px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Estado</td>
                            </tr>
                            <tr>
                              <td colspan="2" style="padding-top:8px;text-align:center">
                                <span style="display:inline-block;background:${ec.badge};color:${ec.text};font-size:13px;font-weight:700;padding:4px 18px;border-radius:20px;text-transform:capitalize">${p(data.estado)}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" valign="top" style="padding-left:9px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbeafe;border-radius:14px;background-color:#ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.02);margin-bottom:14px;overflow:hidden">
                      <tr>
                        <td style="padding:14px 18px">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td valign="middle" width="28">${iconCircle(uris.clock, 28)}</td>
                              <td valign="middle" style="padding-left:10px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Registrada</td>
                            </tr>
                            <tr>
                              <td colspan="2" style="padding-top:8px;text-align:center">
                                <span style="font-size:13px;color:#0f172a;font-weight:600">${p(data.created_at)}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ========== CTA BUTTON ========== -->
          <tr>
            <td style="padding:8px 36px 28px;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);box-shadow:0 4px 14px rgba(14,165,233,0.2)">
                    <a href="${p(data.admin_url)}" target="_blank" style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">Ver cita en el panel &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ========== FOOTER ========== -->
          <tr>
            <td style="background-color:#f8fafc;padding:24px 36px;border-top:1px solid #e2e8f0;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="font-size:14px;font-weight:700;color:#0ea5e9">MediHome</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#94a3b8;padding-top:2px;font-weight:500">Sistema de Gestión Médica</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#cbd5e1;padding-top:10px;line-height:1.6">
                    Este correo fue generado automáticamente por MediHome.<br>
                    &copy; ${year} MediHome. Todos los derechos reservados.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}

function buildText(data) {
  const p = (v, fallback = '—') => (v && v !== 'undefined' ? v : fallback);
  const modalidadLabel =
    { domicilio: 'A domicilio', telemedicina: 'Telemedicina', consulta: 'En consultorio' }[
      data.modalidad
    ] || p(data.modalidad);

  return [
    '========================================',
    '  MEDIHOME - Nueva cita agendada',
    '========================================',
    '',
    `Código: ${p(data.codigo_cita)}`,
    '',
    '--- INFORMACIÓN DEL PACIENTE ---',
    `Nombre:       ${p(data.nombre_paciente)}`,
    `Teléfono:     ${p(data.telefono)}`,
    `Correo:       ${p(data.correo)}`,
    `Dirección:    ${p(data.direccion)}${data.ciudad ? ', ' + p(data.ciudad) : ''}`,
    '',
    '--- DETALLES DE LA CITA ---',
    `Servicio:     ${p(data.servicio_nombre)}`,
    `Doctor:       ${p(data.medico_nombre)}`,
    `Fecha:        ${p(data.fecha)}`,
    `Hora:         ${p(data.hora)}`,
    `Modalidad:    ${modalidadLabel}`,
    '',
    '--- INFORMACIÓN DEL REGISTRO ---',
    `Estado:       ${p(data.estado)}`,
    `Registrada:   ${p(data.created_at)}`,
    '',
    `Comentario:   ${p(data.comentario, 'Sin comentario')}`,
    '',
    '---',
    `Panel admin: ${p(data.admin_url)}`,
    '',
    'Este correo fue generado automáticamente por MediHome.',
    '',
  ].join('\n');
}

module.exports = { buildHtml, buildText };
