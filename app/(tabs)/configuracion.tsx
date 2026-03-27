import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";

export default function Configuracion() {
  const [tarifa, setTarifa] = useState("20");
  const [espacios, setEspacios] = useState("50");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarConfig();
  }, []);

  const cargarConfig = async () => {
    try {
      const snap = await getDoc(doc(db, "configuracion", "general"));
      if (snap.exists()) {
        const data = snap.data();
        setTarifa(String(data.tarifaPorHora || 20));
        setEspacios(String(data.espaciosTotales || 50));
      }
    } catch (e) {}
  };

  const guardarConfig = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, "configuracion", "general"), {
        tarifaPorHora: Number(tarifa),
        espaciosTotales: Number(espacios),
      });
      Alert.alert("✅ Guardado", "Configuración actualizada correctamente");
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚙️ Configuración</Text>
      <Text style={styles.subtitle}>Solo visible para administradores</Text>

      <View style={styles.card}>
        <Text style={styles.label}>💵 Tarifa por hora (MXN)</Text>
        <TextInput
          style={styles.input}
          value={tarifa}
          onChangeText={setTarifa}
          keyboardType="numeric"
        />

        <Text style={styles.label}>🚗 Espacios totales</Text>
        <TextInput
          style={styles.input}
          value={espacios}
          onChangeText={setEspacios}
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={guardarConfig}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Guardar cambios</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f0f4f8", paddingTop: 60 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#6b7280", marginBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: "#f9fafb",
  },
  button: {
    backgroundColor: "#7C3AED",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});