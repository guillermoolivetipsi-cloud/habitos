import JSZip from "jszip";
import type { SqlJsStatic } from "sql.js";
import type { Dia, Habito, Registro } from "../tipos";

/** Paleta de Loop por índice (la copia de seguridad guarda el índice; el CSV, el color). */
const PALETA_LOOP = [
  "#D32F2F", "#E64A19", "#F57C00", "#FF8F00", "#F9A825", "#AFB42B", "#7CB342", "#388E3C", "#00897B", "#00ACC1",
  "#039BE5", "#1976D2", "#303F9F", "#5E35B1", "#8E24AA", "#D81B60", "#5D4037", "#303030", "#757575", "#AAAAAA",
];
/** Colores de Loop (modo claro) → su versión para fondo negro. */
const COLORES: Record<string, string> = {
  "#D32F2F": "#FF8A80", "#E64A19": "#FF8A65", "#F57C00": "#FFB74D", "#FF8F00": "#FFD54F",
  "#F9A825": "#FFF176", "#AFB42B": "#DCE775", "#7CB342": "#AED581", "#388E3C": "#69F0AE",
  "#00897B": "#80CBC4", "#00ACC1": "#4DD0E1", "#039BE5": "#4FC3F7", "#1976D2": "#64B5F6",
  "#303F9F": "#7986CB", "#5E35B1": "#B39DDB", "#8E24AA": "#CE93D8", "#D81B60": "#F48FB1",
  "#5D4037": "#BCAAA4", "#303030": "#BDBDBD", "#757575": "#BDBDBD", "#AAAAAA": "#BDBDBD",
};
export const colorOscuro = (c: string) => COLORES[c.toUpperCase()] ?? "#BDBDBD";

/** Un hábito tal como viene de Loop, antes de convertirlo. */
interface HabitoLoop {
  clave: string; // posición en el CSV, id en la copia de seguridad
  orden: number;
  nombre: string;
  archivado: boolean;
  color: string; // hex de Loop
  num: number;
  den: number;
  numerico: boolean;
  meta: number;
  comoMaximo: boolean;
  unidad: string;
  pregunta: string;
  descripcion: string;
  recordatorio: string | null;
}
interface MarcaLoop {
  clave: string;
  dia: Dia;
  tipo: "si" | "libre";
  cantidad?: number;
}

export interface Copia {
  clave: string;
  nombre: string;
  /** "igual": mismos días que otro; "contenida": todos sus días están en otro. */
  motivo: "igual" | "contenida";
  de: string; // clave del hábito que la contiene
  dias: number;
}

export interface ResultadoImportacion {
  origen: "csv" | "copia";
  habitos: Habito[];
  registros: Registro[];
  copias: Copia[];
  desde: Dia | null;
  hasta: Dia | null;
  conRecordatorio: number;
}

/** Detecta el formato y lee el archivo. */
export async function importarArchivoLoop(datos: Uint8Array, hoy: Dia, iniciarSql: () => Promise<SqlJsStatic>): Promise<ResultadoImportacion> {
  const cabecera = new TextDecoder().decode(datos.slice(0, 15));
  if (cabecera === "SQLite format 3") return importarCopiaLoop(datos, hoy, iniciarSql);
  if (datos[0] === 0x50 && datos[1] === 0x4b) return importarZipLoop(datos, hoy);
  throw new Error("No reconozco el archivo. Elegí la copia de seguridad (.db) o la exportación CSV (.zip) de Loop.");
}

/* ---------- Copia de seguridad (.db) ---------- */

