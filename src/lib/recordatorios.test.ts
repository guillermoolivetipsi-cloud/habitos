import { describe, expect, it } from "vitest";
import type { Dia, Habito, Registro, Valor } from "../tipos";
import type { Historial } from "./calculos";
import { AVISOS_POR_DEFECTO, planificarAvisos } from "./recordatorios";

const op = { libresCumplen: true };
const habito = (id: string, x: Partial<Habito> = {}): Habito => ({
  id, nombre: id, color: "#69F0AE", tipo: "hacer", frecuencias: [{ desde: "2026-01-01", frecuencia: { num: 1, den: 1 } }],
  momento: "todo", area: "", identidad: null, despuesDe: null, recordatorio: "20:30", minima: null, nuncaDosVeces: false,
  variantes: [], pregunta: null, notas: null, orden: 0, archivado: false, creado: "2026-01-01", ...x,
});
const hist = (id: string, marcas: [Dia, Valor][]): Historial => new Map(marcas.map(([dia, valor]) => [dia, { habito: id, dia, valor } as Registro]));
const ahora = new Date(2026, 8, 28, 9, 0); // lunes 28 sept, 9:00
const hoy = "2026-09-28";
const o = { ...AVISOS_POR_DEFECTO, dias: 7, cierreSemana: false, cierreMes: false };

describe("recordatorios inteligentes", () => {
  it("un aviso por día a la hora del hábito", () => {
    const a = planificarAvisos([habito("leer")], new Map(), [], ahora, hoy, op, o);
    expect(a.length).toBe(7);
    expect(a[0].cuando).toEqual(new Date(2026, 8, 28, 20, 30));
  });
  it("hoy no avisa si ya está hecho", () => {
    const a = planificarAvisos([habito("leer")], new Map([["leer", hist("leer", [[hoy, "hecho"]])]]), [], ahora, hoy, op, o);
    expect(a[0].dia).toBe("2026-09-29");
    expect(planificarAvisos([habito("leer")], new Map([["leer", hist("leer", [[hoy, "hecho"]])]]), [], ahora, hoy, op, { ...o, noSiHecho: false })[0].dia).toBe(hoy);
  });
  it("no avisa si ya pasó la hora, en pausa, ni en días que no tocan", () => {
    const tarde = new Date(2026, 8, 28, 21, 0);
    expect(planificarAvisos([habito("leer")], new Map(), [], tarde, hoy, op, o)[0].dia).toBe("2026-09-29");
    const pausa = [{ desde: "2026-09-28", hasta: "2026-10-01", motivo: "" }];
    expect(planificarAvisos([habito("leer")], new Map(), pausa, ahora, hoy, op, o)[0].dia).toBe("2026-10-02");
    const habiles = habito("meditar", { frecuencias: [{ desde: "2026-01-01", frecuencia: { num: 5, den: 7, dias: [0, 1, 2, 3, 4] } }] });
    expect(planificarAvisos([habiles], new Map(), [], ahora, hoy, op, o).map((x) => x.dia)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
  it("sin recordatorio no hay avisos; los cierres van a las 20:00", () => {
    const a = planificarAvisos([habito("x", { recordatorio: null })], new Map(), [], ahora, hoy, op, { ...o, cierreSemana: true, cierreMes: true });
    expect(a.map((x) => [x.tipo, x.dia])).toEqual([["cierreMes", "2026-09-01"], ["cierreSemana", "2026-09-28"]]);
  });
});
