import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Timestamp, collection, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { dbLocal, obtenerConfig } from "../../services/database";
import { db } from "../../services/firebase";

export default function Salida() {
  const [placa, setPlaca] = useState("");
  const [loading, setLoading] = useState(false);
  const [vehiculo, setVehiculo] = useState<any>(null);
  const [activos, setActivos] = useState<any[]>([]);
  const [tarifaPorHora, setTarifaPorHora] = useState(20);

useEffect(() => {

  // 🔥 1. ESCUCHAR FIRESTORE EN TIEMPO REAL
  const unsubConfig = onSnapshot(
    doc(db, "configuracion", "general"),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();

        const tarifa = Number(data.tarifaPorHora);
        if (!isNaN(tarifa) && tarifa > 0) {
          setTarifaPorHora(tarifa);
        }
      }
    },
    () => {
      // 🔥 2. FALLBACK LOCAL (SIN INTERNET)
      const tarifaLocal = Number(obtenerConfig("tarifaPorHora", "20"));
      setTarifaPorHora(tarifaLocal > 0 ? tarifaLocal : 20);
    }
  );

  // 🔥 3. LISTENER DE VEHÍCULOS ACTIVOS
  const q = query(collection(db, "registros"), where("activo", "==", true));

  const unsubRegistros = onSnapshot(q, (snap) => {
    const ahora = new Date();

    const data = snap.docs.map((d) => {
      const item = d.data();
      const entrada = item.entrada.toDate();

      const minutos = Math.max(
        1,
        Math.floor((ahora.getTime() - entrada.getTime()) / 60000)
      );

      const costo = calcularCosto(minutos, tarifaPorHora);
      return { id: d.id, ...item, entrada, minutos, costo };

      
    });

    setActivos(data);
  });

  return () => {
    unsubConfig();
    unsubRegistros();
  };

}, [tarifaPorHora]);

  // ✅ CÁLCULO PROPORCIONAL: cobra por minuto exacto
  // Ejemplo: $100/hora, 30 min → $50. 45 min → $75. 90 min → $150.
  const calcularCosto = (minutos: number, tarifa: number): number => {
    if (minutos <= 0) minutos = 1;
    const costoPorMinuto = tarifa / 60;
    const costoExacto = minutos * costoPorMinuto;
    // Redondear al peso más próximo (sin mínimo forzado de 1 hora)
    return Math.round(costoExacto);
  };

  const formatTiempo = (minutos: number) => {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  const buscarVehiculo = async () => {
    const placaLimpia = placa.trim().toUpperCase();
    if (!placaLimpia) { Alert.alert("Error", "Ingresa la placa"); return; }

    setLoading(true);
    const timeoutId = setTimeout(() => {
      setLoading(false);
      Alert.alert("Tiempo agotado", "Verifica tu conexión.");
    }, 10000);

    try {
      const q = query(collection(db, "registros"), where("placa", "==", placaLimpia), where("activo", "==", true));
      const snap = await getDocs(q);
      clearTimeout(timeoutId);
      if (snap.empty) {
        Alert.alert("No encontrado", `No hay entrada activa para ${placaLimpia}`);
        setVehiculo(null);
        setLoading(false);
        return;
      }
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      const entrada = data.entrada.toDate();
      const minutos = Math.max(1, Math.floor((new Date().getTime() - entrada.getTime()) / 60000));
      const costo = calcularCosto(minutos, tarifaPorHora);
      setVehiculo({ id: docSnap.id, ...data, entrada, costo, minutos });
      setLoading(false);
    } catch (e) {
      clearTimeout(timeoutId);
      setLoading(false);
      // Intentar buscar en activos locales
      const encontrado = activos.find(v => v.placa === placaLimpia);
      if (encontrado) {
        setVehiculo(encontrado);
      } else {
        Alert.alert("Sin conexión", "No se pudo buscar. Selecciona el vehículo de la lista de activos.");
      }
    }
  };

const seleccionarVehiculo = (v: any) => {
  const ahora = new Date();
  const minutos = Math.max(
    1,
    Math.floor((ahora.getTime() - v.entrada.getTime()) / 60000)
  );

  const costo = calcularCosto(minutos, tarifaPorHora);

  setPlaca(v.placa);
  setVehiculo({ ...v, minutos, costo });
};

// 🔥 SOLO TE MUESTRO LA PARTE CORREGIDA (la importante)

const generarTicketHTML = (v: any) => {
  const ahora = new Date();

  // ✅ RECALCULAR TODO EN TIEMPO REAL
  const minutosActuales = Math.max(
    1,
    Math.floor((ahora.getTime() - v.entrada.getTime()) / 60000)
  );

  const costoActual = calcularCosto(minutosActuales, tarifaPorHora);

  const horas = Math.floor(minutosActuales / 60);
  const mins = minutosActuales % 60;
  const costoPorMin = (tarifaPorHora / 60).toFixed(2);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body>

  <h2>Ticket ParkSmart</h2>

  <p>Placa: ${v.placa}</p>
  <p>Entrada: ${v.entrada.toLocaleString("es-MX")}</p>
  <p>Salida: ${ahora.toLocaleString("es-MX")}</p>

  <p>Tiempo: ${horas > 0 ? horas + "h " : ""}${mins}min</p>

  <p>Tarifa: $${tarifaPorHora}/hora</p>

  <h1>TOTAL: $${costoActual} MXN</h1>

  <p>${minutosActuales} min × $${costoPorMin}/min = $${costoActual}</p>

</body>
</html>`;
};

const generarTicket = async () => {
  if (!vehiculo) return;

  // 🔥 FORZAR ACTUALIZACIÓN DEL VEHÍCULO
  const ahora = new Date();
  const minutos = Math.max(
    1,
    Math.floor((ahora.getTime() - vehiculo.entrada.getTime()) / 60000)
  );

  const costo = calcularCosto(minutos, tarifaPorHora);

  const vehiculoActualizado = {
    ...vehiculo,
    minutos,
    costo
  };

  const html = generarTicketHTML(vehiculoActualizado);

  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
  } else {
    await Print.printAsync({ html });
  }
};
const registrarSalida = async () => {
  if (!vehiculo) return;
  setLoading(true);

  const salidaTime = new Date();

  const minutos = Math.max(
    1,
    Math.floor((salidaTime.getTime() - vehiculo.entrada.getTime()) / 60000)
  );

  const costoFinal = calcularCosto(minutos, tarifaPorHora);

  let guardadoEnFirestore = false;

  // 🔥 1. Intentar guardar en FIRESTORE (principal)
  try {
    await updateDoc(doc(db, "registros", vehiculo.id), {
      salida: Timestamp.fromDate(salidaTime),
      costo: costoFinal,
      activo: false,
    });

    guardadoEnFirestore = true;

  } catch (error) {
    console.log("⚠️ Sin internet, usando base local");
  }

  // 🔥 2. SOLO SI FALLA → guardar LOCAL
  if (!guardadoEnFirestore) {
    try {
      await dbLocal.runAsync(
        "UPDATE registros SET salida=?, costo=?, activo=0 WHERE placa=? AND activo=1",
        [salidaTime.toISOString(), costoFinal, vehiculo.placa]
      );
    } catch (e) {
      console.log("Error guardando local:", e);
    }
  }

  setLoading(false);

  const tiempoStr = formatTiempo(minutos);
  const costoPorMin = (tarifaPorHora / 60).toFixed(2);

  Alert.alert(
    "✅ Salida registrada",
    `Placa: ${vehiculo.placa}
Tiempo: ${tiempoStr}
Tarifa: $${tarifaPorHora}/h ($${costoPorMin}/min)
Total: $${costoFinal} MXN${!guardadoEnFirestore ? "\n\n⚠️ Guardado localmente" : ""}`,
    [
      { text: "🧾 Ticket PDF", onPress: generarTicket },
      { text: "OK" },
    ]
  );

  // 🔥 Actualizar UI inmediatamente
  setActivos(prev => prev.filter(v => v.id !== vehiculo.id));
  setVehiculo(null);
  setPlaca("");
};
  const formatHora = (fecha: Date) =>
    fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚪 Registro de Salida</Text>
        <Text style={styles.headerSub}>Tarifa: ${tarifaPorHora}/hora · ${(tarifaPorHora / 60).toFixed(2)}/min</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Buscar vehículo por placa</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="ABC-123"
            value={placa}
            onChangeText={(t) => setPlaca(t.toUpperCase())}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={buscarVehiculo} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.searchIcon}>🔍</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {!vehiculo && activos.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>Vehículos activos ({activos.length}) — toca para seleccionar</Text>
          {activos.map((v) => {
            const mins = Math.max(1, Math.floor((new Date().getTime() - v.entrada.getTime()) / 60000));
            const costoActual = calcularCosto(mins, tarifaPorHora);
            return (
              <TouchableOpacity key={v.id} style={styles.activoItem} onPress={() => seleccionarVehiculo(v)}>
                <View style={styles.activoLeft}>
                  <Text style={styles.activoIcono}>{v.tipo === "auto" ? "🚗" : "🏍️"}</Text>
                  <View>
                    <Text style={styles.activoPlaca}>{v.placa}</Text>
                    <Text style={styles.activoHora}>Entrada: {formatHora(v.entrada)}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.activoTiempo}>{formatTiempo(mins)}</Text>
                  <Text style={styles.activoCosto}>${costoActual} MXN</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {activos.length === 0 && !vehiculo && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🅿️</Text>
          <Text style={styles.emptyTitle}>Sin vehículos activos</Text>
          <Text style={styles.emptyDesc}>No hay vehículos estacionados en este momento.</Text>
        </View>
      )}

      {vehiculo && (
        <View style={styles.card}>
          <View style={styles.vehiculoHeader}>
            <Text style={styles.detallePlaca}>{vehiculo.placa}</Text>
            <Text style={styles.detalleTipo}>{vehiculo.tipo === "auto" ? "🚗 Automóvil" : "🏍️ Moto"}</Text>
          </View>

          <View style={styles.detalleRow}>
            <Text style={styles.detalleLabel}>🕐 Entrada</Text>
            <Text style={styles.detalleVal}>{vehiculo.entrada.toLocaleString("es-MX")}</Text>
          </View>
          <View style={styles.detalleRow}>
            <Text style={styles.detalleLabel}>⏱️ Tiempo</Text>
            <Text style={styles.detalleVal}>{formatTiempo(vehiculo.minutos)}</Text>
          </View>
          <View style={styles.detalleRow}>
            <Text style={styles.detalleLabel}>💵 Tarifa</Text>
            <Text style={styles.detalleVal}>${tarifaPorHora}/hora · ${(tarifaPorHora / 60).toFixed(2)}/min</Text>
          </View>

          {/* ✅ Cálculo proporcional visible */}
          <View style={styles.calculoBox}>
            <Text style={styles.calculoTitle}>📐 Cálculo proporcional</Text>
            <Text style={styles.calculoDetalle}>
              {vehiculo.minutos} min × ${(tarifaPorHora / 60).toFixed(2)}/min
            </Text>
          </View>

          <View style={styles.costoFinalBox}>
            <Text style={styles.costoFinalLabel}>TOTAL A PAGAR</Text>
            <Text style={styles.costoFinalVal}>
              ${calcularCosto(
                Math.max(
                 1,
                 Math.floor((new Date().getTime() - vehiculo.entrada.getTime()) / 60000)
                ),
                tarifaPorHora
              )} MXN
            </Text>
          </View>

          <View style={styles.botonesRow}>
            <TouchableOpacity style={styles.ticketBtn} onPress={generarTicket}>
              <Text style={styles.ticketText}>🧾 Ticket PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.salidaBtn, loading && { opacity: 0.7 }]}
              onPress={registrarSalida}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.salidaText}>✅ Registrar Salida</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => { setVehiculo(null); setPlaca(""); }} style={styles.cancelarBtn}>
            <Text style={styles.cancelarText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { backgroundColor: "#EF4444", padding: 20, paddingTop: 60, paddingBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  headerSub: { fontSize: 13, color: "#fecaca", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, margin: 12, marginBottom: 0, padding: 16, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  label: { fontSize: 13, color: "#666", marginBottom: 10, fontWeight: "600" },
  searchRow: { flexDirection: "row", gap: 10 },
  input: { flex: 1, borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, padding: 13, fontSize: 18, fontWeight: "bold", letterSpacing: 3, backgroundColor: "#f9fafb", textAlign: "center" },
  searchBtn: { backgroundColor: "#EF4444", width: 52, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  searchIcon: { fontSize: 20 },
  activoItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  activoLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  activoIcono: { fontSize: 28 },
  activoPlaca: { fontSize: 16, fontWeight: "bold" },
  activoHora: { fontSize: 11, color: "#888", marginTop: 2 },
  activoTiempo: { fontSize: 13, color: "#666" },
  activoCosto: { fontSize: 16, fontWeight: "bold", color: "#EF4444" },
  emptyCard: { backgroundColor: "#fff", borderRadius: 16, margin: 12, padding: 40, alignItems: "center", elevation: 1 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#374151", marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  vehiculoHeader: { alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  detallePlaca: { fontSize: 30, fontWeight: "900", letterSpacing: 4, color: "#1d4ed8" },
  detalleTipo: { fontSize: 14, color: "#666", marginTop: 4 },
  detalleRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  detalleLabel: { fontSize: 13, color: "#6b7280" },
  detalleVal: { fontSize: 13, fontWeight: "600", color: "#374151", maxWidth: "60%", textAlign: "right" },
  calculoBox: { backgroundColor: "#fef9c3", borderRadius: 10, padding: 12, marginTop: 12, alignItems: "center" },
  calculoTitle: { fontSize: 12, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  calculoDetalle: { fontSize: 14, color: "#78350f", fontWeight: "600" },
  costoFinalBox: { backgroundColor: "#fff0f0", borderRadius: 12, padding: 16, marginTop: 10, alignItems: "center", borderWidth: 2, borderColor: "#fca5a5" },
  costoFinalLabel: { fontSize: 11, color: "#dc2626", fontWeight: "700", letterSpacing: 1 },
  costoFinalVal: { fontSize: 38, fontWeight: "900", color: "#dc2626", marginTop: 4 },
  botonesRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  ticketBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", backgroundColor: "#f9fafb" },
  ticketText: { fontSize: 14, fontWeight: "600" },
  salidaBtn: { flex: 1.5, backgroundColor: "#EF4444", padding: 14, borderRadius: 10, alignItems: "center" },
  salidaText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  cancelarBtn: { alignItems: "center", marginTop: 12 },
  cancelarText: { color: "#9ca3af", fontSize: 13 },
});
