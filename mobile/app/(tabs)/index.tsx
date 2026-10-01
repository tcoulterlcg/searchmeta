import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Wordmark } from "../../components/Logo";
import { supabase } from "../../lib/supabase";
import { colors, ui } from "../../lib/theme";
import { SOURCES, sourceName, type Match } from "../../lib/types";

const LIMIT = 300;
const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "price_asc", label: "Price ↑" },
  { id: "price_desc", label: "Price ↓" },
  { id: "ending", label: "Ending soon" },
] as const;
type Sort = (typeof SORTS)[number]["id"];

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function formatLabel(f: string[]) {
  if (f.includes("auction")) return "Auction";
  if (f.includes("buy_it_now")) return f.includes("best_offer") ? "Buy Now / Offer" : "Buy Now";
  return "";
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[ui.chip, on && ui.chipOn]}>
      <Text style={[ui.chipText, on && ui.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export default function Alerts() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [searches, setSearches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [searchId, setSearchId] = useState<string | null>(null);
  const [sites, setSites] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("newest");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("matches")
      .select("id, saved_search_id, label, created_at, seen, listing:listings!inner(*), saved_search:saved_searches(name)")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (searchId) query = query.eq("saved_search_id", searchId);
    if (sites.length) query = query.in("listing.source", sites);
    for (const word of debouncedQ.replace(/[%_\\]/g, " ").split(/\s+/).filter(Boolean).slice(0, 8)) {
      query = query.ilike("listing.title", `%${word}%`);
    }
    const [{ data }, { data: s }] = await Promise.all([
      query,
      supabase.from("saved_searches").select("id, name").order("name"),
    ]);
    const rows = ((data ?? []) as unknown as Match[]).filter((m) => m.listing);
    setMatches(rows);
    setSearches((s ?? []) as { id: string; name: string }[]);
    setLoading(false);

    const unseen = rows.filter((m) => !m.seen).map((m) => m.id);
    if (unseen.length) supabase.from("matches").update({ seen: true }).in("id", unseen).then(() => {});
  }, [searchId, sites, debouncedQ]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sorted = useMemo(() => {
    const list = [...matches];
    if (sort === "price_asc" || sort === "price_desc") {
      const dir = sort === "price_asc" ? 1 : -1;
      list.sort((a, b) => {
        if (a.listing.price == null) return 1;
        if (b.listing.price == null) return -1;
        return (Number(a.listing.price) - Number(b.listing.price)) * dir;
      });
    } else if (sort === "ending") {
      const now = Date.now();
      const t = (m: Match) => {
        const v = m.listing.ends_at ? new Date(m.listing.ends_at).getTime() : Infinity;
        return v < now ? Infinity : v;
      };
      list.sort((a, b) => t(a) - t(b));
    }
    return list;
  }, [matches, sort]);

  const filtered = Boolean(debouncedQ || searchId || sites.length);

  return (
    <SafeAreaView style={ui.screen} edges={["top"]}>
      <FlatList
        data={sorted}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 6 }}>
            <Wordmark />
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={ui.h1}>Alerts</Text>
              <Text style={ui.muted}>
                {sorted.length}
                {sorted.length === LIMIT ? "+" : ""} listings
              </Text>
            </View>
            <TextInput
              style={ui.input}
              placeholder="Filter by title, player, set, grade…"
              placeholderTextColor={colors.muted}
              value={q}
              onChangeText={setQ}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label="All searches" on={!searchId} onPress={() => setSearchId(null)} />
              {searches.map((s) => (
                <Chip key={s.id} label={s.name} on={searchId === s.id} onPress={() => setSearchId(searchId === s.id ? null : s.id)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SOURCES.map((s) => {
                const on = sites.includes(s.id);
                return (
                  <Chip
                    key={s.id}
                    label={s.name}
                    on={on}
                    onPress={() => setSites(on ? sites.filter((x) => x !== s.id) : [...sites, s.id])}
                  />
                );
              })}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SORTS.map((s) => (
                <Chip key={s.id} label={s.label} on={sort === s.id} onPress={() => setSort(s.id)} />
              ))}
              {filtered && (
                <Pressable
                  onPress={() => {
                    setQ("");
                    setSearchId(null);
                    setSites([]);
                  }}
                  style={{ justifyContent: "center", paddingHorizontal: 8 }}
                >
                  <Text style={ui.muted}>Clear</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={[ui.card, { alignItems: "center", borderStyle: "dashed", paddingVertical: 32 }]}>
              <Text style={[ui.text, { fontWeight: "600" }]}>{filtered ? "No alerts match these filters" : "Nothing yet"}</Text>
              {!filtered && (
                <Text style={[ui.muted, { marginTop: 6, textAlign: "center" }]}>
                  Add a saved search and new listings that match will show up here.
                </Text>
              )}
            </View>
          )
        }
        renderItem={({ item: m }) => {
          const l = m.listing;
          return (
            <Pressable onPress={() => WebBrowser.openBrowserAsync(l.url)} style={({ pressed }) => [ui.card, { flexDirection: "row", gap: 12, padding: 10 }, pressed && { opacity: 0.7 }]}>
              <View style={{ width: 76, height: 76, borderRadius: 10, overflow: "hidden", backgroundColor: colors.ink }}>
                {l.image_url ? <Image source={{ uri: l.image_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {!m.seen && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.signal }} />}
                  <Text style={{ color: colors.signal, fontSize: 12, fontWeight: "700" }}>{sourceName(l.source)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>
                    · {m.saved_search?.name ?? m.label}
                  </Text>
                </View>
                <Text style={[ui.text, { fontSize: 14, fontWeight: "500", marginTop: 3 }]} numberOfLines={2}>
                  {l.title}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                  {l.price != null && (
                    <Text style={[ui.text, { fontWeight: "700", fontSize: 14 }]}>${Number(l.price).toLocaleString("en-US")}</Text>
                  )}
                  <Text style={[ui.muted, { fontSize: 13 }]}>{formatLabel(l.buying_formats)}</Text>
                  <Text style={[ui.muted, { fontSize: 12, marginLeft: "auto" }]}>{ago(m.created_at)}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
