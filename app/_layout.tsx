import { Stack, useRouter, useSegments } from "expo-router";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth } from "../services/firebase";

export default function RootLayout() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const didSignOut = useRef(false);

  useEffect(() => {
    const init = async () => {
      if (!didSignOut.current) {
        didSignOut.current = true;
        await signOut(auth);
      }
      const unsub = onAuthStateChanged(auth, (firebaseUser: User | null) => {
        setUser(firebaseUser);
        setChecking(false);
      });
      return unsub;
    };
    init();
  }, []);

  useEffect(() => {
    if (checking) return;
    const inTabs = segments[0] === "(tabs)";
    const inRegister = segments[0] === "register";
    if (!user && inTabs) {
      router.replace("/login");
    } else if (user && !inTabs && !inRegister) {
      router.replace("/(tabs)");
    }
  }, [user, checking, segments]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}