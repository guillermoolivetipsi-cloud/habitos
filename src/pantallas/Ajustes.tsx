import { useState } from "react";
import type { Datos } from "../datos";
import type { Preferencias } from "../db";
import { eliminar, guardarImportacion, guardarPreferencia, reactivar } from "../lib/acciones";
import { importarArchivoLoop, type ResultadoImportacion } from "../lib/importarLoop";
import { iniciarSql } from "../lib/sql";
import { MESES_CORTOS, fechaCorta } from "../lib/fecha";
import type { Dia } from "../tipos";
import { Barra, Hoja, Icono, Interruptor } from "../ui/piezas";
import Identidades from "./Identidades";

type Sub = null | "importar" | "archivados" | "identidades";

export default function Ajustes({ datos, hoy, sub, setSub, avisar, abrirDetalle }: {
  datos: Datos; hoy: Dia; sub: Sub; setSub: (s: Sub) => void; avisar: (c: React.ReactNode) => void; abrirDetalle: (id: string) => void;
}) {
  if (sub === "importar") return <Importar hoy={hoy} volver={() => setSub(null)} avisar={avisar} />;
  if (sub === "identidades") return <Identidades datos={datos} volver={() => setSub(null)} avisar={avisar} />;
  if (sub === "archivados") return <Archivados datos={datos} volver={() => setSub(null)} avisar={avisar} abrirDetalle={abrirDetalle} />;
  const p = datos.prefs;
  const cambiar = <K extends keyof Preferencias>(k: K, v: Preferencias[K]) => guardarPreferencia(k, v);
  return (
    <>
      <Barra titulo="Ajustes" />
      <div className="seccion">Tus hábitos</div>
      <div className="item">
        <Icono n="view_agenda" estilo={{ color: "var(--mu)" }} />
        <div className="t"><div>Agrupar en Hoy por</div></div>
        <div className="chips">
          <button className={`chip${p.agrupar === "momento" ? " activo" : ""}`} onClick={() => cambiar("agrupar", "momento")}>Momento</button>
          <button className={`chip${p.agrupar === "area" ? " activo" : ""}`} onClick={() => cambiar("agrupar", "area")}>Área</button>
        </div>
      </div>
      <button className="item" onClick={() => setSub("identidades")}>
        <Icono n="person" estilo={{ color: "var(--mu)" }} />
        <div className="t"><div>Identidades</div><div className="chico">{datos.identidades.length ? `${datos.identidades.length} identidades` : "Quién querés ser"}</div></div>
        <Icono n="chevron_right" estilo={{ color: "#555" }} />
      </button>
      <button className="item" onClick={() => setSub("archivados")}>
        <Icono n="archive" estilo={{ color: "var(--mu)" }} />
        <div className="t"><div>Archivados</div><div className="chico">{datos.archivados.length} hábitos</div></div>
        <Icono n="chevron_right" estilo={{ color: "#555" }} />
      </button>
      <div className="seccion">Días</div>
      <Opcion titulo="Días libres cuentan como cumplidos" detalle="En porcentajes y en el progreso de la semana." on={p.libresCumplen} alCambiar={() => cambiar("libresCumplen", !p.libresCumplen)} />
      <Opcion titulo="Patrones por día de la semana" detalle='La nota en Hoy ("los domingos 42% · el resto 73%").' on={p.patrones} alCambiar={() => cambiar("patrones", !p.patrones)} />
      <Opcion titulo="Invertir el orden de los días" detalle="En Semana, del más viejo al más nuevo. Por defecto hoy va primero." on={p.invertirSemana} alCambiar={() => cambiar("invertirSemana", !p.invertirSemana)} />
      <div className="seccion">Revisión</div>
      <Opcion titulo="Proponer ajustes" detalle="Bajar frecuencia, archivar o pasar a lunes a viernes, con botones de un toque." on={p.sugerencias} alCambiar={() => cambiar("sugerencias", !p.sugerencias)} />
      <div className="item">
        <div className="t"><div>Máximo de sugerencias por semana</div></div>
        <div className="chips">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={`chip${p.maximoSugerencias === n ? " activo" : ""}`} onClick={() => cambiar("maximoSugerencias", n)}>{n}</button>)}</div>
      </div>
      <div className="item">
        <div className="t"><div>Sugerir cuando un hábito está por debajo de</div><div className="chico">del objetivo en los últimos 90 días</div></div>
        <div className="chips">{[20, 30, 40, 50].map((n) => <button key={n} className={`chip${p.umbralSugerencias === n ? " activo" : ""}`} onClick={() => cambiar("umbralSugerencias", n)}>{n}%</button>)}</div>
      </div>
      <div className="seccion">Tus datos</div>
      <button className="item" onClick={() => setSub("importar")}>
        <Icono n="download" estilo={{ color: "var(--mu)" }} />
        <div className="t"><div>Importar desde Loop</div><div className="chico">Copia de seguridad (.db) o exportación CSV (.zip)</div></div>
        <Icono n="chevron_right" estilo={{ color: "#555" }} />
      </button>
    </>
  );
}

const Opcion = ({ titulo, detalle, on, alCambiar }: { titulo: string; detalle: string; on: boolean; alCambiar: () => void }) => (
  <div className="item"><div className="t"><div>{titulo}</div><div className="chico">{detalle}</div></div><Interruptor on={on} etiqueta={titulo} alCambiar={alCambiar} /></div>
);

