import { Stack, useRouter, useSegments } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth } from "../services/firebase";

// ✅ NO importa database aquí — eso lo hace el tabs/_layout.tsx
export default function RootLayout() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Timeout: si Firebase tarda más de 8s, continuar sin sesión
    const timeout = setTimeout(() => {
      setChecking(false);
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(timeout);
      setUser(firebaseUser);
      setChecking(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (checking) return;
    const timer = setTimeout(() => {
      const inTabs = segments[0] === "(tabs)";
      const inRegister = segments[0] === "register";
      if (!user && inTabs) {
        router.replace("/login");
      } else if (user && !inTabs && !inRegister) {
        router.replace("/(tabs)");
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [user, checking, segments]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#2563EB" }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
