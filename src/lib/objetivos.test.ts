import { describe, expect, it } from "vitest";
import type { Dia, Habito, Objetivo, Registro, Valor } from "../tipos";
import type { Historial } from "./calculos";
import { sumarDias } from "./fecha";
import { avancePorMes, progreso } from "./objetivos";

const habito = (id: string, x: Partial<Habito> = {}): Habito => ({
  id, nombre: id, color: "#69F0AE", tipo: "hacer", frecuencias: [{ desde: "2026-01-01", frecuencia: { num: 5, den: 7 } }],
  momento: "todo", area: "", identidad: null, despuesDe: null, recordatorio: null, minima: null, nuncaDosVeces: false,
  variantes: [], pregunta: null, notas: null, orden: 0, archivado: false, creado: "2026-01-01", ...x,
});
const hist = (id: string, marcas: [Dia, Valor][]): Historial => new Map(marcas.map(([dia, valor]) => [dia, { habito: id, dia, valor } as Registro]));
const objetivo = (x: Partial<Objetivo>): Objetivo => ({
  id: "o", nombre: "Objetivo", descripcion: "", periodo: "anio", desde: "2026-01-01", hasta: "2026-12-31",
  medida: "veces", meta: 10, habitos: ["e"], manual: 0, logrado: null, identidad: null, ...x,
});

describe("progreso de objetivos", () => {
  const e = habito("e");
  const marcas: [Dia, Valor][] = [];
  for (let i = 0; i < 6; i++) marcas.push([sumarDias("2026-09-01", i), "hecho"]);
  marcas.push(["2026-09-10", "libre"]);
  const hs = new Map([["e", hist("e", marcas)]]);

  it("veces: suma lo hecho de los hábitos vinculados, sin días libres", () => {
    const p = progreso(objetivo({ meta: 10 }), [e], hs, "2026-09-28");
    expect(p.valor).toBe(6);
    expect(p.estado).toBe("activo");
    expect(p.esperadoHoy).toBeCloseTo(271 / 365, 3);
    expect(p.texto.startsWith("Faltan 4 en 14 semanas")).toBe(true);
  });
  it("veces: cumplido cuando llega a la meta", () => {
    expect(progreso(objetivo({ meta: 5 }), [e], hs, "2026-09-28").estado).toBe("cumplido");
  });
  it("terminado sin llegar: no logrado", () => {
    const p = progreso(objetivo({ meta: 50, desde: "2026-09-01", hasta: "2026-09-15", periodo: "periodo" }), [e], hs, "2026-09-28");
    expect([p.estado, p.logrado, p.texto]).toEqual(["terminado", false, "Terminó en 6 de 50"]);
  });
  it("racha de un hábito Evitar: días sin seguidos", () => {
    const f = habito("f", { tipo: "evitar" });
    const hf = new Map([["f", hist("f", [["2026-09-25", "hecho"], ["2026-09-26", "hecho"], ["2026-09-27", "hecho"]])]]);
    const p = progreso(objetivo({ medida: "racha", meta: 30, habitos: ["f"], hasta: "2026-10-31", periodo: "periodo" }), [f], hf, "2026-09-28");
    expect(p.valor).toBe(3);
    expect(p.texto).toBe("Si seguís, llegás el 25 oct · límite 31 oct");
  });
  it("sí/no: sin responder hasta que se contesta", () => {
    const o = objetivo({ medida: "siNo", habitos: [], periodo: "mes", desde: "2026-09-01", hasta: "2026-09-30" });
    expect(progreso(o, [], new Map(), "2026-09-28").texto).toBe("Termina el 30 sept");
    expect(progreso(o, [], new Map(), "2026-10-02").texto).toBe("Terminó: ¿lo lograste?");
    expect(progreso({ ...o, logrado: true }, [], new Map(), "2026-10-02").estado).toBe("cumplido");
  });
  it("avance por mes con línea de ritmo", () => {
    const a = avancePorMes(objetivo({ meta: 12 }), [e], hs, "2026-09-28");
    expect(a.length).toBe(12);
    expect(a[8]).toEqual({ mes: "2026-09", hecho: 6, ideal: 9 });
    expect(a[9].hecho).toBeNull();
  });
});
