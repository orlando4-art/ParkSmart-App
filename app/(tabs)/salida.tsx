import { Timestamp, collection, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { dbLocal } from "../../services/database";
import { db } from "../../services/firebase";

export default function Salida() {
  const [placa, setPlaca] = useState("");
  const [loading, setLoading] = useState(false);
  const [vehiculo, setVehiculo] = useState<any>(null);
  const [activos, setActivos] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, "registros"), where("activo", "==", true));
    const unsub = onSnapshot(q, (snap) => {
      const ahora = new Date();
      const data = snap.docs.map((d) => {
        const item = d.data();
        const entrada = item.entrada.toDate();
        const minutos = Math.floor((ahora.getTime() - entrada.getTime()) / 60000);
        const costo = Math.max(Math.ceil((minutos / 60) * 20), 20);
        return { id: d.id, ...item, entrada, minutos, costo };
      });
      setActivos(data);
    });
    return unsub;
  }, []);

  const buscarVehiculo = async () => {
    const placaLimpia = placa.trim().toUpperCase();
    if (!placaLimpia) { Alert.alert("Error", "Ingresa la placa"); return; }
    setLoading(true);
    try {
      const q = query(collection(db, "registros"), where("placa", "==", placaLimpia), where("activo", "==", true));
      const snap = await getDocs(q);
      if (snap.empty) { Alert.alert("No encontrado", `No hay entrada activa para ${placaLimpia}`); setVehiculo(null); return; }
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      const entrada = data.entrada.toDate();
      const minutos = Math.floor((new Date().getTime() - entrada.getTime()) / 60000);
      const costo = Math.max(Math.ceil((minutos / 60) * 20), 20);
      setVehiculo({ id: docSnap.id, ...data, entrada, costo, minutos });
    } catch (e) { Alert.alert("Error", "No se pudo buscar"); }
    finally { setLoading(false); }
  };

  const seleccionarVehiculo = (v: any) => {
    setPlaca(v.placa);
    setVehiculo(v);
  };

  const registrarSalida = async () => {
    if (!vehiculo) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "registros", vehiculo.id), {
        salida: Timestamp.now(), costo: vehiculo.costo, activo: false,
      });
      dbLocal.runSync(
        "UPDATE registros SET salida=?, costo=?, activo=0 WHERE placa=? AND activo=1",
        [new Date().toISOString(), vehiculo.costo, vehiculo.placa]
      );
      dbLocal.runSync(
        "INSERT INTO eventos (tipo, descripcion, fecha) VALUES (?, ?, ?)",
        ["salida", `Salida registrada: ${vehiculo.placa}`, new Date().toISOString()]
      );
      Alert.alert("✅ Salida registrada", `Placa: ${vehiculo.placa}\nTiempo: ${vehiculo.minutos} min\nCosto: $${vehiculo.costo} MXN`);
      setVehiculo(null); setPlaca("");
    } catch (e) { Alert.alert("Error", "No se pudo registrar la salida"); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Registro de Salida</Text>
        <Text style={styles.headerSub}>Calcular tiempo y costo</Text>
      </View>

      {/* Buscador */}
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
            <Text style={styles.searchIcon}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de vehículos activos */}
      {!vehiculo && activos.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>Vehículos activos</Text>
          {activos.map((v) => (
            <TouchableOpacity key={v.id} style={styles.activoItem} onPress={() => seleccionarVehiculo(v)}>
              <View>
                <Text style={styles.activoPlaca}>{v.placa}</Text>
                <Text style={styles.activoHora}>Entrada: {v.entrada.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.activoTiempo}>{Math.floor(v.minutos / 60)}h {v.minutos % 60}m</Text>
                <Text style={styles.activoCosto}>${v.costo}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Detalle del vehículo seleccionado */}
      {vehiculo && (
        <View style={styles.card}>
          <Text style={styles.detallePlaca}>{vehiculo.placa}</Text>
          <Text style={styles.detalleTipo}>{vehiculo.tipo === "auto" ? "🚗 Automóvil" : "🏍️ Moto"}</Text>

          <View style={styles.detalleRow}>
            <Text style={styles.detalleLabel}>⏰ Hora de entrada</Text>
            <Text style={styles.detalleVal}>{vehiculo.entrada.toLocaleString("es-MX")}</Text>
          </View>
          <View style={styles.detalleRow}>
            <Text style={styles.detalleLabel}>⏱ Tiempo total</Text>
            <Text style={styles.detalleVal}>{Math.floor(vehiculo.minutos / 60)}h {vehiculo.minutos % 60}m</Text>
          </View>
          <View style={[styles.detalleRow, styles.costoRow]}>
            <Text style={[styles.detalleLabel, { color: "#EF4444" }]}>💲 Costo calculado</Text>
            <Text style={styles.costoVal}>${vehiculo.costo} MXN</Text>
          </View>
          {vehiculo.lat ? (
            <View style={styles.detalleRow}>
              <Text style={styles.detalleLabel}>📍 Ubicación GPS</Text>
              <Text style={styles.detalleVal}>{vehiculo.lat?.toFixed(4)}, {vehiculo.lng?.toFixed(4)}</Text>
            </View>
          ) : null}

          <View style={styles.botonesRow}>
            <TouchableOpacity style={styles.ticketBtn} onPress={() => Alert.alert("🎫 Ticket", `Placa: ${vehiculo.placa}\nEntrada: ${vehiculo.entrada.toLocaleString("es-MX")}\nCosto: $${vehiculo.costo} MXN`)}>
              <Text style={styles.ticketText}>🎫 Generar Ticket</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.salidaBtn, loading && { opacity: 0.7 }]} onPress={registrarSalida} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.salidaText}>Registrar Salida</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { backgroundColor: "#EF4444", padding: 20, paddingTop: 60, paddingBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  headerSub: { fontSize: 14, color: "#fecaca", marginTop: 2 },
  card: { backgroundColor: "#fff", borderRadius: 12, margin: 12, marginBottom: 0, padding: 16, elevation: 1 },
  label: { fontSize: 13, color: "#666", marginBottom: 10, fontWeight: "600" },
  searchRow: { flexDirection: "row", gap: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 13, fontSize: 16, fontWeight: "bold", letterSpacing: 2, backgroundColor: "#f9fafb" },
  searchBtn: { backgroundColor: "#EF4444", width: 50, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  searchIcon: { fontSize: 20 },
  activoItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  activoPlaca: { fontSize: 16, fontWeight: "bold" },
  activoHora: { fontSize: 12, color: "#888", marginTop: 2 },
  activoTiempo: { fontSize: 13, color: "#666" },
  activoCosto: { fontSize: 16, fontWeight: "bold", color: "#EF4444" },
  detallePlaca: { fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 4 },
  detalleTipo: { fontSize: 15, textAlign: "center", color: "#666", marginBottom: 16 },
  detalleRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  costoRow: { borderBottomWidth: 0, backgroundColor: "#fff5f5", borderRadius: 8, padding: 10, marginTop: 4 },
  detalleLabel: { fontSize: 13, color: "#666" },
  detalleVal: { fontSize: 13, fontWeight: "600" },
  costoVal: { fontSize: 22, fontWeight: "bold", color: "#EF4444" },
  botonesRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  ticketBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  ticketText: { fontSize: 14, fontWeight: "600" },
  salidaBtn: { flex: 1.5, backgroundColor: "#EF4444", padding: 14, borderRadius: 10, alignItems: "center" },
  salidaText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
});