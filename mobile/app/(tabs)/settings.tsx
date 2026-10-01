import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WEB_URL } from "../../lib/config";
import { getPushStatus, registerForPush, unregisterPush, type PushStatus } from "../../lib/push";
import { useSession } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";

const PUSH_TEXT: Record<PushStatus, string> = {
  on: "On",
  off: "Off",
  denied: "Blocked in your phone's Settings",
  unsupported: "Not available on this device",
  "not-configured": "Allowed. Finishes setting up in the App Store build",
};

async function api(method: "GET" | "DELETE") {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${WEB_URL}/api/account`, {
    method,
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={ui.card}>
      <Text style={ui.label}>{title}</Text>
      {children}
    </View>
  );
}

export default function Settings() {
  const { session } = useSession();
  const [push, setPush] = useState<PushStatus>("off");
  const [inbound, setInbound] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPushStatus().then(setPush);
      api("GET")
        .then((r: { inboundAddress: string | null }) => setInbound(r.inboundAddress))
        .catch(() => setInbound(null));
    }, []),
  );

  async function enablePush() {
    const s = await registerForPush(true);
    setPush(s);
    if (s === "denied") Linking.openSettings();
  }

  async function signOut() {
    await unregisterPush();
    await supabase.auth.signOut();
  }

  function deleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account, saved searches, and alerts. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              await unregisterPush();
              await api("DELETE");
              await supabase.auth.signOut();
            } catch (e) {
              Alert.alert("Couldn't delete account", e instanceof Error ? e.message : "Please try again.");
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Text style={[ui.h1, { marginBottom: 4 }]}>Settings</Text>

        <Section title="Account">
          <Text style={ui.text}>{session?.user.email}</Text>
        </Section>

        <Section title="Notifications">
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={[ui.text, { flex: 1 }]}>{PUSH_TEXT[push]}</Text>
            {push === "off" && (
              <Pressable style={[ui.btn, { paddingVertical: 8 }]} onPress={enablePush}>
                <Text style={ui.btnText}>Turn on</Text>
              </Pressable>
            )}
            {push === "denied" && (
              <Pressable style={[ui.btnGhost, { paddingVertical: 8 }]} onPress={() => Linking.openSettings()}>
                <Text style={ui.btnGhostText}>Open Settings</Text>
              </Pressable>
            )}
          </View>
        </Section>

        <Section title="Heritage alerts">
          {inbound ? (
            <>
              <Text style={ui.muted}>Heritage doesn&apos;t allow automated searching. Forward Heritage&apos;s Want List emails here instead:</Text>
              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync(inbound);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                style={[ui.input, { marginTop: 10, flexDirection: "row", justifyContent: "space-between" }]}
              >
                <Text style={[ui.text, { flex: 1, fontSize: 13 }]} numberOfLines={1}>{inbound}</Text>
                <Text style={{ color: colors.signal, fontWeight: "600" }}>{copied ? "Copied ✓" : "Copy"}</Text>
              </Pressable>
            </>
          ) : (
            <Text style={ui.muted}>Coming soon.</Text>
          )}
        </Section>

        <Section title="About">
          <View style={{ gap: 12 }}>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/support`)}>
              <Text style={ui.text}>Help & support</Text>
            </Pressable>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)}>
              <Text style={ui.text}>Privacy policy</Text>
            </Pressable>
          </View>
        </Section>

        <Pressable style={ui.btnGhost} onPress={signOut}>
          <Text style={ui.btnGhostText}>Sign out</Text>
        </Pressable>
        <Pressable onPress={deleteAccount} style={{ alignItems: "center", paddingVertical: 8 }}>
          <Text style={{ color: colors.danger, fontWeight: "600" }}>Delete account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
