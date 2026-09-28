import { useLiveQuery } from "dexie-react-hooks";
import { db, PREFERENCIAS, type Decision, type Preferencias } from "./db";
import type { Historial } from "./lib/calculos";
import type { Habito, Identidad } from "./tipos";
import { leerPreferencias } from "./lib/acciones";

export interface Datos {
  habitos: Habito[]; // activos, en orden
  archivados: Habito[];
  identidades: Identidad[];
  notas: Map<string, string>;
  decisiones: Decision[];
  historiales: Map<string, Historial>;
  prefs: Preferencias;
  cargando: boolean;
}

/** Todo lo que necesitan las pantallas, siempre al día con la base local. */
export function useDatos(): Datos {
  const todos = useLiveQuery(() => db.habitos.orderBy("orden").toArray(), []);
  const habitos = todos?.filter((h) => !h.archivado);
  const identidades = useLiveQuery(() => db.identidades.toArray(), []);
  const registros = useLiveQuery(() => db.registros.toArray(), []);
  const notas = useLiveQuery(() => db.notas.toArray(), []);
  const decisiones = useLiveQuery(() => db.decisiones.orderBy("fecha").reverse().toArray(), []);
  const prefs = useLiveQuery(() => leerPreferencias(), []);
  const historiales = new Map<string, Historial>();
  for (const r of registros ?? []) {
    let m = historiales.get(r.habito);
    if (!m) historiales.set(r.habito, (m = new Map()));
    m.set(r.dia, r);
  }
  for (const h of habitos ?? []) if (!historiales.has(h.id)) historiales.set(h.id, new Map());
  return { habitos: habitos ?? [], archivados: todos?.filter((h) => h.archivado) ?? [], identidades: identidades ?? [], notas: new Map((notas ?? []).map((n) => [n.clave, n.texto])), decisiones: decisiones ?? [], historiales, prefs: prefs ?? PREFERENCIAS, cargando: !habitos || !registros || !prefs };
}
