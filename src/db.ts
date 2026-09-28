import Dexie, { type Table } from "dexie";
import type { Habito, Identidad, Objetivo, Registro } from "./tipos";

export interface Ajuste { clave: string; valor: unknown }

class Base extends Dexie {
  habitos!: Table<Habito, string>;
  registros!: Table<Registro, [string, string]>;
  identidades!: Table<Identidad, string>;
  objetivos!: Table<Objetivo, string>;
  ajustes!: Table<Ajuste, string>;
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
  }
}

export const db = new Base();

export interface Preferencias {
  agrupar: "momento" | "area";
  libresCumplen: boolean;
  patrones: boolean;
  invertirSemana: boolean;
}
export const PREFERENCIAS: Preferencias = { agrupar: "momento", libresCumplen: true, patrones: true, invertirSemana: false };
