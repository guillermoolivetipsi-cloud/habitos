import { useState } from "react";
import type { Datos } from "../datos";
import { borrarObjetivo, guardarObjetivo, responderObjetivo, sumarManual } from "../lib/acciones";
import { MESES_CORTOS, diasEntre, fechaCorta, mesDe, nombreMes, sumarDias, sumarMeses } from "../lib/fecha";
import { avancePorMes, progreso, rangoObjetivo } from "../lib/objetivos";
import { contarTareas, proximaTarea } from "../lib/tareas";
import type { MedidaObjetivo, Objetivo, PeriodoObjetivo } from "../tipos";
import { Lineas, redondeo } from "../ui/Graficos";
import { Barra, Hoja, Icono } from "../ui/piezas";
import { FechaTarea, ListaTareas } from "./Tareas";

const mayus = (t: string) => t[0].toUpperCase() + t.slice(1);
const MEDIDAS: [MedidaObjetivo, string][] = [["siNo", "Sí / no"], ["cantidad", "Cantidad"], ["veces", "Veces de un hábito"], ["racha", "Racha"], ["tareas", "Tareas"]];

export type NuevoObjetivo = { periodo: PeriodoObjetivo; mes?: string };

function colorDe(o: Objetivo, datos: Datos) {
  const h = datos.habitos.find((x) => x.id === o.habitos[0]) ?? datos.archivados.find((x) => x.id === o.habitos[0]);
  return h?.color ?? datos.identidades.find((i) => i.id === o.identidad)?.color ?? "#69F0AE";
}

/** Días que quedan, o si todavía no empezó / ya terminó. */
function plazo(o: Objetivo, hoy: string) {
  if (hoy < o.desde) return `Empieza el ${fechaCorta(o.desde)}`;
  if (hoy > o.hasta) return `Terminó el ${fechaCorta(o.hasta)}`;
  const n = diasEntre(hoy, o.hasta);
  return n === 0 ? "Termina hoy" : n === 1 ? "Queda 1 día · hasta mañana" : `Quedan ${n} días · hasta el ${fechaCorta(o.hasta)}`;
}

/** Lo que va dentro del anillo: 2/4, 17/20, Sí. */
function centroAnillo(o: Objetivo, valor: number) {
  if (o.medida === "siNo") return o.logrado ? "Sí" : o.logrado === false ? "No" : "—";
  const meta = o.medida === "tareas" ? contarTareas(o.tareas).total : o.meta;
  return `${redondeo(valor)}/${meta}`;
}
const SUB_ANILLO: Partial<Record<Objetivo["medida"], string>> = { tareas: "tareas", veces: "veces", racha: "días" };

/** Anillo de avance. La marca amarilla es dónde deberías estar hoy para llegar a tiempo. */
export function AnilloObjetivo({ fraccion, esperado, color, tam, grosor, texto, sub }: { fraccion: number; esperado?: number | null; color: string; tam: number; grosor: number; texto: string; sub?: string }) {
  const m = tam / 2, r = (tam - grosor) / 2 - 1, c = 2 * Math.PI * r;
  const letra = tam * (texto.length > 5 ? 0.2 : 0.26);
  const ang = esperado != null ? esperado * 2 * Math.PI - Math.PI / 2 : 0;
  return (
    <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} role="img" aria-label={`${texto}${sub ? ` ${sub}` : ""}`} style={{ flex: "none" }}>
      <circle cx={m} cy={m} r={r} fill="none" stroke="#242424" strokeWidth={grosor} />
      {fraccion > 0 && <circle cx={m} cy={m} r={r} fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round" strokeDasharray={`${Math.max(0.001, fraccion) * c} ${c}`} transform={`rotate(-90 ${m} ${m})`} />}
      {esperado != null && esperado > 0 && esperado < 1 && (
        <line x1={m + (r - grosor * 0.9) * Math.cos(ang)} y1={m + (r - grosor * 0.9) * Math.sin(ang)} x2={m + (r + grosor * 0.9) * Math.cos(ang)} y2={m + (r + grosor * 0.9) * Math.sin(ang)} stroke="var(--meta)" strokeWidth={2} strokeLinecap="round" />
      )}
      <text x={m} y={sub ? m - tam * 0.04 : m} textAnchor="middle" dominantBaseline="central" fill="#e8e8e8" fontSize={letra}>{texto}</text>
      {sub && <text x={m} y={m + tam * 0.17} textAnchor="middle" dominantBaseline="central" fill="#8a8a8a" fontSize={tam * 0.12}>{sub}</text>}
    </svg>
  );
}

