import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { db } from "../../services/firebase";

export default function Historial() {
  const [registros, setRegistros] = useState<any[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "auto" | "moto">("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "registros"), orderBy("entrada", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRegistros(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtrados = registros.filter((r) => filtroTipo === "todos" || r.tipo === filtroTipo);
  const activos = registros.filter((r) => r.activo).length;
  const ingresos = registros.filter((r) => !r.activo).reduce((s, r) => s + (r.costo || 0), 0);

  const formatHora = (ts: any) => {
    if (!ts) return "---";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const exportar = async () => {
    try {
      const fecha = new Date().toLocaleDateString("es-MX").replace(/\//g, "-");

      let csv = "Placa,Tipo,Entrada,Salida,Costo,Estado\n";
      registros.forEach((r) => {
        const entrada = formatHora(r.entrada);
        const salida = r.salida ? formatHora(r.salida) : "Activo";
        const estado = r.activo ? "Activo" : "Completado";
        const tipoLabel = r.tipo === "auto" ? "Automovil" : "Motocicleta";
        csv += `${r.placa},${tipoLabel},${entrada},${salida},$${r.costo || 0},${estado}\n`;
      });

      csv += `\nRESUMEN\n`;
      csv += `Total registros,${registros.length}\n`;
      csv += `Vehiculos activos,${activos}\n`;
      csv += `Ingresos totales,$${ingresos} MXN\n`;
      csv += `Fecha del reporte,${new Date().toLocaleString("es-MX")}\n`;

      const fileUri = `${FileSystem.documentDirectory}reporte_parksmart_${fecha}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Exportar reporte ParkSmart",
        });
      } else {
        Alert.alert("✅ Reporte guardado", `Archivo guardado en el dispositivo.`);
      }
    } catch (error) {
      console.error("Error exportando:", error);
      Alert.alert("Error", "No se pudo exportar: " + String(error));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial</Text>
        <Text style={styles.headerSub}>Consulta de movimientos</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{registros.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#f0fdf4" }]}>
          <Text style={[styles.statNum, { color: "#22C55E" }]}>{activos}</Text>
          <Text style={styles.statLabel}>Activos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#fff7ed" }]}>
          <Text style={[styles.statNum, { color: "#F59E0B" }]}>${ingresos}</Text>
          <Text style={styles.statLabel}>Ingresos</Text>
        </View>
      </View>

      <View style={styles.filtrosCard}>
        <Text style={styles.filtroTitle}>🔽 Filtros</Text>
        <View style={styles.filtroRow}>
          {(["todos", "auto", "moto"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filtroBtn, filtroTipo === f && styles.filtroBtnActive]}
              onPress={() => setFiltroTipo(f)}
            >
              <Text style={[styles.filtroText, filtroTipo === f && styles.filtroTextActive]}>
                {f === "todos" ? "Todos" : f === "auto" ? "🚗 Autos" : "🏍️ Motos"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {filtroTipo !== "todos" && (
          <TouchableOpacity onPress={() => setFiltroTipo("todos")}>
            <Text style={styles.limpiar}>Limpiar filtros</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{loading ? "Cargando..." : "No hay registros"}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.itemCard, item.activo && styles.itemActivo]}>
            <View style={styles.itemHeader}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemIcono}>{item.tipo === "auto" ? "🚗" : "🏍️"}</Text>
                <View>
                  <Text style={styles.itemPlaca}>{item.placa}</Text>
                  <Text style={styles.itemTipo}>{item.tipo === "auto" ? "Automóvil" : "Motocicleta"}</Text>
                </View>
              </View>
              <View style={[styles.badge, item.activo ? styles.badgeActivo : styles.badgeSalida]}>
                <Text style={styles.badgeText}>{item.activo ? "Activo" : "Completado"}</Text>
              </View>
            </View>
            <View style={styles.itemBody}>
              <Text style={styles.itemInfo}>
                Entrada: <Text style={styles.itemVal}>{formatHora(item.entrada)}</Text>
              </Text>
              {item.salida && (
                <Text style={styles.itemInfo}>
                  Salida: <Text style={styles.itemVal}>{formatHora(item.salida)}</Text>
                </Text>
              )}
              {!item.activo && <Text style={styles.itemCosto}>${item.costo} MXN</Text>}
            </View>
          </View>
        )}
        ListFooterComponent={
          <TouchableOpacity style={styles.exportBtn} onPress={exportar}>
            <Text style={styles.exportText}>⬇️ Exportar Reporte CSV</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { backgroundColor: "#2563EB", padding: 20, paddingTop: 60, paddingBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  headerSub: { fontSize: 14, color: "#bfdbfe", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 8, margin: 12, marginBottom: 0 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 14, alignItems: "center", elevation: 1 },
  statNum: { fontSize: 22, fontWeight: "bold", color: "#2563EB" },
  statLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  filtrosCard: { backgroundColor: "#fff", borderRadius: 12, margin: 12, marginBottom: 8, padding: 16, elevation: 1 },
  filtroTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  filtroRow: { flexDirection: "row", gap: 8 },
  filtroBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#f3f4f6" },
  filtroBtnActive: { backgroundColor: "#2563EB" },
  filtroText: { fontSize: 13, fontWeight: "600", color: "#666" },
  filtroTextActive: { color: "#fff" },
  limpiar: { color: "#2563EB", textAlign: "center", marginTop: 10, fontSize: 13 },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: "#888", fontSize: 14 },
  itemCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  itemActivo: { borderLeftWidth: 4, borderLeftColor: "#22C55E" },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemIcono: { fontSize: 28 },
  itemPlaca: { fontSize: 16, fontWeight: "bold" },
  itemTipo: { fontSize: 12, color: "#888" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeActivo: { backgroundColor: "#dcfce7" },
  badgeSalida: { backgroundColor: "#f3f4f6" },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#333" },
  itemBody: { borderTopWidth: 1, borderTopColor: "#f5f5f5", paddingTop: 8 },
  itemInfo: { fontSize: 12, color: "#888", marginBottom: 2 },
  itemVal: { color: "#374151", fontWeight: "600" },
  itemCosto: { fontSize: 18, fontWeight: "bold", color: "#EF4444", marginTop: 4 },
  exportBtn: { backgroundColor: "#2563EB", padding: 15, borderRadius: 12, alignItems: "center", marginTop: 4, marginBottom: 20 },
  exportText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
});
