import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";

export default function TabLayout() {
  const [rol, setRol] = useState<string>("operador");

  useEffect(() => {
    AsyncStorage.getItem("saved_rol").then((r) => {
      if (r) setRol(r);
    });
  }, []);

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#007AFF" }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="entrada"
        options={{
          title: "Entrada",
          tabBarIcon: ({ color, size }) => <Ionicons name="car" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="salida"
        options={{
          title: "Salida",
          tabBarIcon: ({ color, size }) => <Ionicons name="exit" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: "Historial",
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="configuracion"
        options={{
          title: "Config",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
          tabBarItemStyle: rol !== "admin" ? { display: "none" } : {},
        }}
      />
      <Tabs.Screen
        name="reportes"
        options={{
          title: "Reportes",
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
          tabBarItemStyle: rol !== "admin" ? { display: "none" } : {},
        }}
      />
    </Tabs>
  );
}