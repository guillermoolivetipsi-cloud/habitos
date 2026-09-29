import { useState } from "react";
import type { Datos } from "../datos";
import { dejarPendientes, guardarNota, pasarPendientes } from "../lib/acciones";
import { conPendientes } from "../lib/tareas";
import type { Opciones } from "../lib/calculos";
import { INICIALES, MESES_CORTOS, fechaCorta, lunes, mesDe, nombreMes, sumarDias, sumarMeses } from "../lib/fecha";
import { cambios, cumplimiento, hechosPorDia, porHabito, rangoMes, votos } from "../lib/revision";
import { Barras, Lineas, redondeo } from "../ui/Graficos";
import { Barra, Icono } from "../ui/piezas";
import { TarjetaObjetivo, type NuevoObjetivo } from "./Objetivos";
import { celda, mismaAltura, rangoSemanal, type Cierre as TipoCierre } from "./Revision";

const mayus = (t: string) => t[0].toUpperCase() + t.slice(1);
/** Cierra la frase con punto, salvo que ya termine en signo ("Ducha fría?"). */
const conPunto = (t: string) => (/[.?!]$/.test(t) ? t : `${t}.`);

/** Resumen de cierre de una semana, un mes o un año. El domingo (o el último día) es un día más: se actualiza solo. */
export default function Cierre({ datos, hoy, cierre, volver, irARevision, abrirObjetivo, nuevoObjetivo }: {
  datos: Datos; hoy: string; cierre: TipoCierre; volver: () => void; irARevision: () => void;
  abrirObjetivo: (id: string) => void; nuevoObjetivo: (n: NuevoObjetivo) => void;
}) {
  const op: Opciones = { libresCumplen: datos.prefs.libresCumplen };
  const { habitos, historiales: hs } = datos;
  const { periodo, inicio } = cierre;
  let fin: string, titulo: string, claveNota: string, antA: string, antB: string, nombreAnterior: string;
  if (periodo === "semana") { fin = sumarDias(inicio, 6); titulo = `Semana ${rangoSemanal(inicio)}`; claveNota = `semana:${inicio}`; antA = sumarDias(inicio, -7); antB = sumarDias(inicio, -1); nombreAnterior = "Semana anterior"; }
  else if (periodo === "mes") { const m = mesDe(inicio); [, fin] = rangoMes(m); titulo = `${mayus(nombreMes(m))} ${m.slice(0, 4)}`; claveNota = `mes:${m}`; [antA, antB] = rangoMes(sumarMeses(m, -1)); nombreAnterior = mayus(nombreMes(sumarMeses(m, -1))); }
  else { const y = inicio.slice(0, 4); fin = `${y}-12-31`; titulo = y; claveNota = `anio:${y}`; antA = `${+y - 1}-01-01`; antB = `${+y - 1}-12-31`; nombreAnterior = String(+y - 1); }

  const actual = cumplimiento(habitos, hs, inicio, fin, hoy, op);
  const enCurso = inicio <= hoy && hoy < fin;
  const anterior = cumplimiento(habitos, hs, antA, enCurso ? mismaAltura(inicio, hoy, antA, antB) : antB, hoy, op);
  const dif = actual.porcentaje - anterior.porcentaje;
  const filas = porHabito(habitos, hs, inicio, fin, hoy, op);
  const parcial = fin > hoy;

  return (
    <>
      <Barra titulo={<span className="mu" style={{ fontSize: 15 }}>Resumen {periodo === "semana" ? "de la semana" : periodo === "mes" ? "del mes" : "del año"}</span>}
        izquierda={<button className="icono-btn" aria-label="Cerrar" onClick={volver}><Icono n="close" /></button>} />
      <div style={{ fontSize: 19, margin: "6px 0 10px" }}>{titulo}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span className="grande">{actual.porcentaje}%</span>
        <span className="chico">{Math.round(actual.hechas)} de {Math.round(actual.esperadas)}{parcial ? ` · al ${fechaCorta(hoy)}` : ""}</span>
      </div>
      <div className="chico">
        {nombreAnterior}{enCurso ? " a esta altura" : ""} {anterior.porcentaje}% · <span style={{ color: dif >= 0 ? "var(--acento)" : "var(--mal)" }}>{dif >= 0 ? "+" : ""}{dif}</span>
        {periodo === "mes" && (() => {
          const m = sumarMeses(mesDe(inicio), -12);
          const p = cumplimiento(habitos, hs, ...rangoMes(m), hoy, op).porcentaje;
          return <> · {nombreMes(m)} {m.slice(0, 4)} {p}% · <span style={{ color: actual.porcentaje - p >= 0 ? "var(--acento)" : "var(--mal)" }}>{actual.porcentaje - p >= 0 ? "+" : ""}{actual.porcentaje - p}</span></>;
        })()}
      </div>

      {periodo === "semana" && <Semana {...{ datos, inicio, fin, hoy, op, filas }} />}
      {periodo === "mes" && <Mes {...{ datos, inicio, fin, hoy, op, filas, antA, antB }} />}
      {periodo === "anio" && <Anio {...{ datos, anio: +inicio.slice(0, 4), hoy, op, filas }} />}

      <Votos datos={datos} a={inicio} b={fin > hoy ? hoy : fin} />
      {periodo === "mes" && <ObjetivosDelMes datos={datos} hoy={hoy} mes={mesDe(inicio)} abrir={abrirObjetivo} nuevo={nuevoObjetivo} />}

      <h3 className="titulo-g">¿Cómo fue {periodo === "semana" ? "tu semana" : periodo === "mes" ? "tu mes" : "tu año"}? <span className="chico">opcional</span></h3>
      <NotaCierre clave={claveNota} inicial={datos.notas.get(claveNota) ?? ""} />

      {periodo === "semana" && <button className="boton2" onClick={irARevision}>Ver qué hay para decidir</button>}
      <button className="boton" onClick={volver}>Listo</button>
    </>
  );
}

