import type { Dia } from "../tipos";

export const DIAS_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
export const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
/** "los lunes", "los sábados". */
export const DIAS_PLURAL = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
export const INICIALES = ["L", "M", "X", "J", "V", "S", "D"];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Se calcula al mediodía UTC para que ningún cambio de horario mueva el día.
const aFecha = (d: Dia) => new Date(d + "T12:00:00Z");
const aDia = (f: Date): Dia => f.toISOString().slice(0, 10);

export function hoy(ahora = new Date(), terminaALas3 = false): Dia {
  const f = new Date(ahora);
  if (terminaALas3 && f.getHours() < 3) f.setDate(f.getDate() - 1);
  const m = String(f.getMonth() + 1).padStart(2, "0");
  const d = String(f.getDate()).padStart(2, "0");
  return `${f.getFullYear()}-${m}-${d}`;
}

export function sumarDias(d: Dia, n: number): Dia {
  const f = aFecha(d);
  f.setUTCDate(f.getUTCDate() + n);
  return aDia(f);
}

/** 0 = lunes … 6 = domingo. */
export const diaSemana = (d: Dia) => (aFecha(d).getUTCDay() + 6) % 7;
export const lunes = (d: Dia) => sumarDias(d, -diaSemana(d));
export const diasEntre = (a: Dia, b: Dia) => Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 864e5);

export type Mes = string; // "AAAA-MM"
export const mesDe = (d: Dia): Mes => d.slice(0, 7);
export function diasDelMes(m: Mes): number {
  const [a, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(a, mm, 0)).getUTCDate();
}
export function sumarMeses(m: Mes, n: number): Mes {
  let [a, mm] = m.split("-").map(Number);
  mm += n;
  while (mm > 12) { mm -= 12; a++; }
  while (mm < 1) { mm += 12; a--; }
  return `${a}-${String(mm).padStart(2, "0")}`;
}
export const primerDia = (m: Mes): Dia => `${m}-01`;
export const ultimoDia = (m: Mes): Dia => `${m}-${diasDelMes(m)}`;

export const fechaCorta = (d: Dia) => `${+d.slice(8)} ${MESES_CORTOS[+d.slice(5, 7) - 1]}`;
export const nombreMes = (m: Mes) => MESES[+m.slice(5) - 1];

/** Recorre [a, b] día por día. */
export function* dias(a: Dia, b: Dia): Generator<Dia> {
  for (let d = a; d <= b; d = sumarDias(d, 1)) yield d;
}
