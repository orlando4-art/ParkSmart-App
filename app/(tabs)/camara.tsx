/**
 * camara.tsx — Registro de entrada por VOZ + teclado
 * ✅ Reconocimiento de voz real (expo-speech-recognition) — APK
 * ✅ Teclado de respaldo si la voz falla
 * ✅ Tarifa sincronizada en tiempo real desde Firestore
 * ✅ Confirmar entrada funciona correctamente (con timeout y fallback)
 * ✅ Sin crashes por listeners sin limpiar
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import {
  addDoc, collection, doc, onSnapshot, serverTimestamp
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TouchableOpacity, Vibration, View,
} from "react-native";
import { guardarConfig, guardarRegistroLocal, obtenerConfig } from "../../services/database";
import { db } from "../../services/firebase";

// ─────────────────────────────────────────────
// Helpers de placa
// ─────────────────────────────────────────────
const FORMATOS = [
  { label: "ABC-123-A", regex: /^[A-Z]{3}\d{3}[A-Z]$/ },
  { label: "ABC-123",   regex: /^[A-Z]{3}\d{3}$/ },
  { label: "123-ABC",   regex: /^\d{3}[A-Z]{3}$/ },
  { label: "AB-1234",   regex: /^[A-Z]{2}\d{4}$/ },
];

const formatearPlaca = (raw: string): string => {
  const t = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{3}\d{3}[A-Z]$/.test(t)) return `${t.slice(0,3)}-${t.slice(3,6)}-${t.slice(6)}`;
  if (/^[A-Z]{3}\d{3}$/.test(t))       return `${t.slice(0,3)}-${t.slice(3,6)}`;
  if (/^\d{3}[A-Z]{3}$/.test(t))       return `${t.slice(0,3)}-${t.slice(3,6)}`;
  if (/^[A-Z]{2}\d{4}$/.test(t))       return `${t.slice(0,2)}-${t.slice(2,6)}`;
  return t;
};

const detectarTipo = (raw: string): string => {
  const t = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{3}\d{3}[A-Z]$/.test(t)) return "🚗 Automóvil (formato actual)";
  if (/^[A-Z]{3}\d{3}$/.test(t))       return "🚗 Automóvil";
  if (/^\d{3}[A-Z]{3}$/.test(t))       return "🚗 Automóvil (antiguo)";
  if (/^[A-Z]{2}\d{4}$/.test(t))       return "🏍️ Motocicleta";
  return "";
};

const placaValida = (raw: string): boolean => {
  const t = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return FORMATOS.some(f => f.regex.test(t));
};

const extraerPlacaDeVoz = (texto: string): string => {
  const t = texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(CERO|UNO|DOS|TRES|CUATRO|CINCO|SEIS|SIETE|OCHO|NUEVE)\b/g, (m) =>
      ({CERO:"0",UNO:"1",DOS:"2",TRES:"3",CUATRO:"4",
        CINCO:"5",SEIS:"6",SIETE:"7",OCHO:"8",NUEVE:"9"}[m] ?? ""))
    .replace(/\b(LA|EL|ES|UN|MI|DE|PLACA|LETRA|NUMERO|MATRICULA)\b/g, "")
    .replace(/\s+/g, " ").trim();

  const directos = [
    /\b([A-Z]{3}[-\s]?\d{3}[-\s]?[A-Z])\b/,
    /\b([A-Z]{3}[-\s]?\d{3})\b/,
    /\b(\d{3}[-\s]?[A-Z]{3})\b/,
    /\b([A-Z]{2}[-\s]?\d{4})\b/,
  ];
  for (const p of directos) {
    const m = t.match(p);
    if (m) return m[1].replace(/[\s-]/g, "");
  }
  const tokens = t.split(/\s+/).filter(tok => /^[A-Z0-9]$/.test(tok));
  if (tokens.length >= 5) return tokens.join("").substring(0, 7);
  return "";
};

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
export default function CamaraIA() {
  const [modoVoz, setModoVoz]       = useState(true);
  const [escuchando, setEscuchando] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [rawInput, setRawInput]     = useState("");
  const [placa, setPlaca]           = useState("");
  const [tipo, setTipo]             = useState("");
  const [guardando, setGuardando]   = useState(false);
  const [historial, setHistorial]   = useState<string[]>([]);
  const [tarifa, setTarifa]         = useState(20);

  const unsubRef = useRef<(() => void) | null>(null);

  // ── Tarifa en tiempo real ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "configuracion", "general"),
      (snap) => {
        if (snap.exists()) {
          const t = Number(snap.data().tarifaPorHora);
          if (!isNaN(t) && t > 0) {
            setTarifa(t);
            guardarConfig("tarifaPorHora", String(t));
          }
        }
      },
      () => {
        const local = Number(obtenerConfig("tarifaPorHora", "20"));
        if (!isNaN(local) && local > 0) setTarifa(local);
      }
    );
    unsubRef.current = unsub;
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  // ── Eventos de voz ────────────────────────────────────────────────────────
  useSpeechRecognitionEvent("result", (event) => {
    const texto = event.results[0]?.transcript ?? "";
    setTranscript(texto);
    const raw = extraerPlacaDeVoz(texto);
    if (raw) {
      setRawInput(raw);
      setPlaca(formatearPlaca(raw));
      setTipo(detectarTipo(raw));
      Vibration.vibrate(80);
    }
  });

  useSpeechRecognitionEvent("end", () => setEscuchando(false));

  useSpeechRecognitionEvent("error", (event) => {
    setEscuchando(false);
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      Alert.alert("Permiso denegado", "Ve a Ajustes → ParkSmart → Micrófono y actívalo.");
    } else if (event.error === "no-speech") {
      Alert.alert("Sin voz detectada", "No se escuchó nada. Intenta de nuevo o usa el teclado.");
    } else if (event.error !== "aborted") {
      setModoVoz(false);
      Alert.alert("Voz no disponible", "Cambiando al teclado.");
    }
  });

  // ── Voz: iniciar / detener ─────────────────────────────────────────────────
  const toggleVoz = async () => {
    if (escuchando) {
      ExpoSpeechRecognitionModule.stop();
      setEscuchando(false);
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert("Permiso requerido", "Ve a Ajustes → ParkSmart → Micrófono.");
      return;
    }
    limpiar();
    ExpoSpeechRecognitionModule.start({
      lang: "es-MX", interimResults: true, continuous: false,
      volumeChangeEventOptions: { enabled: false },
    });
    setEscuchando(true);
  };

  // ── Teclado personalizado ──────────────────────────────────────────────────
  const teclas = [
    ["A","B","C","D","E","F","G"],
    ["H","I","J","K","L","M","N"],
    ["O","P","Q","R","S","T","U"],
    ["V","W","X","Y","Z","⌫",""],
    ["1","2","3","4","5","6","7"],
    ["8","9","0","","","",""],
  ];

  const presionarTecla = (tecla: string) => {
    if (tecla === "⌫") actualizarRaw(rawInput.slice(0, -1));
    else if (tecla !== "") actualizarRaw(rawInput + tecla);
  };

  const actualizarRaw = (txt: string) => {
    const limpio = txt.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
    setRawInput(limpio);
    setPlaca(formatearPlaca(limpio));
    setTipo(detectarTipo(limpio));
    if (placaValida(limpio)) Vibration.vibrate(40);
  };

  // ── Confirmar entrada → Firebase ───────────────────────────────────────────
  const confirmarEntrada = async () => {
    if (!placaValida(rawInput)) {
      Alert.alert(
        "Placa inválida",
        "Formatos válidos:\n• ABC-123-A (auto actual)\n• ABC-123 (auto)\n• AB-1234 (moto)"
      );
      return;
    }

    setGuardando(true);

    // Timeout de seguridad — si Firebase tarda más de 10s, guardar local
    const timeoutId = setTimeout(() => {
      setGuardando(false);
      // Guardar localmente como respaldo
      const id = `local_${Date.now()}`;
      guardarRegistroLocal({
        id,
        placa: placa.trim().toUpperCase(),
        tipo:  tipo || "🚙 Vehículo",
        entrada: new Date().toISOString(),
        salida: null,
        costo: 0,
        activo: true,
      });
      setHistorial(prev => [
        `⚠️ ${placa} · ${tipo} · ${new Date().toLocaleTimeString("es-MX")} (local)`,
        ...prev.slice(0, 4),
      ]);
      Alert.alert(
        "⚠️ Guardado localmente",
        `Placa: ${placa}\nSin conexión — se sincronizará con internet.`,
        [{ text: "OK", onPress: limpiar }]
      );
    }, 10000);

    try {
      const operador = (await AsyncStorage.getItem("saved_uid")) ?? "desconocido";

      await addDoc(collection(db, "registros"), {
        placa:    placa.trim().toUpperCase(),
        tipo:     tipo || "🚙 Vehículo",
        entrada:  serverTimestamp(),
        activo:   true,
        operador,
        metodo:   modoVoz ? "voz" : "teclado",
        tarifa,
      });

      clearTimeout(timeoutId);
      setGuardando(false);
      Vibration.vibrate([80, 40, 80]);

      setHistorial(prev => [
        `✅ ${placa} · ${tipo} · ${new Date().toLocaleTimeString("es-MX")}`,
        ...prev.slice(0, 4),
      ]);

      Alert.alert(
        "✅ Entrada registrada",
        `Placa: ${placa}\n${tipo}\nTarifa: $${tarifa}/hora`,
        [{ text: "Nueva entrada", onPress: limpiar }]
      );

    } catch (e: any) {
      clearTimeout(timeoutId);
      setGuardando(false);
      console.log("[Firebase] error:", e?.message);

      // Guardar localmente si falla Firebase
      const id = `local_${Date.now()}`;
      guardarRegistroLocal({
        id,
        placa: placa.trim().toUpperCase(),
        tipo:  tipo || "🚙 Vehículo",
        entrada: new Date().toISOString(),
        salida: null,
        costo: 0,
        activo: true,
      });

      setHistorial(prev => [
        `⚠️ ${placa} · ${tipo} · ${new Date().toLocaleTimeString("es-MX")} (local)`,
        ...prev.slice(0, 4),
      ]);

      Alert.alert(
        "⚠️ Sin conexión",
        `Entrada guardada localmente.\nSe sincronizará cuando haya internet.`,
        [{ text: "OK", onPress: limpiar }]
      );
    }
  };

  const limpiar = () => {
    setRawInput(""); setPlaca(""); setTipo(""); setTranscript("");
  };

  const valida   = placaValida(rawInput);
  const maxLen   = tipo.includes("Moto") ? 6 : 7;
  const progreso = Math.min(rawInput.length / Math.max(maxLen, 1), 1);

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header con tarifa en tiempo real */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🚗 Registrar Entrada</Text>
          <Text style={styles.headerSub}>
            Tarifa vigente: <Text style={styles.tarifaDestacada}>${tarifa} MXN/hora</Text>
          </Text>
        </View>
        <TouchableOpacity
          style={styles.modoBtn}
          onPress={() => { setModoVoz(!modoVoz); limpiar(); }}
        >
          <Text style={styles.modoBtnText}>{modoVoz ? "⌨️" : "🎤"}</Text>
        </TouchableOpacity>
      </View>

      {/* Display de placa */}
      <View style={[styles.displayCard, valida && styles.displayCardValida]}>
        <Text style={styles.displayLabel}>PLACA</Text>
        <Text style={[styles.displayPlaca, valida && styles.displayPlacaValida]}>
          {placa || "———"}
        </Text>
        <View style={styles.progresoBarra}>
          <View style={[
            styles.progresoRelleno,
            { width: `${progreso * 100}%` as any },
            valida && { backgroundColor: "#16a34a" },
          ]} />
        </View>
        {!!tipo
          ? <View style={[styles.tipoBadge, valida && styles.tipoBadgeValida]}>
              <Text style={[styles.tipoTexto, valida && styles.tipoTextoValida]}>{tipo}</Text>
            </View>
          : <Text style={styles.tipoPlaceholder}>
              {modoVoz ? "Toca el micrófono y dicta la placa" : "Usa el teclado para ingresar la placa"}
            </Text>
        }
      </View>

      {/* ── MODO VOZ ── */}
      {modoVoz && (
        <View style={styles.vozBox}>
          <TouchableOpacity
            style={[styles.micBtn, escuchando && styles.micBtnActivo]}
            onPress={toggleVoz}
            disabled={guardando}
            activeOpacity={0.8}
          >
            <Text style={styles.micEmoji}>{escuchando ? "🔴" : "🎤"}</Text>
            <Text style={styles.micLabel}>
              {escuchando ? "Escuchando... toca para detener" : "Toca para dictar la placa"}
            </Text>
            {escuchando && (
              <View style={styles.ondas}>
                {[14, 22, 18, 26, 16].map((h, i) => (
                  <View key={i} style={[styles.onda, { height: h }]} />
                ))}
              </View>
            )}
          </TouchableOpacity>

          {!!transcript && (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>🗣️ Escuché:</Text>
              <Text style={styles.transcriptTexto}>"{transcript}"</Text>
            </View>
          )}

          <View style={styles.instruccionBox}>
            <Text style={styles.instruccionTitulo}>¿Cómo dictarla?</Text>
            <Text style={styles.instruccion}>• Letra por letra: <Text style={styles.bold}>"A B C 1 2 3 A"</Text></Text>
            <Text style={styles.instruccion}>• O completa: <Text style={styles.bold}>"ABC 123 A"</Text></Text>
            <Text style={styles.instruccion}>• Moto: <Text style={styles.bold}>"A B 1 2 3 4"</Text></Text>
          </View>
        </View>
      )}

      {/* ── MODO TECLADO ── */}
      {!modoVoz && (
        <View>
          <View style={styles.formatosBox}>
            <Text style={styles.formatosTitulo}>Formatos válidos:</Text>
            <View style={styles.formatosFila}>
              {FORMATOS.map((f, i) => (
                <View key={i} style={styles.formatoChip}>
                  <Text style={styles.formatoChipText}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.teclado}>
            {teclas.map((fila, fi) => (
              <View key={fi} style={styles.tecladoFila}>
                {fila.map((tecla, ti) => (
                  <TouchableOpacity
                    key={ti}
                    style={[
                      styles.tecla,
                      tecla === "⌫" && styles.teclaDelete,
                      tecla === ""  && styles.teclaVacia,
                    ]}
                    onPress={() => presionarTecla(tecla)}
                    disabled={tecla === "" || guardando}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.teclaTexto, tecla === "⌫" && styles.teclaDeleteTexto]}>
                      {tecla}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Botones de acción */}
      <View style={styles.acciones}>
        {!!(placa || transcript) && (
          <TouchableOpacity style={styles.btnLimpiar} onPress={limpiar} disabled={guardando}>
            <Text style={styles.btnLimpiarText}>🔄 Limpiar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.btnConfirmar, (!valida || guardando) && styles.disabled]}
          onPress={confirmarEntrada}
          disabled={!valida || guardando}
          activeOpacity={0.85}
        >
          {guardando
            ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.btnConfirmarText}>Guardando...</Text>
              </View>
            : <Text style={styles.btnConfirmarText}>✅ Confirmar Entrada</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Historial de sesión */}
      {historial.length > 0 && (
        <View style={styles.historialBox}>
          <Text style={styles.historialTitulo}>📋 Registros de esta sesión</Text>
          {historial.map((item, i) => (
            <Text key={i} style={styles.historialItem}>{item}</Text>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef2ff" },
  content:   { padding: 20, paddingTop: 56 },

  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  headerTitle:      { fontSize: 22, fontWeight: "900", color: "#1d4ed8" },
  headerSub:        { fontSize: 13, color: "#6b7280", marginTop: 2 },
  tarifaDestacada:  { color: "#16a34a", fontWeight: "700" },
  modoBtn:          { backgroundColor: "#fff", borderRadius: 12, padding: 10, elevation: 2, borderWidth: 1, borderColor: "#e5e7eb" },
  modoBtnText:      { fontSize: 22 },

  displayCard:        { backgroundColor: "#fff", borderRadius: 20, padding: 20, alignItems: "center", marginBottom: 16, borderWidth: 2, borderColor: "#e5e7eb", elevation: 3 },
  displayCardValida:  { borderColor: "#16a34a", backgroundColor: "#f0fdf4" },
  displayLabel:       { fontSize: 11, color: "#9ca3af", fontWeight: "700", letterSpacing: 1.5, marginBottom: 8 },
  displayPlaca:       { fontSize: 42, fontWeight: "900", color: "#1d4ed8", letterSpacing: 6, marginBottom: 12 },
  displayPlacaValida: { color: "#16a34a" },
  progresoBarra:      { width: "100%", height: 4, backgroundColor: "#f3f4f6", borderRadius: 2, marginBottom: 10 },
  progresoRelleno:    { height: 4, backgroundColor: "#2563EB", borderRadius: 2 },
  tipoBadge:          { backgroundColor: "#dbeafe", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  tipoBadgeValida:    { backgroundColor: "#dcfce7" },
  tipoTexto:          { fontSize: 14, fontWeight: "700", color: "#1d4ed8" },
  tipoTextoValida:    { color: "#16a34a" },
  tipoPlaceholder:    { fontSize: 12, color: "#9ca3af", fontStyle: "italic" },

  vozBox:          { marginBottom: 16 },
  micBtn:          { backgroundColor: "#2563EB", borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 12, elevation: 5 },
  micBtnActivo:    { backgroundColor: "#dc2626" },
  micEmoji:        { fontSize: 48, marginBottom: 8 },
  micLabel:        { color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center" },
  ondas:           { flexDirection: "row", gap: 5, marginTop: 10, alignItems: "flex-end" },
  onda:            { width: 5, backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 3 },

  transcriptBox:   { backgroundColor: "#f0fdf4", borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#bbf7d0" },
  transcriptLabel: { fontSize: 12, color: "#166534", fontWeight: "700", marginBottom: 4 },
  transcriptTexto: { fontSize: 14, color: "#15803d", fontStyle: "italic" },

  instruccionBox:   { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: "#2563EB" },
  instruccionTitulo:{ fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6 },
  instruccion:      { fontSize: 12, color: "#6b7280", marginBottom: 3 },
  bold:             { fontWeight: "700", color: "#1d4ed8" },

  formatosBox:     { marginBottom: 12 },
  formatosTitulo:  { fontSize: 12, color: "#6b7280", fontWeight: "700", marginBottom: 6 },
  formatosFila:    { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  formatoChip:     { backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#e5e7eb" },
  formatoChipText: { fontSize: 12, color: "#374151", fontWeight: "600" },

  teclado:          { gap: 6, marginBottom: 16 },
  tecladoFila:      { flexDirection: "row", gap: 5, justifyContent: "center" },
  tecla:            { width: 44, height: 44, borderRadius: 10, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", elevation: 1, borderWidth: 1, borderColor: "#e5e7eb" },
  teclaTexto:       { fontSize: 16, fontWeight: "700", color: "#1d4ed8" },
  teclaDelete:      { backgroundColor: "#fee2e2", borderColor: "#fca5a5" },
  teclaDeleteTexto: { color: "#dc2626" },
  teclaVacia:       { backgroundColor: "transparent", borderColor: "transparent", elevation: 0 },

  acciones:         { flexDirection: "row", gap: 10, marginBottom: 16 },
  btnLimpiar:       { flex: 1, padding: 14, borderRadius: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#d1d5db", backgroundColor: "#fff" },
  btnLimpiarText:   { color: "#6b7280", fontSize: 14, fontWeight: "600" },
  btnConfirmar:     { flex: 2, backgroundColor: "#16a34a", padding: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnConfirmarText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  disabled:         { opacity: 0.38 },

  historialBox:    { backgroundColor: "#fff", borderRadius: 14, padding: 14 },
  historialTitulo: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 8 },
  historialItem:   { fontSize: 12, color: "#6b7280", marginBottom: 4 },
});
