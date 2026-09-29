import { describe, expect, it } from "vitest";
import type { Objetivo, Tarea } from "../tipos";
import { progreso } from "./objetivos";
import { agregar, alternar, conPendientes, ordenadas, pasarPendientes, proximaTarea, quitar, reordenar, reponer } from "./tareas";

const t = (id: string, hecha = false): Tarea => ({ id, texto: id, hecha, fecha: null, nota: "" });
const objetivo = (x: Partial<Objetivo>): Objetivo => ({
  id: "o", nombre: "Taller", descripcion: "", periodo: "mes", desde: "2026-09-01", hasta: "2026-09-30",
  medida: "tareas", meta: 1, habitos: [], manual: 0, logrado: null, identidad: null, ...x,
});
const ids = (ts: Tarea[]) => ts.map((x) => x.id).join(",");

describe("tareas", () => {
  it("una nueva va última entre las pendientes", () => {
    expect(ids(agregar([t("a"), t("b", true)], t("c")))).toBe("a,c,b");
  });
  it("marcar baja al final y desmarcar vuelve última entre las pendientes", () => {
    const ts = [t("a"), t("b"), t("c", true)];
    const marcada = alternar(ts, "a");
    expect(ids(marcada)).toBe("b,c,a");
    expect(marcada.find((x) => x.id === "a")!.hecha).toBe(true);
    expect(ids(alternar(marcada, "c"))).toBe("b,c,a");
    expect(alternar(marcada, "c").find((x) => x.id === "c")!.hecha).toBe(false);
  });
  it("deshacer repone en el mismo lugar", () => {
    const ts = [t("a"), t("b"), t("c")];
    const q = quitar(ts, "b");
    expect(ids(q.tareas)).toBe("a,c");
    expect(ids(reponer(q.tareas, q.tarea!, q.indice))).toBe("a,b,c");
    expect(ids(reponer(ts, q.tarea!, 1))).toBe("a,b,c");
  });
  it("reordenar mueve solo las pendientes", () => {
    const ts = [t("a"), t("b"), t("c"), t("d", true)];
    expect(ids(reordenar(ts, ["c", "a", "b"]))).toBe("c,a,b,d");
  });
  it("la próxima es la primera pendiente", () => {
    expect(proximaTarea([t("a", true), t("b"), t("c")])!.id).toBe("b");
    expect(proximaTarea([])).toBeNull();
    expect(ids(ordenadas([t("a", true), t("b")]))).toBe("b,a");
  });

  it("el avance sale de las tareas", () => {
    const p = progreso(objetivo({ tareas: [t("a", true), t("b", true), t("c")] }), [], new Map(), "2026-09-20");
    expect(p.valor).toBe(2);
    expect(p.fraccion).toBeCloseTo(2 / 3);
    expect(p.estado).toBe("activo");
    expect(p.texto).toBe("Falta 1 tarea · hasta el 30 sept");
    expect(progreso(objetivo({ tareas: [t("a", true)] }), [], new Map(), "2026-09-20").estado).toBe("cumplido");
  });
  it("sin tareas no está cumplido", () => {
    const p = progreso(objetivo({ tareas: [] }), [], new Map(), "2026-09-20");
    expect(p.estado).toBe("activo");
    expect(p.fraccion).toBe(0);
    expect(p.texto).toBe("Todavía no tiene tareas");
  });
  it("terminado con pendientes", () => {
    const p = progreso(objetivo({ tareas: [t("a", true), t("b")] }), [], new Map(), "2026-10-02");
    expect(p.estado).toBe("terminado");
    expect(p.logrado).toBe(false);
    expect(p.texto).toBe("Terminó con 1 de 2 tareas");
  });

  it("el cierre de mes pregunta por los que terminan ese mes con pendientes", () => {
    const os = [objetivo({ tareas: [t("a")] }), objetivo({ id: "p", tareas: [t("a", true)] }), objetivo({ id: "q", tareas: [t("a")], pendientesResueltas: true }),
      objetivo({ id: "r", periodo: "anio", desde: "2026-01-01", hasta: "2026-12-31", tareas: [t("a")] })];
    expect(conPendientes(os, "2026-09").map((o) => o.id)).toEqual(["o"]);
  });
  it("pasar pendientes crea el objetivo del mes siguiente", () => {
    const o = objetivo({ tareas: [t("a", true), t("b"), t("c")] });
    let n = 0;
    const { original, destino } = pasarPendientes(o, [o], () => "nuevo", () => `x${n++}`);
    expect(original.pendientesResueltas).toBe(true);
    expect(original.tareas!.length).toBe(3);
    expect(destino).toMatchObject({ id: "nuevo", nombre: "Taller", periodo: "mes", desde: "2026-10-01", hasta: "2026-10-31", medida: "tareas" });
    expect(destino.tareas!.map((x) => [x.id, x.texto, x.hecha])).toEqual([["x0", "b", false], ["x1", "c", false]]);
  });
  it("pasar pendientes se suma al objetivo del mes siguiente con el mismo nombre", () => {
    const o = objetivo({ medida: "siNo", tareas: [t("b")] });
    const sig = objetivo({ id: "s", nombre: "taller ", desde: "2026-10-01", hasta: "2026-10-31", tareas: [t("z"), t("y", true)] });
    const { destino } = pasarPendientes(o, [o, sig], () => "nuevo", () => "x");
    expect(destino.id).toBe("s");
    expect(ids(destino.tareas!)).toBe("z,x,y");
  });
});
