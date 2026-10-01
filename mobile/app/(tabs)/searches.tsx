import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { SOURCES, type SavedSearch } from "../../lib/types";

function summary(s: SavedSearch): string[] {
  const out: string[] = [];
  out.push(s.sources.length >= SOURCES.length - 1 ? "All sites" : s.sources.map((id) => SOURCES.find((x) => x.id === id)?.name).join(", "));
  if (s.min_price != null || s.max_price != null) out.push(`$${s.min_price ?? 0}–${s.max_price != null ? `$${s.max_price}` : "any"}`);
  if (s.buying_formats.length) {
    out.push(s.buying_formats.map((f) => ({ auction: "Auction", buy_it_now: "Buy Now", best_offer: "Offers" })[f]).join(" / "));
  }
  if (s.condition !== "any") out.push(s.condition === "graded" ? "Graded" : "Ungraded");
  if (s.free_shipping) out.push("Free shipping");
  if (s.located_in) out.push("US only");
  return out;
}

export default function Searches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("saved_searches").select("*").order("created_at", { ascending: false });
    setSearches((data ?? []) as SavedSearch[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function toggle(s: SavedSearch, notify: boolean) {
    setSearches((list) => list.map((x) => (x.id === s.id ? { ...x, notify } : x)));
    await supabase.from("saved_searches").update({ notify }).eq("id", s.id);
  }

  return (
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <FlatList
        data={searches}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}
        ListHeaderComponent={
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={ui.h1}>Saved searches</Text>
            <Link href="/search/new" asChild>
              <Pressable style={[ui.btn, { paddingVertical: 8 }]}>
                <Text style={ui.btnText}>+ New</Text>
              </Pressable>
            </Link>
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={[ui.card, { alignItems: "center", paddingVertical: 32 }]}>
              <Text style={[ui.text, { fontWeight: "600" }]}>No saved searches yet</Text>
              <Text style={[ui.muted, { marginTop: 6, textAlign: "center" }]}>Save a search and we&apos;ll watch every auction house for it.</Text>
            </View>
          )
        }
        renderItem={({ item: s }) => (
          <View style={[ui.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
            <Link href={{ pathname: "/search/[id]", params: { id: s.id } }} asChild>
              <Pressable style={{ flex: 1, minWidth: 0 }}>
                <Text style={[ui.text, { fontWeight: "600" }]} numberOfLines={1}>{s.name}</Text>
                <Text style={[ui.muted, { fontFamily: "Menlo", fontSize: 13, marginTop: 2 }]} numberOfLines={1}>{s.keywords}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {summary(s).map((t) => (
                    <Text key={t} style={{ color: colors.muted, fontSize: 12, backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: "hidden" }}>
                      {t}
                    </Text>
                  ))}
                </View>
              </Pressable>
            </Link>
            <Switch
              value={s.notify}
              onValueChange={(v) => toggle(s, v)}
              trackColor={{ false: colors.line, true: colors.signal }}
              thumbColor="#fff"
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}
