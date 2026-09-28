import { db, PREFERENCIAS, type Preferencias } from "../db";
import type { Dia, Habito, Identidad, Valor } from "../tipos";
import type { AccionSugerida } from "./revision";
import type { ResultadoImportacion } from "./importarLoop";

/** Tocar el círculo: marca hecho; si ya tenía algo, lo desmarca. */
export async function tocar(h: Habito, dia: Dia): Promise<"marcado" | "desmarcado"> {
  const r = await db.registros.get([h.id, dia]);
  if (r) {
    await db.registros.delete([h.id, dia]);
    return "desmarcado";
  }
  const ultima = h.variantes.length ? await ultimaVariante(h) : undefined;
  await db.registros.put({ habito: h.id, dia, valor: "hecho", ...(ultima ? { variante: ultima } : {}) });
  return "marcado";
}

/** Mantener presionado: pone o saca el día libre. */
export async function alternarLibre(h: Habito, dia: Dia): Promise<boolean> {
  const r = await db.registros.get([h.id, dia]);
  if (r?.valor === "libre") {
    await db.registros.delete([h.id, dia]);
    return false;
  }
  await db.registros.put({ habito: h.id, dia, valor: "libre" });
  return true;
}

export async function cambiarValor(h: Habito, dia: Dia, valor: Valor) {
  const r = await db.registros.get([h.id, dia]);
  await db.registros.put({ ...(r ?? { habito: h.id, dia }), valor });
}

export async function elegirVariante(h: Habito, dia: Dia, variante: string) {
  await db.registros.put({ habito: h.id, dia, valor: "hecho", variante });
}

async function ultimaVariante(h: Habito): Promise<string | undefined> {
  const regs = await db.registros.where("habito").equals(h.id).reverse().sortBy("dia");
  return regs.find((r) => r.variante)?.variante ?? h.variantes[0];
}

/** Reemplaza todo lo importado antes desde Loop; lo creado en la app no se toca. */
export async function guardarImportacion(r: ResultadoImportacion) {
  await db.transaction("rw", db.habitos, db.registros, async () => {
    const previos = (await db.habitos.toArray()).filter((h) => h.loop).map((h) => h.id);
    await db.registros.where("habito").anyOf(previos).delete();
    await db.habitos.bulkDelete(previos);
    await db.habitos.bulkPut(r.habitos);
    await db.registros.bulkPut(r.registros);
  });
}

export async function leerPreferencias(): Promise<Preferencias> {
  const filas = await db.ajustes.toArray();
  const p = { ...PREFERENCIAS } as Record<string, unknown>;
  for (const f of filas) if (f.clave in p) p[f.clave] = f.valor;
  return p as unknown as Preferencias;
}
export const guardarPreferencia = <K extends keyof Preferencias>(k: K, v: Preferencias[K]) => db.ajustes.put({ clave: k, valor: v });

/* ---------- Crear, editar, archivar, eliminar ---------- */

export const nuevoId = () => `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Guarda un hábito. Si cambió la frecuencia:
 * - "hoy": se agrega una versión nueva desde hoy; el pasado se sigue midiendo como antes.
 * - "todo": la nueva frecuencia reemplaza a todas (recalcula el historial).
 */
export async function guardarHabito(h: Habito, cambio?: { frecuencia: import("../tipos").Frecuencia; desde: "hoy" | "todo"; hoy: Dia }) {
  let frecuencias = h.frecuencias;
  if (cambio) {
    frecuencias = cambio.desde === "todo"
      ? [{ desde: h.frecuencias[0]?.desde ?? cambio.hoy, frecuencia: cambio.frecuencia }]
      : [...h.frecuencias.filter((v) => v.desde < cambio.hoy), { desde: cambio.hoy, frecuencia: cambio.frecuencia }];
  }
  await db.habitos.put({ ...h, frecuencias });
}

export async function crearHabito(h: Omit<Habito, "orden">) {
  const ultimo = await db.habitos.orderBy("orden").last();
  await db.habitos.put({ ...h, orden: (ultimo?.orden ?? 0) + 1 } as Habito);
}

export const archivar = (id: string) => db.habitos.update(id, { archivado: true });
export const reactivar = (id: string) => db.habitos.update(id, { archivado: false });

/** Borra el hábito y todo su historial. */
export async function eliminar(id: string) {
  await db.transaction("rw", db.habitos, db.registros, db.objetivos, async () => {
    await db.registros.where("habito").equals(id).delete();
    await db.habitos.delete(id);
    await db.objetivos.toCollection().modify((o) => { o.habitos = o.habitos.filter((x) => x !== id); });
  });
}

/* ---------- Revisión ---------- */

export const guardarNota = (clave: string, texto: string) => (texto.trim() ? db.notas.put({ clave, texto }) : db.notas.delete(clave));

/** Aplica una sugerencia de Revisión y la anota en "Decisiones anteriores". Los cambios de frecuencia rigen desde hoy. */
export async function aplicarSugerencia(h: Habito, accion: AccionSugerida, hoy: Dia) {
  let texto = "";
  if (accion.tipo === "bajar") {
    await guardarHabito(h, { frecuencia: accion.frecuencia, desde: "hoy", hoy });
    texto = `${accion.frecuencia.num} por semana`;
  } else if (accion.tipo === "habiles") {
    await guardarHabito(h, { frecuencia: { num: 5, den: 7, dias: [0, 1, 2, 3, 4] }, desde: "hoy", hoy });
    texto = "lunes a viernes";
  } else if (accion.tipo === "archivar") {
    await archivar(h.id);
    texto = "archivado";
  } else {
    // "Dejar así": no se vuelve a sugerir por 30 días.
    const p = await leerPreferencias();
    const hasta = new Date(Date.parse(hoy + "T12:00:00Z") + 30 * 864e5).toISOString().slice(0, 10);
    await guardarPreferencia("descartadas", { ...p.descartadas, [h.id]: hasta });
    texto = "dejar así";
  }
  await db.decisiones.add({ fecha: hoy, habito: h.id, nombre: h.nombre, texto });
}

/* ---------- Identidades ---------- */

export const guardarIdentidad = (i: Identidad) => db.identidades.put(i);
export async function borrarIdentidad(id: string) {
  await db.transaction("rw", db.identidades, db.habitos, async () => {
    await db.identidades.delete(id);
    await db.habitos.where("id").above("").modify((h) => { if (h.identidad === id) h.identidad = null; });
  });
}
/** Cada hábito vota por una sola identidad: asignarlo acá lo saca de la anterior. */
export const asignarIdentidad = (habito: string, identidad: string | null) => db.habitos.update(habito, { identidad });
