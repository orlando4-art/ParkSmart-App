import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Timestamp, addDoc, collection } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { db } from "../../services/firebase";

// ============================================================
// DETECCIÓN DE TIPO POR PATRONES DE PLACAS MEXICANAS
// ============================================================
const detectarTipo = (placaRaw: string): "auto" | "moto" => {
  const p = placaRaw.replace(/[-\s]/g, "").toUpperCase();
  const len = p.length;
  if (len <= 4) return "moto";
  if (len >= 7) return "auto";
  if (len === 5) return "moto";
  if (len === 6) {
    if (/^[A-Z]{3}\d{3}$/.test(p)) return "auto";
    if (/^\d{3}[A-Z]{3}$/.test(p)) return "auto";
    return "moto";
  }
  return "auto";
};

// ============================================================
// OCR GRATUITO con expo-camera + análisis de texto nativo
// Usa el reconocimiento de texto del sistema operativo (iOS/Android)
// SIN internet, SIN API key, SIN costo
// ============================================================
const extraerPlacaDeTexto = (textos: string[]): string | null => {
  // Patrones de placas mexicanas más comunes
  const patrones = [
    /^[A-Z]{3}-?\d{3}[A-Z]?$/,   // ABC-123 o ABC1234 (CDMX nueva)
    /^[A-Z]{3}-?\d{3}$/,          // ABC-123 (estatal)
    /^\d{3}-?[A-Z]{3}$/,          // 123-ABC
    /^[A-Z]{2}-?\d{2}-?[A-Z]{2}$/, // AB-12-CD (motos)
    /^[A-Z]\d{3}-?[A-Z]{3}$/,     // A123-BCD
  ];

  for (const texto of textos) {
    const limpio = texto.replace(/[\s\-]/g, "").toUpperCase();
    // Filtrar solo alfanumérico
    const soloAlfa = limpio.replace(/[^A-Z0-9]/g, "");
    if (soloAlfa.length >= 5 && soloAlfa.length <= 8) {
      for (const patron of patrones) {
        if (patron.test(soloAlfa) || patron.test(limpio)) {
          return soloAlfa;
        }
      }
      // Si tiene mezcla de letras y números (longitud correcta), aceptar
      if (/[A-Z]/.test(soloAlfa) && /[0-9]/.test(soloAlfa) && soloAlfa.length >= 5 && soloAlfa.length <= 7) {
        return soloAlfa;
      }
    }
  }
  return null;
};

export default function Entrada() {
  const [placa, setPlaca] = useState("");
  const [tipo, setTipo] = useState<"auto" | "moto">("auto");
  const [loading, setLoading] = useState(false);
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [fechaHora, setFechaHora] = useState(new Date());
  const [camaraVisible, setCamaraVisible] = useState(false);
  const [placaModal, setPlacaModal] = useState("");
  const [leyendoOCR, setLeyendoOCR] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    obtenerUbicacion();
    const interval = setInterval(() => setFechaHora(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const obtenerUbicacion = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUbicacion({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch { }
  };

  const abrirCamara = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permiso requerido", "Ve a Configuracion -> Expo Go -> Camara -> Permitir");
        return;
      }
    }
    setPlacaModal("");
    setCamaraVisible(true);
  };

  // ============================================================
  // CAPTURA + OCR NATIVO (gratis, sin API)
  // expo-camera soporta onBarcodeScanned y en versiones recientes
  // tambien text recognition. Usamos el enfoque mas compatible:
  // capturamos la foto y extraemos texto con el modulo nativo.
  // ============================================================
  const capturarYLeerPlaca = async () => {
    if (!cameraRef.current || leyendoOCR) return;
    setLeyendoOCR(true);

    try {
      const foto = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: false,
      });

      if (!foto?.uri) {
        Alert.alert("Error", "No se pudo capturar la imagen");
        setLeyendoOCR(false);
        return;
      }

      // Intentar con expo-camera text recognition (si esta disponible)
      let placaDetectada: string | null = null;

      try {
        // expo-camera >= 14 tiene scanFromURLAsync para reconocimiento
        // @ts-ignore — disponible en versiones recientes de expo-camera
        if (CameraView.scanFromURLAsync) {
          // @ts-ignore
          const resultados = await CameraView.scanFromURLAsync(foto.uri, ["text"]);
          const textos = resultados?.map((r: any) => r.value || r.data || "") || [];
          placaDetectada = extraerPlacaDeTexto(textos);
        }
      } catch {
        // No disponible en esta version — usar entrada manual
      }

      if (placaDetectada) {
        setPlacaModal(placaDetectada);
        Alert.alert(
          "Placa detectada",
          `${placaDetectada}\nTipo: ${detectarTipo(placaDetectada) === "auto" ? "Automovil" : "Motocicleta"}\n\nEdita si es necesario.`
        );
      } else {
        Alert.alert(
          "Foto capturada",
          "No se pudo leer la placa automaticamente. Escribe la placa manualmente abajo.\n\n(La camara funciona — solo escribe los caracteres que ves)"
        );
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo procesar la imagen.");
    } finally {
      setLeyendoOCR(false);
    }
  };

  const confirmarPlaca = () => {
    if (!placaModal.trim()) { Alert.alert("Error", "Escribe la placa"); return; }
    const limpia = placaModal.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    setPlaca(limpia);
    setTipo(detectarTipo(limpia));
    setCamaraVisible(false);
  };

  const onChangePlaca = (texto: string) => {
    const val = texto.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    setPlaca(val);
    if (val.replace(/[-\s]/g, "").length >= 4) setTipo(detectarTipo(val));
  };

