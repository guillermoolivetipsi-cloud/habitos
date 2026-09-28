import { useMemo, useState } from "react";
import type { Datos } from "../datos";
import { alternarLibre, archivar, eliminar, tocar } from "../lib/acciones";
import { fallaAnterior, retomar, textoFrecuencia, unidad, valorEn, type Opciones } from "../lib/calculos";
import {
  acumuladoAnio, frecuenciaMensual, meses, mejoresRachas, puntuaciones, rachaActual, rachas, resumen, semanas,
} from "../lib/estadisticas";
import { DIAS_CORTOS, DIAS_LARGOS, MESES_CORTOS, fechaCorta, sumarDias } from "../lib/fecha";
import type { Habito } from "../tipos";
import { AnilloPuntuacion, Barras, Calendario, FrecuenciaPuntos, Lineas, redondeo } from "../ui/Graficos";
import { Barra, Hoja, Icono } from "../ui/piezas";
import { MOMENTOS } from "./Hoy";

type Pestana = "Progreso" | "Patrones" | "Historial";

export default function Detalle({ h, datos, hoy, volver, editar, avisar }: {
  h: Habito; datos: Datos; hoy: string; volver: () => void; editar: () => void; avisar: (c: React.ReactNode, ms?: number) => void;
}) {
  const [pestana, setPestana] = useState<Pestana>("Progreso");
  const [menu, setMenu] = useState<null | "opciones" | "eliminar">(null);
  const hist = datos.historiales.get(h.id) ?? new Map();
  const op: Opciones = { libresCumplen: datos.prefs.libresCumplen };
  const f = h.frecuencias[h.frecuencias.length - 1].frecuencia;
  const r = useMemo(() => resumen(h, hist, hoy, op), [h, hist, hoy, op.libresCumplen]);
  const punt = useMemo(() => puntuaciones(h, hist, sumarDias(hoy, -365), hoy), [h, hist, hoy]);
  const actual = rachaActual(h, hist, hoy, op);
  const u = unidad(h, hoy);
  const sc = punt.get(hoy) ?? 0;
  const dl = sc - (punt.get(sumarDias(hoy, -30)) ?? 0);
  const identidad = h.identidad ? datos.identidades.find((i) => i.id === h.identidad) : null;

  return (
    <>
      <Barra titulo={h.nombre} izquierda={<button className="icono-btn" aria-label="Volver" onClick={volver}><Icono n="arrow_back" /></button>}>
        <button className="icono-btn" aria-label="Editar" onClick={editar}><Icono n="edit" /></button>
        <button className="icono-btn" aria-label="Más opciones" onClick={() => setMenu("opciones")}><Icono n="more_vert" /></button>
      </Barra>
      <div className="chico" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <span><Icono n="calendar_today" estilo={{ fontSize: 15 }} /> {h.tipo === "medir" && h.medicion ? `${h.medicion.sentido === "alMenos" ? "al menos" : "como máximo"} ${h.medicion.cantidad} ${h.medicion.unidad}` : textoFrecuencia(f, h.tipo)}</span>
        <span><Icono n="notifications" estilo={{ fontSize: 15 }} /> {h.recordatorio ?? "Apagado"}</span>
        <span><Icono n="schedule" estilo={{ fontSize: 15 }} /> {MOMENTOS.find((m) => m[0] === h.momento)?.[1]}</span>
        {h.frecuencias.length > 1 && <span><Icono n="history" estilo={{ fontSize: 15 }} /> así desde el {fechaCorta(h.frecuencias[h.frecuencias.length - 1].desde)}</span>}
      </div>
      {identidad && <div className="nota" style={{ color: identidad.color, marginTop: 6 }}><Icono n="person" /> Vota por "{identidad.frase.toLowerCase()}"</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
        <AnilloPuntuacion valor={sc} color={h.color} />
        <div className="kp">
          <span>Puntuación</span><span>Este mes</span><span>{h.tipo === "evitar" ? "Días sin" : u === "semana" ? "Semanas ok" : "Racha"}</span>
          <b>{sc} <span style={{ fontSize: 11, color: dl >= 0 ? "var(--acento)" : "var(--mal)" }}>{dl >= 0 ? "+" : ""}{dl}</span></b>
          <b>{redondeo(r.esteMes.hechas)}<span className="chico"> / {r.esteMes.meta}</span></b>
          <b>{actual?.largo ?? 0}</b>
        </div>
      </div>

      <div className="pestanas" role="tablist">
        {(["Progreso", "Patrones", "Historial"] as Pestana[]).map((p) => (
          <button key={p} role="tab" aria-selected={pestana === p} className={pestana === p ? "activo" : ""} onClick={() => setPestana(p)}>{p}</button>
        ))}
      </div>

      {pestana === "Progreso" && <Progreso {...{ h, hist, hoy, op, r, punt }} />}
      {pestana === "Patrones" && (
        <>
          <DiasSemana h={h} hist={hist} hoy={hoy} />
          <h3 className="titulo-g">Calendario</h3>
          <p className="sub">tocá un día para marcar · mantené presionado para día libre</p>
          <Calendario h={h} hoy={hoy} valor={(d) => valorEn(hist, d)}
            alTocar={(d) => tocar(h, d)}
            alMantener={async (d) => { const p = await alternarLibre(h, d); avisar(p ? `Día libre el ${fechaCorta(d)}` : "Día libre quitado", 1800); }} />
          <h3 className="titulo-g">Frecuencia</h3>
          <p className="sub">veces por día de la semana, mes a mes · últimos 12 meses</p>
          <FrecuenciaPuntos datos={frecuenciaMensual(h, hist, hoy)} color={h.color} />
          {h.variantes.length > 0 && <Variantes h={h} hist={hist} hoy={hoy} />}
        </>
      )}
      {pestana === "Historial" && <Historial {...{ h, hist, hoy, op }} />}

      {menu === "opciones" && (
        <Hoja cerrar={() => setMenu(null)}>
          <div style={{ fontSize: 16, marginBottom: 4 }}>{h.nombre}</div>
          <button className="item" onClick={() => { setMenu(null); editar(); }}><Icono n="edit" /><div className="t"><div>Editar</div></div></button>
          <button className="item" onClick={async () => { await archivar(h.id); avisar(`${h.nombre} archivado. Lo recuperás desde Ajustes → Archivados.`, 3500); volver(); }}>
            <Icono n="archive" /><div className="t"><div>Archivar</div><div className="chico">Sale de Hoy y conserva el historial</div></div>
          </button>
          <button className="item" style={{ color: "var(--mal)", border: 0 }} onClick={() => setMenu("eliminar")}>
            <Icono n="delete" /><div className="t"><div>Eliminar</div><div className="chico">Borra el hábito y todo su historial</div></div>
          </button>
        </Hoja>
      )}
      {menu === "eliminar" && <ConfirmarEliminar h={h} registros={hist.size} cerrar={() => setMenu(null)} alListo={volver} avisar={avisar} />}
    </>
  );
}

export function ConfirmarEliminar({ h, registros, cerrar, alListo, avisar }: { h: Habito; registros: number; cerrar: () => void; alListo: () => void; avisar: (c: React.ReactNode) => void }) {
  return (
    <Hoja cerrar={cerrar}>
      <div style={{ fontSize: 16 }}>¿Eliminar {h.nombre}?</div>
      <div className="chico" style={{ margin: "6px 0 4px" }}>Se borran {registros.toLocaleString("es-AR")} registros. No se puede deshacer. Si querés conservar el historial, archivalo.</div>
      <button className="boton" style={{ background: "var(--mal)" }} onClick={async () => { await eliminar(h.id); avisar(`${h.nombre} eliminado`); alListo(); }}>Eliminar</button>
      <button className="boton2" onClick={async () => { await archivar(h.id); avisar(`${h.nombre} archivado`); alListo(); }}>Archivar en su lugar</button>
      <button className="boton2" onClick={cerrar}>Cancelar</button>
    </Hoja>
  );
}

type PropsP = { h: Habito; hist: Map<string, import("../tipos").Registro>; hoy: string; op: Opciones };

function Progreso({ h, hist, hoy, op, r, punt }: PropsP & { r: ReturnType<typeof resumen>; punt: Map<string, number> }) {
  const tile = (a: string, b: React.ReactNode, c?: string) => (
    <div className="tile"><div className="chico">{a}</div><div style={{ fontSize: 17 }}>{b}</div>{c && <div className="chico">{c}</div>}</div>
  );
  const pct = (x: number | null) => (x == null ? "—" : `${x}%`);
  const ptos = Array.from({ length: 17 }, (_, i) => punt.get(sumarDias(hoy, -7 * (16 - i))) ?? 0);
  const minP = Math.max(0, Math.floor((Math.min(...ptos) - 8) / 10) * 10);
  const sem = semanas(h, hist, hoy, op);
  const ms = meses(h, hist, hoy, op);
  const u = unidad(h, hoy);
  const rt = h.nuncaDosVeces ? retomar(h, hist, hoy, op) : null;
  const falla = fallaAnterior(h, hist, hoy, op);
  return (
    <>
      <h3 className="titulo-g">Resumen</h3>
      <div className="tiles">
        {tile("Total", r.total.toLocaleString("es-AR"), r.primerDia ? `desde ${MESES_CORTOS[+r.primerDia.slice(5, 7) - 1]} ${r.primerDia.slice(0, 4)}` : undefined)}
        {tile("30 días", pct(r.p30), "del objetivo")}
        {tile("90 días", pct(r.p90), "del objetivo")}
        {tile("12 meses", pct(r.p365), "del objetivo")}
        {tile("Por semana", redondeo(r.porSemana), "últimas 12")}
        {tile("Mejor racha", r.mejorRacha || "—", u === "semana" ? "semanas" : "días")}
        {tile("Mejor mes", r.mejorMes ? MESES_CORTOS[+r.mejorMes.mes.slice(5) - 1] : "—", r.mejorMes ? `${redondeo(r.mejorMes.veces)} veces` : undefined)}
        {tile("Mejor día", r.mejorDia ? DIAS_LARGOS[r.mejorDia.dia] : "—", r.mejorDia ? `${r.mejorDia.tasa}% de las veces` : undefined)}
        {tile("Este año", redondeo(r.esteAnio), "veces")}
      </div>

      <h3 className="titulo-g">Puntuación</h3>
      <p className="sub">Lo reciente pesa más · hace 1 mes {punt.get(sumarDias(hoy, -30)) ?? 0} · hace 1 año {punt.get(sumarDias(hoy, -365)) ?? 0}</p>
      <Lineas series={[{ valores: ptos, color: h.color, puntos: true }]} min={minP} max={100} margenDerecho={10}
        etiquetas={ptos.map((_, i) => (i % 4 === 0 ? fechaCorta(sumarDias(hoy, -7 * (16 - i))) : ""))} />

      <h3 className="titulo-g">{u === "semana" ? "Semanas cumplidas" : "Días por semana"}</h3>
      <p className="sub">objetivo {sem[sem.length - 1].meta} · gris = días libres</p>
      <Barras valores={sem.map((s) => s.hechas)} apiladas={sem.map((s) => s.libres)} meta={sem.map((s) => s.meta)} color={h.color}
        etiquetas={sem.map((s, i) => ((sem.length - 1 - i) % 3 === 0 ? fechaCorta(s.lunes) : ""))} />

      <h3 className="titulo-g">Veces por mes</h3>
      <p className="sub">línea = objetivo · gris = días libres, no se suman al número</p>
      <Barras valores={ms.map((m) => m.hechas)} apiladas={ms.map((m) => m.libres)} meta={ms.map((m) => m.meta)} color={h.color}
        etiquetas={ms.map((m) => MESES_CORTOS[+m.mes.slice(5) - 1])} />

      {h.nuncaDosVeces && (
        <>
          <h3 className="titulo-g">Nunca fallar dos veces</h3>
          {falla && <p className="nota" style={{ color: "var(--aviso)" }}><Icono n="undo" /> {falla}</p>}
          {rt ? (
            <>
              <p className="sub">{u === "dia" ? "Cuando fallás un día, al siguiente lo retomás" : "Cuando no llegás una semana, la siguiente sí llegás"}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="grande" style={{ color: rt.porcentaje >= 50 ? h.color : "var(--aviso)" }}>{rt.porcentaje}%</span>
                <span className="chico">{rt.vueltas} de {rt.fallos} veces · {u === "dia" ? "90 días" : "26 semanas"}</span>
              </div>
            </>
          ) : <p className="sub">Sin fallos en el período.</p>}
        </>
      )}
    </>
  );
}

function DiasSemana({ h, hist, hoy }: { h: Habito; hist: PropsP["hist"]; hoy: string }) {
  const t = useMemo(() => {
    const out: number[] = [];
    const c = [0, 0, 0, 0, 0, 0, 0], n = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 1; i <= 365; i++) {
      const d = sumarDias(hoy, -i);
      const w = (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7;
      n[w]++;
      const v = valorEn(hist, d);
      if (v === "hecho" || v === "minima") c[w]++;
    }
    for (let i = 0; i < 7; i++) out.push(n[i] ? Math.round((100 * c[i]) / n[i]) : 0);
    return out;
  }, [hist, hoy]);
  const max = Math.max(...t), min = Math.min(...t);
  return (
    <>
      <h3 className="titulo-g">Qué días lo hacés</h3>
      <p className="sub">últimos 12 meses · mejor {DIAS_LARGOS[t.indexOf(max)]}, peor {DIAS_LARGOS[t.indexOf(min)]}</p>
      <Barras valores={t} etiquetas={DIAS_CORTOS} color={h.color} alto={120} formato={(v) => `${v}%`} destacada={(i) => t[i] === max} />
    </>
  );
}

function Variantes({ h, hist, hoy }: { h: Habito; hist: PropsP["hist"]; hoy: string }) {
  const mes = hoy.slice(0, 7);
  const c: Record<string, number> = {};
  let total = 0;
  for (const reg of hist.values()) {
    if (reg.dia.slice(0, 7) !== mes || reg.valor === "libre") continue;
    total++;
    if (reg.variante) c[reg.variante] = (c[reg.variante] ?? 0) + 1;
  }
  const con = Object.values(c).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...h.variantes.map((v) => c[v] ?? 0));
  return (
    <>
      <h3 className="titulo-g">Qué hiciste este mes</h3>
      <p className="sub">{total} veces en total</p>
      {h.variantes.map((v) => (
        <div className="hb" key={v}><span>{v}</span><b style={{ width: `${((c[v] ?? 0) / max) * 55}%`, background: h.color }} /><em>{c[v] ?? 0}</em></div>
      ))}
      {total - con > 0 && <div className="chico" style={{ marginTop: 6 }}>Sin variante: {total - con}</div>}
    </>
  );
}

