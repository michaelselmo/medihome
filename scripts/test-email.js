#!/usr/bin/env node
/**
 * Script de prueba para verificar la configuracion de correo.
 * Uso: node scripts/test-email.js
 *
 * Requisitos:
 *   1. Tener .env configurado con EMAIL_APP_PASSWORD valido
 *   2. Ejecutar desde la raiz del proyecto (~/medihome)
 */

require('dotenv').config();

const required = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_APP_PASSWORD', 'EMAIL_ADMIN'];
const missing = required.filter(k => !process.env[k]);

if (missing.length > 0) {
  console.error('ERROR: Faltan variables en .env:');
  missing.forEach(k => console.error(`  - ${k}`));
  console.error('\n1. Copia .env.example a .env: cp .env.example .env');
  console.error('2. Completa los valores, especialmente EMAIL_APP_PASSWORD');
  console.error('3. Obten un App Password en: https://myaccount.google.com/apppasswords');
  process.exit(1);
}

if (process.env.EMAIL_APP_PASSWORD === 'COLOCAR_AQUI_EL_APP_PASSWORD') {
  console.error('ERROR: El EMAIL_APP_PASSWORD en .env es el placeholder.');
  console.error('Debes reemplazarlo con un App Password real de Gmail.');
  console.error('Obtenlo en: https://myaccount.google.com/apppasswords');
  process.exit(1);
}

const { sendNewCitaNotification } = require('../services/emailService');

async function main() {
  console.log('=== MediHome - Prueba de envio de correo ===\n');
  console.log(`Host:     ${process.env.EMAIL_HOST}`);
  console.log(`Port:     ${process.env.EMAIL_PORT}`);
  console.log(`User:     ${process.env.EMAIL_USER}`);
  console.log(`Admin:    ${process.env.EMAIL_ADMIN}\n`);
  console.log('Enviando correo de prueba...\n');

  const result = await sendNewCitaNotification({
    nombre_paciente: 'Prueba Tecnica',
    telefono: '809-555-0000',
    correo: 'paciente@ejemplo.com',
    servicio_nombre: 'Consulta Medica a Domicilio',
    medico_nombre: 'Dr. Carlos Garcia',
    medico_correo: process.env.EMAIL_USER,
    fecha: '2026-06-01',
    hora: '10:30',
    direccion: 'Calle Principal #123',
    ciudad: 'Santo Domingo',
    modalidad: 'domicilio',
    comentario: 'Prueba de configuracion de correo electronico.',
    codigo_cita: 'MH-TEST01',
    created_at: new Date().toISOString(),
    estado: 'pendiente',
    admin_url: 'http://localhost:3000/admin.html',
  });

  if (result.sent) {
    console.log('CORREO ENVIADO EXITOSAMENTE ✓');
    console.log(`MessageID: ${result.messageId}`);
    console.log(`\nRevisa la bandeja de entrada de: ${process.env.EMAIL_ADMIN}`);
  } else {
    console.error('ERROR AL ENVIAR CORREO ✗');
    console.error(`Razon: ${result.reason}`);
    console.error('\nPosibles soluciones:');
    console.error('1. Verifica que el App Password sea correcto (16 caracteres, sin espacios)');
    console.error('2. Verifica que la verificacion en 2 pasos este activada en Gmail');
    console.error('3. Si cambiaste el App Password recientemente, espera unos minutos');
    console.error('4. Revisa: https://support.google.com/mail/?p=BadCredentials');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