function NotaCierre({ clave, inicial }: { clave: string; inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  return (
    <div className="campo" style={{ marginTop: 6 }}>
      <label htmlFor="nota-cierre">Nota</label>
      <textarea id="nota-cierre" rows={2} value={texto} placeholder="Una línea para acordarte después"
        onChange={(e) => setTexto(e.target.value)} onBlur={() => guardarNota(clave, texto)} />
    </div>
  );
}

type Filas = ReturnType<typeof porHabito>;

function Semana({ datos, inicio, fin, hoy, filas }: { datos: Datos; inicio: string; fin: string; hoy: string; op: Opciones; filas: Filas }) {
  const porDia = hechosPorDia(datos.habitos, datos.historiales, inicio, fin, hoy);
  const bien = filas.filter((f) => f.hechas / (f.meta || 1) >= 0.7);
  const cero = filas.filter((f) => f.hechas === 0);
  return (
    <>
      <div style={{ marginTop: 12 }}><Barras valores={porDia} etiquetas={INICIALES} color="#69F0AE" alto={110} destacada={() => true} /></div>
      {fin >= hoy && <p className="chico">El último día cuenta como cualquier otro: lo que marques hasta medianoche se suma solo.</p>}
      <h3 className="titulo-g">Lo que sostuviste</h3>
      {bien.length ? bien.map((f) => (
        <div key={f.h.id} className="item" style={{ padding: "7px 0" }}>
          <div className="t"><div style={{ fontSize: 13.5 }}>{f.h.nombre}</div></div>
          <span style={{ color: f.hechas >= f.meta ? f.h.color : "var(--tx2)" }}>{f.h.tipo === "evitar" ? `${redondeo(f.hechas)} días sin` : `${redondeo(f.hechas)}/${f.meta}`}</span>
        </div>
      )) : <p className="chico">Esta semana ninguno llegó al 70%.</p>}
      {cero.length > 0 && (
        <>
          <h3 className="titulo-g">Lo que costó</h3>
          <p style={{ fontSize: 13, color: "var(--tx2)", margin: "4px 0" }}>En 0: {conPunto(cero.map((f) => f.h.nombre).join(", "))}</p>
        </>
      )}
    </>
  );
}

function Mes({ datos, inicio, fin, hoy, op, filas, antA, antB }: { datos: Datos; inicio: string; fin: string; hoy: string; op: Opciones; filas: Filas; antA: string; antB: string }) {
  const semanas: string[] = [];
  // Solo semanas con al menos un día terminado (hoy todavía está en curso).
  for (let l = lunes(inicio); l <= (fin >= hoy ? sumarDias(hoy, -1) : fin); l = sumarDias(l, 7)) semanas.push(l);
  const pcts = semanas.map((l) => cumplimiento(datos.habitos, datos.historiales, l, sumarDias(l, 6), hoy, op).porcentaje);
  const anio = inicio.slice(0, 4);
  const meses = Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`).filter((m) => m <= mesDe(hoy));
  const cb = cambios(datos.habitos, datos.historiales, [inicio, fin], [antA, antB], hoy, op);
  return (
    <>
      <h3 className="titulo-g">Semana a semana</h3>
      <Barras valores={pcts} etiquetas={semanas.map(fechaCorta)} color="#69F0AE" formato={(v) => `${v}%`} destacada={(i) => pcts[i] >= 55} alto={120} />
      <h3 className="titulo-g">Meses de {anio}</h3>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${meses.length}, 1fr)`, gap: 3 }}>
        {meses.map((m) => <span key={m} className="chico" style={{ textAlign: "center" }}>{MESES_CORTOS[+m.slice(5) - 1][0]}</span>)}
        {meses.map((m) => {
          const p = cumplimiento(datos.habitos, datos.historiales, ...rangoMes(m), hoy, op).porcentaje;
          return <span key={m} style={{ ...celda(p), outline: m === mesDe(inicio) ? "1.5px solid #e8e8e8" : undefined }}>{p}</span>;
        })}
      </div>
      <h3 className="titulo-g">Lo que más cambió vs {nombreMes(mesDe(antA))}</h3>
      {cb.map((c) => (
        <div key={c.h.id} className="item" style={{ padding: "8px 0" }}>
          <div className="t"><div style={{ fontSize: 13.5 }}>{c.h.nombre}</div></div>
          <span className="chico">{c.antes}% →</span><span style={{ color: c.ahora >= c.antes ? "var(--acento)" : "var(--mal)" }}>{c.ahora}%</span>
        </div>
      ))}
      <h3 className="titulo-g">Todos los hábitos</h3>
      {filas.map((f) => (
        <div key={f.h.id} className="hb"><span style={{ color: f.h.color }}>{f.h.nombre}</span><b style={{ width: `${Math.min(100, f.porcentaje) * 0.45}%`, background: f.h.color }} /><em>{f.porcentaje}%</em></div>
      ))}
      <NotasDe datos={datos} claves={semanas.map((l) => `semana:${l}`)} titulo="Tus notas de las semanas" />
    </>
  );
}

