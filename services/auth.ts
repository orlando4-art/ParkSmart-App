import db from "./database";

export const registrarUsuario = (email: string, password: string, rol = "operador") => {
  try {
    db.runSync(
      "INSERT INTO usuarios (email, password, rol) VALUES (?, ?, ?)",
      [email, password, rol]
    );
    return { success: true };
  } catch {
    return { success: false, error: "El usuario ya existe" };
  }
};

export const loginUsuario = (email: string, password: string) => {
  const result = db.getAllSync(
    "SELECT * FROM usuarios WHERE email=? AND password=?",
    [email, password]
  );

  return result.length > 0
    ? { success: true, user: result[0] }
    : { success: false, error: "Credenciales incorrectas" };
};