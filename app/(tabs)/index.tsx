import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../services/firebase";

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

// Abre Google Maps con la ubicacion del estacionamiento
const abrirEnMapa = (est: any) => {
  const label = encodeURIComponent(est.nombre);
  const url = `https://www.google.com/maps/search/?api=1&query=${est.lat},${est.lng}&query_place_id=${label}`;
  Linking.openURL(url).catch(() => {
    // Fallback a Maps de Apple o Waze
    Linking.openURL(`maps://app?daddr=${est.lat},${est.lng}&ll=${est.lat},${est.lng}&q=${label}`).catch(() => {
      Alert.alert("Error", "No se pudo abrir el mapa.");
    });
  });
};

// Abre Google Maps con ruta desde ubicacion actual
const abrirRuta = (est: any) => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${est.lat},${est.lng}&travelmode=driving`;
  Linking.openURL(url).catch(() => {
    Alert.alert("Error", "No se pudo abrir la ruta.");
  });
};

export default function Inicio() {
  const [activos, setActivos] = useState(0);
  const [rol, setRol] = useState("admin");
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [estacionamientoCercano, setEstacionamientoCercano] = useState<any>(null);
  const [alertaMostrada, setAlertaMostrada] = useState(false);
  const total = 50;
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem("saved_rol").then((r) => { if (r) setRol(r); });
    const q = query(collection(db, "registros"), where("activo", "==", true));
    const unsub = onSnapshot(q, (snap) => setActivos(snap.size), () => {});
    obtenerUbicacion();
    return unsub;
  }, []);

  useEffect(() => {
    if (ubicacion) encontrarEstacionamientoCercano();
  }, [ubicacion]);

  const obtenerUbicacion = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setUbicacion({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {}
  };

  const encontrarEstacionamientoCercano = () => {
    if (!ubicacion) return;
    const conDistancia = ESTACIONAMIENTOS.map((est) => ({
      ...est,
      distancia: parseFloat(calcularDistancia(ubicacion.lat, ubicacion.lng, est.lat, est.lng)),
    })).sort((a, b) => a.distancia - b.distancia);

    const cercano = conDistancia[0];
    setEstacionamientoCercano(cercano);

    if (!alertaMostrada && cercano.distancia < 5) {
      setAlertaMostrada(true);
      setTimeout(() => {
        Alert.alert(
          "Estacionamiento mas cercano",
          `${cercano.nombre}\n${cercano.direccion}\n${cercano.total - cercano.ocupados} espacios libres\n${cercano.distancia} km`,
          [
            { text: "Ver en mapa", onPress: () => abrirRuta(cercano) },
            { text: "OK" }
          ]
        );
      }, 1000);
    }
  };

  const handleLogout = () => {
    Alert.alert("Cerrar sesion", "Esta seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir", onPress: async () => {
          await AsyncStorage.removeItem("saved_rol");
          signOut(auth);
        }
      },
    ]);
  };

  const getColorDisponibilidad = (pct: number) => {
    if (pct > 70) return "#22C55E";
    if (pct >= 40) return "#F59E0B";
    return "#EF4444";
  };

  const libres = total - activos;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>ParkSmart</Text>
            <Text style={styles.subtitle}>Dashboard — {rol === "admin" ? "Administrador" : "Operador"}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.menuBtn}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardsRow}>
          <View style={[styles.card, { backgroundColor: "#3b82f6" }]}>
            <Text style={styles.cardIcon}>🚗</Text>
            <Text style={styles.cardNum}>{activos}</Text>
            <Text style={styles.cardLabel}>Dentro</Text>
          </View>
          <View style={[styles.card, { backgroundColor: "#14b8a6" }]}>
            <Text style={styles.cardIcon}>🅿️</Text>
            <Text style={styles.cardNum}>{libres}</Text>
            <Text style={styles.cardLabel}>Libres</Text>
          </View>
          <View style={[styles.card, { backgroundColor: "#8b5cf6" }]}>
            <Text style={styles.cardIcon}>📊</Text>
            <Text style={styles.cardNum}>{total}</Text>
            <Text style={styles.cardLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Estacionamiento mas cercano */}
      {estacionamientoCercano && (
        <View style={styles.cercanoAlert}>
          <View style={styles.cercanoInfo}>
            <Text style={styles.cercanoTitle}>📍 Mas cercano a ti</Text>
            <Text style={styles.cercanoNombre}>{estacionamientoCercano.nombre}</Text>
            <Text style={styles.cercanoDesc}>
              {estacionamientoCercano.distancia} km  •  {estacionamientoCercano.total - estacionamientoCercano.ocupados} espacios libres
            </Text>
          </View>
          <View style={styles.cercanoAcciones}>
            <TouchableOpacity style={styles.mapaBtn} onPress={() => abrirRuta(estacionamientoCercano)}>
              <Text style={styles.mapaBtnText}>🗺️ Ruta</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Acciones */}
      <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/entrada")}>
        <View style={[styles.actionIconBox, { backgroundColor: "#dcfce7" }]}><Text style={styles.actionEmoji}>🚗</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Registrar Entrada</Text>
          <Text style={styles.actionDesc}>Capturar vehiculo entrante</Text>
        </View>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/camara")}>
        <View style={[styles.actionIconBox, { backgroundColor: "#f3f4f6" }]}><Text style={styles.actionEmoji}>📷</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Capturar Placa</Text>
          <Text style={styles.actionDesc}>Usar cámara para leer placas</Text>
        </View>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/salida")}>
        <View style={[styles.actionIconBox, { backgroundColor: "#fee2e2" }]}><Text style={styles.actionEmoji}>🚪</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Registrar Salida</Text>
          <Text style={styles.actionDesc}>Calcular tiempo y costo</Text>
        </View>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/historial")}>
        <View style={[styles.actionIconBox, { backgroundColor: "#dbeafe" }]}><Text style={styles.actionEmoji}>📋</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Historial</Text>
          <Text style={styles.actionDesc}>Consultar movimientos</Text>
        </View>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/configuracion")}>
        <View style={[styles.actionIconBox, { backgroundColor: "#f3f4f6" }]}><Text style={styles.actionEmoji}>⚙️</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Configuracion</Text>
          <Text style={styles.actionDesc}>Tarifas y capacidad</Text>
        </View>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/reportes")}>
        <View style={[styles.actionIconBox, { backgroundColor: "#fef3c7" }]}><Text style={styles.actionEmoji}>📊</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Reportes</Text>
          <Text style={styles.actionDesc}>Estadisticas e ingresos</Text>
        </View>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      {/* Lista de estacionamientos con boton de mapa */}
      <Text style={styles.seccionTitle}>Estacionamientos</Text>
      {ESTACIONAMIENTOS.map((est) => {
        const libresEst = est.total - est.ocupados;
        const pct = Math.round((libresEst / est.total) * 100);
        const color = getColorDisponibilidad(pct);
        const dist = ubicacion ? calcularDistancia(ubicacion.lat, ubicacion.lng, est.lat, est.lng) : "---";
        const esCercano = estacionamientoCercano?.id === est.id;

        return (
          <View key={est.id} style={[styles.estCard, esCercano && styles.estCardCercano]}>
            <View style={styles.estHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.estNombre}>{est.nombre} {esCercano ? "⭐" : ""}</Text>
                <Text style={styles.estDir}>{est.direccion}</Text>
                <Text style={styles.estDist}>📏 {dist} km de ti</Text>
              </View>
              <Text style={[styles.estLibres, { color }]}>{libresEst}<Text style={styles.estLibresLabel}>{"\n"}libres</Text></Text>
            </View>
            <View style={styles.barraFondo}>
              <View style={[styles.barraRelleno, { width: `${pct}%` as any, backgroundColor: color }]} />
            </View>
            <Text style={[styles.barraPct, { color }]}>{pct}% disponible</Text>

            {/* ✅ Botones de mapa */}
            <View style={styles.estBotones}>
              <TouchableOpacity style={styles.estMapaBtn} onPress={() => abrirEnMapa(est)}>
                <Text style={styles.estMapaBtnText}>📍 Ver en mapa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.estMapaBtn, styles.estRutaBtn]} onPress={() => abrirRuta(est)}>
                <Text style={[styles.estMapaBtnText, { color: "#fff" }]}>🗺️ Como llegar</Text>
              </TouchableOpacity>
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
  menuBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  menuIcon: { fontSize: 24, color: "#fff" },
  cardsRow: { flexDirection: "row", gap: 10 },
  card: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  cardIcon: { fontSize: 20, marginBottom: 4 },
  cardNum: { fontSize: 26, fontWeight: "bold", color: "#fff" },
  cardLabel: { fontSize: 11, color: "#fff", marginTop: 2 },
  cercanoAlert: { flexDirection: "row", alignItems: "center", backgroundColor: "#dcfce7", margin: 12, padding: 16, borderRadius: 14, borderLeftWidth: 4, borderLeftColor: "#22C55E" },
  cercanoInfo: { flex: 1 },
  cercanoTitle: { fontSize: 11, fontWeight: "bold", color: "#166534", marginBottom: 2 },
  cercanoNombre: { fontSize: 15, fontWeight: "bold", color: "#111", marginBottom: 2 },
  cercanoDesc: { fontSize: 12, color: "#6b7280" },
  cercanoAcciones: { gap: 6 },
  mapaBtn: { backgroundColor: "#22C55E", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  mapaBtnText: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  actionBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 12, marginTop: 10, borderRadius: 14, padding: 16, gap: 14, elevation: 1 },
  actionIconBox: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  actionEmoji: { fontSize: 22 },
  actionTitle: { fontSize: 15, fontWeight: "bold", color: "#111" },
  actionDesc: { fontSize: 12, color: "#888", marginTop: 2 },
  actionArrow: { fontSize: 22, color: "#d1d5db", fontWeight: "300" },
  seccionTitle: { fontSize: 18, fontWeight: "bold", margin: 12, marginBottom: 8, marginTop: 20 },
  estCard: { backgroundColor: "#fff", borderRadius: 14, marginHorizontal: 12, marginBottom: 12, padding: 16, elevation: 1 },
  estCardCercano: { borderWidth: 2, borderColor: "#22C55E", backgroundColor: "#f0fdf4" },
  estHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  estNombre: { fontSize: 15, fontWeight: "bold" },
  estDir: { fontSize: 12, color: "#666", marginTop: 2 },
  estDist: { fontSize: 11, color: "#888", marginTop: 2 },
  estLibres: { fontSize: 26, fontWeight: "bold", textAlign: "right" },
  estLibresLabel: { fontSize: 11, color: "#888" },
  barraFondo: { height: 8, backgroundColor: "#f3f4f6", borderRadius: 4, overflow: "hidden", marginBottom: 4 },
  barraRelleno: { height: 8, borderRadius: 4 },
  barraPct: { fontSize: 11, fontWeight: "bold", marginBottom: 12 },
  estBotones: { flexDirection: "row", gap: 8 },
  estMapaBtn: { flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, paddingVertical: 8, alignItems: "center", backgroundColor: "#f9fafb" },
  estRutaBtn: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  estMapaBtnText: { fontSize: 13, fontWeight: "600", color: "#374151" },
});
