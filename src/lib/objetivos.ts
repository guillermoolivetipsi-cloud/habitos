import type { Dia, Habito, Objetivo } from "../tipos";
import { diasSinSeguidos, rachaDias, sumar, type Historial } from "./calculos";
import { diasEntre, fechaCorta, lunes, sumarDias, sumarMeses, mesDe, primerDia, ultimoDia } from "./fecha";

export type Estado = "futuro" | "activo" | "cumplido" | "terminado";

export interface Progreso {
  valor: number;
  /** 0 a 1. */
  fraccion: number;
  /** Dónde debería estar hoy para llegar a tiempo (0 a 1); null si no aplica (racha, sí/no). */
  esperadoHoy: number | null;
  estado: Estado;
  /** Logrado: sí/no según la respuesta; los medibles, según si llegaron a la meta. null = sin responder. */
  logrado: boolean | null;
  texto: string;
}

const coma = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");

/** Veces hechas de los hábitos vinculados en [desde, hasta]. */
function vecesDe(o: Objetivo, habitos: Habito[], hs: Map<string, Historial>, hasta: Dia): number {
  let x = 0;
  for (const id of o.habitos) {
    const h = habitos.find((y) => y.id === id);
    if (h && hasta >= o.desde) x += sumar(h, hs.get(id) ?? new Map(), o.desde, hasta, { libresCumplen: false }, true);
  }
  return x;
}

/** Promedio por semana de los hábitos vinculados en las últimas 8 semanas completas. */
export function ritmoActual(o: Objetivo, habitos: Habito[], hs: Map<string, Historial>, hoy: Dia): number {
  const l0 = lunes(hoy);
  let x = 0;
  for (const id of o.habitos) {
    const h = habitos.find((y) => y.id === id);
    if (!h) continue;
    for (let i = 1; i <= 8; i++) { const l = sumarDias(l0, -7 * i); x += sumar(h, hs.get(id) ?? new Map(), l, sumarDias(l, 6), { libresCumplen: false }, true); }
  }
  return x / 8;
}

export function progreso(o: Objetivo, habitos: Habito[], hs: Map<string, Historial>, hoy: Dia): Progreso {
  const total = diasEntre(o.desde, o.hasta) + 1;
  const transcurridos = Math.min(total, Math.max(0, diasEntre(o.desde, hoy) + 1));
  const corte = hoy < o.hasta ? hoy : o.hasta;
  let valor = 0;
  if (o.medida === "veces") valor = vecesDe(o, habitos, hs, corte);
  else if (o.medida === "racha") {
    const h = habitos.find((y) => y.id === o.habitos[0]);
    const hist = hs.get(o.habitos[0]) ?? new Map();
    valor = h ? (h.tipo === "evitar" ? diasSinSeguidos(hist, corte) : rachaDias(h, hist, corte)) : 0;
  } else if (o.medida === "cantidad") valor = o.manual;
  else valor = o.logrado ? 1 : 0;
  const meta = o.medida === "siNo" ? 1 : Math.max(1, o.meta);
  const fraccion = Math.min(1, valor / meta);
  const llego = valor >= meta;
  const estado: Estado = hoy < o.desde ? "futuro" : o.medida === "siNo" ? (o.logrado != null ? "cumplido" : hoy > o.hasta ? "terminado" : "activo") : llego ? "cumplido" : hoy > o.hasta ? "terminado" : "activo";
  const logrado = o.medida === "siNo" ? o.logrado : estado === "cumplido" ? true : estado === "terminado" ? false : null;
  const esperadoHoy = o.medida === "veces" || o.medida === "cantidad" ? transcurridos / total : null;

  let texto = "";
  if (estado === "futuro") texto = `Empieza el ${fechaCorta(o.desde)}`;
  else if (o.medida === "siNo") texto = o.logrado == null ? (estado === "terminado" ? "Terminó: ¿lo lograste?" : `Termina el ${fechaCorta(o.hasta)}`) : o.logrado ? "Logrado" : "No logrado";
  else if (llego) texto = "Meta cumplida";
  else if (estado === "terminado") texto = `Terminó en ${coma(valor)} de ${meta}`;
  else if (o.medida === "veces") {
    const faltan = meta - valor;
    const semanas = Math.max(0.1, (diasEntre(hoy, o.hasta) + 1) / 7);
    texto = `Faltan ${coma(faltan)} en ${Math.max(1, Math.round(semanas))} semanas: ${coma(faltan / semanas)} por semana · tu ritmo ${coma(ritmoActual(o, habitos, hs, hoy))}`;
  } else if (o.medida === "racha") {
    const llega = sumarDias(hoy, meta - valor);
    texto = llega <= o.hasta ? `Si seguís, llegás el ${fechaCorta(llega)} · límite ${fechaCorta(o.hasta)}` : `Con la racha actual llegarías el ${fechaCorta(llega)}, después del límite (${fechaCorta(o.hasta)})`;
  } else texto = `Faltan ${coma(meta - valor)} · hasta el ${fechaCorta(o.hasta)}`;
  return { valor, fraccion, esperadoHoy, estado, logrado, texto };
}

/** Avance acumulado por mes contra la línea de ritmo necesario (para el gráfico del detalle). */
export function avancePorMes(o: Objetivo, habitos: Habito[], hs: Map<string, Historial>, hoy: Dia) {
  const out: { mes: string; hecho: number | null; ideal: number }[] = [];
  const total = diasEntre(o.desde, o.hasta) + 1;
  for (let m = mesDe(o.desde); m <= mesDe(o.hasta); m = sumarMeses(m, 1)) {
    const fin = ultimoDia(m) > o.hasta ? o.hasta : ultimoDia(m);
    const inicioMes = primerDia(m) < o.desde ? o.desde : primerDia(m);
    out.push({
      mes: m,
      hecho: inicioMes > hoy ? null : Math.round(vecesDe(o, habitos, hs, fin > hoy ? hoy : fin) * 10) / 10,
      ideal: Math.round((o.meta * (diasEntre(o.desde, fin) + 1)) / total),
    });
  }
  return out;
}

/** Rango de fechas según el período elegido. */
export function rangoObjetivo(periodo: Objetivo["periodo"], valor: { mes?: string; anio?: number; desde?: Dia; hasta?: Dia }): [Dia, Dia] {
  if (periodo === "mes") return [primerDia(valor.mes!), ultimoDia(valor.mes!)];
  if (periodo === "anio") return [`${valor.anio}-01-01`, `${valor.anio}-12-31`];
  return [valor.desde!, valor.hasta!];
}
