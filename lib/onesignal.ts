import OneSignal from "react-onesignal";

const APP_ID = "a4ab2ceb-c143-4844-9408-6ff33c985786";

let initialized = false;

export async function initOneSignal() {
  if (typeof window === "undefined") return;
  if (initialized) return;

  try {
    await OneSignal.init({
      appId: APP_ID,
      serviceWorkerPath: "/OneSignalSDKWorker.js",
      allowLocalhostAsSecureOrigin: false,
    });

    initialized = true;
    console.log("✅ OneSignal inicializado");
  } catch (error) {
    console.error("Error inicializando OneSignal:", error);
  }
}

/** Vincular el usuario logueado con OneSignal */
export async function identificarUsuario(userId: string) {
  if (typeof window === "undefined") return;

  try {
    // login() vincula este dispositivo al userId
    await OneSignal.login(userId);
    OneSignal.User.addTag("user_id", userId);
    console.log("✅ Usuario identificado en OneSignal:", userId);
  } catch (error) {
    console.error("Error identificando usuario en OneSignal:", error);
  }
}

/** Pedir permiso de notificaciones (se llama una sola vez) */
export async function pedirPermisoNotificaciones() {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;

  try {
    // Solo pedir si aún no se ha decidido
    if (Notification.permission === "default") {
      await OneSignal.Slidedown.promptPush();
    }
  } catch (error) {
    console.error("Error pidiendo permiso:", error);
  }
}