function Historial({ h, hist, hoy, op }: PropsP) {
  const anio = +hoy.slice(0, 4);
  const series = [anio - 2, anio - 1, anio].map((a, i) => {
    const v = acumuladoAnio(h, hist, a, hoy, op);
    const ult = v.filter((x): x is number => x != null).pop() ?? 0;
    return { valores: v, color: i === 0 ? "#555" : i === 1 ? h.color + "77" : h.color, grosor: i === 2 ? 2.5 : 1.5, etiqueta: `${a} · ${redondeo(ult)}` };
  });
  const todas = rachas(h, hist, hoy, op);
  const mejores = mejoresRachas(todas);
  const max = Math.max(1, ...mejores.map((x) => x.largo));
  const actual = rachaActual(h, hist, hoy, op);
  const unidadR = unidad(h, hoy) === "semana" ? "semanas" : "días";
  const fecha = (d: string) => `${fechaCorta(d)} ${d.slice(0, 4)}`;
  return (
    <>
      <h3 className="titulo-g">Este año contra los anteriores</h3>
      <p className="sub">acumulado por mes</p>
      <Lineas series={series} etiquetas={MESES_CORTOS.map((m) => m[0])} margenDerecho={70} />
      <h3 className="titulo-g">Mejores rachas</h3>
      <p className="sub">en {unidadR} seguidos · actual {actual?.largo ?? 0}</p>
      {mejores.map((x) => (
        <div key={x.desde} className="racha">
          <span>{fecha(x.desde)}</span>
          <b style={{ width: 40 + (x.largo / max) * 80, background: x.largo === max ? h.color : "#2a2a2a", color: x.largo === max ? "#000" : "var(--tx)" }}>{x.largo}</b>
          <span>{fecha(x.hasta)}</span>
        </div>
      ))}
      {!mejores.length && <p className="chico">Todavía no hay rachas.</p>}
    </>
  );
}
