import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from "react-native";
import {
  activarBiometriaLocal,
  guardarUsuarioLocal,
  obtenerUsuarioLocal,
  obtenerUsuarioPorEmail,
  tieneBiometriaActivada,
} from "../services/database";
import { auth, db } from "../services/firebase";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [scanning, setScanning] = useState(false);

  // Estado de biometría
  const [bioDisponible, setBioDisponible] = useState(false);
  const [bioTipo, setBioTipo]             = useState("biometria"); // "rostro" | "huella" | "biometria"
  const [bioLabel, setBioLabel]           = useState("Biometría");
  const [bioEmoji, setBioEmoji]           = useState("🔐");
  const [credGuardadas, setCredGuardadas] = useState(false);

  const router = useRouter();

  // ─────────────────────────────────────────────
  // Al montar: detectar hardware Y credenciales
  // ─────────────────────────────────────────────
  useEffect(() => {
    detectarBiometria();
    verificarCredenciales();
  }, []);

  const verificarCredenciales = async () => {
    const em  = await AsyncStorage.getItem("saved_email");
    const pw  = await AsyncStorage.getItem("saved_password");
    const uid = await AsyncStorage.getItem("saved_uid");
    setCredGuardadas(!!em && !!pw && !!uid);
  };

  // ─────────────────────────────────────────────
  // Detección robusta de biometría
  // ─────────────────────────────────────────────
  const detectarBiometria = async () => {
    try {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      console.log("[Bio] hasHardware:", hardware);
      if (!hardware) { setBioDisponible(false); return; }

      let enrolled = false;
      try {
        enrolled = await LocalAuthentication.isEnrolledAsync();
        console.log("[Bio] isEnrolled:", enrolled);
      } catch (e) {
        console.log("[Bio] isEnrolledAsync error (ignorado):", e);
        enrolled = true;
      }

      if (!enrolled) {
        console.log("[Bio] enrolled=false, pero mostramos el botón igual");
      }

      let tipos: LocalAuthentication.AuthenticationType[] = [];
      try {
        tipos = await LocalAuthentication.supportedAuthenticationTypesAsync();
        console.log("[Bio] tipos:", tipos);
      } catch (e) {
        console.log("[Bio] supportedTypes error:", e);
      }

      const tieneFace    = tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const tieneHuella  = tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
      const tieneIrisEtc = tipos.includes(3 as any);

      if (tieneFace) {
        setBioTipo("rostro");
        setBioLabel(Platform.OS === "ios" ? "Face ID" : "Reconocimiento facial");
        setBioEmoji("😊");
      } else if (tieneHuella) {
        setBioTipo("huella");
        setBioLabel("Huella digital");
        setBioEmoji("👆");
      } else if (tieneIrisEtc) {
        setBioTipo("iris");
        setBioLabel("Biometría del dispositivo");
        setBioEmoji("👁️");
      } else {
        setBioTipo("biometria");
        setBioLabel("Biometría del dispositivo");
        setBioEmoji("🔐");
      }

      setBioDisponible(true);
    } catch (e) {
      console.log("[Bio] Error general detectarBiometria:", e);
      setBioDisponible(false);
    }
  };

  // ─────────────────────────────────────────────
  // Helpers de navegación y rol
  // ─────────────────────────────────────────────
  const irA = (rol: string) => {
    if (rol === "admin") router.replace("/(tabs)");
    else router.replace("/(tabs)/entrada");
  };

  const getRol = async (uid: string, emailUsuario: string): Promise<string> => {
    const local = obtenerUsuarioLocal(uid);
    if (local?.rol === "admin" || local?.rol === "operador") return local.rol;

    const porEmail = obtenerUsuarioPorEmail(emailUsuario);
    if (porEmail?.rol === "admin" || porEmail?.rol === "operador") return porEmail.rol;

    try {
      const snap = await Promise.race([
        getDoc(doc(db, "usuarios", uid)),
        new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 5000)),
      ]) as any;
      if (snap.exists?.()) {
        const r = snap.data().rol;
        if (r === "admin" || r === "operador") return r;
      }
    } catch {}

    const rolGuardado = await AsyncStorage.getItem("saved_rol");
    if (rolGuardado === "admin" || rolGuardado === "operador") return rolGuardado;

    return new Promise((resolve) => {
      Alert.alert(
        "¿Cuál es tu rol?",
        "Selecciona tu tipo de acceso:",
        [
          { text: "👷 Operador",      onPress: () => resolve("operador") },
          { text: "👑 Administrador", onPress: () => resolve("admin") },
        ],
        { cancelable: false }
      );
    });
  };

  // ─────────────────────────────────────────────
  // Ofrecer activar biometría tras login manual
  // ─────────────────────────────────────────────
  const ofrecerActivarBiometria = async (uid: string, rol: string) => {
    if (!bioDisponible) {
      console.log("No hay biometría disponible");
      irA(rol);
      return;
    }

    Alert.alert(
      "🔐 Acceso rápido",
      `¿Quieres activar ${bioLabel} para entrar sin contraseña la próxima vez?`,
      [
        { text: "Ahora no", style: "cancel", onPress: () => irA(rol) },
        {
          text: "✅ Sí, activar",
          onPress: async () => {
            try {
              const res = await LocalAuthentication.authenticateAsync({
                promptMessage:         `Registra tu ${bioLabel} en ParkSmart`,
                fallbackLabel:         "Cancelar",
                disableDeviceFallback: true,
                cancelLabel:           "Cancelar",
              });
              if (res.success) {
                activarBiometriaLocal(uid);
                Alert.alert(
                  "✅ Activada",
                  `${bioEmoji} ${bioLabel} activada.\nLa próxima vez entra con un toque.`,
                  [{ text: "Entrar", onPress: () => irA(rol) }]
                );
              } else {
                console.log("[Bio] registro cancelado:", res.error);
                irA(rol);
              }
            } catch (e) {
              console.log("[Bio] error al registrar:", e);
              irA(rol);
            }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────
  // Login con correo y contraseña
  // ─────────────────────────────────────────────
  const handleLogin = async (emailParam?: string, passParam?: string) => {
    const finalEmail = (emailParam || email).trim();
    const finalPass  = passParam || password;

    if (!finalEmail || !finalPass) {
      Alert.alert("Campos vacíos", "Ingresa tu correo y contraseña.");
      return;
    }

    setLoading(true);
    const tid = setTimeout(() => {
      setLoading(false);
      Alert.alert("Sin conexión", "Verifica tu internet e intenta de nuevo.");
    }, 12000);

    try {
      const cred = await signInWithEmailAndPassword(auth, finalEmail, finalPass);
      const uid  = cred.user.uid;

      await AsyncStorage.removeItem("saved_rol");
      const rol = await getRol(uid, finalEmail);

      await AsyncStorage.multiSet([
        ["saved_email",    finalEmail],
        ["saved_password", finalPass],
        ["saved_uid",      uid],
        ["saved_rol",      rol],
      ]);

      const local = obtenerUsuarioLocal(uid);
      guardarUsuarioLocal(
        uid,
        local?.nombre || "Usuario",
        finalEmail,
        rol,
        true
      );

      clearTimeout(tid);
      setLoading(false);
      setCredGuardadas(true);

      if (!emailParam) {
        await ofrecerActivarBiometria(uid, rol);
      } else {
        irA(rol);
      }

    } catch (error: any) {
      clearTimeout(tid);
      setLoading(false);
      const msg: Record<string, string> = {
        "auth/network-request-failed": "Sin conexión. Verifica tu internet.",
        "auth/invalid-credential":     "Correo o contraseña incorrectos.",
        "auth/wrong-password":         "Contraseña incorrecta.",
        "auth/user-not-found":         "No existe una cuenta con ese correo.",
        "auth/too-many-requests":      "Demasiados intentos. Espera unos minutos.",
      };
      Alert.alert("Error", msg[error.code] || error.message || "No se pudo iniciar sesión.");
    }
  };

  // ─────────────────────────────────────────────
  // Login con biometría
  // ─────────────────────────────────────────────
  const handleBiometric = async () => {
    const savedEmail = await AsyncStorage.getItem("saved_email");
    const savedPass  = await AsyncStorage.getItem("saved_password");
    const savedUid   = await AsyncStorage.getItem("saved_uid");

    if (!savedEmail || !savedPass || !savedUid) {
      Alert.alert(
        "Primero inicia sesión",
        "Inicia sesión una vez con correo y contraseña.\nDespués podrás usar la biometría.",
        [{ text: "Entendido" }]
      );
      return;
    }

    setScanning(true);
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage:         "Autenticación — ParkSmart",
        fallbackLabel:         "Usar contraseña",
        disableDeviceFallback: false,
        cancelLabel:           "Cancelar",
      });

      console.log("[Bio] resultado autenticación:", res);

      if (res.success) {
        // Marcar como activada si no estaba
        if (savedUid && !tieneBiometriaActivada(savedUid)) {
          activarBiometriaLocal(savedUid);
        }
        await handleLogin(savedEmail, savedPass);

      } else if (res.error === "not_enrolled") {
        Alert.alert(
          "Sin biometría registrada",
          "Ve a Configuración del teléfono y registra tu huella o rostro primero."
        );

      } else if (
        res.error === "lockout" ||
        res.error === "lockout_permanent" ||
        res.error === "too_many_attempts"   // ← Android moderno
      ) {
        Alert.alert(
          "Bloqueado temporalmente",
          "Demasiados intentos fallidos. Usa tu contraseña para entrar."
        );

      } else if (res.error !== "user_cancel" && res.error !== "system_cancel") {
        Alert.alert("No autenticado", "Usa tu contraseña para entrar.");
      }

    } catch (e: any) {
      console.log("[Bio] error handleBiometric:", e);
      Alert.alert("Error", "No se pudo usar la biometría. Usa tu contraseña.");
    } finally {
      setScanning(false);
    }
  };

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  const ocupado = loading || scanning;

  return (
    <View style={styles.container}>

      {/* Logo */}
      <View style={styles.logoBox}>
        <Text style={styles.logoIcon}>🅿️</Text>
        <Text style={styles.titulo}>ParkSmart</Text>
        <Text style={styles.subtitulo}>Sistema de Estacionamiento</Text>
      </View>

      {/* Formulario */}
      <View style={styles.formBox}>

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!ocupado}
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!ocupado}
        />

        {/* Botón ingresar */}
        <TouchableOpacity
          style={[styles.btnIngresar, ocupado && styles.btnDeshabilitado]}
          onPress={() => handleLogin()}
          disabled={ocupado}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnIngresarText}>Ingresar</Text>
          }
        </TouchableOpacity>

        {/* Separador */}
        <View style={styles.separador}>
          <View style={styles.separadorLinea} />
          <Text style={styles.separadorTexto}>o</Text>
          <View style={styles.separadorLinea} />
        </View>

        {/* Botón biometría */}
        {bioDisponible ? (
          <TouchableOpacity
            style={[styles.btnBio, ocupado && styles.btnDeshabilitado]}
            onPress={handleBiometric}
            disabled={ocupado}
            activeOpacity={0.85}
          >
            {scanning ? (
              <ActivityIndicator color="#6d28d9" />
            ) : (
              <View style={styles.btnBioContent}>
                <Text style={styles.btnBioEmoji}>{bioEmoji}</Text>
                <View style={styles.btnBioTextos}>
                  <Text style={styles.btnBioTitulo}>{bioLabel}</Text>
                  <Text style={styles.btnBioSub}>
                    {credGuardadas
                      ? "Toca para entrar sin contraseña"
                      : "Inicia sesión primero para activarla"}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.bioNoDisp}>
            <Text style={styles.bioNoDispText}>
              🔒 Biometría no disponible en este dispositivo
            </Text>
          </View>
        )}

        {/* Enlace registro */}
        <TouchableOpacity
          style={styles.linkBox}
          onPress={() => router.push("/register")}
          disabled={ocupado}
        >
          <Text style={styles.link}>
            ¿No tienes cuenta? <Text style={styles.linkBold}>Regístrate</Text>
          </Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    padding: 24,
  },

  // Logo
  logoBox:   { alignItems: "center", marginBottom: 32 },
  logoIcon:  { fontSize: 60, marginBottom: 8 },
  titulo:    { fontSize: 32, fontWeight: "900", color: "#1d4ed8", letterSpacing: 1 },
  subtitulo: { fontSize: 13, color: "#6b7280", marginTop: 4 },

  // Card formulario
  formBox: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    elevation: 6,
    shadowColor: "#1d4ed8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },

  // Inputs
  input: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    padding: 14,
    marginBottom: 12,
    borderRadius: 12,
    fontSize: 15,
    color: "#111",
  },

  // Botón ingresar
  btnIngresar:     { backgroundColor: "#2563EB", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 4 },
  btnIngresarText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  // Separador "o"
  separador:       { flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 10 },
  separadorLinea:  { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  separadorTexto:  { color: "#9ca3af", fontSize: 13 },

  // Botón biometría
  btnBio:        { backgroundColor: "#f5f3ff", borderWidth: 1.5, borderColor: "#c4b5fd", borderRadius: 14, padding: 14 },
  btnBioContent: { flexDirection: "row", alignItems: "center", gap: 14 },
  btnBioEmoji:   { fontSize: 36 },
  btnBioTextos:  { flex: 1 },
  btnBioTitulo:  { fontSize: 15, fontWeight: "700", color: "#5b21b6" },
  btnBioSub:     { fontSize: 11, color: "#7c3aed", marginTop: 2 },

  // Sin biometría
  bioNoDisp:     { backgroundColor: "#f9fafb", borderRadius: 12, padding: 12, alignItems: "center" },
  bioNoDispText: { color: "#9ca3af", fontSize: 12 },

  // Deshabilitado
  btnDeshabilitado: { opacity: 0.55 },

  // Link registro
  linkBox:  { marginTop: 20, alignItems: "center" },
  link:     { color: "#6b7280", fontSize: 14 },
  linkBold: { color: "#2563EB", fontWeight: "700" },
});
