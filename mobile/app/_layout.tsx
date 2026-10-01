import * as Notifications from "expo-notifications";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { registerForPush } from "../lib/push";
import { SessionProvider, useSession } from "../lib/session";
import { colors } from "../lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  // Send signed-out users to login, signed-in users away from it.
  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync().catch(() => {});
    const onLogin = segments[0] === "login";
    if (!session && !onLogin) router.replace("/login");
    if (session && onLogin) router.replace("/");
  }, [session, loading, segments, router]);

  // Keep this phone's push token attached to the account (no prompt here).
  useEffect(() => {
    if (session) registerForPush(false).catch(() => {});
  }, [session]);

  // Tapping a notification opens the listing.
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("http")) WebBrowser.openBrowserAsync(url);
    };
    Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.ink },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="search/[id]" options={{ title: "Saved search", presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
