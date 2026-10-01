import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Wordmark } from "../components/Logo";
import { supabase } from "../lib/supabase";
import { colors, ui } from "../lib/theme";

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: "https://searchmeta.vercel.app/auth/callback" },
      });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Check your email to confirm your account, then sign in here.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMsg(error.message);
    }
    setBusy(false);
  }

  return (
    <SafeAreaView style={ui.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ marginBottom: 32 }}>
          <Wordmark size={34} />
        </View>
        <Text style={ui.h1}>{mode === "signup" ? "Create your account" : "Welcome back"}</Text>
        <Text style={[ui.muted, { marginTop: 6 }]}>One saved search. Every auction house.</Text>

        <View style={{ gap: 12, marginTop: 24 }}>
          <TextInput
            style={ui.input}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={ui.input}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable style={[ui.btn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
            <Text style={ui.btnText}>{busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}</Text>
          </Pressable>
        </View>

        {msg && <Text style={{ color: colors.warn, marginTop: 16 }}>{msg}</Text>}

        <Pressable onPress={() => setMode(mode === "signup" ? "signin" : "signup")} style={{ marginTop: 24 }}>
          <Text style={ui.muted}>
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
