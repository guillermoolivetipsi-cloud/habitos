import type { Dia, Objetivo, Tarea } from "../tipos";
import { mesDe, primerDia, sumarMeses, ultimoDia } from "./fecha";

export const nuevoIdTarea = () => `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Orden en pantalla: pendientes en su orden, después las hechas. */
export const ordenadas = (ts: Tarea[]) => [...ts.filter((t) => !t.hecha), ...ts.filter((t) => t.hecha)];

export const contarTareas = (ts: Tarea[] = []) => ({ hechas: ts.filter((t) => t.hecha).length, total: ts.length });

/** Primera pendiente en el orden elegido. */
export const proximaTarea = (ts: Tarea[] = []) => ts.find((t) => !t.hecha) ?? null;

/** Una tarea nueva va última entre las pendientes. */
export function agregar(ts: Tarea[], t: Tarea): Tarea[] {
  const o = ordenadas(ts);
  const i = o.findIndex((x) => x.hecha);
  return i < 0 ? [...o, t] : [...o.slice(0, i), t, ...o.slice(i)];
}

/** Marcar o desmarcar. Al marcarla baja al final; al desmarcarla vuelve última entre las pendientes. */
export function alternar(ts: Tarea[], id: string): Tarea[] {
  const t = ts.find((x) => x.id === id);
  if (!t) return ts;
  const resto = ts.filter((x) => x.id !== id);
  return t.hecha ? agregar(resto, { ...t, hecha: false }) : [...ordenadas(resto), { ...t, hecha: true }];
}

export function quitar(ts: Tarea[], id: string): { tareas: Tarea[]; tarea: Tarea | null; indice: number } {
  const indice = ts.findIndex((x) => x.id === id);
  return { tareas: ts.filter((x) => x.id !== id), tarea: indice < 0 ? null : ts[indice], indice };
}

/** Deshacer: vuelve al lugar donde estaba. */
export function reponer(ts: Tarea[], t: Tarea, indice: number): Tarea[] {
  if (ts.some((x) => x.id === t.id)) return ts;
  const i = Math.max(0, Math.min(indice, ts.length));
  return [...ts.slice(0, i), t, ...ts.slice(i)];
}

/** Nuevo orden de las pendientes (ids); las hechas quedan al final como estaban. */
export function reordenar(ts: Tarea[], idsPendientes: string[]): Tarea[] {
  const pend = idsPendientes.map((id) => ts.find((t) => t.id === id && !t.hecha)).filter((t): t is Tarea => !!t);
  const faltan = ts.filter((t) => !t.hecha && !idsPendientes.includes(t.id));
  return [...pend, ...faltan, ...ts.filter((t) => t.hecha)];
}

/** Objetivos que terminan en este mes y dejaron tareas sin hacer que todavía no se resolvieron. */
export function conPendientes(objetivos: Objetivo[], mes: string): Objetivo[] {
  return objetivos.filter((o) => !o.pendientesResueltas && mesDe(o.hasta) === mes && (o.tareas ?? []).some((t) => !t.hecha));
}

/**
 * Pasar las pendientes al mes siguiente: se suman a un objetivo de ese mes con el mismo nombre o se crea uno.
 * En el objetivo original quedan como no hechas (el historial no se reescribe).
 */
export function pasarPendientes(o: Objetivo, objetivos: Objetivo[], id: () => string, idTarea: () => string = nuevoIdTarea): { original: Objetivo; destino: Objetivo } {
  const mes = sumarMeses(mesDe(o.hasta), 1);
  const copias = (o.tareas ?? []).filter((t) => !t.hecha).map((t) => ({ ...t, id: idTarea() }));
  const existente = objetivos.find((x) => x.id !== o.id && x.periodo === "mes" && mesDe(x.desde) === mes && x.nombre.trim().toLowerCase() === o.nombre.trim().toLowerCase());
  const destino: Objetivo = existente
    ? { ...existente, tareas: copias.reduce(agregar, existente.tareas ?? []) }
    : {
      id: id(), nombre: o.nombre, descripcion: o.descripcion, periodo: "mes", desde: primerDia(mes) as Dia, hasta: ultimoDia(mes) as Dia,
      medida: o.medida === "tareas" ? "tareas" : "siNo", meta: 1, habitos: [], manual: 0, logrado: null, identidad: o.identidad, tareas: copias,
    };
  return { original: { ...o, pendientesResueltas: true }, destino };
}
