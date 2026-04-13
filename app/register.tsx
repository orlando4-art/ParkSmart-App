import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from "react-native";
import { guardarUsuarioLocal } from "../services/database";
import { auth, db } from "../services/firebase";

export default function Register() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [rol, setRol] = useState<"admin" | "operador">("operador");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    if (!nombre || !email || !password || !confirmar) {
      Alert.alert("Error", "Completa todos los campos");
      return;
    }
    if (password !== confirmar) {
      Alert.alert("Error", "Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Mínimo 6 caracteres");
      return;
    }

    setLoading(true);

    const timeoutId = setTimeout(() => {
      setLoading(false);
      Alert.alert("Tiempo agotado", "Verifica tu internet e intenta de nuevo.");
    }, 15000);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Guardar en Firestore (puede fallar sin internet)
      try {
        await Promise.race([
          setDoc(doc(db, "usuarios", cred.user.uid), {
            nombre, email, rol, creadoEn: new Date(),
          }),
          new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 8000)),
        ]);
      } catch (e) {
        console.log("Firestore no disponible, guardando local");
      }

      // Siempre guardar en SQLite con el rol seleccionado
      guardarUsuarioLocal(cred.user.uid, nombre, email, rol);

      clearTimeout(timeoutId);
      setLoading(false);

      Alert.alert(
        "✅ Cuenta creada",
        `Nombre: ${nombre}\nRol: ${rol === "admin" ? "👑 Administrador" : "👷 Operador"}`,
        [{ text: "Ir al login", onPress: () => router.replace("/login") }]
      );
    } catch (error: any) {
      clearTimeout(timeoutId);
      setLoading(false);
      if (error.code === "auth/email-already-in-use") {
        Alert.alert("Error", "Correo ya registrado");
      } else if (error.code === "auth/network-request-failed") {
        Alert.alert("Sin conexión", "Necesitas internet para crear una cuenta.");
      } else {
        Alert.alert("Error", error.message || "No se pudo registrar");
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Registro</Text>

      <TextInput placeholder="Nombre" style={styles.input} onChangeText={setNombre} editable={!loading} />
      <TextInput placeholder="Correo" style={styles.input} onChangeText={setEmail} autoCapitalize="none" editable={!loading} />
      <TextInput placeholder="Contraseña" secureTextEntry style={styles.input} onChangeText={setPassword} editable={!loading} />
      <TextInput placeholder="Confirmar contraseña" secureTextEntry style={styles.input} onChangeText={setConfirmar} editable={!loading} />

      {/* ✅ Selector de rol visible */}
      <Text style={styles.rolLabel}>Tipo de cuenta:</Text>
      <View style={styles.rolRow}>
        <TouchableOpacity
          style={[styles.rolBtn, rol === "operador" && styles.rolBtnActive]}
          onPress={() => setRol("operador")}
        >
          <Text style={styles.rolIcon}>👷</Text>
          <Text style={[styles.rolText, rol === "operador" && styles.rolTextActive]}>Operador</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rolBtn, rol === "admin" && styles.rolBtnActiveAdmin]}
          onPress={() => setRol("admin")}
        >
          <Text style={styles.rolIcon}>👑</Text>
          <Text style={[styles.rolText, rol === "admin" && styles.rolTextActiveAdmin]}>Administrador</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Registrar</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/login")} disabled={loading}>
        <Text style={styles.link}>Ya tengo cuenta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 24, textAlign: "center", marginBottom: 20 },
  input: { borderWidth: 1, padding: 12, marginBottom: 10, borderRadius: 8 },
  rolLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#374151" },
  rolRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  rolBtn: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: "center",
    borderWidth: 2, borderColor: "#e5e7eb", backgroundColor: "#f9fafb",
  },
  rolBtnActive: { borderColor: "#22C55E", backgroundColor: "#f0fdf4" },
  rolBtnActiveAdmin: { borderColor: "#7C3AED", backgroundColor: "#f5f3ff" },
  rolIcon: { fontSize: 24, marginBottom: 4 },
  rolText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  rolTextActive: { color: "#22C55E" },
  rolTextActiveAdmin: { color: "#7C3AED" },
  button: { backgroundColor: "#22C55E", padding: 15, borderRadius: 8 },
  buttonText: { color: "#fff", textAlign: "center" },
  link: { marginTop: 15, textAlign: "center", color: "#2563EB" },
});
