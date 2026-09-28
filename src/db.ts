import Dexie, { type Table } from "dexie";
import type { Habito, Identidad, Objetivo, Registro } from "./tipos";

export interface Ajuste { clave: string; valor: unknown }
/** Nota de un cierre: clave "semana:AAAA-MM-DD" (lunes), "mes:AAAA-MM" o "anio:AAAA". */
export interface Nota { clave: string; texto: string }
/** Ajuste aplicado desde Revisión, para "Decisiones anteriores". */
export interface Decision { id?: number; fecha: string; habito: string; nombre: string; texto: string }

class Base extends Dexie {
  habitos!: Table<Habito, string>;
  registros!: Table<Registro, [string, string]>;
  identidades!: Table<Identidad, string>;
  objetivos!: Table<Objetivo, string>;
  ajustes!: Table<Ajuste, string>;
  notas!: Table<Nota, string>;
  decisiones!: Table<Decision, number>;
  constructor() {
    super("habitos");
    this.version(1).stores({
      habitos: "id, orden, archivado",
      // Un registro por hábito y día.
      registros: "[habito+dia], habito, dia",
      identidades: "id",
      objetivos: "id",
      ajustes: "clave",
    });
    this.version(2).stores({ notas: "clave", decisiones: "++id, fecha" });
  }
}

export const db = new Base();

export interface Preferencias {
  agrupar: "momento" | "area";
  libresCumplen: boolean;
  patrones: boolean;
  invertirSemana: boolean;
  /** Sugerencias de Revisión: umbral en % de 90 días y máximo por semana. */
  sugerencias: boolean;
  umbralSugerencias: number;
  maximoSugerencias: number;
  /** Id de hábito → fecha hasta la que no se vuelve a sugerir ("Dejar así"). */
  descartadas: Record<string, string>;
}
export const PREFERENCIAS: Preferencias = { agrupar: "momento", libresCumplen: true, patrones: true, invertirSemana: false, sugerencias: true, umbralSugerencias: 30, maximoSugerencias: 3, descartadas: {} };
