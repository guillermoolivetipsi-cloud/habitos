import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { db } from "../db";
import type { Dia } from "../tipos";

const VERSION = 1;
const CARPETA = "Habitos";
const GUARDAR = 5; // copias automáticas que se conservan

export interface Copia {
  app: "habitos";
  version: number;
  fecha: string; // ISO
  habitos: unknown[];
  registros: unknown[];
  identidades: unknown[];
  objetivos: unknown[];
  ajustes: unknown[];
  notas: unknown[];
  decisiones: unknown[];
}

/** Toda la base en un objeto. */
export async function armarCopia(ahora = new Date()): Promise<Copia> {
  const [habitos, registros, identidades, objetivos, ajustes, notas, decisiones] = await Promise.all([
    db.habitos.toArray(), db.registros.toArray(), db.identidades.toArray(), db.objetivos.toArray(),
    db.ajustes.toArray(), db.notas.toArray(), db.decisiones.toArray(),
  ]);
  return { app: "habitos", version: VERSION, fecha: ahora.toISOString(), habitos, registros, identidades, objetivos, ajustes, notas, decisiones };
}

/** Lee un archivo de copia y avisa si no es válido. */
export function leerCopia(texto: string): Copia {
  let c: Partial<Copia>;
  try { c = JSON.parse(texto); } catch { throw new Error("El archivo no es una copia de seguridad de Hábitos."); }
  if (c.app !== "habitos" || !Array.isArray(c.habitos) || !Array.isArray(c.registros)) throw new Error("El archivo no es una copia de seguridad de Hábitos.");
  if ((c.version ?? 0) > VERSION) throw new Error("La copia es de una versión más nueva de la app. Actualizá la app antes de restaurarla.");
  return c as Copia;
}

/** Reemplaza todo lo que hay por el contenido de la copia. */
export async function restaurarCopia(c: Copia) {
  await db.transaction("rw", [db.habitos, db.registros, db.identidades, db.objetivos, db.ajustes, db.notas, db.decisiones], async () => {
    await Promise.all([db.habitos.clear(), db.registros.clear(), db.identidades.clear(), db.objetivos.clear(), db.ajustes.clear(), db.notas.clear(), db.decisiones.clear()]);
    await db.habitos.bulkPut(c.habitos as never[]);
    await db.registros.bulkPut(c.registros as never[]);
    await db.identidades.bulkPut((c.identidades ?? []) as never[]);
    await db.objetivos.bulkPut((c.objetivos ?? []) as never[]);
    await db.ajustes.bulkPut((c.ajustes ?? []).filter((a) => (a as { clave: string }).clave !== "ultimaCopia") as never[]);
    await db.notas.bulkPut((c.notas ?? []) as never[]);
    await db.decisiones.bulkPut((c.decisiones ?? []) as never[]);
  });
}

const nombreArchivo = (dia: Dia) => `habitos-copia-${dia}.json`;

/**
 * Copia automática semanal: si pasaron 7 días o más desde la última, guarda una en
 * Documentos/Habitos (en Android) y conserva las últimas 5. En el navegador queda
 * guardada dentro del navegador.
 */
export async function copiaAutomatica(hoy: Dia): Promise<"hecha" | "no-hacia-falta" | "error"> {
  try {
    const ultima = (await db.ajustes.get("ultimaCopia"))?.valor as Dia | undefined;
    if (ultima && (Date.parse(hoy) - Date.parse(ultima)) / 864e5 < 7) return "no-hacia-falta";
    if (!(await db.habitos.count())) return "no-hacia-falta";
    const texto = JSON.stringify(await armarCopia());
    await Filesystem.writeFile({ path: `${CARPETA}/${nombreArchivo(hoy)}`, data: texto, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
    const lista = await Filesystem.readdir({ path: CARPETA, directory: Directory.Documents });
    const viejas = lista.files.map((f) => f.name).filter((n) => n.startsWith("habitos-copia-")).sort().slice(0, -GUARDAR);
    for (const n of viejas) await Filesystem.deleteFile({ path: `${CARPETA}/${n}`, directory: Directory.Documents });
    await db.ajustes.put({ clave: "ultimaCopia", valor: hoy });
    return "hecha";
  } catch {
    return "error";
  }
}

export const ultimaCopia = async () => (await db.ajustes.get("ultimaCopia"))?.valor as Dia | undefined;

/** Exportar a mano: en Android abre "Compartir" (Drive, mail, WhatsApp); en el navegador descarga el archivo. */
export async function exportarCopia(hoy: Dia) {
  const texto = JSON.stringify(await armarCopia());
  const nombre = nombreArchivo(hoy);
  if (Capacitor.isNativePlatform()) {
    const r = await Filesystem.writeFile({ path: nombre, data: texto, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: "Copia de seguridad de Hábitos", files: [r.uri] });
  } else {
    const url = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  await db.ajustes.put({ clave: "ultimaCopia", valor: hoy });
}
