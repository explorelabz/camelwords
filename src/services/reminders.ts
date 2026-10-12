import { Platform } from "react-native";
export async function setReminder(hour: number, minute: number) {
  if (Platform.OS === "web")
    throw new Error("リマインダーは iOS / Android アプリで設定できます。");
  const n = await import("expo-notifications");
  if (Platform.OS === "android")
    await n.setNotificationChannelAsync("study", {
      name: "学習リマインダー",
      importance: n.AndroidImportance.DEFAULT,
    });
  const permission = await n.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error("端末の設定で通知を許可してください。");
  await n.cancelAllScheduledNotificationsAsync();
  await n.scheduleNotificationAsync({
    content: {
      title: "今日の一歩を、CamelWords で。",
      body: "少しずつ、あなたの言葉に。今日の単語が待っています。",
    },
    trigger: { type: n.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}
