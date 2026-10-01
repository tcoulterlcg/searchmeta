import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Show alerts even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushStatus = "on" | "off" | "denied" | "unsupported" | "not-configured";

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!Device.isDevice) return "unsupported";
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "denied") return "denied";
  if (status !== "granted") return "off";
  return "on";
}

/** Asks permission (if needed), gets this phone's push token, and saves it to the account. */
export async function registerForPush(prompt: boolean): Promise<PushStatus> {
  if (!Device.isDevice) return "unsupported";

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("alerts", {
      name: "Listing alerts",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#3ef08a",
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && prompt) status = (await Notifications.requestPermissionsAsync()).status;
  if (status === "denied") return "denied";
  if (status !== "granted") return "off";

  const id = projectId();
  if (!id) return "not-configured";

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("device_tokens").delete().eq("token", token).neq("user_id", user.id);
    await supabase
      .from("device_tokens")
      .upsert({ user_id: user.id, token, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: "token" });
  }
  return "on";
}

/** Removes this phone's token on sign-out so the next person doesn't get your alerts. */
export async function unregisterPush() {
  const id = projectId();
  if (!id || !Device.isDevice) return;
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    await supabase.from("device_tokens").delete().eq("token", token);
  } catch {
    // no token — nothing to remove
  }
}
