import { describe, expect, it } from "vitest";
import type { Dia, Habito, Registro, Valor } from "../tipos";
import { diasSinSeguidos, esperado, fallaAnterior, frecuenciaEn, patronDelDia, puntos, sumar, type Historial } from "./calculos";
import { sumarDias } from "./fecha";

const op = { libresCumplen: true };
const habito = (x: Partial<Habito> = {}): Habito => ({
  id: "h", nombre: "Prueba", color: "#69F0AE", tipo: "hacer", frecuencias: [{ desde: "2026-01-01", frecuencia: { num: 1, den: 1 } }],
  momento: "todo", area: "", identidad: null, despuesDe: null, recordatorio: null, minima: null, nuncaDosVeces: true,
  variantes: [], pregunta: null, notas: null, orden: 0, archivado: false, creado: "2026-01-01", ...x,
});
const hist = (marcas: [Dia, Valor][]): Historial => new Map(marcas.map(([dia, valor]) => [dia, { habito: "h", dia, valor } as Registro]));

describe("frecuencia por versiones", () => {
  it("el pasado se mide con la frecuencia anterior", () => {
    const h = habito({ frecuencias: [
      { desde: "2026-01-01", frecuencia: { num: 4, den: 7 } },
      { desde: "2026-09-01", frecuencia: { num: 5, den: 7, dias: [0, 1, 2, 3, 4] } },
    ] });
    expect(frecuenciaEn(h, "2026-08-31").num).toBe(4);
    expect(frecuenciaEn(h, "2026-09-05").dias).toEqual([0, 1, 2, 3, 4]);
    // Semana del 7 al 13 sept con días fijos lun–vie: 5 esperados.
    expect(esperado(h, "2026-09-07", "2026-09-13")).toBe(5);
  });
});

describe("valores", () => {
  it("la mínima de Evitar vale medio día y el día libre suma solo si cuenta como cumplido", () => {
    expect(puntos(habito({ tipo: "evitar" }), "minima")).toBe(0.5);
    expect(puntos(habito(), "minima")).toBe(1);
    const h = habito();
    const x = hist([["2026-09-01", "hecho"], ["2026-09-02", "libre"]]);
    expect(sumar(h, x, "2026-09-01", "2026-09-02", op)).toBe(2);
    expect(sumar(h, x, "2026-09-01", "2026-09-02", { libresCumplen: false })).toBe(1);
  });
  it("días sin seguidos no se cortan por un día libre", () => {
    const x = hist([["2026-09-24", "hecho"], ["2026-09-25", "libre"], ["2026-09-26", "hecho"]]);
    expect(diasSinSeguidos(x, "2026-09-27")).toBe(2);
  });
});

describe("nunca fallar dos veces", () => {
  it("diario: ayer no", () => {
    expect(fallaAnterior(habito(), hist([]), "2026-09-27", op)).toBe("ayer no");
    expect(fallaAnterior(habito(), hist([["2026-09-26", "hecho"]]), "2026-09-27", op)).toBeNull();
  });
  it("semanal: la semana pasada", () => {
    const h = habito({ frecuencias: [{ desde: "2026-01-01", frecuencia: { num: 5, den: 7 } }] });
    const x = hist([["2026-09-22", "hecho"], ["2026-09-25", "hecho"]]);
    expect(fallaAnterior(h, x, "2026-09-28", op)).toBe("la semana pasada 2 de 5");
  });
  it("apagado no muestra nada", () => {
    expect(fallaAnterior(habito({ nuncaDosVeces: false }), hist([]), "2026-09-27", op)).toBeNull();
  });
});

describe("patrón del día", () => {
  it("avisa cuando ese día está 20 puntos o más por debajo del resto", () => {
    // 13 semanas: todos los días hechos menos los domingos.
    const marcas: [Dia, Valor][] = [];
    for (let i = 1; i <= 91; i++) {
      const d = sumarDias("2026-09-27", -i);
      if (new Date(d + "T12:00:00Z").getUTCDay() !== 0) marcas.push([d, "hecho"]);
    }
    expect(patronDelDia(habito(), hist(marcas), "2026-09-27")).toEqual({ dia: 6, tasa: 0, resto: 100 });
    expect(patronDelDia(habito(), hist(marcas), "2026-09-28")).toBeNull();
  });
});

describe("hábito nuevo", () => {
  it("antes de su primer día no se espera nada", () => {
    const h = habito({ frecuencias: [{ desde: "2026-09-20", frecuencia: { num: 1, den: 1 } }] });
    expect(esperado(h, "2026-09-01", "2026-09-26")).toBe(7);
  });
});

describe("modo pausa", () => {
  it("pone día libre donde no hay registro y respeta lo marcado", async () => {
    const { aplicarPausas, sumar: s } = await import("./calculos");
    const h = habito();
    const hs = new Map([["h", hist([["2026-09-10", "hecho"]])]]);
    aplicarPausas([h], hs, [{ desde: "2026-09-10", hasta: "2026-09-20", motivo: "Vacaciones" }], "2026-09-12");
    const m = hs.get("h")!;
    expect([m.get("2026-09-10")?.valor, m.get("2026-09-11")?.valor, m.get("2026-09-12")?.porPausa, m.has("2026-09-13")]).toEqual(["hecho", "libre", true, false]);
    // Con días libres cumplidos, la pausa no baja el porcentaje.
    expect(s(h, m, "2026-09-10", "2026-09-12", op)).toBe(3);
  });
});
