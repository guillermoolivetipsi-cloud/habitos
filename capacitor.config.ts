import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.guillermooliveti.habitos",
  appName: "Hábitos",
  webDir: "dist",
  android: { backgroundColor: "#000000" },
  plugins: {
    LocalNotifications: { smallIcon: "ic_notificacion", iconColor: "#69F0AE" },
  },
};

export default config;
