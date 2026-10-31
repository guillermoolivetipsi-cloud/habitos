import { describe, expect, it } from "vitest";
import type { Dia, Habito, Registro, Valor } from "../tipos";
import type { Historial } from "./calculos";
import { puntuaciones, rachaActual, rachas } from "./estadisticas";
import { dias } from "./fecha";

const op = { libresCumplen: true };
const habito = (num = 1, den = 1): Habito => ({
  id: "h", nombre: "Prueba", color: "#69F0AE", tipo: "hacer", frecuencias: [{ desde: "2026-01-01", frecuencia: { num, den } }],
  momento: "todo", area: "", identidad: null, despuesDe: null, recordatorio: null, minima: null, nuncaDosVeces: false,
  variantes: [], pregunta: null, notas: null, orden: 0, archivado: false, creado: "2026-01-01",
});
const hist = (marcas: [Dia, Valor][]): Historial => new Map(marcas.map(([dia, valor]) => [dia, { habito: "h", dia, valor } as Registro]));

describe("puntuación (fórmula de Loop)", () => {
  it("en un hábito diario, 13 días seguidos hechos llevan de 0 a 50", () => {
    const x = hist([...dias("2026-01-01", "2026-01-13")].map((d) => [d, "hecho"] as [Dia, Valor]));
    expect(puntuaciones(habito(), x, "2026-01-13", "2026-01-13").get("2026-01-13")).toBe(50);
  });
  it("un día libre no mueve la puntuación", () => {
    const x = hist([["2026-01-01", "hecho"], ["2026-01-02", "libre"]]);
    const p = puntuaciones(habito(), x, "2026-01-01", "2026-01-02");
    expect(p.get("2026-01-02")).toBe(p.get("2026-01-01"));
  });
  it("un día libre no cuenta como no hecho en los días siguientes", () => {
    const fechas = [...dias("2026-01-01", "2026-01-20")];
    const conLibre = hist(fechas.map((d, i) => [d, i === 9 ? "libre" : "hecho"] as [Dia, Valor]));
    const sinEseDia = hist(fechas.slice(0, 19).map((d) => [d, "hecho"] as [Dia, Valor]));
    expect(puntuaciones(habito(5, 7), conLibre, "2026-01-20", "2026-01-20").get("2026-01-20"))
      .toBe(puntuaciones(habito(5, 7), sinEseDia, "2026-01-19", "2026-01-19").get("2026-01-19"));
  });

  // Misma cuenta que ScoreList.recompute de Loop (hábitos sí/no), con marcas pseudoaleatorias fijas.
  const comoLoop = (num: number, den: number, valores: (Valor | undefined)[]) => {
    const frec = num / den;
    const n = frec < 1 ? num * 2 : num, d = frec < 1 ? den * 2 : den;
    const mult = Math.pow(0.5, Math.sqrt(frec) / 13);
    const ventana: (Valor | undefined)[] = [];
    let suma = 0, score = 0;
    return valores.map((v) => {
      if (v !== "libre") {
        ventana.push(v);
        if (ventana.length > d && ventana.shift() === "hecho") suma--;
        if (v === "hecho") suma++;
        score = score * mult + Math.min(1, suma / n) * (1 - mult);
      }
      return score * 100;
    });
  };
  const marcasAl = (largo: number, pHecho: number, pLibre: number) => {
    let x = 12345;
    const azar = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
    return Array.from({ length: largo }, () => { const r = azar(); return r < pLibre ? "libre" : r < pLibre + pHecho ? "hecho" : undefined; }) as (Valor | undefined)[];
  };
  const fechas = [...dias("2026-01-01", "2027-06-30")];
  for (const [num, den, pHecho, pLibre] of [[1, 1, 0.7, 0.1], [5, 7, 0.6, 0.15], [3, 7, 0.4, 0.05], [1, 7, 0.2, 0.25]]) {
    it(`da lo mismo que Loop día por día (${num} en ${den}, ${pLibre * 100}% libres)`, () => {
      const valores = marcasAl(fechas.length, pHecho, pLibre);
      const x = hist(fechas.flatMap((d, i) => (valores[i] ? [[d, valores[i]] as [Dia, Valor]] : [])));
      const nuestra = puntuaciones(habito(num, den), x, fechas[0], fechas[fechas.length - 1]);
      const loop = comoLoop(num, den, valores);
      expect(fechas.map((d) => nuestra.get(d))).toEqual(loop.map(Math.round));
    });
  }
});

describe("rachas", () => {
  it("diarias: los días libres no cortan", () => {
    const x = hist([["2026-09-20", "hecho"], ["2026-09-21", "libre"], ["2026-09-22", "hecho"], ["2026-09-24", "hecho"]]);
    expect(rachas(habito(), x, "2026-09-24", op).map((r) => r.largo)).toEqual([2, 1]);
    expect(rachaActual(habito(), x, "2026-09-25", op)?.largo).toBe(1);
  });
  it("semanales: semanas seguidas cumplidas", () => {
    const marcas: [Dia, Valor][] = [];
    for (const l of ["2026-09-07", "2026-09-14"]) for (let i = 0; i < 3; i++) marcas.push([`2026-09-${String(+l.slice(8) + i).padStart(2, "0")}`, "hecho"]);
    const r = rachas(habito(3, 7), hist(marcas), "2026-09-24", op);
    expect(r.map((x) => [x.largo, x.unidad])).toEqual([[2, "semanas"]]);
  });
});

describe("series por escala", async () => {
  const { historialPor, puntuacionPor, tramos } = await import("./estadisticas");
  it("tramos: meses con el año en enero, trimestres y años", () => {
    expect(tramos("2025-11-10", "2026-02-03", "mes").map((t) => t.etiqueta)).toEqual(["nov", "dic", "2026", "feb"]);
    expect(tramos("2025-11-10", "2026-05-03", "trimestre").map((t) => t.etiqueta)).toEqual(["T4", "T1 26", "T2"]);
    expect(tramos("2024-03-01", "2026-01-01", "anio").map((t) => t.etiqueta)).toEqual(["2024", "2025", "2026"]);
  });
  it("historial por mes: hechas, libres y meta del mes completo", () => {
    const h = habito(5, 7);
    const x = hist([["2026-01-05", "hecho"], ["2026-01-06", "libre"], ["2026-02-02", "hecho"]]);
    const m = historialPor(h, x, "2026-02-10", op, "mes");
    expect(m.map((t) => [t.etiqueta, t.hechas, t.libres, t.meta])).toEqual([["2026", 1, 1, 22], ["feb", 1, 0, 20]]);
  });
  it("la puntuación de cada tramo es el promedio de sus días, sin contar días fuera de rango", () => {
    const x = hist([...dias("2026-01-01", "2026-01-20")].map((d) => [d, "hecho"] as [Dia, Valor]));
    // Hecho todos los días: al día n la puntuación es 1 - 0,5^(n/13).
    const dia = (n: number) => 100 * (1 - Math.pow(0.5, n / 13));
    const promedio = (ns: number[]) => Math.round(ns.reduce((a, n) => a + dia(n), 0) / ns.length);
    const s = puntuacionPor(habito(), x, "2026-01-20", "semana");
    expect(s[0].valor).toBe(promedio([1, 2, 3, 4])); // la primera semana empieza el jueves 1
    expect(s[s.length - 1].valor).toBe(promedio([19, 20])); // la última llega hasta hoy
  });
});
