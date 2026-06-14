function sanitizar(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").replace(/[<>"'\\]/g, "").trim();
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarTelefonoRD(tel) {
  const limpio = tel.replace(/[\s\-\ ()\+]/g, "");
  return /^\d{10,12}$/.test(limpio);
}

function validarCedulaRD(ced) {
  return /^\d{11}$/.test(ced);
}

function convertirHoraAMinutos(hora) {
  if (!hora) return 0;
  const partes = hora.split(":");
  if (partes.length < 2) return 0;
  return parseInt(partes[0], 10) * 60 + parseInt(partes[1], 10);
}

function generarCodigoCita() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let codigo = "MH-";
  for (let i = 0; i < 6; i++)
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  return codigo;
}

function escHtml(str) {
  if (typeof str !== "string") return str || "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

module.exports = { sanitizar, validarEmail, validarTelefonoRD, validarCedulaRD, convertirHoraAMinutos, generarCodigoCita, escHtml };
