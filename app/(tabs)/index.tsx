import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../services/firebase";

// Estacionamientos con coordenadas reales
const ESTACIONAMIENTOS = [
  { id: 1, nombre: "ParkSmart Mall", direccion: "Insurgentes 789", lat: 19.431, lng: -99.138, total: 120, ocupados: 30 },
  { id: 2, nombre: "ParkSmart Plaza", direccion: "Calle Madero 456", lat: 19.4348, lng: -99.135, total: 80, ocupados: 15 },
  { id: 3, nombre: "ParkSmart Airport", direccion: "Terminal 1", lat: 19.4361, lng: -99.072, total: 200, ocupados: 155 },
];

const calcularDistancia = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
};

export default function Inicio() {
  const [activos, setActivos] = useState(0);
  const [rol, setRol] = useState("operador");
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const total = 50;
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem("saved_rol").then((r) => { if (r) setRol(r); });
    const q = query(collection(db, "registros"), where("activo", "==", true));
    const unsub = onSnapshot(q, (snap) => setActivos(snap.size));
    obtenerUbicacion();
    return unsub;
  }, []);

  const obtenerUbicacion = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({});
    setUbicacion({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  };

  const libres = total - activos;

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", onPress: async () => { await AsyncStorage.removeItem("saved_rol"); signOut(auth); } },
    ]);
  };

  const getColorDisponibilidad = (pct: number) => {
    if (pct > 70) return "#22C55E";
    if (pct >= 40) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>ParkSmart</Text>
            <Text style={styles.subtitle}>Dashboard Principal</Text>
          </View>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>

        {/* Cards */}
        <View style={styles.cardsRow}>
          <View style={[styles.card, { backgroundColor: "#3b82f6" }]}>
            <Text style={styles.cardIcon}>🚗</Text>
            <Text style={styles.cardNum}>{activos}</Text>
            <Text style={styles.cardLabel}>Dentro</Text>
          </View>
          <View style={[styles.card, { backgroundColor: "#14b8a6" }]}>
            <Text style={styles.cardIcon}>⏰</Text>
            <Text style={styles.cardNum}>{libres}</Text>
            <Text style={styles.cardLabel}>Libres</Text>
          </View>
          <View style={[styles.card, { backgroundColor: "#8b5cf6" }]}>
            <Text style={styles.cardIcon}>⏰</Text>
            <Text style={styles.cardNum}>{activos}</Text>
            <Text style={styles.cardLabel}>Ocupados</Text>
          </View>
        </View>
      </View>

      {/* Acciones */}
      <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/entrada")}>
        <View style={[styles.actionIconBox, { backgroundColor: "#dcfce7" }]}><Text style={styles.actionEmoji}>🚗</Text></View>
        <View><Text style={styles.actionTitle}>Registrar Entrada</Text><Text style={styles.actionDesc}>Capturar vehículo entrante</Text></View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/salida")}>
        <View style={[styles.actionIconBox, { backgroundColor: "#fee2e2" }]}><Text style={styles.actionEmoji}>🚪</Text></View>
        <View><Text style={styles.actionTitle}>Registrar Salida</Text><Text style={styles.actionDesc}>Calcular tiempo y costo</Text></View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/historial")}>
        <View style={[styles.actionIconBox, { backgroundColor: "#dbeafe" }]}><Text style={styles.actionEmoji}>📋</Text></View>
        <View><Text style={styles.actionTitle}>Historial</Text><Text style={styles.actionDesc}>Consultar movimientos</Text></View>
      </TouchableOpacity>

      {rol === "admin" && (
        <>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/configuracion")}>
            <View style={[styles.actionIconBox, { backgroundColor: "#f3f4f6" }]}><Text style={styles.actionEmoji}>⚙️</Text></View>
            <View><Text style={styles.actionTitle}>Configuración</Text><Text style={styles.actionDesc}>Tarifas y capacidad</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/reportes")}>
            <View style={[styles.actionIconBox, { backgroundColor: "#fef3c7" }]}><Text style={styles.actionEmoji}>📊</Text></View>
            <View><Text style={styles.actionTitle}>Reportes</Text><Text style={styles.actionDesc}>Estadísticas e ingresos</Text></View>
          </TouchableOpacity>
        </>
      )}

      {/* Estacionamientos cercanos */}
      <Text style={styles.seccionTitle}>Estacionamientos Cercanos</Text>
      <Text style={styles.seccionSub}>Con mejor disponibilidad de espacios</Text>

      {ESTACIONAMIENTOS.map((est) => {
        const libresEst = est.total - est.ocupados;
        const pct = Math.round((libresEst / est.total) * 100);
        const color = getColorDisponibilidad(pct);
        const dist = ubicacion ? calcularDistancia(ubicacion.lat, ubicacion.lng, est.lat, est.lng) : "—";

        return (
          <View key={est.id} style={styles.estCard}>
            <View style={styles.estHeader}>
              <View style={styles.estLeft}>
                <View style={[styles.estDot, { backgroundColor: "#dcfce7" }]}><Text>📍</Text></View>
                <View>
                  <Text style={styles.estNombre}>{est.nombre}</Text>
                  <Text style={styles.estDir}>{est.direccion}</Text>
                  <Text style={styles.estDist}>✈ {dist} km</Text>
                </View>
              </View>
              <Text style={[styles.estLibres, { color }]}>{libresEst}<Text style={styles.estLibresLabel}>{"\n"}libres</Text></Text>
            </View>

            {/* Mini mapa simulado */}
            <View style={styles.miniMapa}>
              {/* Grid de calles */}
              {[0,1,2,3,4].map(i => (
                <View key={`h${i}`} style={[styles.gridLine, { top: `${i * 25}%` as any, width: "100%" }]} />
              ))}
              {[0,1,2,3,4].map(i => (
                <View key={`v${i}`} style={[styles.gridLine, { left: `${i * 25}%` as any, height: "100%", width: 1 }]} />
              ))}
              {/* Pin */}
              <View style={styles.mapPin}>
                <Text style={styles.mapPinIcon}>📍</Text>
                <View style={styles.mapLabel}>
                  <Text style={styles.mapLabelText}>{est.nombre}</Text>
                  <Text style={styles.mapLabelCoords}>{est.lat}, {est.lng}</Text>
                </View>
              </View>
              {/* Brújula */}
              <View style={styles.brujula}><Text style={styles.brujulaText}>N</Text></View>
            </View>

            {/* Stats */}
            <View style={styles.estStats}>
              <View style={styles.estStatItem}>
                <Text style={styles.estStatLabel}>Total</Text>
                <Text style={styles.estStatNum}>{est.total}</Text>
              </View>
              <View style={[styles.estStatItem, { backgroundColor: "#f0fdf4" }]}>
                <Text style={[styles.estStatLabel, { color: "#22C55E" }]}>Libres</Text>
                <Text style={[styles.estStatNum, { color: "#22C55E" }]}>{libresEst}</Text>
              </View>
              <View style={[styles.estStatItem, { backgroundColor: "#fff5f5" }]}>
                <Text style={[styles.estStatLabel, { color: "#EF4444" }]}>Ocupados</Text>
                <Text style={[styles.estStatNum, { color: "#EF4444" }]}>{est.ocupados}</Text>
              </View>
            </View>

            {/* Barra disponibilidad */}
            <View style={styles.barraRow}>
              <Text style={styles.barraLabel}>Disponibilidad</Text>
              <Text style={[styles.barraPct, { color }]}>{pct}%</Text>
            </View>
            <View style={styles.barraFondo}>
              <View style={[styles.barraRelleno, { width: `${pct}%` as any, backgroundColor: color }]} />
            </View>
          </View>
        );
      })}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { backgroundColor: "#2563EB", padding: 20, paddingTop: 60, paddingBottom: 24 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  subtitle: { fontSize: 13, color: "#bfdbfe" },
  menuIcon: { fontSize: 24, color: "#fff" },
  cardsRow: { flexDirection: "row", gap: 10 },
  card: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  cardIcon: { fontSize: 20, marginBottom: 4 },
  cardNum: { fontSize: 26, fontWeight: "bold", color: "#fff" },
  cardLabel: { fontSize: 11, color: "#fff", marginTop: 2 },
  actionBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 12, marginTop: 10, borderRadius: 12, padding: 16, gap: 14, elevation: 1 },
  actionIconBox: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  actionEmoji: { fontSize: 22 },
  actionTitle: { fontSize: 15, fontWeight: "bold", color: "#111" },
  actionDesc: { fontSize: 12, color: "#888", marginTop: 2 },
  seccionTitle: { fontSize: 18, fontWeight: "bold", margin: 12, marginBottom: 2, marginTop: 20 },
  seccionSub: { fontSize: 12, color: "#888", marginHorizontal: 12, marginBottom: 8 },
  estCard: { backgroundColor: "#fff", borderRadius: 12, marginHorizontal: 12, marginBottom: 12, padding: 16, elevation: 1 },
  estHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  estLeft: { flexDirection: "row", gap: 10, flex: 1 },
  estDot: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  estNombre: { fontSize: 15, fontWeight: "bold" },
  estDir: { fontSize: 12, color: "#666", marginTop: 2 },
  estDist: { fontSize: 11, color: "#888", marginTop: 2 },
  estLibres: { fontSize: 24, fontWeight: "bold", textAlign: "right" },
  estLibresLabel: { fontSize: 11, color: "#888" },
  miniMapa: { height: 100, backgroundColor: "#f0fdf4", borderRadius: 8, marginBottom: 12, overflow: "hidden", position: "relative", borderWidth: 1, borderColor: "#e5e7eb" },
  gridLine: { position: "absolute", backgroundColor: "#d1fae5", height: 1 },
  mapPin: { position: "absolute", top: "30%", left: "40%", alignItems: "center" },
  mapPinIcon: { fontSize: 24 },
  mapLabel: { backgroundColor: "#fff", borderRadius: 4, padding: 3, elevation: 2, marginTop: 2 },
  mapLabelText: { fontSize: 8, fontWeight: "bold" },
  mapLabelCoords: { fontSize: 7, color: "#888" },
  brujula: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", elevation: 2 },
  brujulaText: { fontSize: 9, fontWeight: "bold" },
  estStats: { flexDirection: "row", gap: 8, marginBottom: 10 },
  estStatItem: { flex: 1, backgroundColor: "#f9fafb", borderRadius: 8, padding: 10, alignItems: "center" },
  estStatLabel: { fontSize: 11, color: "#888" },
  estStatNum: { fontSize: 18, fontWeight: "bold", color: "#374151" },
  barraRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  barraLabel: { fontSize: 11, color: "#888" },
  barraPct: { fontSize: 11, fontWeight: "bold" },
  barraFondo: { height: 8, backgroundColor: "#f3f4f6", borderRadius: 4, overflow: "hidden", marginBottom: 4 },
  barraRelleno: { height: 8, borderRadius: 4 },
});