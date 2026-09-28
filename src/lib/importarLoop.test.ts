import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { importarArchivoLoop, importarCopiaLoop, importarZipLoop, leerCsv } from "./importarLoop";

const iniciarSql = () => initSqlJs();

const CAB = "Position,Name,Type,Question,Description,FrequencyNumerator,FrequencyDenominator,Color,Unit,Target Type,Target Value,Archived?";

async function zipDePrueba() {
  const z = new JSZip();
  z.file("Habits.csv", [
    CAB,
    '001,Lectura 10 Min,YES_NO,,,1,1,#00897B,,,,true',
    '002,Lectura 10 Min,YES_NO,,,5,7,#00897B,,,,false',
    '003,"Algo de ingles",YES_NO,"Serie, podcast o tarea?",,5,7,#1976D2,,,,true',
  ].join("\n"));
  z.file("001 Lectura 10 Min/Checkmarks.csv", "Date,Value,Notes\n2020-01-01,YES_MANUAL,\n");
  z.file("002 Lectura 10 Min/Checkmarks.csv", "Date,Value,Notes\n2020-01-03,SKIP,\n2020-01-02,YES_MANUAL,\n2020-01-01,YES_MANUAL,\n2020-01-04,YES_AUTO,\n");
  z.file("003 Algo de ingles/Checkmarks.csv", "Date,Value,Notes\n2022-07-03,YES_MANUAL,\n2022-07-04,NO,\n");
  return z.generateAsync({ type: "uint8array" });
}

describe("leerCsv", () => {
  it("respeta comas dentro de comillas", () => {
    expect(leerCsv('a,"b, c",d\n1,2,3')).toEqual([["a", "b, c", "d"], ["1", "2", "3"]]);
  });
});

describe("importarZipLoop", () => {
  it("convierte hábitos y registros, y deja afuera las copias", async () => {
    const r = await importarZipLoop(await zipDePrueba(), "2026-09-27");
    expect(r.copias).toEqual([{ clave: "001", nombre: "Lectura 10 Min", motivo: "contenida", de: "002", dias: 1 }]);
    expect(r.habitos.map((h) => h.id)).toEqual(["loop-002", "loop-003"]);
    const lectura = r.habitos[0];
    expect(lectura.frecuencias[0].frecuencia).toEqual({ num: 5, den: 7 });
    expect(lectura.color).toBe("#80CBC4");
    expect(r.habitos[1].pregunta).toBe("Serie, podcast o tarea?");
    expect(r.habitos[1].archivado).toBe(true);
    // Solo marcas manuales y días libres; las automáticas y los "no" no se guardan.
    expect(r.registros.filter((x) => x.habito === "loop-002").map((x) => `${x.dia}:${x.valor}`).sort())
      .toEqual(["2020-01-01:hecho", "2020-01-02:hecho", "2020-01-03:libre"]);
    expect(r.desde).toBe("2020-01-01");
  });
});

describe("importarCopiaLoop", () => {
  it("lee la copia de seguridad: colores por índice, recordatorios y copias", async () => {
    const SQL = await initSqlJs();
    const b = new SQL.Database();
    b.run(`CREATE TABLE Habits ( id integer primary key autoincrement, archived integer, color integer, description text, freq_den integer, freq_num integer, highlight integer, name text, position integer, reminder_hour integer, reminder_min integer , reminder_days integer not null default 127, type integer not null default 0, target_type integer not null default 0, target_value real not null default 0, unit text not null default "", question text, uuid text);
      CREATE TABLE Repetitions ( id integer primary key autoincrement, habit integer not null, timestamp integer not null, value integer not null, notes text);
      INSERT INTO Habits (id,archived,color,freq_den,freq_num,name,position,reminder_hour,reminder_min,question,description) VALUES
        (6,1,7,7,6,'Ejercicios',5,20,30,NULL,''),(16,0,7,7,5,'Ejercicios',14,20,30,NULL,''),(27,0,7,1,1,'No alcohol',19,NULL,NULL,'No tome','Solo 1 cerveza permitida');`);
    const ts = (d: string) => Date.parse(d + "T00:00:00Z");
    for (const [h, d, v] of [[6, "2020-01-05", 2], [16, "2020-01-05", 2], [16, "2026-09-27", 2], [16, "2026-09-26", 3], [27, "2026-09-27", 0], [27, "2026-09-25", 2]] as const)
      b.run("INSERT INTO Repetitions (habit,timestamp,value) VALUES (?,?,?)", [h, ts(d), v]);
    const datos = b.export();
    b.close();
    const r = await importarCopiaLoop(datos, "2026-09-28", iniciarSql);
    expect(r.origen).toBe("copia");
    expect(r.copias.map((c) => c.clave)).toEqual(["6"]);
    const ej = r.habitos.find((h) => h.id === "loop-16")!;
    expect(ej.color).toBe("#69F0AE");
    expect(ej.recordatorio).toBe("20:30");
    expect(ej.frecuencias[0].frecuencia).toEqual({ num: 5, den: 7 });
    expect(r.registros.filter((x) => x.habito === "loop-16").map((x) => `${x.dia}:${x.valor}`).sort())
      .toEqual(["2020-01-05:hecho", "2026-09-26:libre", "2026-09-27:hecho"]);
    // Un "no" explícito de Loop no se guarda: un día sin registro ya es "no".
    expect(r.registros.filter((x) => x.habito === "loop-27").length).toBe(1);
    expect(r.habitos.find((h) => h.id === "loop-27")!.notas).toBe("Solo 1 cerveza permitida");
    expect(r.hasta).toBe("2026-09-27");
    expect(r.conRecordatorio).toBe(1);
    // La detección de formato elige el lector correcto.
    expect((await importarArchivoLoop(datos, "2026-09-28", iniciarSql)).origen).toBe("copia");
  });
});
