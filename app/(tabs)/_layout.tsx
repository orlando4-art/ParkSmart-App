import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { initDB } from "../../services/database";

export default function TabLayout() {
  const [rol, setRol] = useState<string>("operador");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Inicializar SQLite aquí
    try { initDB(); } catch (e) { console.log("initDB error:", e); }

    const getRol = async () => {
      try {
        const r = await AsyncStorage.getItem("saved_rol");
        if (r) setRol(r);
      } catch (e) {
        console.error("Error obteniendo rol:", e);
      } finally {
        setLoading(false);
      }
    };
    getRol();
  }, []);

  if (loading) return null;

  const isAdmin = rol === "admin";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isAdmin ? "#2563EB" : "#22C55E",
        tabBarStyle: { paddingBottom: 4 },
      }}
    >
      {/* Inicio — solo admin */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          href: isAdmin ? undefined : null,
          tabBarItemStyle: isAdmin ? {} : { display: "none" },
        }}
      />

      {/* Entrada — ambos roles */}
      <Tabs.Screen
        name="entrada"
        options={{
          title: "Entrada",
          tabBarIcon: ({ color, size }) => <Ionicons name="car" size={size} color={color} />,
        }}
      />

      {/* Salida — ambos roles */}
      <Tabs.Screen
        name="salida"
        options={{
          title: "Salida",
          tabBarIcon: ({ color, size }) => <Ionicons name="exit" size={size} color={color} />,
        }}
      />

      {/* Historial — ambos roles */}
      <Tabs.Screen
        name="historial"
        options={{
          title: "Historial",
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />

      {/* Configuración — solo admin */}
      <Tabs.Screen
        name="configuracion"
        options={{
          title: "Config",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
          href: isAdmin ? undefined : null,
          tabBarItemStyle: isAdmin ? {} : { display: "none" },
        }}
      />

      {/* Reportes — solo admin */}
      <Tabs.Screen
        name="reportes"
        options={{
          title: "Reportes",
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
          href: isAdmin ? undefined : null,
          tabBarItemStyle: isAdmin ? {} : { display: "none" },
        }}
      />
    </Tabs>
  );
}
