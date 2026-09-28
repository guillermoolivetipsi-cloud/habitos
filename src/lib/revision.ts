import type { Dia, Habito, Identidad } from "../tipos";
import { esperado, esperadoDia, frecuenciaEn, metaSemana, puntos, sumar, tasasPorDia, unidad, valorEn, cuenta, type Historial, type Opciones } from "./calculos";
import { diaSemana, dias, lunes, primerDia, sumarDias, ultimoDia } from "./fecha";

export type Historiales = Map<string, Historial>;
const histDe = (hs: Historiales, h: Habito) => hs.get(h.id) ?? new Map();
const conMeta = (habitos: Habito[]) => habitos.filter((h) => h.tipo !== "medir");

export interface Cumplimiento { hechas: number; esperadas: number; porcentaje: number }

/** Cumplimiento de todos los hábitos juntos en [a, b] (b se recorta a hoy). */
export function cumplimiento(habitos: Habito[], hs: Historiales, a: Dia, b: Dia, hoy: Dia, op: Opciones): Cumplimiento {
  const fin = b > hoy ? hoy : b;
  let hechas = 0, esperadas = 0;
  if (fin >= a) for (const h of conMeta(habitos)) { hechas += sumar(h, histDe(hs, h), a, fin, op); esperadas += esperado(h, a, fin); }
  return { hechas, esperadas, porcentaje: esperadas ? Math.round((100 * hechas) / esperadas) : 0 };
}

export interface FilaHabito { h: Habito; hechas: number; meta: number; porcentaje: number }
/** Cada hábito en el período, de mejor a peor. En Evitar, `hechas` son días sin. */
export function porHabito(habitos: Habito[], hs: Historiales, a: Dia, b: Dia, hoy: Dia, op: Opciones): FilaHabito[] {
  const fin = b > hoy ? hoy : b;
  return conMeta(habitos).map((h) => {
    const x = fin >= a ? sumar(h, histDe(hs, h), a, fin, op) : 0;
    // La meta del período completo (una semana de 5 por semana tiene meta 5 aunque vaya por el martes).
    const meta = unidad(h, a) === "semana" && a === lunes(a) && b === sumarDias(a, 6) ? metaSemana(h, a) : Math.round(esperado(h, a, b));
    const e = esperado(h, a, fin);
    return { h, hechas: x, meta, porcentaje: e ? Math.round((100 * x) / e) : 0 };
  }).sort((p, q) => q.hechas / (q.meta || 1) - p.hechas / (p.meta || 1));
}

/** Hábitos hechos por día (para las barras del cierre de semana). */
export function hechosPorDia(habitos: Habito[], hs: Historiales, a: Dia, b: Dia, hoy: Dia): number[] {
  const out: number[] = [];
  for (const d of dias(a, b)) out.push(d > hoy ? 0 : habitos.filter((h) => puntos(h, valorEn(histDe(hs, h), d)) > 0).length);
  return out;
}

/** Cumplimiento global por día de la semana en los últimos 90 días (0 = lunes). */
export function porDiaSemana(habitos: Habito[], hs: Historiales, hoy: Dia, op: Opciones): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0], e = [0, 0, 0, 0, 0, 0, 0];
  const fin = sumarDias(hoy, -1);
  for (let i = 0; i < 90; i++) {
    const d = sumarDias(fin, -i), w = diaSemana(d);
    for (const h of conMeta(habitos)) { c[w] += cuenta(h, valorEn(histDe(hs, h), d), op); e[w] += esperadoDia(h, d); }
  }
  return c.map((x, i) => (e[i] ? Math.round((100 * x) / e[i]) : 0));
}

export interface PatronHabito { h: Habito; dia: number; tasa: number; resto: number }
/** Por hábito, el día de la semana que más cae (20 puntos o más por debajo del resto), 90 días. */
export function patronesPorHabito(habitos: Habito[], hs: Historiales, hoy: Dia, umbral = 20): PatronHabito[] {
  const out: (PatronHabito & { caida: number })[] = [];
  for (const h of conMeta(habitos)) {
    const t = tasasPorDia(h, histDe(hs, h), sumarDias(hoy, -1), 90);
    let mejor: (PatronHabito & { caida: number }) | null = null;
    t.forEach((x, i) => {
      const resto = (t.reduce((a, b) => a + b, 0) - x) / 6;
      if (resto - x >= umbral && (!mejor || resto - x > mejor.caida)) mejor = { h, dia: i, tasa: Math.round(x), resto: Math.round(resto), caida: resto - x };
    });
    if (mejor) out.push(mejor);
  }
  return out.sort((a, b) => b.caida - a.caida).map(({ caida: _, ...p }) => p);
}

