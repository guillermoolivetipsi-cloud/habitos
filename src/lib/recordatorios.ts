import type { Dia, Habito, Pausa } from "../tipos";
import { esperadoDia, hechoEnSemana, metaSemana, unidad, valorEn, type Historial, type Opciones } from "./calculos";
import { diaSemana, fechaCorta, mesDe, sumarDias, ultimoDia } from "./fecha";

export interface Aviso {
  id: number;
  cuando: Date;
  titulo: string;
  cuerpo: string;
  tipo: "habito" | "cierreSemana" | "cierreMes";
  habito?: string;
  dia: Dia;
}

export interface OpcionesAvisos {
  /** "No avisar si ya está hecho": hoy no se programa el aviso de lo que ya marcaste. */
  noSiHecho: boolean;
  cierreSemana: boolean;
  cierreMes: boolean;
  dias: number; // cuántos días hacia adelante se programan
}
export const AVISOS_POR_DEFECTO: OpcionesAvisos = { noSiHecho: true, cierreSemana: true, cierreMes: true, dias: 14 };

const fechaHora = (d: Dia, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const [a, mes, dia] = d.split("-").map(Number);
  return new Date(a, mes - 1, dia, h, m, 0, 0);
};

/**
 * Qué avisos programar desde ahora y por `dias` días.
 * No avisa: en pausa, en días que no tocan (días fijos), en hábitos semanales con la semana
 * ya cumplida, ni (con `noSiHecho`) lo que ya está marcado hoy.
 */
export function planificarAvisos(habitos: Habito[], hs: Map<string, Historial>, pausas: Pausa[], ahora: Date, hoy: Dia, op: Opciones, o: OpcionesAvisos): Aviso[] {
  const out: Aviso[] = [];
  const enPausa = (d: Dia) => pausas.some((p) => p.desde <= d && d <= p.hasta);
  habitos.filter((h) => !h.archivado && h.recordatorio).forEach((h, i) => {
    const hist = hs.get(h.id) ?? new Map();
    for (let k = 0; k < o.dias; k++) {
      const d = sumarDias(hoy, k);
      const cuando = fechaHora(d, h.recordatorio!);
      if (cuando <= ahora || enPausa(d) || esperadoDia(h, d) === 0) continue;
      if (k === 0) {
        if (o.noSiHecho && valorEn(hist, d)) continue;
        if (unidad(h, d) === "semana" && hechoEnSemana(h, hist, d, op) >= metaSemana(h, d)) continue;
      }
      const detalle = h.pregunta || (h.despuesDe ? `Después de ${h.despuesDe}` : unidad(h, d) === "semana" ? `Semana ${Math.round(hechoEnSemana(h, hist, d, op))} de ${metaSemana(h, d)}` : "");
      out.push({ id: 1000 + i * 100 + k, cuando, titulo: h.nombre, cuerpo: detalle, tipo: "habito", habito: h.id, dia: d });
    }
  });
  for (let k = 0; k < o.dias; k++) {
    const d = sumarDias(hoy, k);
    const cuando = fechaHora(d, "20:00");
    if (cuando <= ahora) continue;
    if (o.cierreSemana && diaSemana(d) === 6)
      out.push({ id: 900000 + k, cuando, titulo: "Cerrá tu semana", cuerpo: `Tu resumen de la semana del ${fechaCorta(sumarDias(d, -6))} al ${fechaCorta(d)} está listo.`, tipo: "cierreSemana", dia: sumarDias(d, -6) });
    if (o.cierreMes && d === ultimoDia(mesDe(d)))
      out.push({ id: 910000 + k, cuando, titulo: "Cerrá tu mes", cuerpo: "Tu resumen del mes está listo.", tipo: "cierreMes", dia: `${mesDe(d)}-01` });
  }
  return out.sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
}
