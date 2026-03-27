import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { db } from "../../services/firebase";

export default function Reportes() {
  const [registros, setRegistros] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, "registros"), orderBy("entrada", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRegistros(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const completados = registros.filter((r) => !r.activo);
  const activos = registros.filter((r) => r.activo);
  const ingresos = completados.reduce((sum, r) => sum + (r.costo || 0), 0);
  const autos = registros.filter((r) => r.tipo === "auto").length;
  const motos = registros.filter((r) => r.tipo === "moto").length;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📊 Reportes</Text>
      <Text style={styles.subtitle}>Solo visible para administradores</Text>

      <View style={styles.grid}>
        <View style={[styles.statCard, { backgroundColor: "#2563EB" }]}>
          <Text style={styles.statNum}>{registros.length}</Text>
          <Text style={styles.statLabel}>Total registros</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#34C759" }]}>
          <Text style={styles.statNum}>{activos.length}</Text>
          <Text style={styles.statLabel}>Activos ahora</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#FF3B30" }]}>
          <Text style={styles.statNum}>${ingresos}</Text>
          <Text style={styles.statLabel}>Ingresos totales</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#8B5CF6" }]}>
          <Text style={styles.statNum}>{completados.length}</Text>
          <Text style={styles.statLabel}>Completados</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#F59E0B" }]}>
          <Text style={styles.statNum}>{autos}</Text>
          <Text style={styles.statLabel}>🚗 Autos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#06B6D4" }]}>
          <Text style={styles.statNum}>{motos}</Text>
          <Text style={styles.statLabel}>🏍️ Motos</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f0f4f8", paddingTop: 60 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#6b7280", marginBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    width: "47%",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
  },
  statNum: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  statLabel: { fontSize: 12, color: "#fff", marginTop: 4, textAlign: "center" },
});