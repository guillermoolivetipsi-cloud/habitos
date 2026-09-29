import type { Dia, Habito } from "../tipos";
import {
  esperado, frecuenciaEn, hechoEl, metaSemana, puntos, sumar, tasasPorDia, unidad, valorEn,
  type Historial, type Opciones,
} from "./calculos";
import { diaSemana, dias, diasDelMes, lunes, mesDe, primerDia, sumarDias, sumarMeses, ultimoDia } from "./fecha";

/**
 * Puntuación como la de Loop: promedio exponencial donde cada día aporta el
 * porcentaje cumplido de la ventana de su frecuencia (hechos en los últimos
 * `den` días / `num`, hasta 1). Lo reciente pesa más: la vida media es de
 * 13 días en un hábito diario. Los días libres no mueven la puntuación.
 * Devuelve la puntuación (0 a 100) al final de cada día de [desde, hasta].
 */
export function puntuaciones(h: Habito, hist: Historial, desde: Dia, hasta: Dia): Map<Dia, number> {
  const out = new Map<Dia, number>();
  const inicio = h.frecuencias[0].desde < desde ? h.frecuencias[0].desde : desde;
  let score = 0;
  const ventana: number[] = [];
  let suma = 0;
  for (const d of dias(inicio, hasta)) {
    const f = frecuenciaEn(h, d);
    const base = f.dias ? f.dias.length : f.num;
    const baseDen = f.dias ? 7 : f.den;
    // Como Loop: en hábitos no diarios se duplica la ventana (10 en 14 días en vez de 5 en 7)
    // para suavizar semanas irregulares.
    const doble = base / baseDen < 1 ? 2 : 1;
    const num = base * doble;
    const den = baseDen * doble;
    const v = valorEn(hist, d);
    const p = puntos(h, v);
    ventana.push(p);
    suma += p;
    while (ventana.length > den) suma -= ventana.shift()!;
    if (v !== "libre" && (!f.dias || f.dias.includes(diaSemana(d)) || p > 0)) {
      const mult = Math.pow(0.5, Math.sqrt(base / baseDen) / 13);
      score = score * mult + Math.min(1, suma / num) * (1 - mult);
    }
    if (d >= desde) out.set(d, Math.round(score * 100));
  }
  return out;
}

export interface Resumen {
  total: number;
  primerDia: Dia | null;
  p30: number | null;
  p90: number | null;
  p365: number | null;
  porSemana: number;
  mejorRacha: number;
  mejorMes: { mes: string; veces: number } | null;
  mejorDia: { dia: number; tasa: number } | null;
  esteAnio: number;
  esteMes: { hechas: number; meta: number };
}

const pct = (h: Habito, hist: Historial, a: Dia, b: Dia, op: Opciones) => {
  const e = esperado(h, a, b);
  return e ? Math.round((100 * sumar(h, hist, a, b, op)) / e) : null;
};

export function resumen(h: Habito, hist: Historial, hoy: Dia, op: Opciones): Resumen {
  const ayer = sumarDias(hoy, -1);
  const hechosDias = [...hist.values()].filter((r) => puntos(h, r.valor) > 0).map((r) => r.dia).sort();
  let porSemana = 0;
  const l0 = lunes(hoy);
  for (let i = 1; i <= 12; i++) { const l = sumarDias(l0, -7 * i); porSemana += sumar(h, hist, l, sumarDias(l, 6), op, true); }
  let mejorMes: Resumen["mejorMes"] = null;
  const anio = hoy.slice(0, 4);
  for (let m = `${anio}-01`; m <= mesDe(hoy); m = sumarMeses(m, 1)) {
    const v = sumar(h, hist, primerDia(m), ultimoDia(m) > hoy ? hoy : ultimoDia(m), op, true);
    if (!mejorMes || v > mejorMes.veces) mejorMes = { mes: m, veces: v };
  }
  const t = tasasPorDia(h, hist, ayer, 365);
  const md = t.indexOf(Math.max(...t));
  const sinDatos = !hechosDias.length;
  const mes = mesDe(hoy);
  return {
    total: hechosDias.length,
    primerDia: hechosDias[0] ?? null,
    p30: pct(h, hist, sumarDias(ayer, -29), ayer, op),
    p90: pct(h, hist, sumarDias(ayer, -89), ayer, op),
    p365: pct(h, hist, sumarDias(ayer, -364), ayer, op),
    porSemana: Math.round((porSemana / 12) * 10) / 10,
    mejorRacha: Math.max(0, ...rachas(h, hist, hoy, op).map((r) => r.largo)),
    mejorMes: mejorMes && mejorMes.veces > 0 ? mejorMes : null,
    mejorDia: sinDatos ? null : { dia: md, tasa: Math.round(t[md]) },
    esteAnio: sumar(h, hist, `${anio}-01-01`, hoy, op, true),
    esteMes: { hechas: sumar(h, hist, primerDia(mes), hoy, op, true), meta: Math.round(esperado(h, primerDia(mes), hoy)) },
  };
}

