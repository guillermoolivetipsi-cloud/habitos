import { useState } from "react";
import type { Datos } from "../datos";
import { aplicarSugerencia } from "../lib/acciones";
import type { Opciones } from "../lib/calculos";
import { DIAS_PLURAL, MESES_CORTOS, diasEntre, fechaCorta, lunes, mesDe, nombreMes, sumarDias, sumarMeses } from "../lib/fecha";
import {
  cambios, cumplimiento, patronesPorHabito, porHabito, rangoMes, sugerencias, votos,
} from "../lib/revision";
import { Barras, Lineas, redondeo } from "../ui/Graficos";
import { Barra, Icono } from "../ui/piezas";

type Periodo = "semana" | "mes" | "anio";
export type Cierre = { periodo: Periodo; inicio: string };

export const rangoSemanal = (l: string) => `${fechaCorta(l)} – ${fechaCorta(sumarDias(l, 6))}`;
const mayus = (t: string) => t[0].toUpperCase() + t.slice(1);

/** El día del período anterior que corresponde a `hoy` en el actual (sin pasarse de su final). */
export function mismaAltura(a: string, hoy: string, antA: string, antB: string): string {
  const d = sumarDias(antA, diasEntre(a, hoy));
  return d > antB ? antB : d;
}

/** Colores de las celdas de porcentaje: verde fuerte arriba de 65, rojizo debajo de 50. */
export function celda(p: number): React.CSSProperties {
  const [fondo, texto] = p >= 65 ? ["#5DCAA5", "#04342C"] : p >= 58 ? ["#9FE1CB", "#04342C"] : p >= 50 ? ["#E1F5EE", "#04342C"] : ["#F7C1C1", "#501313"];
  return { background: fondo, color: texto, borderRadius: 4, padding: "6px 0", textAlign: "center", fontSize: 11 };
}

