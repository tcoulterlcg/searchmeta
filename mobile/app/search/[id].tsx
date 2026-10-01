import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { SOURCES, type BuyingFormat, type SavedSearch, type SourceId } from "../../lib/types";

const SITE_OPTIONS = SOURCES.filter((s) => s.id !== "heritage");
const ALL_SITES: SourceId[] = [...SITE_OPTIONS.map((s) => s.id), "heritage"];
const FORMATS: { id: BuyingFormat; label: string }[] = [
  { id: "auction", label: "Auction" },
  { id: "buy_it_now", label: "Buy It Now" },
  { id: "best_offer", label: "Accepts Offers" },
];
const CONDITIONS = [
  { id: "any", label: "Any" },
  { id: "graded", label: "Graded" },
  { id: "ungraded", label: "Ungraded" },
] as const;

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[ui.chip, on && ui.chipOn]}>
      <Text style={[ui.chipText, on && ui.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={ui.label}>{label}</Text>
      {children}
    </View>
  );
}

const toNum = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return s.trim() && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Requires at least one word that isn't an exclusion. */
const hasPositiveTerm = (k: string) => k.trim().split(/\s+/).some((w) => w && !w.startsWith("-"));

export default function SearchEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [name, setName] = useState("");
  const [searchDescription, setSearchDescription] = useState(false);
  const [sources, setSources] = useState<SourceId[]>(ALL_SITES);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [formats, setFormats] = useState<BuyingFormat[]>([]);
  const [condition, setCondition] = useState<SavedSearch["condition"]>("any");
  const [freeShipping, setFreeShipping] = useState(false);
  const [usOnly, setUsOnly] = useState(false);
  const [notify, setNotify] = useState(true);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isNew ? "New saved search" : "Edit search" });
    if (isNew) return;
    supabase
      .from("saved_searches")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        const s = data as SavedSearch | null;
        if (s) {
          setKeywords(s.keywords);
          setName(s.name);
          setSearchDescription(s.search_description);
          setSources(s.sources);
          setMinPrice(s.min_price != null ? String(s.min_price) : "");
          setMaxPrice(s.max_price != null ? String(s.max_price) : "");
          setFormats(s.buying_formats);
          setCondition(s.condition);
          setFreeShipping(s.free_shipping);
          setUsOnly(s.located_in === "US");
          setNotify(s.notify);
        }
        setLoading(false);
      });
  }, [id, isNew, navigation]);

  async function save() {
    const k = keywords.trim();
    if (!hasPositiveTerm(k)) {
      Alert.alert("Add a keyword", "Enter at least one word to search for.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const picked = sources.filter((s) => s !== "heritage");
    const row = {
      user_id: user.id,
      name: name.trim() || k.slice(0, 60),
      keywords: k,
      search_description: searchDescription,
      sources: picked.length ? [...picked, "heritage"] : ALL_SITES,
      min_price: toNum(minPrice),
      max_price: toNum(maxPrice),
      buying_formats: formats,
      condition,
      free_shipping: freeShipping,
      located_in: usOnly ? "US" : null,
      notify,
      updated_at: new Date().toISOString(),
    };
    const { error } = isNew
      ? await supabase.from("saved_searches").insert(row)
      : await supabase.from("saved_searches").update(row).eq("id", id);
    setSaving(false);
    if (error) Alert.alert("Couldn't save", error.message);
    else router.back();
  }

  function remove() {
    Alert.alert("Delete this search?", "Its alerts will be removed too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("saved_searches").delete().eq("id", id);
          router.back();
        },
      },
    ]);
  }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (loading) {
    return (
      <View style={[ui.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.signal} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Field label="Keywords">
          <TextInput
            style={[ui.input, { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}
            placeholder="kucherov shield -reprint"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={keywords}
            onChangeText={setKeywords}
          />
          <Pressable onPress={() => setShowTips(!showTips)} style={{ marginTop: 8 }}>
            <Text style={ui.muted}>{showTips ? "Hide search tips" : "Search tips (same as eBay)"}</Text>
          </Pressable>
          {showTips && (
            <View style={{ marginTop: 8, gap: 4 }}>
              {[
                ["kucherov shield", "all words, any order"],
                ['"logo patch"', "exact phrase"],
                ["-reprint", "exclude a word"],
                ["(psa,bgs,sgc)", "any of these"],
                ["kuch*", "word starts with"],
              ].map(([a, b]) => (
                <Text key={a} style={[ui.muted, { fontSize: 13 }]}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{a}</Text>  {b}
                </Text>
              ))}
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <Text style={ui.muted}>Include description in search</Text>
            <Switch value={searchDescription} onValueChange={setSearchDescription} trackColor={{ false: colors.line, true: colors.signal }} thumbColor="#fff" />
          </View>
        </Field>

        <Field label="Name (optional)">
          <TextInput style={ui.input} placeholder="Kucherov Shield" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />
        </Field>

        <Field label="Sites">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SITE_OPTIONS.map((s) => (
              <Chip key={s.id} label={s.name} on={sources.includes(s.id)} onPress={() => setSources(toggle(sources, s.id))} />
            ))}
          </View>
          <Text style={[ui.muted, { fontSize: 12, marginTop: 6 }]}>Heritage alerts are set up in Settings.</Text>
        </Field>

        <Field label="Price">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput style={[ui.input, { flex: 1 }]} placeholder="$ Min" placeholderTextColor={colors.muted} keyboardType="decimal-pad" value={minPrice} onChangeText={setMinPrice} />
            <Text style={ui.muted}>to</Text>
            <TextInput style={[ui.input, { flex: 1 }]} placeholder="$ Max" placeholderTextColor={colors.muted} keyboardType="decimal-pad" value={maxPrice} onChangeText={setMaxPrice} />
          </View>
        </Field>

        <Field label="Buying format">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {FORMATS.map((f) => (
              <Chip key={f.id} label={f.label} on={formats.includes(f.id)} onPress={() => setFormats(toggle(formats, f.id))} />
            ))}
          </View>
          <Text style={[ui.muted, { fontSize: 12, marginTop: 6 }]}>None selected = all formats</Text>
        </Field>

        <Field label="Condition">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CONDITIONS.map((c) => (
              <Chip key={c.id} label={c.label} on={condition === c.id} onPress={() => setCondition(c.id)} />
            ))}
          </View>
        </Field>

        <Field label="Shipping & location">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label="Free shipping" on={freeShipping} onPress={() => setFreeShipping(!freeShipping)} />
            <Chip label="US only" on={usOnly} onPress={() => setUsOnly(!usOnly)} />
          </View>
        </Field>

        <View style={[ui.card, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
          <Text style={ui.text}>Notify me about new matches</Text>
          <Switch value={notify} onValueChange={setNotify} trackColor={{ false: colors.line, true: colors.signal }} thumbColor="#fff" />
        </View>

        <Pressable style={[ui.btn, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}>
          <Text style={ui.btnText}>{saving ? "Saving…" : isNew ? "Save search" : "Save changes"}</Text>
        </Pressable>

        {!isNew && (
          <Pressable onPress={remove} style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ color: colors.danger, fontWeight: "600" }}>Delete this search</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