export async function importarCopiaLoop(datos: Uint8Array, hoy: Dia, iniciarSql: () => Promise<SqlJsStatic>): Promise<ResultadoImportacion> {
  const SQL = await iniciarSql();
  const base = new SQL.Database(datos);
  try {
    const filas = (sql: string) => {
      const r = base.exec(sql)[0];
      return r ? r.values.map((v) => Object.fromEntries(r.columns.map((c, i) => [c, v[i]]))) : [];
    };
    if (!filas("select name from sqlite_master where type='table' and name='Habits'").length)
      throw new Error("El archivo no parece una copia de seguridad de Loop: falta la tabla de hábitos.");
    const habitos: HabitoLoop[] = filas("select * from Habits order by position").map((h) => ({
      clave: String(h.id),
      orden: Number(h.position),
      nombre: String(h.name ?? ""),
      archivado: Number(h.archived) === 1,
      color: PALETA_LOOP[Number(h.color)] ?? "#AAAAAA",
      num: Number(h.freq_num) || 1,
      den: Number(h.freq_den) || 1,
      numerico: Number(h.type) === 1,
      meta: Number(h.target_value) || 0,
      comoMaximo: Number(h.target_type) === 1,
      unidad: String(h.unit ?? ""),
      pregunta: String(h.question ?? ""),
      descripcion: String(h.description ?? ""),
      recordatorio: h.reminder_hour == null ? null : `${String(h.reminder_hour).padStart(2, "0")}:${String(h.reminder_min ?? 0).padStart(2, "0")}`,
    }));
    const numericos = new Set(habitos.filter((h) => h.numerico).map((h) => h.clave));
    const marcas: MarcaLoop[] = [];
    // Valores de Loop: 2 = sí (manual), 3 = día libre, 0 = no. El "sí automático" no se guarda.
    for (const r of filas("select habit, timestamp, value from Repetitions")) {
      const clave = String(r.habit);
      const dia = new Date(Number(r.timestamp)).toISOString().slice(0, 10);
      const v = Number(r.value);
      if (numericos.has(clave)) { if (v > 0) marcas.push({ clave, dia, tipo: "si", cantidad: v / 1000 }); }
      else if (v === 2) marcas.push({ clave, dia, tipo: "si" });
      else if (v === 3) marcas.push({ clave, dia, tipo: "libre" });
    }
    return convertir("copia", habitos, marcas, hoy);
  } finally {
    base.close();
  }
}

/* ---------- Exportación CSV (.zip) ---------- */

/** CSV con comillas dobles, como lo escribe Loop. */
export function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

export async function importarZipLoop(datos: ArrayBuffer | Uint8Array, hoy: Dia): Promise<ResultadoImportacion> {
  const zip = await JSZip.loadAsync(datos);
  const archivoHabitos = Object.values(zip.files).find((f) => /(^|\/)Habits\.csv$/.test(f.name));
  if (!archivoHabitos) throw new Error("El archivo no parece una exportación de Loop: falta Habits.csv.");
  const raiz = archivoHabitos.name.slice(0, -"Habits.csv".length);
  const [cab, ...filas] = leerCsv(await archivoHabitos.async("string"));
  const col = (n: string) => cab.indexOf(n);
  const habitos: HabitoLoop[] = [];
  const marcas: MarcaLoop[] = [];
  for (const f of filas) {
    const clave = f[col("Position")];
    const numerico = f[col("Type")] === "NUMERICAL";
    habitos.push({
      clave, orden: Number(clave), nombre: f[col("Name")], archivado: f[col("Archived?")] === "true",
      color: f[col("Color")] || "#AAAAAA", num: Number(f[col("FrequencyNumerator")]) || 1, den: Number(f[col("FrequencyDenominator")]) || 1,
      numerico, meta: Number(f[col("Target Value")]) || 0, comoMaximo: f[col("Target Type")] === "AT_MOST", unidad: f[col("Unit")] || "",
      pregunta: f[col("Question")] || "", descripcion: f[col("Description")] || "", recordatorio: null,
    });
    const carpeta = Object.keys(zip.files).find((k) => k.startsWith(`${raiz}${clave} `) && k.endsWith("Checkmarks.csv"));
    if (!carpeta) continue;
    const [c2, ...filasMarcas] = leerCsv(await zip.files[carpeta].async("string"));
    const iD = c2.indexOf("Date");
    const iV = c2.indexOf("Value");
    for (const m of filasMarcas) {
      const v = m[iV];
      if (numerico) { const cantidad = Number(v) / 1000; if (cantidad > 0) marcas.push({ clave, dia: m[iD], tipo: "si", cantidad }); }
      else if (v === "YES_MANUAL") marcas.push({ clave, dia: m[iD], tipo: "si" });
      else if (v === "SKIP") marcas.push({ clave, dia: m[iD], tipo: "libre" });
    }
  }
  return convertir("csv", habitos, marcas, hoy);
}

