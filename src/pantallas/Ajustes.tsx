import { useEffect, useState } from "react";
import type { Datos } from "../datos";
import type { Preferencias } from "../db";
import { eliminar, guardarImportacion, guardarPreferencia, reactivar } from "../lib/acciones";
import { importarArchivoLoop, type ResultadoImportacion } from "../lib/importarLoop";
import { pausaActiva } from "../lib/calculos";
import { hayNotificaciones, pedirPermiso, permisoNotificaciones } from "../lib/notificaciones";
import { planificarAvisos } from "../lib/recordatorios";
import { exportarCopia, leerCopia, restaurarCopia, ultimaCopia, type Copia } from "../lib/copia";
import { iniciarSql } from "../lib/sql";
import { MESES_CORTOS, fechaCorta } from "../lib/fecha";
import type { Dia } from "../tipos";
import { Barra, Hoja, Icono, Interruptor } from "../ui/piezas";
import Identidades from "./Identidades";

export type SubAjustes = null | "importar" | "archivados" | "identidades" | "pausa" | "recordatorios" | "copias";
type Sub = SubAjustes;

export default function Ajustes({ datos, hoy, sub, setSub, avisar, abrirDetalle }: {
  datos: Datos; hoy: Dia; sub: Sub; setSub: (s: Sub) => void; avisar: (c: React.ReactNode) => void; abrirDetalle: (id: string) => void;
}) {
  if (sub === "importar") return <Importar hoy={hoy} volver={() => setSub(null)} avisar={avisar} />;
  if (sub === "recordatorios") return <Recordatorios datos={datos} hoy={hoy} volver={() => setSub(null)} />;
  if (sub === "copias") return <Copias hoy={hoy} volver={() => setSub(null)} avisar={avisar} />;
  if (sub === "pausa") return <ModoPausa datos={datos} hoy={hoy} volver={() => setSub(null)} avisar={avisar} />;
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
      <button className="item" onClick={() => setSub("pausa")}>
        <Icono n="pause_circle" estilo={{ color: "var(--mu)" }} />
        <div className="t"><div>Modo pausa</div><div className="chico">{(() => { const a = pausaActiva(p.pausas, hoy); return a ? `Activa hasta el ${fechaCorta(a.hasta)}` : "Vacaciones o enfermedad: nada cuenta como fallo"; })()}</div></div>
        <Icono n="chevron_right" estilo={{ color: "#555" }} />
      </button>
      <Opcion titulo="Días libres cuentan como cumplidos" detalle="En porcentajes y en el progreso de la semana." on={p.libresCumplen} alCambiar={() => cambiar("libresCumplen", !p.libresCumplen)} />
      <Opcion titulo="Patrones por día de la semana" detalle='La nota en Hoy ("los domingos 42% · el resto 73%").' on={p.patrones} alCambiar={() => cambiar("patrones", !p.patrones)} />
      <Opcion titulo="Invertir el orden de los días" detalle="En Semana, del más viejo al más nuevo. Por defecto hoy va primero." on={p.invertirSemana} alCambiar={() => cambiar("invertirSemana", !p.invertirSemana)} />
      <div className="seccion">Recordatorios</div>
      <button className="item" onClick={() => setSub("recordatorios")}>
        <Icono n="notifications" estilo={{ color: "var(--mu)" }} />
        <div className="t"><div>Recordatorios</div><div className="chico">{p.avisoNoSiHecho ? "No suenan si ya está hecho" : "Suenan siempre"} · {datos.habitos.filter((h) => h.recordatorio).length} hábitos con hora</div></div>
        <Icono n="chevron_right" estilo={{ color: "#555" }} />
      </button>
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
      <button className="item" onClick={() => setSub("copias")}>
        <Icono n="backup" estilo={{ color: "var(--mu)" }} />
        <div className="t"><div>Copia de seguridad</div><div className="chico">Automática cada semana · exportar o restaurar</div></div>
        <Icono n="chevron_right" estilo={{ color: "#555" }} />
      </button>
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

function ModoPausa({ datos, hoy, volver, avisar }: { datos: Datos; hoy: Dia; volver: () => void; avisar: (c: React.ReactNode) => void }) {
  const pausas = datos.prefs.pausas;
  const activa = pausaActiva(pausas, hoy);
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(() => { const d = new Date(hoy + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10); });
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const guardar = (lista: typeof pausas) => guardarPreferencia("pausas", [...lista].sort((a, b) => (a.desde < b.desde ? -1 : 1)));
  const fecha = (d: string) => `${fechaCorta(d)} ${d.slice(0, 4)}`;
  return (
    <>
      <Barra titulo="Modo pausa" izquierda={<button className="icono-btn" aria-label="Volver" onClick={volver}><Icono n="arrow_back" /></button>} />
      <p className="mu">Durante una pausa todos los hábitos quedan como día libre: no bajan la puntuación, no cortan rachas y no cuentan como fallo. Si marcás algo igual, se respeta.</p>
      {activa ? (
        <>
          <div className="aviso amarillo"><Icono n="pause_circle" /> Pausa activa del {fechaCorta(activa.desde)} al {fechaCorta(activa.hasta)}{activa.motivo ? ` · ${activa.motivo}` : ""}</div>
          <button className="boton2" onClick={async () => {
            // Terminar hoy: los días ya pasados siguen como pausa; desde mañana, no.
            const ayer = new Date(Date.parse(hoy + "T12:00:00Z") - 864e5).toISOString().slice(0, 10);
            const resto = pausas.filter((x) => x !== activa);
            await guardar(activa.desde <= ayer ? [...resto, { ...activa, hasta: ayer }] : resto);
            avisar("Pausa terminada");
          }}>Terminar la pausa hoy</button>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="campo" style={{ flex: 1 }}><label htmlFor="p-desde">Desde</label><input id="p-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
            <div className="campo" style={{ flex: 1 }}><label htmlFor="p-hasta">Hasta</label><input id="p-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
          </div>
          <div className="campo"><label htmlFor="p-motivo">Motivo · opcional</label><input id="p-motivo" value={motivo} placeholder="Vacaciones" onChange={(e) => setMotivo(e.target.value)} /></div>
          {error && <div className="chico" style={{ color: "var(--mal)", marginTop: 6 }}>{error}</div>}
          <button className="boton" onClick={async () => {
            if (!desde || !hasta || hasta < desde) return setError("Revisá las fechas: el final tiene que ser igual o posterior al inicio.");
            if (pausas.some((x) => x.desde <= hasta && desde <= x.hasta)) return setError("Se superpone con otra pausa.");
            await guardar([...pausas, { desde, hasta, motivo: motivo.trim() }]);
            avisar(`Pausa del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`);
          }}>Activar pausa</button>
        </>
      )}
      {pausas.filter((x) => x !== activa).length > 0 && (
        <>
          <div className="seccion">Pausas</div>
          {pausas.filter((x) => x !== activa).map((x) => (
            <div key={x.desde} className="item">
              <div className="t"><div style={{ fontSize: 13.5 }}>{fecha(x.desde)} – {fecha(x.hasta)}</div><div className="chico">{x.motivo || "Sin motivo"}{x.desde > hoy ? " · programada" : ""}</div></div>
              <button className="icono-btn" aria-label="Borrar pausa" onClick={async () => { await guardar(pausas.filter((y) => y !== x)); avisar("Pausa borrada: esos días vuelven a contar"); }}><Icono n="delete" /></button>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function Copias({ hoy, volver, avisar }: { hoy: Dia; volver: () => void; avisar: (c: React.ReactNode) => void }) {
  const [ultima, setUltima] = useState<string | undefined>();
  const [aRestaurar, setARestaurar] = useState<Copia | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { ultimaCopia().then(setUltima); }, []);
  return (
    <>
      <Barra titulo="Copia de seguridad" izquierda={<button className="icono-btn" aria-label="Volver" onClick={volver}><Icono n="arrow_back" /></button>} />
      <div className="item">
        <Icono n="event_repeat" estilo={{ color: "var(--mu)" }} />
        <div className="t"><div>Copia automática semanal</div><div className="chico">En Android se guarda en Documentos/Habitos (las últimas 5). Última: {ultima ? `${fechaCorta(ultima)} ${ultima.slice(0, 4)}` : "todavía ninguna"}.</div></div>
      </div>
      <button className="boton2" onClick={async () => { await exportarCopia(hoy); setUltima(hoy); avisar("Copia exportada"); }}>
        <Icono n="ios_share" estilo={{ fontSize: 17 }} /> Exportar copia ahora
      </button>
      <p className="chico">Para no perder nada si cambiás de teléfono, guardala en Drive o mandátela por mail.</p>
      <div className="seccion">Restaurar</div>
      <label className="boton2" style={{ cursor: "pointer" }}>
        <Icono n="settings_backup_restore" estilo={{ fontSize: 17 }} /> Elegir una copia (.json)
        <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setError(null);
          try { setARestaurar(leerCopia(await f.text())); } catch (err) { setError(err instanceof Error ? err.message : "No se pudo leer la copia."); }
        }} />
      </label>
      {error && <div className="aviso" style={{ color: "var(--mal)" }}>{error}</div>}
      {aRestaurar && (
        <Hoja cerrar={() => setARestaurar(null)}>
          <div style={{ fontSize: 16 }}>¿Restaurar esta copia?</div>
          <div className="chico" style={{ margin: "6px 0" }}>
            Del {new Date(aRestaurar.fecha).toLocaleDateString("es-AR")}: {aRestaurar.habitos.length} hábitos y {aRestaurar.registros.length.toLocaleString("es-AR")} registros.
            Reemplaza todo lo que hay ahora en la app. No se puede deshacer; si querés, exportá una copia antes.
          </div>
          <button className="boton" onClick={async () => { await restaurarCopia(aRestaurar); setARestaurar(null); avisar("Copia restaurada"); }}>Restaurar</button>
          <button className="boton2" onClick={() => setARestaurar(null)}>Cancelar</button>
        </Hoja>
      )}
    </>
  );
}

function Recordatorios({ datos, hoy, volver }: { datos: Datos; hoy: Dia; volver: () => void }) {
  const p = datos.prefs;
  const [permiso, setPermiso] = useState<string>("…");
  useEffect(() => { permisoNotificaciones().then(setPermiso); }, []);
  const avisos = planificarAvisos(datos.habitos, datos.historiales, p.pausas, new Date(), hoy, { libresCumplen: p.libresCumplen },
    { noSiHecho: p.avisoNoSiHecho, cierreSemana: p.avisoCierreSemana, cierreMes: p.avisoCierreMes, dias: 3 });
  const hora = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const cuando = (d: Date) => {
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return `${dia === hoy ? "Hoy" : fechaCorta(dia)} ${hora(d)}`;
  };
  return (
    <>
      <Barra titulo="Recordatorios" izquierda={<button className="icono-btn" aria-label="Volver" onClick={volver}><Icono n="arrow_back" /></button>} />
      {!hayNotificaciones() && <div className="aviso">En el navegador no se envían avisos. Se activan en la app de Android; acá ves cuáles saldrían.</div>}
      {hayNotificaciones() && permiso !== "concedido" && (
        <div className="aviso amarillo" style={{ flexWrap: "wrap" }}>
          Para avisarte, la app necesita permiso de notificaciones.
          <button className="chip activo" onClick={async () => { await pedirPermiso(); setPermiso(await permisoNotificaciones()); }}>Dar permiso</button>
        </div>
      )}
      <Opcion titulo="No avisar si ya está hecho" detalle="Si marcaste el hábito antes de la hora, el aviso de hoy no suena." on={p.avisoNoSiHecho} alCambiar={() => guardarPreferencia("avisoNoSiHecho", !p.avisoNoSiHecho)} />
      <Opcion titulo="Aviso de cierre de semana" detalle="Domingo a las 20:00: abre el resumen de la semana." on={p.avisoCierreSemana} alCambiar={() => guardarPreferencia("avisoCierreSemana", !p.avisoCierreSemana)} />
      <Opcion titulo="Aviso de cierre de mes" detalle="El último día del mes a las 20:00." on={p.avisoCierreMes} alCambiar={() => guardarPreferencia("avisoCierreMes", !p.avisoCierreMes)} />
      <p className="chico" style={{ marginTop: 10 }}>La hora de cada hábito se cambia en Editar. La notificación trae los botones "Hecho" (lo marca sin abrir la app) y "En 1 hora".</p>
      <div className="seccion">Próximos avisos</div>
      {avisos.length ? avisos.slice(0, 12).map((a) => (
        <div key={a.id} className="item" style={{ padding: "8px 0" }}>
          <Icono n={a.tipo === "habito" ? "notifications" : "summarize"} estilo={{ color: "var(--mu)" }} />
          <div className="t"><div style={{ fontSize: 13.5 }}>{a.titulo}</div>{a.cuerpo && <div className="chico">{a.cuerpo}</div>}</div>
          <span className="chico">{cuando(a.cuando)}</span>
        </div>
      )) : <p className="chico">No hay avisos en los próximos 3 días.</p>}
    </>
  );
}