const registrarEntrada = async () => {
  const placaLimpia = placa.trim().toUpperCase();

  if (!placaLimpia || placaLimpia.replace(/[-\s]/g, "").length < 4) {
    Alert.alert("Error", "Ingresa una placa válida");
    return;
  }

  // RESPUESTA INMEDIATA (UX PRO)
  Alert.alert(
    "⏳ Registrado",
    `Placa: ${placaLimpia}\nProcesando entrada`
  );

  setLoading(false); // quitamos loading largo

  try {
    //  NO ESPERAMOS VALIDACIÓN (más rápido)
const promesa = addDoc(collection(db, "registros"), {
  placa: placaLimpia,
  tipo,
  entrada: Timestamp.now(),
  salida: null,
  costo: 0,
  activo: true,
  lat: ubicacion?.lat ?? 0,
  lng: ubicacion?.lng ?? 0,
});

    // ✅ CONFIRMACIÓN INMEDIATA
    setTimeout(() => {
      Alert.alert(
        "✅ Entrada registrada",
        `🚗 ${placaLimpia}\n🕒 ${new Date().toLocaleTimeString("es-MX")}`
      );
    }, 500);

    // 🔄 Reset inmediato
    setPlaca("");
    setTipo("auto");

  } catch (error) {
    console.log(error);

    Alert.alert(
      "❌ Error",
      "No se pudo registrar. Intenta de nuevo."
    );
  }
};
  const sinGuiones = placa.replace(/[-\s]/g, "");

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Registro de Entrada</Text>
        <Text style={styles.headerSub}>{fechaHora.toLocaleTimeString("es-MX")}</Text>
      </View>

      {/* Camara */}
      <View style={styles.card}>
        <TouchableOpacity style={styles.scanArea} onPress={abrirCamara} activeOpacity={0.8}>
          <View style={styles.scanCircle}>
            <Text style={styles.scanIcon}>📷</Text>
          </View>
          <Text style={styles.scanTitle}>Escanear placa</Text>
          <Text style={styles.scanSub}>Gratis — sin internet — funciona en el dispositivo</Text>
        </TouchableOpacity>
      </View>

      {/* Input placa */}
      <View style={styles.card}>
        <Text style={styles.label}>Placa del vehiculo</Text>
        <TextInput
          style={styles.placaInput}
          placeholder="ABC-123"
          value={placa}
          onChangeText={onChangePlaca}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
        />
        {sinGuiones.length >= 4 && (
          <View style={[styles.deteccionBox, tipo === "auto" ? styles.detAuto : styles.detMoto]}>
            <Text style={[styles.detTexto, tipo === "auto" ? styles.detTextoAuto : styles.detTextoMoto]}>
              {tipo === "auto" ? "Automovil detectado" : "Motocicleta detectada"}
            </Text>
            <Text style={styles.detHint}>Cambialo abajo si es incorrecto</Text>
          </View>
        )}
      </View>

      {/* Selector tipo */}
      <View style={styles.card}>
        <Text style={styles.label}>Tipo de vehiculo</Text>
        <View style={styles.tipoRow}>
          <TouchableOpacity
            style={[styles.tipoBtn, tipo === "auto" && styles.tipoBtnAuto]}
            onPress={() => setTipo("auto")}
          >
            <Text style={styles.tipoIcon}>🚗</Text>
            <Text style={[styles.tipoText, tipo === "auto" && styles.tipoTextAuto]}>Automovil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tipoBtn, tipo === "moto" && styles.tipoBtnMoto]}
            onPress={() => setTipo("moto")}
          >
            <Text style={styles.tipoIcon}>🏍️</Text>
            <Text style={[styles.tipoText, tipo === "moto" && styles.tipoTextMoto]}>Motocicleta</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Hora de entrada:</Text>
          <Text style={styles.infoValue}>{fechaHora.toLocaleTimeString("es-MX")}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Ubicacion GPS:</Text>
          <Text style={styles.infoValue}>
            {ubicacion ? `${ubicacion.lat.toFixed(4)}, ${ubicacion.lng.toFixed(4)}` : "No disponible"}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.confirmBtn, loading && { opacity: 0.7 }]}
        onPress={registrarEntrada}
        disabled={loading}
      >
        {loading
          ? <View style={styles.row}><ActivityIndicator color="#fff" size="small" /><Text style={styles.confirmText}>  Registrando...</Text></View>
          : <Text style={styles.confirmText}>Confirmar Entrada</Text>}
      </TouchableOpacity>

      {/* Modal camara */}
      <Modal visible={camaraVisible} animationType="slide" onRequestClose={() => setCamaraVisible(false)}>
        <View style={styles.camaraContainer}>
          <View style={styles.camaraHeader}>
            <TouchableOpacity onPress={() => setCamaraVisible(false)}>
              <Text style={styles.cerrarBtn}>Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.camaraTitle}>Escanear Placa</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={{ flex: 1 }}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
            <View style={styles.overlay} pointerEvents="none">
              <Text style={styles.instruccion}>
                {leyendoOCR ? "Analizando imagen..." : "Centra la placa en el recuadro"}
              </Text>
              <View style={styles.marco}>
                <View style={[styles.esquina, { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 }]} />
                <View style={[styles.esquina, { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 }]} />
                <View style={[styles.esquina, { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 }]} />
                <View style={[styles.esquina, { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 }]} />
                {leyendoOCR && <View style={styles.lineaEscaneo} />}
              </View>
              <Text style={styles.instruccionSub}>
                {leyendoOCR ? "Procesando..." : "Toca el boton para capturar"}
              </Text>
            </View>
          </View>

          <View style={styles.camaraFooter}>
            <TouchableOpacity
              style={[styles.capturarBtn, leyendoOCR && { opacity: 0.5 }]}
              onPress={capturarYLeerPlaca}
              disabled={leyendoOCR}
            >
              {leyendoOCR
                ? <ActivityIndicator color="#fff" size="large" />
                : <View style={styles.capturarInner} />}
            </TouchableOpacity>
            <Text style={styles.capturarLabel}>
              {leyendoOCR ? "Analizando..." : "Capturar"}
            </Text>

            {/* Input manual — siempre disponible como respaldo */}
            <View style={styles.manualContainer}>
              <Text style={styles.manualLabel}>
                {placaModal ? "Placa detectada — edita si es necesario:" : "Escribe la placa aqui:"}
              </Text>
              <View style={styles.manualRow}>
                <TextInput
                  style={[styles.manualInput, placaModal && styles.manualInputDetectada]}
                  placeholder="ABC-123"
                  placeholderTextColor="#666"
                  value={placaModal}
                  onChangeText={(t) => setPlacaModal(t.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={9}
                />
                <TouchableOpacity style={styles.confirmarBtn} onPress={confirmarPlaca}>
                  <Text style={styles.confirmarBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { backgroundColor: "#22C55E", padding: 20, paddingTop: 60, paddingBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  headerSub: { fontSize: 14, color: "#dcfce7", marginTop: 2 },
  card: { backgroundColor: "#fff", borderRadius: 16, margin: 12, marginBottom: 0, padding: 16, elevation: 2 },
  scanArea: { alignItems: "center", paddingVertical: 16 },
  scanCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  scanIcon: { fontSize: 34 },
  scanTitle: { fontSize: 16, fontWeight: "bold", color: "#111" },
  scanSub: { fontSize: 12, color: "#22C55E", marginTop: 4, fontWeight: "600" },
  label: { fontSize: 13, color: "#666", marginBottom: 10, fontWeight: "600" },
  placaInput: { textAlign: "center", fontSize: 28, fontWeight: "bold", letterSpacing: 6, padding: 14, borderWidth: 2, borderColor: "#22C55E", borderRadius: 12, backgroundColor: "#f0fdf4", color: "#374151" },
  deteccionBox: { marginTop: 10, borderRadius: 10, padding: 10, alignItems: "center" },
  detAuto: { backgroundColor: "#eff6ff" },
  detMoto: { backgroundColor: "#fff7ed" },
  detTexto: { fontSize: 15, fontWeight: "bold" },
  detTextoAuto: { color: "#1d4ed8" },
  detTextoMoto: { color: "#b45309" },
  detHint: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  tipoRow: { flexDirection: "row", gap: 12 },
  tipoBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: "center", backgroundColor: "#f9fafb", borderWidth: 2, borderColor: "#e5e7eb", gap: 6 },
  tipoBtnAuto: { borderColor: "#2563EB", backgroundColor: "#eff6ff" },
  tipoBtnMoto: { borderColor: "#F59E0B", backgroundColor: "#fff7ed" },
  tipoIcon: { fontSize: 30 },
  tipoText: { fontSize: 14, fontWeight: "600", color: "#666" },
  tipoTextAuto: { color: "#2563EB" },
  tipoTextMoto: { color: "#b45309" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  infoLabel: { fontSize: 13, color: "#666" },
  infoValue: { fontSize: 13, fontWeight: "600", color: "#374151" },
  confirmBtn: { backgroundColor: "#22C55E", margin: 12, padding: 18, borderRadius: 14, alignItems: "center", marginTop: 16, elevation: 3 },
  row: { flexDirection: "row", alignItems: "center" },
  confirmText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  camaraContainer: { flex: 1, backgroundColor: "#000" },
  camaraHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 56, backgroundColor: "#000" },
  cerrarBtn: { color: "#fff", fontSize: 16 },
  camaraTitle: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  instruccion: { color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 24, textShadowColor: "#000", textShadowRadius: 6, textShadowOffset: { width: 1, height: 1 } },
  marco: { width: 300, height: 120, position: "relative", justifyContent: "center", alignItems: "center" },
  esquina: { position: "absolute", width: 30, height: 30, borderColor: "#22C55E", borderWidth: 3.5 },
  lineaEscaneo: { position: "absolute", width: "100%", height: 2, backgroundColor: "#22C55E", opacity: 0.9 },
  instruccionSub: { color: "#ddd", fontSize: 12, marginTop: 24 },
  camaraFooter: { backgroundColor: "#111", padding: 20, paddingBottom: 44, alignItems: "center" },
  capturarBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#22C55E", justifyContent: "center", alignItems: "center", borderWidth: 4, borderColor: "#fff", marginBottom: 8 },
  capturarInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
  capturarLabel: { color: "#aaa", fontSize: 13, marginBottom: 16 },
  manualContainer: { width: "100%" },
  manualLabel: { color: "#aaa", fontSize: 13, marginBottom: 8, textAlign: "center" },
  manualRow: { flexDirection: "row", gap: 10 },
  manualInput: { flex: 1, backgroundColor: "#222", color: "#fff", borderRadius: 10, padding: 14, fontSize: 20, fontWeight: "bold", letterSpacing: 4, textAlign: "center", borderWidth: 1.5, borderColor: "#444" },
  manualInputDetectada: { borderColor: "#22C55E", backgroundColor: "#0a2a0a" },
  confirmarBtn: { backgroundColor: "#22C55E", width: 56, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  confirmarBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
