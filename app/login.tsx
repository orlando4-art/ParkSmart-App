import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../services/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [scanning, setScanning] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHardware && isEnrolled);
  };

  // Obtiene el rol del usuario desde Firestore
  const getRol = async (uid: string): Promise<string> => {
    try {
      const snap = await getDoc(doc(db, "usuarios", uid));
      if (snap.exists()) return snap.data().rol;
    } catch (e) {}
    return "operador"; // por defecto
  };

  const handleLogin = async (emailParam?: string, passParam?: string) => {
    const finalEmail = emailParam || email.trim();
    const finalPass = passParam || password.trim();

    if (!finalEmail || !finalPass) {
      Alert.alert("Campos vacíos", "Ingresa correo y contraseña");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, finalEmail, finalPass);

      // Detecta el rol automáticamente
      const rol = await getRol(cred.user.uid);

      // Guarda credenciales y rol para huella
      await AsyncStorage.setItem("saved_email", finalEmail);
      await AsyncStorage.setItem("saved_password", finalPass);
      await AsyncStorage.setItem("saved_rol", rol);

      // Redirige según el rol
      if (rol === "admin") {
        router.replace("/(tabs)"); // admin ve todo
      } else {
        router.replace("/(tabs)/entrada"); // operador va directo a entrada
      }
    } catch (error: any) {
      Alert.alert("Error", "Usuario o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    if (!biometricAvailable) {
      Alert.alert(
        "No disponible",
        "Tu dispositivo no tiene huella dactilar registrada.\n\nPara usarla:\n1. Ve a Configuración\n2. Seguridad → Huella dactilar\n3. Registra tu huella"
      );
      return;
    }

    const savedEmail = await AsyncStorage.getItem("saved_email");
    const savedPassword = await AsyncStorage.getItem("saved_password");

    if (!savedEmail || !savedPassword) {
      Alert.alert(
        "Primero inicia sesión",
        "Debes iniciar sesión una vez con correo y contraseña para habilitar la huella."
      );
      return;
    }

    setScanning(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Coloca tu huella dactilar",
        fallbackLabel: "Usar contraseña",
        cancelLabel: "Cancelar",
        disableDeviceFallback: false,
      });

      if (result.success) {
        await handleLogin(savedEmail, savedPassword);
      } else if (result.error !== "user_cancel") {
        Alert.alert("Error", "No se reconoció la huella. Intenta de nuevo.");
      }
    } catch (e) {
      Alert.alert("Error", "Problema con la autenticación biométrica.");
    } finally {
      setScanning(false);
    }
  };

  const handleRoleAccess = (role: "admin" | "operador") => {
    setShowRoles(false);
    if (role === "admin") {
      handleLogin("admin@parksmart.com", "admin123");
    } else {
      handleLogin("operador@parksmart.com", "operador123");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoIcon}>🚗</Text>
      </View>
      <Text style={styles.titulo}>ParkSmart</Text>
      <Text style={styles.subtitulo}>Gestión Inteligente</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Usuario</Text>
        <TextInput
          style={styles.input}
          placeholder="Ingresa tu usuario"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="Ingresa tu contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={() => handleLogin()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </TouchableOpacity>

        <View style={styles.separatorRow}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>o inicia sesión con</Text>
          <View style={styles.separatorLine} />
        </View>

        <TouchableOpacity
          style={[styles.biometricButton, scanning && { opacity: 0.7 }]}
          onPress={handleBiometric}
          disabled={scanning || loading}
        >
          {scanning ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.biometricText}>Leyendo huella...</Text>
            </>
          ) : (
            <>
              <Text style={styles.biometricIcon}>👆</Text>
              <Text style={styles.biometricText}>
                {biometricAvailable ? "Huella Dactilar" : "Huella no disponible"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowRoles(true)}>
          <Text style={styles.adminLink}>Acceso administrador / operador</Text>
        </TouchableOpacity>

        {/* Botón crear cuenta */}
        <View style={styles.registerRow}>
          <Text style={styles.registerText}>¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={styles.registerLink}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal roles */}
      <Modal
        visible={showRoles}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoles(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Seleccionar acceso</Text>
            <Text style={styles.modalSubtitle}>
              Elige tu tipo de cuenta para ingresar
            </Text>

            <TouchableOpacity
              style={styles.roleButton}
              onPress={() => handleRoleAccess("admin")}
            >
              <Text style={styles.roleIcon}>👤</Text>
              <View>
                <Text style={styles.roleName}>Administrador</Text>
                <Text style={styles.roleDesc}>Acceso completo al sistema</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleButton, { marginTop: 12 }]}
              onPress={() => handleRoleAccess("operador")}
            >
              <Text style={styles.roleIcon}>🔧</Text>
              <View>
                <Text style={styles.roleName}>Operador</Text>
                <Text style={styles.roleDesc}>Registro de entradas y salidas</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowRoles(false)}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2563EB",
    padding: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  logoIcon: { fontSize: 36 },
  titulo: { fontSize: 32, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  subtitulo: { fontSize: 15, color: "#bfdbfe", marginBottom: 32 },
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
  button: {
    backgroundColor: "#2563EB",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  separatorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  separatorText: { fontSize: 12, color: "#9ca3af", marginHorizontal: 10 },
  biometricButton: {
    backgroundColor: "#7C3AED",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  biometricIcon: { fontSize: 20 },
  biometricText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  adminLink: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
    textDecorationLine: "underline",
    marginBottom: 16,
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  registerText: { fontSize: 13, color: "#6b7280" },
  registerLink: { fontSize: 13, color: "#2563EB", fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#111", marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  roleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  roleIcon: { fontSize: 28 },
  roleName: { fontSize: 16, fontWeight: "bold", color: "#111" },
  roleDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cancelBtn: { marginTop: 16, padding: 12, alignItems: "center" },
  cancelText: { color: "#EF4444", fontSize: 15, fontWeight: "600" },
});