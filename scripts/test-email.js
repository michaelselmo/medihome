#!/usr/bin/env node
/**
 * Script de prueba para verificar la configuracion de Resend.
 * Uso: node scripts/test-email.js
 *
 * Requisitos:
 *   1. Tener .env configurado con RESEND_API_KEY valida
 *   2. Ejecutar desde la raiz del proyecto (~/medihome)
 */

require('dotenv').config();

const required = ['RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_ADMIN'];
const missing = required.filter(k => !process.env[k]);

if (missing.length > 0) {
  console.error('ERROR: Faltan variables en .env:');
  missing.forEach(k => console.error(`  - ${k}`));
  console.error('\n1. Copia .env.example a .env: cp .env.example .env');
  console.error('2. Completa los valores, especialmente RESEND_API_KEY');
  console.error('3. Obten una API Key en: https://resend.com/api-keys');
  process.exit(1);
}

if (process.env.RESEND_API_KEY === 're_xxxxxxxxxxxx') {
  console.error('ERROR: El RESEND_API_KEY en .env es el placeholder.');
  console.error('Debes reemplazarlo con una API Key real de Resend.');
  console.error('Obtenla en: https://resend.com/api-keys');
  process.exit(1);
}

const { sendNewCitaNotification } = require('../services/emailService');
const { buildHtml } = require('../templates/email/appointmentNotification');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== MediHome - Prueba de envio de correo (Resend) ===\n');
  console.log(`From:     ${process.env.EMAIL_FROM}`);
  console.log(`Admin:    ${process.env.EMAIL_ADMIN}\n`);
  console.log('Enviando correo de prueba...\n');

  const previewPath = path.join(__dirname, '..', 'templates', 'email', 'preview.html');
  const previewHtml = buildHtml({
    nombre_paciente: 'Prueba Tecnica',
    telefono: '809-555-0000',
    correo: 'paciente@ejemplo.com',
    direccion: 'Calle Principal #123, Ensanche Ozama',
    ciudad: 'Santo Domingo Este',
    servicio_nombre: 'Consulta Medica a Domicilio',
    medico_nombre: 'Dr. Carlos Garcia',
    fecha: '2026-06-01',
    hora: '10:30',
    modalidad: 'domicilio',
    comentario: 'Prueba de configuracion de correo electronico.',
    codigo_cita: 'MH-TEST01',
    created_at: new Date().toISOString(),
    estado: 'pendiente',
    admin_url: 'http://localhost:3000/admin.html',
  });
  fs.writeFileSync(previewPath, previewHtml);
  console.log(`Preview HTML guardado: templates/email/preview.html`);

  const result = await sendNewCitaNotification({
    nombre_paciente: 'Prueba Tecnica',
    telefono: '809-555-0000',
    correo: 'paciente@ejemplo.com',
    direccion: 'Calle Principal #123, Ensanche Ozama',
    ciudad: 'Santo Domingo Este',
    servicio_nombre: 'Consulta Medica a Domicilio',
    medico_nombre: 'Dr. Carlos Garcia',
    medico_correo: null,
    fecha: '2026-06-01',
    hora: '10:30',
    modalidad: 'domicilio',
    comentario: 'Prueba de configuracion de correo electronico.',
    codigo_cita: 'MH-TEST01',
    created_at: new Date().toISOString(),
    estado: 'pendiente',
    admin_url: 'http://localhost:3000/admin.html',
  });

  if (result.admin?.sent) {
    console.log('CORREO ADMIN ENVIADO EXITOSAMENTE ✓');
    console.log(`ID: ${result.admin.messageId}`);
  } else {
    console.error('ERROR AL ENVIAR CORREO ADMIN ✗');
    console.error(`Razon: ${result.admin?.reason || 'Desconocido'}`);
    process.exit(1);
  }

  if (result.patient?.sent) {
    console.log('CORREO PACIENTE ENVIADO EXITOSAMENTE ✓');
    console.log(`ID: ${result.patient.messageId}`);
    console.log(`\nRevisa las bandejas de: ${process.env.EMAIL_ADMIN} y paciente@ejemplo.com`);
  } else if (result.patient?.reason === 'Paciente sin correo') {
    console.log('CORREO PACIENTE: omitido (sin correo en datos de prueba)');
  } else {
    console.error('ERROR AL ENVIAR CORREO PACIENTE ✗');
    console.error(`Razon: ${result.patient?.reason || 'Desconocido'}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});