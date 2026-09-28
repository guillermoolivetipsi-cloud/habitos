import { describe, expect, it } from "vitest";
import type { Dia, Habito, Registro, Valor } from "../tipos";
import type { Historial } from "./calculos";
import { sumarDias } from "./fecha";
import { cumplimiento, porHabito, sugerencias, votos } from "./revision";

const op = { libresCumplen: true };
const habito = (id: string, num: number, den: number, x: Partial<Habito> = {}): Habito => ({
  id, nombre: id, color: "#69F0AE", tipo: "hacer", frecuencias: [{ desde: "2026-01-01", frecuencia: { num, den } }],
  momento: "todo", area: "", identidad: null, despuesDe: null, recordatorio: null, minima: null, nuncaDosVeces: false,
  variantes: [], pregunta: null, notas: null, orden: 0, archivado: false, creado: "2026-01-01", ...x,
});
const hist = (id: string, marcas: [Dia, Valor][]): Historial => new Map(marcas.map(([dia, valor]) => [dia, { habito: id, dia, valor } as Registro]));

describe("cumplimiento", () => {
  it("suma todos los hábitos y recorta a hoy", () => {
    const a = habito("a", 1, 1), b = habito("b", 1, 1);
    const hs = new Map([["a", hist("a", [["2026-09-21", "hecho"], ["2026-09-22", "hecho"]])], ["b", hist("b", [["2026-09-21", "hecho"]])]]);
    const c = cumplimiento([a, b], hs, "2026-09-21", "2026-09-27", "2026-09-22", op);
    expect(c).toEqual({ hechas: 3, esperadas: 4, porcentaje: 75 });
  });
  it("la meta semanal es la de la semana completa aunque la semana vaya por la mitad", () => {
    const e = habito("e", 5, 7);
    const hs = new Map([["e", hist("e", [["2026-09-21", "hecho"]])]]);
    expect(porHabito([e], hs, "2026-09-21", "2026-09-27", "2026-09-22", op)[0].meta).toBe(5);
  });
});

describe("sugerencias", () => {
  const hoy = "2026-09-28";
  it("propone bajar la frecuencia a un hábito por debajo del umbral, y respeta 'Dejar así'", () => {
    const d = habito("ducha", 1, 1);
    const marcas: [Dia, Valor][] = [];
    for (let i = 1; i <= 90; i += 10) marcas.push([sumarDias(hoy, -i), "hecho"]);
    const hs = new Map([["ducha", hist("ducha", marcas)]]);
    const s = sugerencias([d], hs, hoy, op, { umbral: 30, maximo: 3, descartadas: new Set() });
    expect(s[0].titulo).toBe("ducha: 10% en 90 días");
    expect(s[0].acciones.map((a) => a.etiqueta)).toEqual(["Bajar a 4/sem", "Archivar", "Dejar así"]);
    expect(sugerencias([d], hs, hoy, op, { umbral: 30, maximo: 3, descartadas: new Set(["ducha"]) })).toEqual([]);
  });
  it("propone lunes a viernes si nunca se hace el fin de semana", () => {
    const m = habito("meditar", 4, 7);
    const marcas: [Dia, Valor][] = [];
    for (let i = 1; i <= 90; i++) { const d = sumarDias(hoy, -i); const w = (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7; if (w < 4) marcas.push([d, "hecho"]); }
    const s = sugerencias([m], new Map([["meditar", hist("meditar", marcas)]]), hoy, op, { umbral: 30, maximo: 3, descartadas: new Set() });
    expect(s[0].acciones[0].etiqueta).toBe("Pasar a lun–vie");
  });
});

describe("votos", () => {
  it("cuenta días marcados por identidad, sin días libres", () => {
    const i = { id: "cuerpo", frase: "Alguien que se cuida", color: "#69F0AE" };
    const a = habito("agua", 1, 1, { identidad: "cuerpo" });
    const hs = new Map([["agua", hist("agua", [["2026-09-21", "hecho"], ["2026-09-22", "libre"], ["2026-09-23", "hecho"]])]]);
    expect(votos([i], [a], hs, "2026-09-21", "2026-09-27")[0].votos).toBe(2);
  });
});
