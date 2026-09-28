import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db } from "../db";
import { armarCopia, leerCopia, restaurarCopia } from "./copia";

describe("copia de seguridad", () => {
  it("ida y vuelta: lo que se exporta se restaura igual", async () => {
    await db.habitos.put({ id: "a", nombre: "Leer", color: "#80CBC4", tipo: "hacer", frecuencias: [{ desde: "2026-01-01", frecuencia: { num: 5, den: 7 } }], momento: "noche", area: "Mente", identidad: null, despuesDe: null, recordatorio: "20:30", minima: "1 página", nuncaDosVeces: true, variantes: [], pregunta: null, notas: null, orden: 1, archivado: false, creado: "2026-01-01" });
    await db.registros.bulkPut([{ habito: "a", dia: "2026-09-01", valor: "hecho" }, { habito: "a", dia: "2026-09-02", valor: "libre" }]);
    await db.notas.put({ clave: "semana:2026-08-31", texto: "Semana pesada" });
    const texto = JSON.stringify(await armarCopia(new Date("2026-09-28T10:00:00Z")));

    await db.registros.clear();
    await db.habitos.put({ id: "b", nombre: "Otro", color: "#fff", tipo: "hacer", frecuencias: [{ desde: "2026-01-01", frecuencia: { num: 1, den: 1 } }], momento: "todo", area: "", identidad: null, despuesDe: null, recordatorio: null, minima: null, nuncaDosVeces: false, variantes: [], pregunta: null, notas: null, orden: 2, archivado: false, creado: "2026-01-01" });

    await restaurarCopia(leerCopia(texto));
    expect((await db.habitos.toArray()).map((h) => h.id)).toEqual(["a"]);
    expect(await db.registros.count()).toBe(2);
    expect((await db.notas.get("semana:2026-08-31"))?.texto).toBe("Semana pesada");
  });
  it("rechaza archivos que no son copias", () => {
    expect(() => leerCopia("hola")).toThrow("no es una copia");
    expect(() => leerCopia(JSON.stringify({ app: "otra" }))).toThrow("no es una copia");
    expect(() => leerCopia(JSON.stringify({ app: "habitos", version: 99, habitos: [], registros: [] }))).toThrow("más nueva");
  });
});
