import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("parksmart.db");

export const initDB = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placa TEXT NOT NULL,
      tipo TEXT NOT NULL,
      entrada TEXT NOT NULL,
      salida TEXT,
      costo REAL DEFAULT 0,
      activo INTEGER DEFAULT 1,
      lat REAL,
      lng REAL
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL,
      rol TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tarifa REAL DEFAULT 20,
      espacios INTEGER DEFAULT 50,
      camara INTEGER DEFAULT 1,
      gps INTEGER DEFAULT 1,
      acelerometro INTEGER DEFAULT 1,
      sensibilidad REAL DEFAULT 5
    );

    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      descripcion TEXT,
      fecha TEXT NOT NULL
    );
  `);

  // Inserta configuración por defecto si no existe
  const config = db.getFirstSync("SELECT * FROM configuracion");
  if (!config) {
    db.runSync("INSERT INTO configuracion (tarifa, espacios) VALUES (?, ?)", [20, 50]);
  }
};

export const dbLocal = db;