function buildHtml(data) {
  const p = (v, fallback = '—') => (v && v !== 'undefined' ? v : fallback);
  const year = new Date().getFullYear();

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

  const pacienteFields = [
    { label: 'Paciente', value: p(data.nombre_paciente) },
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

  function rows(fields) {
    return fields
      .map(
        (f, i) => `<tr>
        <td valign="top" style="font-size:13px;color:#64748b;padding:7px 0;width:100px;white-space:nowrap;${i < fields.length - 1 ? 'border-bottom:1px solid #f1f5f9' : ''}">${f.label}</td>
        <td valign="top" style="font-size:14px;color:#0f172a;font-weight:500;padding:7px 0;${i < fields.length - 1 ? 'border-bottom:1px solid #f1f5f9' : ''}">${f.value}</td>
      </tr>`
      )
      .join('');
  }

  function card(title, content) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;margin-bottom:16px;padding:18px 20px">
      <tr>
        <td style="font-size:12px;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:10px;border-bottom:2px solid #e2e8f0">${title}</td>
      </tr>
      <tr>
        <td style="padding:4px 0 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${content}
          </table>
        </td>
      </tr>
    </table>`;
  }

  const pacienteRows = rows(pacienteFields);
  const citaRows = rows(citaFields);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Nueva cita - MediHome</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0">
    <tr>
      <td align="center" style="padding:0 12px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0284c7,#0ea5e9,#06b6d4);padding:32px 30px 28px;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">MediHome</td>
                </tr>
                <tr>
                  <td style="font-size:12px;color:rgba(255,255,255,0.8);padding-top:4px;font-weight:400;letter-spacing:1px">SERVICIOS MÉDICOS A DOMICILIO &amp; TELEMEDICINA</td>
                </tr>
              </table>
              <table role="presentation" width="80" cellpadding="0" cellspacing="0" align="center" style="margin-top:18px">
                <tr>
                  <td style="height:2px;background:rgba(255,255,255,0.3);border-radius:1px"></td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:16px">
                <tr>
                  <td style="font-size:18px;font-weight:600;color:#ffffff">Nueva cita agendada</td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:rgba(255,255,255,0.8);padding-top:4px">Se ha registrado una nueva solicitud en la plataforma.</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CODIGO -->
          <tr>
            <td style="padding:20px 30px 0;text-align:center">
              <span style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1px">Código de seguimiento</span>
              <br>
              <span style="font-size:20px;font-weight:700;color:#0ea5e9;letter-spacing:1.5px;font-family:'Courier New',Courier,monospace">${p(data.codigo_cita)}</span>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:20px 30px 24px">

              ${card('Información del paciente', pacienteRows)}

              ${card('Detalles de la cita', citaRows)}

              <!-- COMENTARIO -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;margin-bottom:16px;padding:18px 20px">
                <tr>
                  <td style="font-size:12px;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:10px;border-bottom:2px solid #e2e8f0">Motivo / Comentario</td>
                </tr>
                <tr>
                  <td style="padding:10px 0 0;font-size:14px;color:#475569;line-height:1.5;font-style:italic">${p(data.comentario, 'Sin comentario adicional')}</td>
                </tr>
              </table>

              <!-- ESTADO + FECHA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" valign="top" style="padding-right:6px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;padding:14px 12px;text-align:center">
                      <tr>
                        <td style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:6px">Estado</td>
                      </tr>
                      <tr>
                        <td><span style="display:inline-block;background:${ec.bg};color:${ec.text};font-size:12px;font-weight:700;padding:3px 14px;border-radius:20px;text-transform:capitalize">${p(data.estado)}</span></td>
                      </tr>
                    </table>
                  </td>
                  <td width="48%" valign="top" style="padding-left:6px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;padding:14px 12px;text-align:center">
                      <tr>
                        <td style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:6px">Registrada</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#0f172a;font-weight:600">${p(data.created_at)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background-color:#0ea5e9">
                          <a href="${p(data.admin_url)}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">Ver cita en el panel</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 30px;border-top:1px solid #e2e8f0;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="font-size:13px;font-weight:600;color:#0ea5e9">MediHome</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#94a3b8;padding-top:2px">Sistema de Gestión Médica</td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#cbd5e1;padding-top:10px;line-height:1.5">
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
</body>
</html>`;
}

function buildText(data) {
  const p = (v, fallback = '—') => (v && v !== 'undefined' ? v : fallback);
  const modalidadLabel = { domicilio: 'A domicilio', telemedicina: 'Telemedicina', consulta: 'En consultorio' }[
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
    `Paciente:     ${p(data.nombre_paciente)}`,
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
