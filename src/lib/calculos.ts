import type { Dia, Frecuencia, Habito, Registro, Valor } from "../tipos";
import { DIAS_CORTOS, diaSemana, dias, lunes, mesDe, primerDia, sumarDias, sumarMeses, ultimoDia } from "./fecha";

/** Registros de un hábito, por día. */
export type Historial = Map<Dia, Registro>;

export interface Opciones {
  /** Días libres cuentan como cumplidos en porcentajes y en "día completo". */
  libresCumplen: boolean;
}
export const OPCIONES_POR_DEFECTO: Opciones = { libresCumplen: true };

/** La versión de la frecuencia que aplica ese día (las anteriores a la primera usan la primera). */
export function frecuenciaEn(h: Habito, d: Dia): Frecuencia {
  let f = h.frecuencias[0].frecuencia;
  for (const v of h.frecuencias) if (v.desde <= d) f = v.frecuencia;
  return f;
}

/**
 * Cuánto se espera ese día: 1 en días fijos que tocan, num/den en el resto.
 * Antes de que el hábito existiera no se espera nada, así un hábito nuevo no arranca con fallos.
 */
export function esperadoDia(h: Habito, d: Dia): number {
  if (d < h.frecuencias[0].desde) return 0;
  const f = frecuenciaEn(h, d);
  if (f.dias) return f.dias.includes(diaSemana(d)) ? 1 : 0;
  return f.num / f.den;
}

/** Hecho = 1; mínima = 1 (en Evitar, medio día); libre = 0. */
export function puntos(h: Habito, v: Valor | undefined): number {
  if (v === "hecho") return 1;
  if (v === "minima") return h.tipo === "evitar" ? 0.5 : 1;
  return 0;
}
/** Puntos más los días libres, si cuentan como cumplidos. */
export function cuenta(h: Habito, v: Valor | undefined, op: Opciones): number {
  return puntos(h, v) + (v === "libre" && op.libresCumplen ? 1 : 0);
}

export const valorEn = (hist: Historial, d: Dia) => hist.get(d)?.valor;
export const hechoEl = (h: Habito, hist: Historial, d: Dia) => puntos(h, valorEn(hist, d)) > 0;

export function sumar(h: Habito, hist: Historial, a: Dia, b: Dia, op: Opciones, soloPuntos = false): number {
  let s = 0;
  for (const d of dias(a, b)) s += soloPuntos ? puntos(h, valorEn(hist, d)) : cuenta(h, valorEn(hist, d), op);
  return s;
}
export function esperado(h: Habito, a: Dia, b: Dia): number {
  let s = 0;
  for (const d of dias(a, b)) s += esperadoDia(h, d);
  return s;
}

export type Unidad = "dia" | "semana" | "mes";
export function unidad(h: Habito, d: Dia): Unidad {
  const f = frecuenciaEn(h, d);
  if (f.dias || f.den === 7) return "semana";
  if (f.den === 1) return "dia";
  return f.den >= 28 ? "mes" : "dia";
}
export function metaSemana(h: Habito, d: Dia): number {
  const f = frecuenciaEn(h, d);
  return f.dias ? f.dias.length : Math.round((f.num / f.den) * 7);
}
export function hechoEnSemana(h: Habito, hist: Historial, d: Dia, op: Opciones): number {
  const l = lunes(d);
  return sumar(h, hist, l, sumarDias(l, 6), op);
}

export function textoFrecuencia(f: Frecuencia, tipo: Habito["tipo"] = "hacer"): string {
  if (f.dias) {
    if (f.dias.join("") === "01234") return "lunes a viernes";
    if (f.dias.join("") === "56") return "fines de semana";
    return f.dias.map((i) => DIAS_CORTOS[i]).join(", ");
  }
  if (f.den === 1) return "Todos los días";
  if (f.num === 1 && f.den < 28) return `Cada ${f.den} días`;
  if (f.den === 7) return `${f.num} por semana`;
  if (f.den >= 28 && f.den <= 31) return tipo === "evitar" ? `margen ${f.den - f.num} por mes` : `${f.num} por mes`;
  return `${f.num} en ${f.den} días`;
}