export interface Racha { largo: number; desde: Dia; hasta: Dia; unidad: "dias" | "semanas" }
/**
 * Rachas históricas. En hábitos diarios, días seguidos hechos (los libres no cortan).
 * En hábitos por semana, semanas seguidas cumplidas.
 */
export function rachas(h: Habito, hist: Historial, hoy: Dia, op: Opciones): Racha[] {
  const out: Racha[] = [];
  const inicio = [...hist.keys()].sort()[0];
  if (!inicio) return out;
  if (unidad(h, hoy) === "semana") {
    let actual = null as Racha | null;
    for (let l = lunes(inicio); l <= lunes(hoy); l = sumarDias(l, 7)) {
      const fin = sumarDias(l, 6);
      const ok = sumar(h, hist, l, fin, op) >= metaSemana(h, l);
      if (ok) actual = actual ? { largo: actual.largo + 1, desde: actual.desde, hasta: fin, unidad: "semanas" } : { largo: 1, desde: l, hasta: fin, unidad: "semanas" };
      else if (l < lunes(hoy)) { if (actual) out.push(actual); actual = null; }
    }
    if (actual) out.push(actual);
  } else {
    let actual = null as Racha | null;
    for (const d of dias(inicio, hoy)) {
      const v = valorEn(hist, d);
      if (puntos(h, v) > 0) actual = actual ? { largo: actual.largo + 1, desde: actual.desde, hasta: d, unidad: "dias" } : { largo: 1, desde: d, hasta: d, unidad: "dias" };
      else if (v !== "libre" && d < hoy) { if (actual) out.push(actual); actual = null; }
    }
    if (actual) out.push(actual);
  }
  return out;
}
export const mejoresRachas = (r: Racha[], n = 5) => [...r].sort((a, b) => b.largo - a.largo).slice(0, n).sort((a, b) => (a.desde < b.desde ? 1 : -1));

/** Últimas `n` semanas (lunes a domingo): hechas, días libres y meta. */
export function semanas(h: Habito, hist: Historial, hoy: Dia, op: Opciones, n = 14) {
  const l0 = lunes(hoy);
  return Array.from({ length: n }, (_, i) => {
    const l = sumarDias(l0, -7 * (n - 1 - i));
    const fin = sumarDias(l, 6);
    let libres = 0;
    for (const d of dias(l, fin)) if (valorEn(hist, d) === "libre") libres++;
    return { lunes: l, hechas: sumar(h, hist, l, fin, op, true), libres, meta: unidad(h, l) === "semana" ? metaSemana(h, l) : Math.round(esperado(h, l, fin)) };
  });
}

/** Últimos `n` meses: hechas, días libres y meta del mes completo. */
export function meses(h: Habito, hist: Historial, hoy: Dia, op: Opciones, n = 14) {
  const m0 = mesDe(hoy);
  return Array.from({ length: n }, (_, i) => {
    const m = sumarMeses(m0, -(n - 1 - i));
    const fin = ultimoDia(m) > hoy ? hoy : ultimoDia(m);
    let libres = 0;
    for (const d of dias(primerDia(m), fin)) if (valorEn(hist, d) === "libre") libres++;
    return { mes: m, hechas: sumar(h, hist, primerDia(m), fin, op, true), libres, meta: esperado(h, primerDia(m), ultimoDia(m)) };
  });
}

/** Acumulado por mes de un año (null en los meses que todavía no llegaron). */
export function acumuladoAnio(h: Habito, hist: Historial, anio: number, hoy: Dia, op: Opciones): (number | null)[] {
  let acc = 0;
  return Array.from({ length: 12 }, (_, i) => {
    const m = `${anio}-${String(i + 1).padStart(2, "0")}`;
    if (m > mesDe(hoy)) return null;
    acc += sumar(h, hist, primerDia(m), ultimoDia(m) > hoy ? hoy : ultimoDia(m), op, true);
    return Math.round(acc * 10) / 10;
  });
}

/** Veces por día de la semana en cada uno de los últimos 12 meses (como el gráfico Frecuencia de Loop). */
export function frecuenciaMensual(h: Habito, hist: Historial, hoy: Dia) {
  const m0 = mesDe(hoy);
  return Array.from({ length: 12 }, (_, i) => {
    const m = sumarMeses(m0, -(11 - i));
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (let k = 1; k <= diasDelMes(m); k++) {
      const d = `${m}-${String(k).padStart(2, "0")}`;
      if (d <= hoy && hechoEl(h, hist, d)) c[diaSemana(d)]++;
    }
    return { mes: m, veces: c };
  });
}

