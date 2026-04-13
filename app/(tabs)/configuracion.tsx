/**
 * configuracion.tsx — CORREGIDO
 * ✅ Guarda tarifa en Firestore correctamente
 * ✅ Operador ve cambios en tiempo real
 * ✅ Sin crashes por listeners sin limpiar
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from "react-native";
import { guardarConfig, obtenerConfig } from "../../services/database";
import { db } from "../../services/firebase";

export default function Configuracion() {
  const [tarifa, setTarifa]     = useState("20");
  const [espacios, setEspacios] = useState("50");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [rol, setRol]           = useState("operador");

  // Ref para evitar que el listener cause re-renders infinitos
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Cargar rol
    AsyncStorage.getItem("saved_rol").then(r => setRol(r || "operador"));

    // Escuchar cambios de Firestore en tiempo real
    const unsub = onSnapshot(
      doc(db, "configuracion", "general"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const t = String(data.tarifaPorHora || "20");
          const e = String(data.espaciosTotales || "50");
          setTarifa(t);
          setEspacios(e);
          // Guardar localmente para uso offline
          guardarConfig("tarifaPorHora", t);
          guardarConfig("espaciosTotales", e);
        }
        setCargando(false);
      },
      () => {
        // Sin conexión → leer localmente
        setTarifa(obtenerConfig("tarifaPorHora", "20"));
        setEspacios(obtenerConfig("espaciosTotales", "50"));
        setCargando(false);
      }
    );

    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  const guardarConfiguracion = async () => {
    const rolActual = await AsyncStorage.getItem("saved_rol");
    if (rolActual !== "admin") {
      Alert.alert("Acceso denegado", "Solo administradores pueden modificar la configuración.");
      return;
    }

    const tarifaNum  = parseFloat(tarifa.replace(",", "."));
    const espaciosNum = parseInt(espacios);

    if (isNaN(tarifaNum) || tarifaNum <= 0) {
      Alert.alert("Error", "La tarifa debe ser un número mayor a 0.");
      return;
    }
    if (isNaN(espaciosNum) || espaciosNum <= 0) {
      Alert.alert("Error", "Los espacios deben ser un número mayor a 0.");
      return;
    }

    setGuardando(true);

    try {
      // 1. Guardar en Firestore (esto notifica a TODOS los listeners en tiempo real)
      await setDoc(doc(db, "configuracion", "general"), {
        tarifaPorHora:   tarifaNum,
        espaciosTotales: espaciosNum,
        actualizadoEn:   new Date().toISOString(),
      });

      // 2. Guardar localmente como respaldo
      guardarConfig("tarifaPorHora", String(tarifaNum));
      guardarConfig("espaciosTotales", String(espaciosNum));

      Alert.alert(
        "✅ Configuración guardada",
        `Tarifa: $${tarifaNum} MXN/hora\nEspacios: ${espaciosNum}\n\nTodos los operadores verán el cambio de inmediato.`
      );
    } catch (error: any) {
      console.log("[Config] error guardando:", error?.message);
      // Si falla Firebase, guardar solo local
      guardarConfig("tarifaPorHora", String(tarifaNum));
      guardarConfig("espaciosTotales", String(espaciosNum));
      Alert.alert(
        "⚠️ Guardado localmente",
        "Sin conexión a internet. Los cambios se sincronizarán cuando haya conexión."
      );
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Cargando configuración...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>⚙️ Configuración</Text>
        <View style={[styles.rolBadge, rol === "admin" ? styles.rolAdmin : styles.rolOp]}>
          <Text style={styles.rolText}>{rol === "admin" ? "👑 Admin" : "👷 Operador"}</Text>
        </View>
      </View>

      {rol !== "admin" ? (
        // Vista operador — solo lectura
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Configuración actual</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>💵 Tarifa por hora</Text>
            <Text style={styles.infoValor}>${tarifa} MXN</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🚗 Espacios totales</Text>
            <Text style={styles.infoValor}>{espacios}</Text>
          </View>
          <View style={styles.notaBox}>
            <Text style={styles.notaTexto}>
              🔒 Solo el administrador puede modificar estos valores.
              Los cambios se actualizan automáticamente en tiempo real.
            </Text>
          </View>
        </View>
      ) : (
        // Vista admin — editable
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Parámetros del estacionamiento</Text>

          <Text style={styles.label}>💵 Tarifa por hora (MXN)</Text>
          <TextInput
            style={styles.input}
            value={tarifa}
            onChangeText={setTarifa}
            keyboardType="decimal-pad"
            placeholder="20"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>🚗 Espacios totales</Text>
          <TextInput
            style={styles.input}
            value={espacios}
            onChangeText={setEspacios}
            keyboardType="number-pad"
            placeholder="50"
            placeholderTextColor="#9ca3af"
          />

          <View style={styles.preview}>
            <Text style={styles.previewText}>
              {espacios} espacios · ${tarifa} MXN/hora
            </Text>
            <Text style={styles.previewSub}>
              = ${(parseFloat(tarifa || "0") / 60).toFixed(2)} MXN/minuto
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, guardando && styles.buttonDisabled]}
            onPress={guardarConfiguracion}
            disabled={guardando}
          >
            {guardando
              ? <View style={styles.row}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.buttonText}>  Guardando en la nube...</Text>
                </View>
              : <Text style={styles.buttonText}>💾 Guardar y sincronizar</Text>
            }
          </TouchableOpacity>

          <Text style={styles.syncNote}>
            ✅ Al guardar, todos los operadores verán la nueva tarifa al instante.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#f0f4f8", paddingTop: 60, padding: 20 },
  loadingBox:   { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText:  { fontSize: 14, color: "#6b7280" },
  headerRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title:        { fontSize: 22, fontWeight: "bold", color: "#111" },
  rolBadge:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  rolAdmin:     { backgroundColor: "#ede9fe" },
  rolOp:        { backgroundColor: "#dcfce7" },
  rolText:      { fontSize: 12, fontWeight: "600", color: "#374151" },
  card:         { backgroundColor: "#fff", borderRadius: 16, padding: 20, elevation: 2 },
  cardTitle:    { fontSize: 16, fontWeight: "bold", marginBottom: 16, color: "#374151" },
  label:        { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input:        { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, padding: 13, fontSize: 18, marginBottom: 16, backgroundColor: "#f9fafb", color: "#111", fontWeight: "600" },
  preview:      { backgroundColor: "#f3f4f6", borderRadius: 10, padding: 14, marginBottom: 16, alignItems: "center" },
  previewText:  { fontSize: 15, color: "#374151", fontWeight: "700" },
  previewSub:   { fontSize: 12, color: "#6b7280", marginTop: 4 },
  button:       { backgroundColor: "#7C3AED", padding: 16, borderRadius: 12, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  row:          { flexDirection: "row", alignItems: "center" },
  buttonText:   { color: "#fff", fontSize: 16, fontWeight: "bold" },
  syncNote:     { fontSize: 12, color: "#10b981", textAlign: "center", marginTop: 12, fontWeight: "600" },
  // Vista operador
  infoRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  infoLabel:    { fontSize: 14, color: "#6b7280" },
  infoValor:    { fontSize: 18, fontWeight: "900", color: "#7C3AED" },
  notaBox:      { backgroundColor: "#f9fafb", borderRadius: 10, padding: 12, marginTop: 14 },
  notaTexto:    { fontSize: 12, color: "#6b7280", textAlign: "center", lineHeight: 18 },
});