/** Evitar: días sin seguidos hasta `d` (si hoy todavía no está marcado, cuenta hasta ayer). Días libres y mínimas no cortan. */
export function diasSinSeguidos(hist: Historial, d: Dia): number {
  let n = 0;
  let x = hist.has(d) ? d : sumarDias(d, -1);
  for (let i = 0; i < 5000; i++) {
    const v = valorEn(hist, x);
    if (!v) break;
    if (v === "hecho") n++;
    x = sumarDias(x, -1);
  }
  return n;
}

/** Racha de días hechos hasta hoy o ayer; los días libres no la cortan. */
export function rachaDias(h: Habito, hist: Historial, d: Dia): number {
  let n = 0;
  let x = hechoEl(h, hist, d) ? d : sumarDias(d, -1);
  for (let i = 0; i < 5000; i++) {
    const v = valorEn(hist, x);
    if (puntos(h, v) > 0) n++;
    else if (v !== "libre") break;
    x = sumarDias(x, -1);
  }
  return n;
}

/** % de días de la semana en que se hizo, en los `n` días que terminan en `fin` (0 = lunes). */
export function tasasPorDia(h: Habito, hist: Historial, fin: Dia, n: number): number[] {
  const hechos = [0, 0, 0, 0, 0, 0, 0];
  const total = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const d = sumarDias(fin, -i);
    const w = diaSemana(d);
    total[w]++;
    if (hechoEl(h, hist, d)) hechos[w]++;
  }
  return hechos.map((x, i) => (total[i] ? (100 * x) / total[i] : 0));
}

export interface Patron { dia: number; tasa: number; resto: number }
/**
 * Nota en Hoy: el día de la semana de `d` está 20 puntos o más por debajo del
 * promedio del resto, en los últimos 90 días.
 */
export function patronDelDia(h: Habito, hist: Historial, d: Dia, umbral = 20): Patron | null {
  const t = tasasPorDia(h, hist, sumarDias(d, -1), 90);
  const w = diaSemana(d);
  const resto = t.filter((_, i) => i !== w).reduce((a, b) => a + b, 0) / 6;
  return resto - t[w] >= umbral ? { dia: w, tasa: Math.round(t[w]), resto: Math.round(resto) } : null;
}

/** "Nunca fallar dos veces": el período anterior (día, semana o mes, según la frecuencia) quedó sin cumplir. */
export function fallaAnterior(h: Habito, hist: Historial, d: Dia, op: Opciones): string | null {
  if (!h.nuncaDosVeces) return null;
  const u = unidad(h, d);
  if (u === "dia") {
    const y = sumarDias(d, -1);
    return !hechoEl(h, hist, y) && valorEn(hist, y) !== "libre" ? "ayer no" : null;
  }
  if (u === "semana") {
    const l = sumarDias(lunes(d), -7);
    const x = sumar(h, hist, l, sumarDias(l, 6), op);
    const meta = metaSemana(h, l);
    return x < meta ? `la semana pasada ${Math.round(x)} de ${meta}` : null;
  }
  const m = sumarMeses(mesDe(d), -1);
  const x = sumar(h, hist, primerDia(m), ultimoDia(m), op);
  const meta = Math.round(esperado(h, primerDia(m), ultimoDia(m)));
  return x < meta ? `el mes pasado ${Math.round(x)} de ${meta}` : null;
}

/** De las veces que falló, cuántas lo retomó en el período siguiente. */
export function retomar(h: Habito, hist: Historial, d: Dia, op: Opciones) {
  let fallos = 0;
  let vueltas = 0;
  if (unidad(h, d) === "dia") {
    for (let i = 90; i >= 1; i--) {
      const x = sumarDias(d, -i - 1);
      if (!hechoEl(h, hist, x) && valorEn(hist, x) !== "libre") {
        fallos++;
        if (hechoEl(h, hist, sumarDias(x, 1))) vueltas++;
      }
    }
  } else {
    const l0 = lunes(d);
    for (let i = 26; i >= 1; i--) {
      const l = sumarDias(l0, -7 * i);
      const meta = metaSemana(h, l);
      if (sumar(h, hist, l, sumarDias(l, 6), op) < meta) {
        fallos++;
        if (sumar(h, hist, sumarDias(l, 7), sumarDias(l, 13), op) >= meta) vueltas++;
      }
    }
  }
  return fallos ? { fallos, vueltas, porcentaje: Math.round((100 * vueltas) / fallos) } : null;
}