/** Racha actual en la unidad del hábito. */
export function rachaActual(h: Habito, hist: Historial, hoy: Dia, op: Opciones): Racha | null {
  const r = rachas(h, hist, hoy, op);
  const ult = r[r.length - 1];
  if (!ult) return null;
  const limite = ult.unidad === "semanas" ? sumarDias(lunes(hoy), -1) : sumarDias(hoy, -1);
  return ult.hasta >= limite ? ult : null;
}


/* ---------- Series para gráficos que se desplazan ---------- */

export type Escala = "dia" | "semana" | "mes" | "trimestre" | "anio";
export interface Tramo { inicio: Dia; fin: Dia; etiqueta: string }

const MES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** Divide [desde, hoy] en tramos de la escala, con una etiqueta corta (vacía donde no hace falta). */
export function tramos(desde: Dia, hoy: Dia, escala: Escala): Tramo[] {
  const out: Tramo[] = [];
  if (escala === "dia") {
    for (const d of dias(desde, hoy)) out.push({ inicio: d, fin: d, etiqueta: d.slice(8) === "01" ? MES_C[+d.slice(5, 7) - 1] : diaSemana(d) === 0 ? String(+d.slice(8)) : "" });
  } else if (escala === "semana") {
    for (let l = lunes(desde); l <= hoy; l = sumarDias(l, 7)) {
      const fin = sumarDias(l, 6);
      const primero = l.slice(8) === "01" || fin.slice(5, 7) !== l.slice(5, 7) ? `${fin.slice(0, 7)}-01` : null;
      out.push({ inicio: l, fin, etiqueta: primero ? (primero.slice(5, 7) === "01" ? fin.slice(0, 4) : MES_C[+primero.slice(5, 7) - 1]) : "" });
    }
  } else if (escala === "mes") {
    for (let m = mesDe(desde); m <= mesDe(hoy); m = sumarMeses(m, 1))
      out.push({ inicio: primerDia(m), fin: ultimoDia(m), etiqueta: m.slice(5) === "01" ? m.slice(0, 4) : MES_C[+m.slice(5) - 1] });
  } else if (escala === "trimestre") {
    const q0 = Math.floor((+desde.slice(5, 7) - 1) / 3);
    for (let m = `${desde.slice(0, 4)}-${String(q0 * 3 + 1).padStart(2, "0")}`; m <= mesDe(hoy); m = sumarMeses(m, 3)) {
      const t = Math.floor((+m.slice(5) - 1) / 3) + 1;
      out.push({ inicio: primerDia(m), fin: ultimoDia(sumarMeses(m, 2)), etiqueta: t === 1 ? `T1 ${m.slice(2, 4)}` : `T${t}` });
    }
  } else {
    for (let y = +desde.slice(0, 4); y <= +hoy.slice(0, 4); y++) out.push({ inicio: `${y}-01-01`, fin: `${y}-12-31`, etiqueta: String(y) });
  }
  return out;
}

const inicioDe = (h: Habito, hist: Historial) => {
  const primero = [...hist.keys()].sort()[0];
  return primero && primero < h.frecuencias[0].desde ? primero : h.frecuencias[0].desde;
};

/** Veces por tramo desde el primer registro: hechas, días libres y meta del tramo completo. */
export function historialPor(h: Habito, hist: Historial, hoy: Dia, op: Opciones, escala: Exclude<Escala, "dia">) {
  return tramos(inicioDe(h, hist), hoy, escala).map((t) => {
    const fin = t.fin > hoy ? hoy : t.fin;
    let libres = 0;
    for (const d of dias(t.inicio, fin)) if (valorEn(hist, d) === "libre") libres++;
    const meta = escala === "semana" && unidad(h, t.inicio) === "semana" ? metaSemana(h, t.inicio) : Math.round(esperado(h, t.inicio, t.fin));
    return { ...t, hechas: sumar(h, hist, t.inicio, fin, op, true), libres, meta };
  });
}

/** Puntuación al final de cada tramo, desde el primer registro. */
export function puntuacionPor(h: Habito, hist: Historial, hoy: Dia, escala: Escala) {
  const inicio = inicioDe(h, hist);
  const p = puntuaciones(h, hist, inicio, hoy);
  return tramos(inicio, hoy, escala).map((t) => ({ ...t, valor: p.get(t.fin > hoy ? hoy : t.fin) ?? 0 }));
}