/** Tarjeta de un objetivo: anillo con el avance, días que quedan y la próxima tarea. */
export function TarjetaObjetivo({ o, datos, hoy, abrir }: { o: Objetivo; datos: Datos; hoy: string; abrir?: () => void }) {
  const p = progreso(o, [...datos.habitos, ...datos.archivados], datos.historiales, hoy);
  const color = colorDe(o, datos);
  const tareas = contarTareas(o.tareas);
  const proxima = proximaTarea(o.tareas);
  // Segunda línea: el ritmo o el resultado. En los de tareas, mientras estén en curso, el anillo ya lo dice.
  const detalle = o.medida === "tareas" && p.estado === "activo" && tareas.total > 0 ? null
    : `${p.texto}${o.medida !== "tareas" && tareas.total > 0 ? ` · ${tareas.hechas} de ${tareas.total} tareas` : ""}`;
  return (
    <div className="tarjeta obj" role={abrir ? "button" : undefined} onClick={abrir} style={abrir ? { cursor: "pointer" } : undefined}>
      <div className="obj-fila">
        <AnilloObjetivo fraccion={p.fraccion} esperado={p.estado === "activo" ? p.esperadoHoy : null} color={color} tam={48} grosor={5} texto={centroAnillo(o, p.valor)} />
        <div style={{ minWidth: 0 }}>
          <div className="obj-nombre">{o.nombre}</div>
          <div className="chico">{plazo(o, hoy)}</div>
          {detalle && <div className="chico" style={{ color: p.estado === "cumplido" ? "var(--acento)" : undefined, marginTop: 1 }}>{detalle}</div>}
        </div>
      </div>
      {proxima && p.estado !== "terminado" && (
        <div className="obj-prox"><Icono n="radio_button_unchecked" /><span className="et">Próxima:</span><span className="t">{proxima.texto}</span><FechaTarea t={proxima} hoy={hoy} /></div>
      )}
      {((o.medida === "cantidad" && p.estado !== "futuro") || (o.medida === "siNo" && o.logrado == null && p.estado !== "futuro")) && (
        <div className="chips" style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
          {o.medida === "cantidad" && <button className="chip" onClick={() => sumarManual(o.id, 1)}>+1</button>}
          {o.medida === "siNo" && (
            <>
              <button className="chip activo" onClick={() => responderObjetivo(o.id, true)}>Logrado</button>
              {p.estado === "terminado" && <button className="chip" onClick={() => responderObjetivo(o.id, false)}>No lo logré</button>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Objetivos({ datos, hoy, abrir, nuevo }: { datos: Datos; hoy: string; abrir: (id: string) => void; nuevo: (n: NuevoObjetivo) => void }) {
  const todos = [...datos.objetivos].sort((a, b) => (a.hasta < b.hasta ? -1 : 1));
  const habs = [...datos.habitos, ...datos.archivados];
  const est = (o: Objetivo) => progreso(o, habs, datos.historiales, hoy).estado;
  const vigentes = todos.filter((o) => o.hasta >= hoy || (o.medida === "siNo" && o.logrado == null));
  const terminados = todos.filter((o) => !vigentes.includes(o));
  // Agrupados por fecha de fin: "Hasta el 31 dic".
  const fines = [...new Set(vigentes.map((o) => o.hasta))].sort();
  const pie = (f: string) => (f < hoy ? "terminó" : diasEntre(hoy, f) === 0 ? "termina hoy" : diasEntre(hoy, f) === 1 ? "termina mañana" : `quedan ${diasEntre(hoy, f)} días`);
  const secciones: [string, string, Objetivo[]][] = fines.map((f) => [
    `Hasta el ${fechaCorta(f)}${f.slice(0, 4) !== hoy.slice(0, 4) ? ` ${f.slice(0, 4)}` : ""}`, pie(f), vigentes.filter((o) => o.hasta === f),
  ]);
  return (
    <>
      <Barra titulo="Objetivos"><button className="icono-btn" aria-label="Nuevo objetivo" onClick={() => nuevo({ periodo: "mes", mes: mesDe(hoy) })}><Icono n="add" /></button></Barra>
      {!todos.length && (
        <div className="tarjeta" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 16 }}>Tu primer objetivo</div>
          <div className="mu" style={{ marginTop: 4 }}>Una meta para el mes, el año o un período. Puede sumar lo que ya marcás en tus hábitos, o no.</div>
          <button className="boton" onClick={() => nuevo({ periodo: "mes", mes: mesDe(hoy) })}>Crear objetivo</button>
        </div>
      )}
      {secciones.map(([titulo, pie, lista]) => lista.length > 0 && (
        <section key={titulo}>
          <div className="grupo" style={{ color: "var(--acento)", display: "flex", justifyContent: "space-between" }}><span>{titulo}</span><span className="chico">{pie}</span></div>
          {lista.map((o) => <TarjetaObjetivo key={o.id} o={o} datos={datos} hoy={hoy} abrir={() => abrir(o.id)} />)}
        </section>
      ))}
      {terminados.length > 0 && (
        <section>
          <div className="grupo">Terminados</div>
          {terminados.slice(-10).reverse().map((o) => (
            <button key={o.id} className="item" onClick={() => abrir(o.id)}>
              <Icono n={est(o) === "cumplido" ? "task_alt" : "radio_button_unchecked"} estilo={{ color: est(o) === "cumplido" ? "var(--acento)" : "var(--dim)" }} />
              <div className="t"><div style={{ fontSize: 13.5 }}>{o.nombre}</div><div className="chico">{est(o) === "cumplido" ? "Logrado" : "No logrado"} · {fechaCorta(o.hasta)} {o.hasta.slice(0, 4)}</div></div>
            </button>
          ))}
        </section>
      )}
      {vigentes.some((o) => o.medida === "veces" || o.medida === "cantidad") && (
        <p className="chico" style={{ marginTop: 12 }}><i style={{ display: "inline-block", width: 2, height: 9, background: "var(--meta)", verticalAlign: -1, marginRight: 5, borderRadius: 1 }} />La marca amarilla del anillo es dónde deberías estar hoy para llegar a tiempo.</p>
      )}
    </>
  );
}

export function DetalleObjetivo({ o, datos, hoy, volver, editar, avisar }: { o: Objetivo; datos: Datos; hoy: string; volver: () => void; editar: () => void; avisar: (c: React.ReactNode, ms?: number) => void }) {
  const [hoja, setHoja] = useState<null | "opciones" | "fecha" | "meta" | "borrar">(null);
  const habs = [...datos.habitos, ...datos.archivados];
  const p = progreso(o, habs, datos.historiales, hoy);
  const vinculados = o.habitos.map((id) => habs.find((h) => h.id === id)?.nombre).filter(Boolean);
  const identidad = datos.identidades.find((i) => i.id === o.identidad);
  const avance = o.medida === "veces" ? avancePorMes(o, habs, datos.historiales, hoy) : null;
  const tareas = contarTareas(o.tareas);
  const principal = o.medida === "tareas"
    ? (!tareas.total ? "Todavía no tiene tareas" : p.estado === "cumplido" ? "Cumplido" : p.estado === "terminado" ? p.texto : tareas.total - tareas.hechas === 1 ? "Falta 1 tarea" : `Faltan ${tareas.total - tareas.hechas} tareas`)
    : p.texto;
  const tiempo = Math.round(Math.min(1, Math.max(0, (diasEntre(o.desde, hoy) + 1) / (diasEntre(o.desde, o.hasta) + 1))) * 100);
  return (
    <>
      <Barra titulo={o.nombre} izquierda={<button className="icono-btn" aria-label="Volver" onClick={volver}><Icono n="arrow_back" /></button>}>
        <button className="icono-btn" aria-label="Editar" onClick={editar}><Icono n="edit" /></button>
        <button className="icono-btn" aria-label="Más opciones" onClick={() => setHoja("opciones")}><Icono n="more_vert" /></button>
      </Barra>
      {o.descripcion && <p style={{ color: "var(--tx2)", fontSize: 13, margin: "0 0 8px" }}>{o.descripcion}</p>}
      <div className="obj-cabeza">
        <AnilloObjetivo fraccion={p.fraccion} esperado={p.estado === "activo" ? p.esperadoHoy : null} color={colorDe(o, datos)} tam={84} grosor={7}
          texto={centroAnillo(o, p.valor)} sub={o.medida === "siNo" ? undefined : SUB_ANILLO[o.medida]} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, color: p.estado === "cumplido" ? "var(--acento)" : undefined }}>{principal}</div>
          {o.medida !== "siNo" && p.estado !== "futuro" && <div className="chico" style={{ marginTop: 2 }}>{Math.round(p.fraccion * 100)}% hecho · {tiempo}% del tiempo</div>}
        </div>
      </div>
      <div className="pildoras">
        <span className="pildora"><Icono n="date_range" />{fechaCorta(o.desde)} – {fechaCorta(o.hasta)}{o.hasta.slice(0, 4) !== hoy.slice(0, 4) ? ` ${o.hasta.slice(0, 4)}` : ""}</span>
        <span className="pildora"><Icono n="hourglass_bottom" />{plazo(o, hoy).split(" · ")[0]}</span>
        {vinculados.length > 0 && <span className="pildora"><Icono n="link" />{vinculados.join(", ")}</span>}
        {identidad && <span className="pildora"><Icono n="person" />{identidad.frase}</span>}
      </div>
      {avance && (
        <>
          <h3 className="titulo-g">Avance contra el ritmo necesario</h3>
          <Lineas series={[
            { valores: avance.map((a) => a.ideal), color: "#ffd54f", punteada: true, grosor: 1.3 },
            { valores: avance.map((a) => a.hecho), color: "#69F0AE", grosor: 2.5, puntos: true, etiqueta: redondeo(p.valor) },
          ]} etiquetas={avance.map((a, i) => (avance.length > 6 && i % 2 ? "" : MESES_CORTOS[+a.mes.slice(5) - 1]))} margenDerecho={30}
            max={Math.max(o.meta, ...avance.map((a) => a.hecho ?? 0))} />
          <div className="chico"><i className="muestra" style={{ background: "#69F0AE" }} />hecho &nbsp; <i className="muestra" style={{ background: "#ffd54f" }} />ritmo para llegar</div>
        </>
      )}
      {o.medida === "cantidad" && (
        <div className="chips" style={{ marginTop: 12 }}>
          <button className="chip" onClick={() => sumarManual(o.id, -1)}>−1</button>
          <button className="chip activo" onClick={() => sumarManual(o.id, 1)}>+1</button>
        </div>
      )}
      {o.medida === "siNo" && (
        <div className="chips" style={{ marginTop: 12 }}>
          <button className={`chip${o.logrado === true ? " activo" : ""}`} onClick={() => responderObjetivo(o.id, true)}>Logrado</button>
          <button className={`chip${o.logrado === false ? " activo" : ""}`} onClick={() => responderObjetivo(o.id, false)}>No lo logré</button>
        </div>
      )}
      <ListaTareas o={o} color={colorDe(o, datos)} hoy={hoy} avisar={avisar} />
      {p.estado === "activo" && o.medida !== "siNo" && (
        <>
          <h3 className="titulo-g">Si no vas a llegar</h3>
          <div className="chips">
            <button className="chip" onClick={() => setHoja("fecha")}>Mover fecha</button>
            {o.medida !== "tareas" && <button className="chip" onClick={() => setHoja("meta")}>Ajustar meta</button>}
            <button className="chip" onClick={volver}>Dejar así</button>
          </div>
        </>
      )}
      {hoja === "opciones" && (
        <Hoja cerrar={() => setHoja(null)}>
          <div style={{ fontSize: 16, marginBottom: 4 }}>{o.nombre}</div>
          <button className="item" onClick={() => { setHoja(null); editar(); }}><Icono n="edit" /><div className="t"><div>Editar</div></div></button>
          {p.estado !== "cumplido" && <button className="item" onClick={() => setHoja("fecha")}><Icono n="event" /><div className="t"><div>Mover fecha</div><div className="chico">Hoy termina el {fechaCorta(o.hasta)}</div></div></button>}
          <button className="item" style={{ color: "var(--mal)", border: 0 }} onClick={() => setHoja("borrar")}>
            <Icono n="delete" /><div className="t"><div>Eliminar objetivo</div><div className="chico">{o.tareas?.length ? `También sus ${o.tareas.length === 1 ? "tarea" : `${o.tareas.length} tareas`}` : "No se puede deshacer"}</div></div>
          </button>
        </Hoja>
      )}

      {hoja === "fecha" && <HojaValor titulo="Nueva fecha límite" tipo="date" inicial={o.hasta} min={hoy} cerrar={() => setHoja(null)} guardar={async (v) => { await guardarObjetivo({ ...o, hasta: v, periodo: "periodo" }); avisar(`Nuevo límite: ${fechaCorta(v)}`); }} />}
      {hoja === "meta" && <HojaValor titulo="Nueva meta" tipo="number" inicial={String(o.meta)} cerrar={() => setHoja(null)} guardar={async (v) => { await guardarObjetivo({ ...o, meta: Math.max(1, Number(v)) }); avisar(`Nueva meta: ${v}`); }} />}
      {hoja === "borrar" && (
        <Hoja cerrar={() => setHoja(null)}>
          <div style={{ fontSize: 16 }}>¿Eliminar {o.nombre}?</div>
          <div className="chico" style={{ margin: "6px 0" }}>No se puede deshacer.{o.tareas?.length ? ` Se eliminan también sus ${o.tareas.length === 1 ? "tarea" : `${o.tareas.length} tareas`}.` : ""} Los hábitos vinculados no se tocan.</div>
          <button className="boton" style={{ background: "var(--mal)" }} onClick={async () => { await borrarObjetivo(o.id); avisar("Objetivo eliminado"); volver(); }}>Eliminar</button>
          <button className="boton2" onClick={() => setHoja(null)}>Cancelar</button>
        </Hoja>
      )}
    </>
  );
}

function HojaValor({ titulo, tipo, inicial, min, cerrar, guardar }: { titulo: string; tipo: "date" | "number"; inicial: string; min?: string; cerrar: () => void; guardar: (v: string) => Promise<void> }) {
  const [v, setV] = useState(inicial);
  const valido = tipo === "date" ? !!v && (!min || v >= min) : Number(v) >= 1;
  return (
    <Hoja cerrar={cerrar}>
      <div className="campo"><label htmlFor="hoja-valor">{titulo}</label><input id="hoja-valor" type={tipo} min={tipo === "date" ? min : 1} value={v} onChange={(e) => setV(e.target.value)} /></div>
      {!valido && <div className="chico" style={{ color: "var(--mal)", marginTop: 4 }}>{tipo === "date" ? "Elegí una fecha de hoy en adelante." : "La meta tiene que ser 1 o más."}</div>}
      <button className="boton" onClick={async () => { if (!valido) return; await guardar(v); cerrar(); }}>Guardar</button>
    </Hoja>
  );
}

/** Crear o editar un objetivo. */
export function FormObjetivo({ datos, hoy, inicial, existente, volver, avisar }: { datos: Datos; hoy: string; inicial: NuevoObjetivo; existente?: Objetivo; volver: () => void; avisar: (c: React.ReactNode) => void }) {
  const [periodo, setPeriodo] = useState<PeriodoObjetivo>(existente?.periodo ?? inicial.periodo);
  const [mes, setMes] = useState(existente?.periodo === "mes" ? mesDe(existente.desde) : inicial.mes ?? mesDe(hoy));
  const [anio, setAnio] = useState(existente?.periodo === "anio" ? +existente.desde.slice(0, 4) : +hoy.slice(0, 4));
  const [desde, setDesde] = useState(existente?.desde ?? hoy);
  const [hasta, setHasta] = useState(existente?.hasta ?? sumarDias(hoy, 30));
  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(existente?.descripcion ?? "");
  const [medida, setMedida] = useState<MedidaObjetivo>(existente?.medida ?? "siNo");
  const [meta, setMeta] = useState(String(existente?.meta ?? 10));
  const [habitos, setHabitos] = useState<string[]>(existente?.habitos ?? []);
  const [identidad, setIdentidad] = useState<string | null>(existente?.identidad ?? null);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!nombre.trim()) return setError("Escribí un nombre para el objetivo.");
    if ((medida === "veces" || medida === "racha") && !habitos.length) return setError("Elegí al menos un hábito.");
    if (medida !== "siNo" && medida !== "tareas" && !(Number(meta) >= 1)) return setError("La meta tiene que ser 1 o más.");
    if (periodo === "periodo" && (!desde || !hasta || hasta < desde)) return setError("Revisá las fechas del período.");
    const [d, h] = rangoObjetivo(periodo, { mes, anio, desde, hasta });
    await guardarObjetivo({
      id: existente?.id ?? `o-${Date.now().toString(36)}`, nombre: nombre.trim(), descripcion: descripcion.trim(), periodo, desde: d, hasta: h,
      medida, meta: medida === "siNo" || medida === "tareas" ? 1 : Number(meta), habitos: medida === "veces" || medida === "racha" ? habitos : [],
      manual: existente?.manual ?? 0, logrado: existente?.logrado ?? null, identidad,
      tareas: existente?.tareas ?? [], pendientesResueltas: existente?.pendientesResueltas,
    });
    avisar(existente ? "Objetivo guardado" : "Objetivo creado");
    volver();
  };
  const flecha = (n: number, alTocar: () => void, deshabilitada = false) => (
    <button className="icono-btn" aria-label={n < 0 ? "Anterior" : "Siguiente"} disabled={deshabilitada} onClick={alTocar}><Icono n={n < 0 ? "chevron_left" : "chevron_right"} /></button>
  );
  return (
    <>
      <Barra titulo={existente ? "Editar objetivo" : "Nuevo objetivo"} izquierda={<button className="icono-btn" aria-label="Cerrar" onClick={volver}><Icono n="close" /></button>} />
      <div className="campo">
        <label>Período</label>
        <div className="selector" style={{ margin: "2px 0 8px" }}>
          {([["mes", "Un mes"], ["anio", "Un año"], ["periodo", "Un período"]] as [PeriodoObjetivo, string][]).map(([k, l]) => (
            <button key={k} className={periodo === k ? "activo" : ""} onClick={() => setPeriodo(k)}>{l}</button>
          ))}
        </div>
        {periodo === "mes" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {flecha(-1, () => setMes(sumarMeses(mes, -1)), mes <= mesDe(hoy))}
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 16 }}>{mayus(nombreMes(mes))} {mes.slice(0, 4)}</div><div className="chico">del 1 al {rangoObjetivo("mes", { mes })[1].slice(8)} de {nombreMes(mes)}</div></div>
            {flecha(1, () => setMes(sumarMeses(mes, 1)))}
          </div>
        )}
        {periodo === "anio" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {flecha(-1, () => setAnio(anio - 1), anio <= +hoy.slice(0, 4))}
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 16 }}>{anio}</div><div className="chico">del 1 ene al 31 dic</div></div>
            {flecha(1, () => setAnio(anio + 1))}
          </div>
        )}
        {periodo === "periodo" && (
          <div style={{ display: "flex", gap: 8 }}>
            <div className="campo" style={{ flex: 1, marginTop: 10 }}><label htmlFor="o-desde">Desde</label><input id="o-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
            <div className="campo" style={{ flex: 1, marginTop: 10 }}><label htmlFor="o-hasta">Hasta</label><input id="o-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
          </div>
        )}
      </div>
      <div className="campo"><label htmlFor="o-nombre">Nombre</label><input id="o-nombre" value={nombre} placeholder="Terminar el curso de hábitos" onChange={(e) => setNombre(e.target.value)} /></div>
      <div className="campo"><label htmlFor="o-desc">Descripción · opcional</label><textarea id="o-desc" rows={2} value={descripcion} placeholder="Qué querés lograr y por qué" onChange={(e) => setDescripcion(e.target.value)} /></div>
      <div className="campo">
        <label>¿Cómo se mide?</label>
        <div className="chips">{MEDIDAS.map(([k, l]) => <button key={k} className={`chip${medida === k ? " activo" : ""}`} onClick={() => { setMedida(k); if (k === "racha") setHabitos(habitos.slice(0, 1)); }}>{l}</button>)}</div>
        <div className="chico" style={{ marginTop: 6 }}>
          {medida === "siNo" ? "Al terminar, marcás si lo lograste." : medida === "cantidad" ? "Lo actualizás a mano con +1." : medida === "veces" ? "Avanza solo con lo que marcás en los hábitos elegidos." : medida === "tareas" ? "Avanza con las tareas que marcás hechas. Las cargás en el objetivo." : "Días seguidos del hábito elegido (en Evitar, días sin)."}
        </div>
      </div>
      {medida !== "siNo" && medida !== "tareas" && <div className="campo"><label htmlFor="o-meta">Meta</label><input id="o-meta" type="number" min={1} value={meta} onChange={(e) => setMeta(e.target.value)} /></div>}
      {(medida === "veces" || medida === "racha") && (
        <div className="campo">
          <label>{medida === "racha" ? "Hábito" : "Hábitos que suman"}</label>
          <div className="chips">
            {datos.habitos.map((h) => {
              const on = habitos.includes(h.id);
              return <button key={h.id} className={`chip${on ? " activo" : ""}`} aria-pressed={on} onClick={() => setHabitos(medida === "racha" ? [h.id] : on ? habitos.filter((x) => x !== h.id) : [...habitos, h.id])}>{h.nombre}</button>;
            })}
          </div>
        </div>
      )}
      {datos.identidades.length > 0 && (
        <div className="campo">
          <label>Identidad · opcional</label>
          <div className="chips">
            <button className={`chip${!identidad ? " activo" : ""}`} onClick={() => setIdentidad(null)}>Ninguna</button>
            {datos.identidades.map((i) => <button key={i.id} className={`chip${identidad === i.id ? " activo" : ""}`} onClick={() => setIdentidad(i.id)}>{i.frase}</button>)}
          </div>
        </div>
      )}
      {error && <div className="chico" style={{ color: "var(--mal)", marginTop: 8 }}>{error}</div>}
      <button className="boton" onClick={guardar}>{existente ? "Guardar" : "Crear objetivo"}</button>
    </>
  );
}