function Importar({ hoy, volver, avisar }: { hoy: Dia; volver: () => void; avisar: (c: React.ReactNode) => void }) {
  const [res, setRes] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const leer = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try { setRes(await importarArchivoLoop(new Uint8Array(await f.arrayBuffer()), hoy, iniciarSql)); }
    catch (e) { setRes(null); setError(e instanceof Error ? e.message : "No se pudo leer el archivo."); }
  };
  const activos = res?.habitos.filter((h) => !h.archivado) ?? [];
  return (
    <>
      <Barra titulo="Importar desde Loop" izquierda={<button className="icono-btn" aria-label="Volver" onClick={volver}><Icono n="arrow_back" /></button>} />
      <p className="mu">En Loop: Configuración → <b style={{ fontWeight: 500, color: "var(--tx2)" }}>Exportar copia de seguridad</b>. Elegí acá el archivo .db que genera.</p>
      <p className="chico">También sirve "Exportar datos (CSV)", pero no trae los horarios de los recordatorios.</p>
      <label className="boton2" style={{ cursor: "pointer" }}>
        <Icono n="folder_open" /> Elegir archivo
        <input type="file" accept=".db,.zip,application/zip,application/octet-stream,application/x-sqlite3" style={{ display: "none" }} onChange={(e) => leer(e.target.files?.[0])} />
      </label>
      {error && <div className="aviso" style={{ color: "var(--mal)" }}>{error}</div>}
      {res && (
        <>
          <div className="seccion">Qué se va a importar</div>
          <div className="tarjeta">
            <div>{activos.length} hábitos activos y {res.habitos.length - activos.length} archivados</div>
            <div className="chico">{res.registros.length.toLocaleString("es-AR")} registros{res.desde ? ` del ${fechaCorta(res.desde)} ${res.desde.slice(0, 4)}` : ""}{res.hasta ? ` al ${fechaCorta(res.hasta)} ${res.hasta.slice(0, 4)}` : ""}</div>
            <div className="chico">{res.origen === "copia" ? `${res.conRecordatorio} hábitos activos con recordatorio` : "Sin recordatorios: el CSV no los trae"}</div>
            <div className="chico" style={{ marginTop: 6 }}>{activos.map((h) => h.nombre).join(" · ")}</div>
          </div>
          {res.copias.length > 0 && (
            <div className="tarjeta">
              <div>{res.copias.length} copias que no se importan</div>
              <div className="chico">Sus días ya están en otro hábito con el mismo nombre, así que no se pierde nada.</div>
              {res.copias.map((c) => <div key={c.clave} className="chico" style={{ marginTop: 4 }}>{c.nombre} · {c.dias} días · {c.motivo === "igual" ? "idéntica a otra" : "contenida en otra"}</div>)}
            </div>
          )}
          <p className="chico">Si ya habías importado antes, se reemplaza lo importado. Los hábitos creados en esta app no se tocan. Momento del día, área e identidad se completan después, editando cada hábito.</p>
          <button className="boton" disabled={guardando} onClick={async () => {
            setGuardando(true);
            await guardarImportacion(res);
            avisar(`Importados ${res.habitos.length} hábitos`);
            volver();
          }}>{guardando ? "Importando…" : "Importar"}</button>
        </>
      )}
    </>
  );
}

function Archivados({ datos, volver, avisar, abrirDetalle }: { datos: Datos; volver: () => void; avisar: (c: React.ReactNode) => void; abrirDetalle: (id: string) => void }) {
  const [elegido, setElegido] = useState<string | null>(null);
  const h = datos.archivados.find((x) => x.id === elegido);
  const lista = datos.archivados.map((x) => {
    const regs = datos.historiales.get(x.id);
    const dias = regs ? [...regs.values()].filter((r) => r.valor !== "libre").map((r) => r.dia).sort() : [];
    return { h: x, n: dias.length, desde: dias[0], hasta: dias[dias.length - 1] };
  }).sort((a, b) => b.n - a.n);
  const anio = (d?: string) => (d ? `${MESES_CORTOS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : "");
  return (
    <>
      <Barra titulo="Archivados" izquierda={<button className="icono-btn" aria-label="Volver" onClick={volver}><Icono n="arrow_back" /></button>} />
      {!lista.length && <p className="mu">No hay hábitos archivados.</p>}
      {lista.map(({ h: x, n, desde, hasta }) => (
        <button key={x.id} className="item" onClick={() => setElegido(x.id)}>
          <span className="punto" style={{ background: x.color }} />
          <div className="t"><div>{x.nombre}</div><div className="chico">{n.toLocaleString("es-AR")} {n === 1 ? "vez" : "veces"}{desde ? ` · ${anio(desde)} – ${anio(hasta)}` : ""}</div></div>
        </button>
      ))}
      {h && (
        <Hoja cerrar={() => setElegido(null)}>
          <div style={{ fontSize: 16, marginBottom: 4 }}>{h.nombre}</div>
          <button className="item" onClick={async () => { await reactivar(h.id); avisar(`${h.nombre} vuelve a Hoy con su historial`); setElegido(null); }}>
            <Icono n="unarchive" /><div className="t"><div>Reactivar</div><div className="chico">Vuelve a Hoy con todo su historial</div></div>
          </button>
          <button className="item" onClick={() => { setElegido(null); abrirDetalle(h.id); }}><Icono n="bar_chart" /><div className="t"><div>Ver detalle</div></div></button>
          <button className="item" style={{ color: "var(--mal)", border: 0 }} onClick={async () => { await eliminar(h.id); avisar(`${h.nombre} eliminado`); setElegido(null); }}>
            <Icono n="delete" /><div className="t"><div>Eliminar</div><div className="chico">Borra el hábito y su historial. No se puede deshacer.</div></div>
          </button>
        </Hoja>
      )}
    </>
  );
}