export default function Revision({ datos, hoy, abrirCierre, abrirDetalle, avisar }: {
  datos: Datos; hoy: string; abrirCierre: (c: Cierre) => void; abrirDetalle: (id: string) => void; avisar: (c: React.ReactNode, ms?: number) => void;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [desfase, setDesfase] = useState(0);
  const op: Opciones = { libresCumplen: datos.prefs.libresCumplen };
  const { habitos, historiales: hs } = datos;
  if (datos.cargando) return null;

  let a: string, b: string, etiqueta: string, antA: string, antB: string;
  if (periodo === "semana") { a = sumarDias(lunes(hoy), 7 * desfase); b = sumarDias(a, 6); etiqueta = rangoSemanal(a); antA = sumarDias(a, -7); antB = sumarDias(a, -1); }
  else if (periodo === "mes") { const m = sumarMeses(mesDe(hoy), desfase); [a, b] = rangoMes(m); etiqueta = `${mayus(nombreMes(m))} ${m.slice(0, 4)}`; [antA, antB] = rangoMes(sumarMeses(m, -1)); }
  else { const y = +hoy.slice(0, 4) + desfase; a = `${y}-01-01`; b = `${y}-12-31`; etiqueta = String(y); antA = `${y - 1}-01-01`; antB = `${y - 1}-12-31`; }

  const actual = cumplimiento(habitos, hs, a, b, hoy, op);
  // Con el período en curso se compara contra el anterior a la misma altura (lunes contra lunes).
  const enCurso = a <= hoy && hoy < b;
  const anterior = cumplimiento(habitos, hs, antA, enCurso ? mismaAltura(a, hoy, antA, antB) : antB, hoy, op);
  const mes = cumplimiento(habitos, hs, ...rangoMes(mesDe(hoy)), hoy, op);

  return (
    <>
      <Barra titulo="Revisión" />
      <div className="selector" role="tablist">
        {([["semana", "Semana"], ["mes", "Mes"], ["anio", "Año"]] as [Periodo, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={periodo === k} className={periodo === k ? "activo" : ""} onClick={() => { setPeriodo(k); setDesfase(0); }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0 6px" }}>
        <button className="icono-btn" aria-label="Anterior" onClick={() => setDesfase(desfase - 1)}><Icono n="chevron_left" /></button>
        <span style={{ fontSize: 15 }}>{etiqueta}</span>
        <button className="icono-btn" aria-label="Siguiente" disabled={desfase >= 0} onClick={() => setDesfase(desfase + 1)}><Icono n="chevron_right" /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, margin: "6px 0 4px" }}>
        <Tarjetita titulo="Cumplido" valor={`${actual.porcentaje}%`} pie={`${Math.round(actual.hechas)} de ${Math.round(actual.esperadas)}`} />
        {periodo === "semana"
          ? <Tarjetita titulo={mayus(nombreMes(mesDe(hoy)))} valor={`${mes.porcentaje}%`} pie={`al ${fechaCorta(hoy)}`} />
          : <Tarjetita titulo="Anterior" valor={`${anterior.porcentaje}%`} pie={periodo === "mes" ? nombreMes(mesDe(antA)) : antA.slice(0, 4)} />}
      </div>

      {periodo === "semana" && desfase === 0 && <ParaDecidir datos={datos} hoy={hoy} op={op} avisar={avisar} />}
      {periodo === "semana" && <PorHabito datos={datos} a={a} b={b} hoy={hoy} op={op} abrirDetalle={abrirDetalle} />}
      {periodo === "mes" && <Mes datos={datos} a={a} b={b} antA={antA} antB={antB} hoy={hoy} op={op} />}
      {periodo === "anio" && <Anio datos={datos} anio={+a.slice(0, 4)} hoy={hoy} op={op} />}

      {periodo === "semana" && (
        <>
          <Patrones datos={datos} hoy={hoy} />
          <Identidades datos={datos} hoy={hoy} />
        </>
      )}

      {periodo !== "semana" && (
        <>
          <h3 className="titulo-g">Cierre</h3>
          <button className="boton2" onClick={() => abrirCierre({ periodo, inicio: a })}>
            <Icono n="summarize" estilo={{ fontSize: 17 }} /> Ver el cierre de {periodo === "mes" ? nombreMes(mesDe(a)) : a.slice(0, 4)}
          </button>
        </>
      )}
      {periodo === "semana" && <SemanasCerradas datos={datos} hoy={hoy} op={op} abrirCierre={abrirCierre} />}
      {periodo === "semana" && datos.decisiones.length > 0 && (
        <>
          <p className="sub" style={{ marginTop: 14 }}>Decisiones anteriores</p>
          {datos.decisiones.slice(0, 5).map((d) => (
            <div key={d.id} className="item" style={{ padding: "8px 0" }}><div className="t"><div style={{ fontSize: 13.5 }}>{d.nombre}: {d.texto}</div><div className="chico">{fechaCorta(d.fecha)}</div></div></div>
          ))}
        </>
      )}
    </>
  );
}

const Tarjetita = ({ titulo, valor, pie }: { titulo: string; valor: React.ReactNode; pie: string }) => (
  <div className="tile"><div className="chico">{titulo}</div><div style={{ fontSize: 19 }}>{valor}</div><div className="chico">{pie}</div></div>
);

function ParaDecidir({ datos, hoy, op, avisar }: { datos: Datos; hoy: string; op: Opciones; avisar: (c: React.ReactNode, ms?: number) => void }) {
  const p = datos.prefs;
  if (!p.sugerencias) return null;
  const descartadas = new Set(Object.entries(p.descartadas).filter(([, hasta]) => hasta >= hoy).map(([id]) => id));
  const s = sugerencias(datos.habitos, datos.historiales, hoy, op, { umbral: p.umbralSugerencias, maximo: p.maximoSugerencias, descartadas });
  if (!s.length) return null;
  return (
    <>
      <h3 className="titulo-g">Para decidir · {s.length}</h3>
      {s.map((x) => (
        <div key={x.h.id} className="tarjeta">
          <div>{x.titulo}</div>
          <div className="chico">{x.detalle}</div>
          <div className="chips" style={{ marginTop: 8 }}>
            {x.acciones.map((ac) => (
              <button key={ac.etiqueta} className={ac.tipo === "dejar" ? "accion" : "accion principal"} onClick={async () => {
                await aplicarSugerencia(x.h, ac, hoy);
                avisar(ac.tipo === "dejar" ? "Listo, no lo vuelvo a sugerir por un mes" : ac.tipo === "archivar" ? `${x.h.nombre} archivado` : `${x.h.nombre}: ${ac.etiqueta.toLowerCase()}, desde hoy`, 3000);
              }}>{ac.etiqueta}</button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function PorHabito({ datos, a, b, hoy, op, abrirDetalle }: { datos: Datos; a: string; b: string; hoy: string; op: Opciones; abrirDetalle: (id: string) => void }) {
  const filas = porHabito(datos.habitos, datos.historiales, a, b, hoy, op);
  return (
    <>
      <h3 className="titulo-g">Hábito por hábito</h3>
      {filas.map(({ h, hechas, meta }) => {
        const r = Math.min(1, hechas / (meta || 1));
        return (
          <button key={h.id} className="hb" style={{ width: "100%" }} onClick={() => abrirDetalle(h.id)}>
            <span style={{ color: h.color, textAlign: "left" }}>{h.nombre}</span>
            <b style={{ width: `${r * 45}%`, minWidth: 2, background: h.color + (r >= 1 ? "" : "88") }} />
            <em>{redondeo(hechas)}/{meta}</em>
          </button>
        );
      })}
    </>
  );
}

/** Los 3 días de la semana que más cuestan, en una frase cada uno. */
function Patrones({ datos, hoy }: { datos: Datos; hoy: string }) {
  if (!datos.prefs.patrones) return null;
  const p = patronesPorHabito(datos.habitos, datos.historiales, hoy).slice(0, 3);
  if (!p.length) return null;
  return (
    <>
      <h3 className="titulo-g">Patrones</h3>
      <p className="sub">qué día de la semana cuesta más · últimos 90 días</p>
      {p.map((x) => (
        <div key={x.h.id} className="item" style={{ padding: "8px 0" }}>
          <span className="punto" style={{ background: x.h.color }} />
          <div className="t"><div style={{ fontSize: 13.5 }}>{x.h.nombre}: los {DIAS_PLURAL[x.dia]} {x.tasa}% <span className="chico">(el resto {x.resto}%)</span></div></div>
        </div>
      ))}
    </>
  );
}

function Identidades({ datos, hoy }: { datos: Datos; hoy: string }) {
  if (!datos.identidades.length) return null;
  const l0 = lunes(hoy);
  // Solo semanas completas: la actual todavía no terminó.
  const semanas = Array.from({ length: 8 }, (_, i) => sumarDias(l0, -7 * (8 - i)));
  const series = datos.identidades.map((idn) => ({
    valores: semanas.map((l) => votos([idn], datos.habitos, datos.historiales, l, sumarDias(l, 6))[0].votos),
    color: idn.color,
  }));
  return (
    <>
      <h3 className="titulo-g">Tus identidades</h3>
      <p className="sub">votos por semana completa (cada día marcado es un voto)</p>
      <Lineas series={series.map((s) => ({ ...s, etiqueta: String(s.valores[s.valores.length - 1]) }))} etiquetas={semanas.map((l, i) => (i % 3 === 1 || i === 7 ? fechaCorta(l) : ""))} margenDerecho={30} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
        {datos.identidades.map((i) => <span key={i.id} className="chico"><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: i.color, marginRight: 4 }} />{i.frase}</span>)}
      </div>
    </>
  );
}

/** Historial de semanas: tocar una abre su cierre. La primera es la semana en curso. */
function SemanasCerradas({ datos, hoy, op, abrirCierre }: { datos: Datos; hoy: string; op: Opciones; abrirCierre: (c: Cierre) => void }) {
  const l0 = lunes(hoy);
  return (
    <>
      <h3 className="titulo-g">Semanas anteriores</h3>
      <p className="sub">tocá una para ver su cierre</p>
      {[0, 1, 2, 3, 4].map((i) => {
        const l = sumarDias(l0, -7 * i);
        const c = cumplimiento(datos.habitos, datos.historiales, l, sumarDias(l, 6), hoy, op);
        return (
          <button key={l} className="item" onClick={() => abrirCierre({ periodo: "semana", inicio: l })}>
            <div className="t">
              <div>{i === 0 ? "Esta semana" : rangoSemanal(l)}{i === 0 && <span className="chico"> · en curso</span>}</div>
              <div className="progreso" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, c.porcentaje)}%`, opacity: 0.8 }} /></div>
              {datos.notas.get(`semana:${l}`) && <div className="chico" style={{ marginTop: 4 }}>{datos.notas.get(`semana:${l}`)}</div>}
            </div>
            <span>{c.porcentaje}%</span>
            <Icono n="chevron_right" estilo={{ color: "#555" }} />
          </button>
        );
      })}
    </>
  );
}

function Mes({ datos, a, b, antA, antB, hoy, op }: { datos: Datos; a: string; b: string; antA: string; antB: string; hoy: string; op: Opciones }) {
  const semanas: string[] = [];
  // Solo semanas con al menos un día terminado (hoy todavía está en curso).
  for (let l = lunes(a); l <= (b >= hoy ? sumarDias(hoy, -1) : b); l = sumarDias(l, 7)) semanas.push(l);
  const pcts = semanas.map((l) => cumplimiento(datos.habitos, datos.historiales, l, sumarDias(l, 6), hoy, op).porcentaje);
  const filas = porHabito(datos.habitos, datos.historiales, a, b, hoy, op);
  const cb = cambios(datos.habitos, datos.historiales, [a, b], [antA, antB], hoy, op);
  return (
    <>
      <h3 className="titulo-g">Semana a semana</h3>
      <Barras valores={pcts} etiquetas={semanas.map(fechaCorta)} color="#69F0AE" formato={(v) => `${v}%`} destacada={(i) => pcts[i] >= 55} alto={120} />
      <h3 className="titulo-g">Lo que más cambió vs {nombreMes(mesDe(antA))}</h3>
      {cb.map((c) => (
        <div key={c.h.id} className="item" style={{ padding: "8px 0" }}>
          <div className="t"><div style={{ fontSize: 13.5 }}>{c.h.nombre}</div></div>
          <span className="chico">{c.antes}% →</span>
          <span style={{ color: c.ahora >= c.antes ? "var(--acento)" : "var(--mal)" }}>{c.ahora}%</span>
        </div>
      ))}
      <h3 className="titulo-g">Todos los hábitos</h3>
      {filas.map((f) => (
        <div key={f.h.id} className="hb"><span style={{ color: f.h.color }}>{f.h.nombre}</span><b style={{ width: `${Math.min(100, f.porcentaje) * 0.45}%`, background: f.h.color }} /><em>{f.porcentaje}%</em></div>
      ))}
    </>
  );
}

function Anio({ datos, anio, hoy, op }: { datos: Datos; anio: number; hoy: string; op: Opciones }) {
  const serie = (y: number) => MESES_CORTOS.map((_, i) => {
    const m = `${y}-${String(i + 1).padStart(2, "0")}`;
    return m > mesDe(hoy) ? null : cumplimiento(datos.habitos, datos.historiales, ...rangoMes(m), hoy, op).porcentaje;
  });
  const filas = porHabito(datos.habitos, datos.historiales, `${anio}-01-01`, `${anio}-12-31`, hoy, op);
  return (
    <>
      <h3 className="titulo-g">Mes a mes</h3>
      <p className="sub">{anio} contra {anio - 1}</p>
      <Lineas series={[{ valores: serie(anio - 1), color: "#555", etiqueta: String(anio - 1) }, { valores: serie(anio), color: "#69F0AE", puntos: true, etiqueta: String(anio) }]}
        etiquetas={MESES_CORTOS.map((m) => m[0])} min={0} max={100} margenDerecho={34} />
      <h3 className="titulo-g">Hábitos del año</h3>
      {filas.map((f) => (
        <div key={f.h.id} className="hb"><span style={{ color: f.h.color }}>{f.h.nombre}</span><b style={{ width: `${Math.min(100, f.porcentaje) * 0.45}%`, background: f.h.color }} /><em>{f.porcentaje}%</em></div>
      ))}
    </>
  );
}
