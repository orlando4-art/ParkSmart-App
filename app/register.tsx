import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
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
    if (!nombre.trim() || !email.trim() || !password.trim() || !confirmar.trim()) {
      Alert.alert("Error", "Todos los campos son obligatorios");
      return;
    }
    if (password !== confirmar) {
      Alert.alert("Error", "Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      // Crear usuario en Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // Guardar datos del usuario en Firestore con su rol
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        nombre: nombre.trim(),
        email: email.trim(),
        rol,
        creadoEn: new Date(),
      });

      Alert.alert(
        "✅ Cuenta creada",
        `Bienvenido ${nombre}. Tu cuenta de ${rol} fue creada exitosamente.`,
        [{ text: "Iniciar sesión", onPress: () => router.replace("/login") }]
      );
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        Alert.alert("Error", "Este correo ya está registrado");
      } else if (error.code === "auth/invalid-email") {
        Alert.alert("Error", "El correo no es válido");
      } else {
        Alert.alert("Error", "No se pudo crear la cuenta. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Volver</Text>
      </TouchableOpacity>

      <View style={styles.logoCircle}>
        <Text style={styles.logoIcon}>🚗</Text>
      </View>
      <Text style={styles.titulo}>Crear cuenta</Text>
      <Text style={styles.subtitulo}>ParkSmart</Text>

      <View style={styles.card}>
        {/* Selector de rol */}
        <Text style={styles.label}>Tipo de cuenta</Text>
        <View style={styles.rolRow}>
          <TouchableOpacity
            style={[styles.rolBtn, rol === "operador" && styles.rolBtnActive]}
            onPress={() => setRol("operador")}
          >
            <Text style={styles.rolIcon}>🔧</Text>
            <Text style={[styles.rolText, rol === "operador" && styles.rolTextActive]}>
              Operador
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rolBtn, rol === "admin" && styles.rolBtnActiveAdmin]}
            onPress={() => setRol("admin")}
          >
            <Text style={styles.rolIcon}>👤</Text>
            <Text style={[styles.rolText, rol === "admin" && styles.rolTextActiveAdmin]}>
              Administrador
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Nombre completo</Text>
        <TextInput
          style={styles.input}
          placeholder="Tu nombre"
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          style={styles.input}
          placeholder="correo@ejemplo.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Confirmar contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="Repite tu contraseña"
          secureTextEntry
          value={confirmar}
          onChangeText={setConfirmar}
        />

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Crear cuenta</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/login")}>
          <Text style={styles.loginLink}>¿Ya tienes cuenta? Inicia sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    backgroundColor: "#2563EB",
    padding: 24,
    paddingTop: 60,
  },
  backBtn: { alignSelf: "flex-start", marginBottom: 20 },
  backText: { color: "#bfdbfe", fontSize: 16 },
  logoCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  logoIcon: { fontSize: 30 },
  titulo: { fontSize: 28, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  subtitulo: { fontSize: 14, color: "#bfdbfe", marginBottom: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  label: { fontSize: 14, color: "#374151", marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    marginBottom: 16,
    backgroundColor: "#f9fafb",
  },
  rolRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  rolBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    gap: 6,
  },
  rolBtnActive: { borderColor: "#2563EB", backgroundColor: "#eff6ff" },
  rolBtnActiveAdmin: { borderColor: "#7C3AED", backgroundColor: "#f5f3ff" },
  rolIcon: { fontSize: 24 },
  rolText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  rolTextActive: { color: "#2563EB" },
  rolTextActiveAdmin: { color: "#7C3AED" },
  button: {
    backgroundColor: "#2563EB",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 16,
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  loginLink: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
    textDecorationLine: "underline",
  },
});