/* ---------- Conversión común ---------- */

function convertir(origen: ResultadoImportacion["origen"], lista: HabitoLoop[], marcas: MarcaLoop[], hoy: Dia): ResultadoImportacion {
  const hechos = new Map<string, Set<Dia>>(lista.map((h) => [h.clave, new Set()]));
  const porClave = new Map(lista.map((h) => [h.clave, h]));
  const registros: Registro[] = [];
  let desde: Dia | null = null;
  let hasta: Dia | null = null;
  for (const m of marcas) {
    const h = porClave.get(m.clave);
    if (!h || !m.dia || m.dia > hoy) continue;
    const id = `loop-${m.clave}`;
    if (m.tipo === "libre") { registros.push({ habito: id, dia: m.dia, valor: "libre" }); continue; }
    const valor = m.cantidad != null && (h.comoMaximo ? m.cantidad > h.meta : m.cantidad < h.meta) ? "minima" : "hecho";
    registros.push({ habito: id, dia: m.dia, valor, ...(m.cantidad != null ? { cantidad: m.cantidad } : {}) });
    hechos.get(m.clave)!.add(m.dia);
    if (!desde || m.dia < desde) desde = m.dia;
    if (!hasta || m.dia > hasta) hasta = m.dia;
  }
  const habitos: Habito[] = lista.map((h) => {
    const primero = [...hechos.get(h.clave)!].sort()[0] ?? hoy;
    return {
      id: `loop-${h.clave}`, nombre: h.nombre.trim(), color: colorOscuro(h.color), tipo: h.numerico ? "medir" : "hacer",
      frecuencias: [{ desde: primero, frecuencia: { num: h.num, den: h.den } }],
      medicion: h.numerico ? { sentido: h.comoMaximo ? "comoMaximo" : "alMenos", cantidad: h.meta, unidad: h.unidad, por: "dia" } : undefined,
      momento: "todo", area: "", identidad: null, despuesDe: null, recordatorio: h.recordatorio, minima: null,
      nuncaDosVeces: false, variantes: [], pregunta: h.pregunta || null, notas: h.descripcion || null,
      orden: h.orden, archivado: h.archivado, creado: primero, loop: { posicion: h.clave, nombre: h.nombre },
    };
  });
  const copias = detectarCopias(habitos, hechos);
  const fuera = new Set(copias.map((c) => `loop-${c.clave}`));
  const quedan = habitos.filter((h) => !fuera.has(h.id));
  return {
    origen, habitos: quedan, registros: registros.filter((r) => !fuera.has(r.habito)), copias, desde, hasta,
    conRecordatorio: quedan.filter((h) => h.recordatorio && !h.archivado).length,
  };
}

/**
 * Una copia es un hábito con el mismo nombre que otro y cuyos días hechos están
 * todos en ese otro. Entre dos iguales se queda el activo; si ambos tienen el
 * mismo estado, el que va primero.
 */
export function detectarCopias(habitos: Habito[], hechos: Map<string, Set<Dia>>): Copia[] {
  const copias: Copia[] = [];
  const descartadas = new Set<string>();
  const nombre = (n: string) => n.trim().toLowerCase();
  for (const a of habitos) {
    const ca = a.loop!.posicion;
    const da = hechos.get(ca)!;
    if (!da.size) continue;
    for (const b of habitos) {
      const cb = b.loop!.posicion;
      if (ca === cb || descartadas.has(cb) || nombre(a.nombre) !== nombre(b.nombre)) continue;
      const db = hechos.get(cb)!;
      if (![...da].every((d) => db.has(d))) continue;
      const iguales = da.size === db.size;
      if (iguales && !(a.archivado && !b.archivado) && !(a.archivado === b.archivado && a.orden > b.orden)) continue;
      copias.push({ clave: ca, nombre: a.nombre, motivo: iguales ? "igual" : "contenida", de: cb, dias: da.size });
      descartadas.add(ca);
      break;
    }
  }
  return copias;
}
