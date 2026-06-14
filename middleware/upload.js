const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { RESULTADOS_DIR, RESULTADOS_PACIENTE_DIR } = require("../db/database");

const fileFilter = (req, file, cb) => {
  const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error("Tipo de archivo no permitido. Solo PDF, JPG, JPEG, PNG."), false);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(RESULTADOS_DIR)) fs.mkdirSync(RESULTADOS_DIR, { recursive: true });
    cb(null, RESULTADOS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const citaId = req.params.id || "unknown";
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    cb(null, "resultado_cita_" + citaId + "_" + date + ext);
  },
});

const storagePaciente = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(RESULTADOS_PACIENTE_DIR)) fs.mkdirSync(RESULTADOS_PACIENTE_DIR, { recursive: true });
    cb(null, RESULTADOS_PACIENTE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const pacienteId = req.params.id || "unknown";
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    cb(null, "resultado_pac_" + pacienteId + "_" + date + "_" + Date.now() + ext);
  },
});

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadPaciente = multer({ storage: storagePaciente, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { upload, uploadPaciente };
