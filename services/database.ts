import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("parksmart.db");

// ============================================================
// 🧠 INICIALIZAR BASE DE DATOS
// ============================================================
export const initDB = () => {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        rol TEXT NOT NULL DEFAULT 'operador',
        biometria INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS registros (
        id TEXT PRIMARY KEY NOT NULL,
        placa TEXT,
        tipo TEXT,
        entrada TEXT,
        salida TEXT,
        costo REAL DEFAULT 0,
        activo INTEGER DEFAULT 1,
        sincronizado INTEGER DEFAULT 0,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT,
        descripcion TEXT,
        fecha TEXT
      );

      CREATE TABLE IF NOT EXISTS config (
        clave TEXT PRIMARY KEY NOT NULL,
        valor TEXT NOT NULL DEFAULT ''
      );
    `);

    // 🔥 Compatibilidad con versiones anteriores
    try {
      db.execSync(`ALTER TABLE usuarios ADD COLUMN biometria INTEGER NOT NULL DEFAULT 0`);
    } catch {}

    try {
      db.execSync(`ALTER TABLE registros ADD COLUMN sincronizado INTEGER DEFAULT 0`);
    } catch {}

    try {
      db.execSync(`ALTER TABLE registros ADD COLUMN updatedAt TEXT`);
    } catch {}

    console.log("✅ BD inicializada PRO");
  } catch (error) {
    console.log("❌ Error creando BD:", error);
  }
};



// ============================================================
// 👤 USUARIOS
// ============================================================
export const guardarUsuarioLocal = (
  id: string,
  nombre: string,
  email: string,
  rol: string,
  biometria: boolean = false
) => {
  try {
    db.runSync(
      `INSERT OR REPLACE INTO usuarios (id, nombre, email, rol, biometria) VALUES (?, ?, ?, ?, ?)`,
      [id, nombre || "", email || "", rol || "operador", biometria ? 1 : 0]
    );
  } catch (error) {
    console.log("Error guardando usuario:", error);
  }
};

export const obtenerUsuarioLocal = (id: string) => {
  try {
    const r = db.getAllSync("SELECT * FROM usuarios WHERE id = ?", [id]) as any[];
    return r[0] || null;
  } catch {
    return null;
  }
};

export const obtenerUsuarioPorEmail = (email: string) => {
  try {
    const r = db.getAllSync("SELECT * FROM usuarios WHERE email = ?", [email]) as any[];
    return r[0] || null;
  } catch {
    return null;
  }
};

export const activarBiometriaLocal = (id: string) => {
  try {
    db.runSync(`UPDATE usuarios SET biometria = 1 WHERE id = ?`, [id]);
    return true;
  } catch {
    return false;
  }
};

export const tieneBiometriaActivada = (id: string): boolean => {
  try {
    const r = db.getAllSync("SELECT biometria FROM usuarios WHERE id = ?", [id]) as any[];
    return r[0]?.biometria === 1;
  } catch {
    return false;
  }
};



// ============================================================
// 🚗 REGISTROS (PRO 🔥)
// ============================================================

// ✅ Guardar entrada local (instantáneo)
export const guardarRegistroLocal = (registro: any) => {
  try {
    db.runSync(
      `INSERT OR REPLACE INTO registros 
      (id, placa, tipo, entrada, salida, costo, activo, sincronizado, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        registro.id,
        registro.placa,
        registro.tipo,
        registro.entrada,
        registro.salida || null,
        registro.costo || 0,
        registro.activo ? 1 : 0,
        0,
        new Date().toISOString()
      ]
    );
    return true;
  } catch (e) {
    console.log("Error guardando registro:", e);
    return false;
  }
};

// ✅ Verificar si ya existe activo
export const existeRegistroActivoLocal = (placa: string) => {
  try {
    const r = db.getAllSync(
      `SELECT * FROM registros WHERE placa = ? AND activo = 1`,
      [placa]
    ) as any[];

    return r.length > 0;
  } catch {
    return false;
  }
};

// ✅ Cerrar registro (salida)
export const cerrarRegistroLocal = (placa: string, costo: number) => {
  try {
    db.runSync(
      `UPDATE registros 
       SET salida = ?, costo = ?, activo = 0, sincronizado = 0, updatedAt = ?
       WHERE placa = ? AND activo = 1`,
      [new Date().toISOString(), costo, new Date().toISOString(), placa]
    );
    return true;
  } catch (e) {
    console.log("Error cerrando registro:", e);
    return false;
  }
};

// ✅ Obtener registros
export const obtenerRegistrosLocales = () => {
  try {
    return db.getAllSync(
      `SELECT * FROM registros ORDER BY entrada DESC`
    );
  } catch {
    return [];
  }
};

// ✅ Obtener pendientes de sincronizar
export const obtenerPendientes = () => {
  try {
    return db.getAllSync(
      `SELECT * FROM registros WHERE sincronizado = 0`
    ) as any[];
  } catch {
    return [];
  }
};

// ✅ Marcar como sincronizado
export const marcarSincronizado = (id: string) => {
  try {
    db.runSync(
      `UPDATE registros SET sincronizado = 1 WHERE id = ?`,
      [id]
    );
  } catch (e) {
    console.log("Error sync:", e);
  }
};



// ============================================================
// ⚙️ CONFIGURACIÓN
// ============================================================
export const guardarConfig = (clave: string, valor: string) => {
  try {
    db.runSync(
      `INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)`,
      [clave, valor]
    );
    return true;
  } catch {
    return false;
  }
};

export const obtenerConfig = (clave: string, defecto = ""): string => {
  try {
    const r = db.getAllSync(
      "SELECT valor FROM config WHERE clave = ?",
      [clave]
    ) as any[];

    return r[0]?.valor ?? defecto;
  } catch {
    return defecto;
  }
};



// ============================================================
// 🔄 WRAPPER ASYNC (opcional)
// ============================================================
export const dbLocal = {
  runAsync: async (sql: string, params: any[] = []) => {
    try {
      db.runSync(sql, params);
      return true;
    } catch (e) {
      console.log("dbLocal error:", e);
      return false;
    }
  },
  getAllAsync: async (sql: string, params: any[] = []) => {
    try {
      return db.getAllSync(sql, params);
    } catch {
      return [];
    }
  },
};

export default db;