function Anio({ datos, anio, hoy, op, filas }: { datos: Datos; anio: number; hoy: string; op: Opciones; filas: Filas }) {
  const serie = (y: number) => MESES_CORTOS.map((_, i) => {
    const m = `${y}-${String(i + 1).padStart(2, "0")}`;
    return m > mesDe(hoy) ? null : cumplimiento(datos.habitos, datos.historiales, ...rangoMes(m), hoy, op).porcentaje;
  });
  return (
    <>
      <h3 className="titulo-g">Mes a mes</h3>
      <Lineas series={[{ valores: serie(anio - 1), color: "#555", etiqueta: String(anio - 1) }, { valores: serie(anio), color: "#69F0AE", puntos: true, etiqueta: String(anio) }]}
        etiquetas={MESES_CORTOS.map((m) => m[0])} min={0} max={100} margenDerecho={34} />
      <h3 className="titulo-g">Todos los hábitos</h3>
      {filas.map((f) => (
        <div key={f.h.id} className="hb"><span style={{ color: f.h.color }}>{f.h.nombre}</span><b style={{ width: `${Math.min(100, f.porcentaje) * 0.45}%`, background: f.h.color }} /><em>{f.porcentaje}%</em></div>
      ))}
      <NotasDe datos={datos} claves={MESES_CORTOS.map((_, i) => `mes:${anio}-${String(i + 1).padStart(2, "0")}`)} titulo="Tus notas de los meses" />
    </>
  );
}

