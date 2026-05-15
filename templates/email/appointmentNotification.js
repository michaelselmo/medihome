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

  // SVG icons as reusable inline snippets
  const iconCircle = (fill, svg) =>
    `<table cellpadding="0" cellspacing="0" style="display:inline-block;vertical-align:middle"><tr><td style="border-radius:50%;width:32px;height:32px;text-align:center;vertical-align:middle;background:${fill}">
      ${svg}
    </td></tr></table>`;

  const icons = {
    heart: `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <defs>
        <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0ea5e9"/>
          <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>
      </defs>
      <rect width="80" height="80" rx="20" fill="rgba(14,165,233,0.08)"/>
      <path d="M40 58 C22 44 14 34 14 26 C14 20 18 16 24 16 C28 16 32 18 34 22 L40 30 L46 22 C48 18 52 16 56 16 C62 16 66 20 66 26 C66 34 58 44 40 58Z" fill="url(#hg)" opacity="0.9"/>
    </svg>`,
    ecgLine: `<svg width="100%" height="24" viewBox="0 0 740 24" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:740px">
      <path d="M0 18 L180 18 L200 18 L210 18 L215 8 L220 18 L230 18 L245 18 L260 18 L265 14 L270 18 L285 18 L310 18 L320 18 L325 8 L330 18 L340 18 L360 18" fill="none" stroke="rgba(14,165,233,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M370 18 L380 18 L386 18 L390 12 L394 18 L400 18 L410 18" fill="none" stroke="rgba(14,165,233,0.35)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M420 18 L430 18 L436 18 L440 12 L444 18 L450 18 L460 18" fill="none" stroke="rgba(14,165,233,0.25)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M470 18 L600 18 L620 18 L630 18 L635 12 L640 18 L650 18 L665 18 L680 18 L690 18 L695 14 L700 18 L710 18 L740 18" fill="none" stroke="rgba(14,165,233,0.15)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    patient:
      '<svg width="16" height="16" viewBox="0 0 16 16" style="display:block;margin:8px auto"><path d="M8 8c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z" fill="#fff"/></svg>',
    details:
      '<svg width="16" height="16" viewBox="0 0 16 16" style="display:block;margin:8px auto"><path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6zm1-9.5H7V9l3.5 2.1.5-.8-3-1.8V4.5z" fill="#fff"/></svg>',
    comment:
      '<svg width="16" height="16" viewBox="0 0 16 16" style="display:block;margin:8px auto"><path d="M14 0H2C.9 0 0 .9 0 2v10c0 1.1.9 2 2 2h3l3 3 3-3h3c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zm0 12H2V2h12v10z" fill="#fff"/></svg>',
    check:
      '<svg width="14" height="14" viewBox="0 0 14 14" style="display:block;margin:8px auto"><path d="M5.5 9.8L2.2 6.5 1 7.7l4.5 4.5 7.5-7.5L11.8 3z" fill="#fff"/></svg>',
    clock:
      '<svg width="14" height="14" viewBox="0 0 14 14" style="display:block;margin:8px auto"><path d="M7 0C3.1 0 0 3.1 0 7s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5zm.5-8.5H6v4.3l3.5 2.1.5-.8-3-1.8V3.5z" fill="#fff"/></svg>',
    bell:
      '<svg width="20" height="20" viewBox="0 0 20 20" style="display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg"><path d="M10 0C6.7 0 4 2.7 4 6v3.3L2.3 12.7c-.4.6-.1 1.3.5 1.5l.2.1c.1 0 .2.1.3.1H17c.1 0 .2 0 .3-.1l.2-.1c.6-.2.9-.9.5-1.5L16 9.3V6c0-3.3-2.7-6-6-6zm2 15H8c0 1.1.9 2 2 2s2-.9 2-2z" fill="#0ea5e9"/></svg>',
  };

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
              <!-- ECG line running across top -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:0;line-height:0;font-size:0">${icons.ecgLine}</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:16px 36px 28px">
                <tr>
                  <!-- Heart icon left -->
                  <td width="80" valign="middle" align="left" style="padding-right:20px">
                    <!--[if !mso]><!-->
                    ${icons.heart}
                    <!--<![endif]-->
                    <!--[if mso]>&nbsp;<![endif]-->
                  </td>
                  <!-- MediHome text -->
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
            <td style="padding:32px 36px 0;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td align="center" style="padding-bottom:12px">
                    <table cellpadding="0" cellspacing="0" style="background:rgba(14,165,233,0.08);border-radius:50%;width:44px;height:44px">
                      <tr><td align="center" valign="middle" style="padding:12px">${icons.bell}</td></tr>
                    </table>
                  </td>
                </tr>
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
                        <td valign="middle" width="36">${iconCircle('rgba(14,165,233,0.85)', icons.patient)}</td>
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
                        <td valign="middle" width="36">${iconCircle('rgba(14,165,233,0.85)', icons.details)}</td>
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
                        <td valign="middle" width="36">${iconCircle('rgba(245,158,11,0.85)', icons.comment)}</td>
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
                  <!--[if !mso]><!-->
                  <td width="50%" valign="top" style="padding-right:9px">
                  <!--<![endif]-->
                  <!--[if mso]><td width="50%" valign="top"><![endif]-->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d1fae5;border-radius:14px;background-color:#ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.02);margin-bottom:14px;overflow:hidden">
                      <tr>
                        <td style="padding:14px 18px">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td valign="middle" width="28">${iconCircle(ec.text, icons.check)}</td>
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
                  <!--[if !mso]><!-->
                  <td width="50%" valign="top" style="padding-left:9px">
                  <!--<![endif]-->
                  <!--[if mso]><td width="50%" valign="top"><![endif]-->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbeafe;border-radius:14px;background-color:#ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.02);margin-bottom:14px;overflow:hidden">
                      <tr>
                        <td style="padding:14px 18px">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td valign="middle" width="28">${iconCircle('rgba(14,165,233,0.85)', icons.clock)}</td>
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
