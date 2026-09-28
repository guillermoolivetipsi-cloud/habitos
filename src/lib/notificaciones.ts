import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { db } from "../db";
import type { Dia } from "../tipos";
import type { Aviso } from "./recordatorios";

/** Las notificaciones programadas solo existen en la app de Android; en el navegador se muestra la lista. */
export const hayNotificaciones = () => Capacitor.isNativePlatform();

export async function permisoNotificaciones(): Promise<"concedido" | "denegado" | "preguntar"> {
  if (!hayNotificaciones()) return "denegado";
  const p = await LocalNotifications.checkPermissions();
  return p.display === "granted" ? "concedido" : p.display === "denied" ? "denegado" : "preguntar";
}
export async function pedirPermiso() {
  if (!hayNotificaciones()) return false;
  return (await LocalNotifications.requestPermissions()).display === "granted";
}

/** Reemplaza todo lo programado por la lista nueva. */
export async function programarAvisos(avisos: Aviso[]) {
  if (!hayNotificaciones() || (await permisoNotificaciones()) !== "concedido") return;
  const pendientes = await LocalNotifications.getPending();
  if (pendientes.notifications.length) await LocalNotifications.cancel({ notifications: pendientes.notifications.map((n) => ({ id: n.id })) });
  if (!avisos.length) return;
  await LocalNotifications.schedule({
    notifications: avisos.map((a) => ({
      id: a.id,
      title: a.titulo,
      body: a.cuerpo,
      schedule: { at: a.cuando, allowWhileIdle: true },
      actionTypeId: a.tipo === "habito" ? "HABITO" : undefined,
      extra: { tipo: a.tipo, habito: a.habito, dia: a.dia },
    })),
  });
}

/**
 * Botones de la notificación: "Hecho" marca el hábito sin abrir la app;
 * "En 1 hora" lo vuelve a avisar. Tocar un aviso de cierre abre ese cierre.
 */
export async function escucharAcciones(abrirCierre: (tipo: "semana" | "mes", inicio: Dia) => void) {
  if (!hayNotificaciones()) return;
  await LocalNotifications.registerActionTypes({
    types: [{ id: "HABITO", actions: [{ id: "hecho", title: "Hecho" }, { id: "luego", title: "En 1 hora" }] }],
  });
  await LocalNotifications.addListener("localNotificationActionPerformed", async (e) => {
    const x = e.notification.extra as { tipo: string; habito?: string; dia: Dia } | undefined;
    if (!x) return;
    if (x.tipo === "habito" && x.habito && e.actionId === "hecho") {
      await db.registros.put({ habito: x.habito, dia: x.dia, valor: "hecho" });
    } else if (x.tipo === "habito" && e.actionId === "luego") {
      await LocalNotifications.schedule({
        notifications: [{ ...e.notification, id: 990000 + Math.floor(Math.random() * 9999), schedule: { at: new Date(Date.now() + 3600_000), allowWhileIdle: true } }],
      });
    } else if (x.tipo === "cierreSemana") abrirCierre("semana", x.dia);
    else if (x.tipo === "cierreMes") abrirCierre("mes", x.dia);
  });
}