function NotasDe({ datos, claves, titulo }: { datos: Datos; claves: string[]; titulo?: string }) {
  const hay = claves.map((k) => [k, datos.notas.get(k)] as const).filter(([, t]) => t);
  if (!hay.length) return null;
  return (
    <>
      <h3 className="titulo-g">{titulo}</h3>
      {hay.map(([k, t]) => {
        const [tipo, fecha] = k.split(":");
        return <div key={k} className="chico" style={{ margin: "6px 0" }}><span style={{ color: "var(--tx2)" }}>{tipo === "semana" ? rangoSemanal(fecha) : nombreMes(fecha)}:</span> {t}</div>;
      })}
    </>
  );
}

function Votos({ datos, a, b }: { datos: Datos; a: string; b: string }) {
  if (!datos.identidades.length) return null;
  const v = votos(datos.identidades, datos.habitos, datos.historiales, a, b);
  const total = v.reduce((s, x) => s + x.votos, 0);
  return (
    <>
      <h3 className="titulo-g">Votaste {redondeo(total)} veces por quien querés ser</h3>
      {v.map((x) => (
        <div key={x.identidad.id} style={{ borderLeft: `2px solid ${x.identidad.color}`, padding: "3px 10px", margin: "8px 0" }}>
          <div style={{ fontSize: 13 }}>{x.identidad.frase}</div>
          <div className="chico">{redondeo(x.votos)} votos{x.detalle.length ? ` · ${x.detalle.map((d) => `${d.h.nombre} ${redondeo(d.votos)}`).join(", ")}` : ""}</div>
        </div>
      ))}
    </>
  );
}

/** Cierre de mes: los objetivos del mes y del año, y (opcional) agregar para el mes siguiente. */
function ObjetivosDelMes({ datos, hoy, mes, abrir, nuevo }: { datos: Datos; hoy: string; mes: string; abrir: (id: string) => void; nuevo: (n: NuevoObjetivo) => void }) {
  const lista = datos.objetivos.filter((o) => (o.periodo === "mes" && mesDe(o.desde) === mes) || (o.periodo === "anio" && o.desde.slice(0, 4) === mes.slice(0, 4)) || (o.periodo === "periodo" && o.desde <= `${mes}-31` && o.hasta >= `${mes}-01`));
  const siguiente = sumarMeses(mes, 1);
  const pendientes = conPendientes(datos.objetivos, mes);
  return (
    <>
      <h3 className="titulo-g">Tus objetivos</h3>
      {lista.length ? lista.map((o) => <TarjetaObjetivo key={o.id} o={o} datos={datos} hoy={hoy} abrir={() => abrir(o.id)} />) : <p className="chico">No tenías objetivos para este mes.</p>}
      {pendientes.map((o) => {
        const sin = (o.tareas ?? []).filter((t) => !t.hecha);
        return (
          <div key={o.id} className="tarjeta">
            <div>{o.nombre}: {sin.length === 1 ? "quedó 1 tarea sin hacer" : `quedaron ${sin.length} tareas sin hacer`}</div>
            <ul className="chico" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{sin.map((t) => <li key={t.id}>{t.texto}</li>)}</ul>
            <div className="chips" style={{ marginTop: 10 }}>
              <button className="accion principal" onClick={() => pasarPendientes(o.id)}>Pasar a {nombreMes(siguiente)}</button>
              <button className="accion" onClick={() => dejarPendientes(o.id)}>Dejarlas como no hechas</button>
            </div>
          </div>
        );
      })}
      <button className="boton2" style={{ borderStyle: "dashed", color: "var(--acento)" }} onClick={() => nuevo({ periodo: "mes", mes: siguiente })}>+ Agregar objetivo para {nombreMes(siguiente)}</button>
      <div className="chico" style={{ marginTop: 4 }}>Opcional: si no agregás ninguno, el cierre termina igual.</div>
    </>
  );
}
