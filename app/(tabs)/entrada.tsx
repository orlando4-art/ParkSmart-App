import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Timestamp, addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { db } from "../../services/firebase";

// ⚠️ Reemplaza con tu API Key de Google Cloud Vision
const GOOGLE_VISION_API_KEY = "AIzaSyCyktREmIeZ2twhyHNDo2gZjfzGHnLATRE";
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

export default function Entrada() {
  const [placa, setPlaca] = useState("");
  const [tipo, setTipo] = useState<"auto" | "moto">("auto");
  const [loading, setLoading] = useState(false);
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [fechaHora, setFechaHora] = useState(new Date());
  const [camaraVisible, setCamaraVisible] = useState(false);
  const [leyendoOCR, setLeyendoOCR] = useState(false);
  const [placaModal, setPlacaModal] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    obtenerUbicacion();
    const interval = setInterval(() => setFechaHora(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const obtenerUbicacion = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({});
    setUbicacion({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  };

  const abrirCamara = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Permiso requerido",
          "Ve a Configuración → Expo Go → Permisos → Cámara → Permitir"
        );
        return;
      }
    }
    setPlacaModal("");
    setCamaraVisible(true);
  };

  // Extrae la placa del texto detectado por OCR
  const extraerPlaca = (textoCompleto: string): string => {
    // Limpia el texto
    const texto = textoCompleto.toUpperCase().replace(/\s+/g, " ").trim();
    const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);

    // Patrones comunes de placas mexicanas:
    // ABC-123, ABC 123, ABC123, AB-1234, etc.
    const patrones = [
      /[A-Z]{3}[-\s]?\d{3}/,   // ABC-123 o ABC123
      /[A-Z]{2}[-\s]?\d{4}/,   // AB-1234
      /[A-Z]{3}[-\s]?\d{2}[-\s]?[A-Z]/,  // ABC-12-D
      /\d{3}[-\s]?[A-Z]{3}/,   // 123-ABC
    ];

    for (const linea of lineas) {
      for (const patron of patrones) {
        const match = linea.match(patron);
        if (match) {
          return match[0].replace(/\s/g, "-").toUpperCase();
        }
      }
    }

    // Si no encuentra patrón exacto, devuelve la línea más corta
    // que tenga mezcla de letras y números
    const candidatas = lineas.filter(
      (l) => l.length >= 5 && l.length <= 10 && /[A-Z]/.test(l) && /\d/.test(l)
    );
    return candidatas[0] || "";
  };

  const capturarYLeerPlaca = async () => {
    if (!cameraRef.current || leyendoOCR) return;
    setLeyendoOCR(true);

    try {
      // 1. Toma la foto
      const foto = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: true,
      });

      if (!foto?.base64) {
        Alert.alert("Error", "No se pudo capturar la imagen");
        return;
      }

      // 2. Manda la imagen a Google Vision API
      const response = await fetch(VISION_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: foto.base64 },
              features: [
                { type: "TEXT_DETECTION", maxResults: 10 },
              ],
            },
          ],
        }),
      });

      const data = await response.json();

      // 3. Extrae el texto detectado
      const textoDetectado =
        data?.responses?.[0]?.fullTextAnnotation?.text || "";

      if (!textoDetectado) {
        Alert.alert(
          "No se detectó texto",
          "Asegúrate de que la placa sea visible y tenga buena iluminación."
        );
        setLeyendoOCR(false);
        return;
      }

      // 4. Filtra para encontrar la placa
      const placaDetectada = extraerPlaca(textoDetectado);

      if (placaDetectada) {
        // ¡Placa encontrada automáticamente!
        setPlacaModal(placaDetectada);
        Alert.alert(
          "✅ Placa detectada",
          `Se detectó: ${placaDetectada}\n\n¿Es correcta? Puedes editarla si es necesario.`
        );
      } else {
        // Muestra todo el texto para que el usuario elija
        setPlacaModal("");
        Alert.alert(
          "Texto detectado",
          `Se encontró:\n${textoDetectado}\n\nEscribe la placa manualmente.`
        );
      }
    } catch (error) {
      Alert.alert(
        "Error de conexión",
        "No se pudo conectar con el servicio OCR. Verifica tu API Key e internet."
      );
    } finally {
      setLeyendoOCR(false);
    }
  };

  const confirmarPlaca = () => {
    if (!placaModal.trim()) {
      Alert.alert("Error", "Escribe la placa del vehículo");
      return;
    }
    setPlaca(placaModal.trim().toUpperCase());
    setCamaraVisible(false);
  };

  const registrarEntrada = async () => {
    const placaLimpia = placa.trim().toUpperCase();
    if (!placaLimpia) {
      Alert.alert("Error", "Ingresa la placa del vehículo");
      return;
    }
    setLoading(true);
    try {
      const q = query(
        collection(db, "registros"),
        where("placa", "==", placaLimpia),
        where("activo", "==", true)
      );
      const existe = await getDocs(q);
      if (!existe.empty) {
        Alert.alert("Aviso", `La placa ${placaLimpia} ya tiene entrada activa`);
        return;
      }

      await addDoc(collection(db, "registros"), {
        placa: placaLimpia,
        tipo,
        entrada: Timestamp.now(),
        salida: null,
        costo: 0,
        activo: true,
        lat: ubicacion?.lat || 0,
        lng: ubicacion?.lng || 0,
      });

      Alert.alert("✅ Entrada registrada", `Placa: ${placaLimpia}\nTipo: ${tipo}`);
      setPlaca("");
      setTipo("auto");
    } catch (error) {
      Alert.alert("Error", "No se pudo registrar la entrada.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Registro de Entrada</Text>
        <Text style={styles.headerSub}>Capturar datos del vehículo</Text>
      </View>

      {/* Botón abrir cámara */}
      <View style={styles.card}>
        <TouchableOpacity style={styles.scanArea} onPress={abrirCamara}>
          <View style={styles.scanCircle}>
            <Text style={styles.scanIcon}>📷</Text>
          </View>
          <Text style={styles.scanTitle}>Escanear Placa</Text>
          <Text style={styles.scanSub}>Toca para activar la cámara</Text>
        </TouchableOpacity>
      </View>

      {/* Campo placa */}
      <View style={styles.card}>
        <Text style={styles.label}>Placa detectada / manual</Text>
        <TextInput
          style={styles.placaInput}
          placeholder="ABC-123"
          value={placa}
          onChangeText={(t) => setPlaca(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>

      {/* Tipo */}
      <View style={styles.card}>
        <Text style={styles.label}>Tipo de vehículo</Text>
        <View style={styles.tipoRow}>
          <TouchableOpacity
            style={[styles.tipoBtn, tipo === "auto" && styles.tipoBtnActive]}
            onPress={() => setTipo("auto")}
          >
            <Text style={styles.tipoIcon}>🚗</Text>
            <Text style={[styles.tipoText, tipo === "auto" && styles.tipoTextActive]}>Auto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tipoBtn, tipo === "moto" && styles.tipoBtnActive]}
            onPress={() => setTipo("moto")}
          >
            <Text style={styles.tipoIcon}>🏍️</Text>
            <Text style={[styles.tipoText, tipo === "moto" && styles.tipoTextActive]}>Moto</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Fecha y GPS */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Fecha y hora:</Text>
          <Text style={styles.infoValue}>
            {fechaHora.toLocaleDateString("es-MX")}{" "}
            {fechaHora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📍 Ubicación GPS:</Text>
          <Text style={styles.infoValue}>
            {ubicacion
              ? `${ubicacion.lat.toFixed(4)}, ${ubicacion.lng.toFixed(4)}`
              : "Obteniendo..."}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.confirmBtn, loading && { opacity: 0.7 }]}
        onPress={registrarEntrada}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.confirmText}>Confirmar Entrada</Text>
        )}
      </TouchableOpacity>

      {/* ─── Modal cámara + OCR ─── */}
      <Modal
        visible={camaraVisible}
        animationType="slide"
        onRequestClose={() => setCamaraVisible(false)}
      >
        <View style={styles.camaraContainer}>
          {/* Header */}
          <View style={styles.camaraHeader}>
            <TouchableOpacity onPress={() => setCamaraVisible(false)}>
              <Text style={styles.cerrarBtn}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.camaraTitle}>Escanear Placa</Text>
            <View style={{ width: 70 }} />
          </View>

          {/* Cámara */}
          <CameraView ref={cameraRef} style={styles.camara} facing="back">
            <View style={styles.overlay}>
              <Text style={styles.instruccion}>
                {leyendoOCR ? "Analizando imagen..." : "Enfoca la placa del vehículo"}
              </Text>

              {/* Marco */}
              <View style={styles.marco}>
                <View style={[styles.esquina, { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 }]} />
                <View style={[styles.esquina, { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 }]} />
                <View style={[styles.esquina, { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 }]} />
                <View style={[styles.esquina, { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 }]} />

                {/* Línea de escaneo */}
                {leyendoOCR && <View style={styles.lineaEscaneo} />}
              </View>

              <Text style={styles.instruccionSub}>
                {leyendoOCR
                  ? "⏳ Procesando con IA..."
                  : "Toca el botón para capturar y leer"}
              </Text>
            </View>
          </CameraView>

          {/* Footer */}
          <View style={styles.camaraFooter}>
            {/* Botón capturar */}
            <TouchableOpacity
              style={[styles.capturarBtn, leyendoOCR && { opacity: 0.5 }]}
              onPress={capturarYLeerPlaca}
              disabled={leyendoOCR}
            >
              {leyendoOCR ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <View style={styles.capturarInner} />
              )}
            </TouchableOpacity>
            <Text style={styles.capturarLabel}>
              {leyendoOCR ? "Leyendo placa..." : "Capturar y leer"}
            </Text>

            {/* Input manual */}
            <View style={styles.manualContainer}>
              <Text style={styles.manualLabel}>
                {placaModal
                  ? "✅ Placa detectada — edita si es necesario:"
                  : "O escribe la placa manualmente:"}
              </Text>
              <View style={styles.manualRow}>
                <TextInput
                  style={[
                    styles.manualInput,
                    placaModal ? styles.manualInputDetectada : {},
                  ]}
                  placeholder="ABC-123"
                  placeholderTextColor="#666"
                  value={placaModal}
                  onChangeText={(t) => setPlacaModal(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.confirmarBtn}
                  onPress={confirmarPlaca}
                >
                  <Text style={styles.confirmarBtnText}>✓</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { backgroundColor: "#22C55E", padding: 20, paddingTop: 60, paddingBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  headerSub: { fontSize: 14, color: "#dcfce7", marginTop: 2 },
  card: { backgroundColor: "#fff", borderRadius: 12, margin: 12, marginBottom: 0, padding: 16, elevation: 1 },
  scanArea: { alignItems: "center", paddingVertical: 20 },
  scanCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  scanIcon: { fontSize: 30 },
  scanTitle: { fontSize: 16, fontWeight: "bold", color: "#111" },
  scanSub: { fontSize: 12, color: "#888", marginTop: 4 },
  label: { fontSize: 13, color: "#666", marginBottom: 10, fontWeight: "600" },
  placaInput: { textAlign: "center", fontSize: 22, fontWeight: "bold", letterSpacing: 4, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, backgroundColor: "#f9fafb", color: "#374151" },
  tipoRow: { flexDirection: "row", gap: 12 },
  tipoBtn: { flex: 1, padding: 16, borderRadius: 10, alignItems: "center", backgroundColor: "#f9fafb", borderWidth: 2, borderColor: "#e5e7eb", gap: 6 },
  tipoBtnActive: { borderColor: "#22C55E", backgroundColor: "#f0fdf4" },
  tipoIcon: { fontSize: 28 },
  tipoText: { fontSize: 14, fontWeight: "600", color: "#666" },
  tipoTextActive: { color: "#22C55E" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: "#666" },
  infoValue: { fontSize: 13, fontWeight: "600", color: "#374151" },
  confirmBtn: { backgroundColor: "#22C55E", margin: 12, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 16, marginBottom: 40 },
  confirmText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  // Cámara
  camaraContainer: { flex: 1, backgroundColor: "#000" },
  camaraHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 60, backgroundColor: "#000" },
  cerrarBtn: { color: "#fff", fontSize: 16 },
  camaraTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  camara: { flex: 1 },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  instruccion: { color: "#fff", fontSize: 15, fontWeight: "600", marginBottom: 24, textShadowColor: "#000", textShadowRadius: 6, textShadowOffset: { width: 1, height: 1 } },
  marco: { width: 290, height: 110, position: "relative", justifyContent: "center", alignItems: "center" },
  esquina: { position: "absolute", width: 28, height: 28, borderColor: "#22C55E", borderWidth: 3 },
  lineaEscaneo: { position: "absolute", width: "100%", height: 2, backgroundColor: "#22C55E", opacity: 0.9 },
  instruccionSub: { color: "#ddd", fontSize: 13, marginTop: 24 },
  camaraFooter: { backgroundColor: "#111", padding: 20, paddingBottom: 40, alignItems: "center" },
  capturarBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#22C55E", justifyContent: "center", alignItems: "center", borderWidth: 4, borderColor: "#fff", marginBottom: 8 },
  capturarInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff" },
  capturarLabel: { color: "#aaa", fontSize: 13, marginBottom: 20 },
  manualContainer: { width: "100%" },
  manualLabel: { color: "#aaa", fontSize: 13, marginBottom: 8, textAlign: "center" },
  manualRow: { flexDirection: "row", gap: 10 },
  manualInput: { flex: 1, backgroundColor: "#222", color: "#fff", borderRadius: 10, padding: 14, fontSize: 20, fontWeight: "bold", letterSpacing: 4, textAlign: "center", borderWidth: 1, borderColor: "#444" },
  manualInputDetectada: { borderColor: "#22C55E", backgroundColor: "#0a2a0a" },
  confirmarBtn: { backgroundColor: "#22C55E", width: 54, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  confirmarBtnText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
});