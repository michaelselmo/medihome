const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "medihome.db");
const SECRET = process.env.SECRET || "medihome_secret_key_2026";
const RESULTADOS_DIR = path.join(__dirname, "..", "uploads", "resultados");
const RESULTADOS_PACIENTE_DIR = path.join(__dirname, "..", "uploads", "resultados_paciente");

const db = new sqlite3.Database(DB_PATH);

module.exports = { db, SECRET, DB_PATH, RESULTADOS_DIR, RESULTADOS_PACIENTE_DIR };