export type AccionSugerida =
  | { tipo: "bajar"; frecuencia: { num: number; den: number }; etiqueta: string }
  | { tipo: "habiles"; etiqueta: string }
  | { tipo: "archivar"; etiqueta: string }
  | { tipo: "dejar"; etiqueta: string };
export interface Sugerencia { h: Habito; titulo: string; detalle: string; acciones: AccionSugerida[]; porcentaje: number }

/**
 * Para decidir: hábitos por debajo del umbral en 90 días (bajar frecuencia o archivar),
 * y hábitos que nunca se hacen el fin de semana (pasar a lunes a viernes).
 * `descartadas`: ids con "Dejar así" vigente.
 */
export function sugerencias(habitos: Habito[], hs: Historiales, hoy: Dia, op: Opciones, opciones: { umbral: number; maximo: number; descartadas: Set<string> }): Sugerencia[] {
  const fin = sumarDias(hoy, -1), inicio = sumarDias(fin, -89);
  const out: Sugerencia[] = [];
  for (const h of conMeta(habitos)) {
    if (opciones.descartadas.has(h.id) || h.frecuencias[0].desde > inicio) continue;
    const hist = histDe(hs, h);
    const e = esperado(h, inicio, fin);
    if (!e) continue;
    const p = Math.round((100 * sumar(h, hist, inicio, fin, op)) / e);
    const f = frecuenciaEn(h, hoy);
    if (p < opciones.umbral) {
      const porSemana = Math.max(1, Math.round((f.num / f.den) * 7 / 2));
      const bajar = porSemana < (f.num / f.den) * 7;
      out.push({
        h, porcentaje: p, titulo: `${h.nombre}: ${p}% en 90 días`,
        detalle: "Casi nunca llegás al objetivo.",
        acciones: [
          ...(bajar ? [{ tipo: "bajar" as const, frecuencia: { num: porSemana, den: 7 }, etiqueta: `Bajar a ${porSemana}/sem` }] : []),
          { tipo: "archivar", etiqueta: "Archivar" }, { tipo: "dejar", etiqueta: "Dejar así" },
        ],
      });
      continue;
    }
    const t = tasasPorDia(h, hist, fin, 90);
    if (!f.dias && f.den === 7 && t[5] === 0 && t[6] === 0 && t.slice(0, 5).some((x) => x > 20))
      out.push({ h, porcentaje: p, titulo: `${h.nombre}: 0% sábado y domingo`, detalle: "Solo lo hacés en días hábiles.", acciones: [{ tipo: "habiles", etiqueta: "Pasar a lun–vie" }, { tipo: "dejar", etiqueta: "Dejar así" }] });
  }
  return out.sort((a, b) => a.porcentaje - b.porcentaje).slice(0, opciones.maximo);
}

/** Votos (días marcados) por identidad en [a, b]. */
export function votos(identidades: Identidad[], habitos: Habito[], hs: Historiales, a: Dia, b: Dia): { identidad: Identidad; votos: number; detalle: { h: Habito; votos: number }[] }[] {
  return identidades.map((i) => {
    const detalle = habitos.filter((h) => h.identidad === i.id).map((h) => ({ h, votos: sumar(h, histDe(hs, h), a, b, { libresCumplen: false }, true) }))
      .filter((x) => x.votos > 0).sort((x, y) => y.votos - x.votos);
    return { identidad: i, votos: detalle.reduce((s, x) => s + x.votos, 0), detalle };
  });
}

export interface Cambio { h: Habito; antes: number; ahora: number }
/** Lo que más cambió entre dos períodos, en % del objetivo. */
export function cambios(habitos: Habito[], hs: Historiales, actual: [Dia, Dia], anterior: [Dia, Dia], hoy: Dia, op: Opciones, n = 4): Cambio[] {
  const pct = (h: Habito, [a, b]: [Dia, Dia]) => { const fin = b > hoy ? hoy : b; const e = esperado(h, a, fin); return e ? Math.round((100 * sumar(h, histDe(hs, h), a, fin, op, true)) / e) : null; };
  return conMeta(habitos).map((h) => ({ h, antes: pct(h, anterior), ahora: pct(h, actual) }))
    .filter((c): c is Cambio => c.antes != null && c.ahora != null)
    .sort((x, y) => Math.abs(y.ahora - y.antes) - Math.abs(x.ahora - x.antes)).slice(0, n);
}

export const rangoMes = (m: string): [Dia, Dia] => [primerDia(m), ultimoDia(m)];
export const rangoSemana = (l: Dia): [Dia, Dia] => [l, sumarDias(l, 6)];
