import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { agregarTarea, alternarTarea, borrarTarea, guardarTarea, reordenarTareas } from "../lib/acciones";
import { DIAS_CORTOS, diaSemana, fechaCorta, sumarDias } from "../lib/fecha";
import { contarTareas, nuevoIdTarea, ordenadas } from "../lib/tareas";
import type { Dia, Objetivo, Tarea } from "../tipos";
import { Hoja, Icono } from "../ui/piezas";

type Avisar = (c: ReactNode, ms?: number) => void;

/** "Hoy", "Mañana" o "vie 3 oct". */
export function fechaTarea(d: Dia, hoy: Dia) {
  if (d === hoy) return "Hoy";
  if (d === sumarDias(hoy, 1)) return "Mañana";
  return `${DIAS_CORTOS[diaSemana(d)]} ${fechaCorta(d)}`;
}

/** Fecha de una tarea pendiente: en rojo cuando ya pasó. */
export function FechaTarea({ t, hoy }: { t: Tarea; hoy: Dia }) {
  if (!t.fecha) return null;
  const vencida = !t.hecha && t.fecha < hoy;
  return <span className={`tarea-fecha${vencida ? " vencida" : ""}`}>{vencida ? "Venció el " : ""}{fechaTarea(t.fecha, hoy)}</span>;
}

/**
 * Tareas de un objetivo. Tocar el círculo marca o desmarca; tocar el texto abre la hoja para editar o eliminar.
 * Las pendientes se reordenan manteniendo presionada la manija y arrastrando; las hechas quedan al final, tachadas.
 */
export function ListaTareas({ o, color, hoy, avisar }: { o: Objetivo; color: string; hoy: Dia; avisar: Avisar }) {
  const [hoja, setHoja] = useState<null | { tarea?: Tarea }>(null);
  const ts = ordenadas(o.tareas ?? []);
  const pend = ts.filter((t) => !t.hecha);
  const hechas = ts.filter((t) => t.hecha);
  const { hechas: h, total } = contarTareas(o.tareas);

  // Arrastre: mientras dura, el orden de las pendientes vive acá; al soltar se guarda.
  const [orden, setOrden] = useState<string[] | null>(null);
  const [arrastrada, setArrastrada] = useState<string | null>(null);
  const ordenRef = useRef<string[] | null>(null);
  const filas = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => { if (!arrastrada) { setOrden(null); ordenRef.current = null; } }, [o.tareas]); // eslint-disable-line react-hooks/exhaustive-deps
  const vista = orden ? [...orden.map((id) => pend.find((t) => t.id === id)).filter((t): t is Tarea => !!t), ...pend.filter((t) => !orden.includes(t.id))] : pend;

  const empezar = (e: PointerEvent<HTMLSpanElement>, id: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    ordenRef.current = pend.map((t) => t.id);
    setOrden(ordenRef.current);
    setArrastrada(id);
  };
  const mover = (e: PointerEvent<HTMLSpanElement>) => {
    const actual = ordenRef.current;
    if (!arrastrada || !actual) return;
    const otras = actual.filter((id) => id !== arrastrada);
    // La tarea va después de todas las filas cuya mitad quedó arriba del dedo.
    const i = otras.filter((id) => { const r = filas.current.get(id)?.getBoundingClientRect(); return r && r.top + r.height / 2 < e.clientY; }).length;
    const nuevo = [...otras.slice(0, i), arrastrada, ...otras.slice(i)];
    if (nuevo.join() !== actual.join()) { ordenRef.current = nuevo; setOrden(nuevo); }
  };
  const soltar = async () => {
    const final = ordenRef.current;
    setArrastrada(null);
    if (!final || final.join() === pend.map((t) => t.id).join()) { ordenRef.current = null; setOrden(null); return; }
    await reordenarTareas(o.id, final);
  };

  const fila = (t: Tarea) => (
    <div key={t.id} className={`tarea${t.hecha ? " hecha" : ""}${arrastrada === t.id ? " arrastrando" : ""}`} ref={(el) => { if (el) filas.current.set(t.id, el); else filas.current.delete(t.id); }}>
      <button className="tarea-circulo" style={t.hecha ? { background: color, borderColor: color } : undefined} aria-pressed={t.hecha}
        aria-label={`${t.hecha ? "Desmarcar" : "Marcar hecha"}: ${t.texto}`} onClick={() => alternarTarea(o.id, t.id)}>
        {t.hecha && <Icono n="check" estilo={{ color: "#000", fontSize: 18 }} />}
      </button>
      <button className="tarea-texto" onClick={() => setHoja({ tarea: t })}>
        <span className="tarea-nombre">{t.texto}</span>
        {t.nota && <span className="tarea-nota">{t.nota}</span>}
        <FechaTarea t={t} hoy={hoy} />
      </button>
      {!t.hecha && pend.length > 1 && (
        <span className="tarea-asa" aria-label="Arrastrar para reordenar" onPointerDown={(e) => empezar(e, t.id)} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
          <Icono n="drag_indicator" />
        </span>
      )}
    </div>
  );

  return (
    <>
      <h3 className="titulo-g" style={{ display: "flex", alignItems: "baseline" }}>Tareas{total > 0 && <span className="chico" style={{ marginLeft: "auto" }}>{h} de {total}</span>}</h3>
      {vista.map(fila)}
      <button className="tarea-agregar" onClick={() => setHoja({})}><Icono n="add" />Agregar tarea</button>
      {hechas.map(fila)}
      {hoja && <HojaTarea o={o} tarea={hoja.tarea} hoy={hoy} cerrar={() => setHoja(null)} avisar={avisar} />}
    </>
  );
}

/** Alta y edición de una tarea: nombre (obligatorio), fecha y nota (opcionales). */
function HojaTarea({ o, tarea, hoy, cerrar, avisar }: { o: Objetivo; tarea?: Tarea; hoy: Dia; cerrar: () => void; avisar: Avisar }) {
  const [texto, setTexto] = useState(tarea?.texto ?? "");
  const [fecha, setFecha] = useState<Dia | null>(tarea?.fecha ?? null);
  const [nota, setNota] = useState(tarea?.nota ?? "");
  const [error, setError] = useState(false);
  const [recien, setRecien] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const manana = sumarDias(hoy, 1);
  const atajos: [string, Dia | null][] = [["Sin fecha", null], ["Hoy", hoy], ["Mañana", manana]];
  if (o.hasta > manana) atajos.push(["Fin del objetivo", o.hasta]);
  const enAtajo = atajos.some(([, v]) => v === fecha);
  const [elegir, setElegir] = useState(!!fecha && !enAtajo);

  const guardar = async (otra: boolean) => {
    if (!texto.trim()) { setError(true); campo.current?.focus(); return; }
    const t: Tarea = { id: tarea?.id ?? nuevoIdTarea(), texto: texto.trim(), hecha: tarea?.hecha ?? false, fecha, nota: nota.trim() };
    // Se limpia antes de guardar para que lo que escribas enseguida no se pegue a la tarea anterior.
    if (otra) { setRecien(t.texto); setTexto(""); setFecha(null); setNota(""); setElegir(false); campo.current?.focus(); }
    if (tarea) await guardarTarea(o.id, t);
    else await agregarTarea(o.id, t);
    if (!otra) cerrar();
  };
  const eliminar = async () => {
    if (!tarea) return;
    const deshacer = await borrarTarea(o.id, tarea.id);
    cerrar();
    avisar(
      <span className="aviso-con-accion">Tarea eliminada<button onClick={async () => { await deshacer(); avisar("Tarea recuperada"); }}>Deshacer</button></span>,
      6000,
    );
  };

  return (
    <Hoja cerrar={cerrar}>
      <div style={{ fontSize: 16 }}>{tarea ? "Editar tarea" : "Nueva tarea"}</div>
      <div className="chico">En {o.nombre}</div>
      {recien && <div className="chico" style={{ color: "var(--acento)", marginTop: 6 }}>Agregaste «{recien}». Escribí la siguiente.</div>}
      <div className={`campo${error ? " error" : ""}`}>
        <label htmlFor="t-texto">Tarea</label>
        <input id="t-texto" ref={campo} autoFocus={!tarea} value={texto} placeholder="Ej.: Llamar al salón" autoComplete="off"
          onChange={(e) => { setTexto(e.target.value); if (e.target.value.trim()) setError(false); }} onKeyDown={(e) => { if (e.key === "Enter") guardar(!tarea); }} />
      </div>
      {error && <div className="chico" style={{ color: "var(--mal)", marginTop: 4 }}>Escribí qué hay que hacer.</div>}
      <div className="chico" style={{ margin: "14px 0 6px", color: "var(--tx2)" }}>Fecha · opcional</div>
      <div className="chips">
        {atajos.map(([l, v]) => <button key={l} className={`chip${!elegir && fecha === v ? " activo" : ""}`} onClick={() => { setFecha(v); setElegir(false); }}>{l}</button>)}
        <button className={`chip${elegir ? " activo" : ""}`} onClick={() => setElegir(true)}>{elegir && fecha ? fechaTarea(fecha, hoy) : "Elegir…"}</button>
      </div>
      {elegir && <div className="campo"><label htmlFor="t-fecha">Fecha</label><input id="t-fecha" type="date" value={fecha ?? ""} onChange={(e) => setFecha(e.target.value || null)} /></div>}
      {fecha && fecha > o.hasta && <div className="chico" style={{ color: "var(--meta)", marginTop: 6 }}>Queda después del {fechaCorta(o.hasta)}, cuando termina el objetivo.</div>}
      <div className="campo"><label htmlFor="t-nota">Nota · opcional</label><textarea id="t-nota" rows={2} value={nota} placeholder="Un teléfono, un link, un detalle" onChange={(e) => setNota(e.target.value)} /></div>
      {tarea ? (
        <>
          <button className="boton" onClick={() => guardar(false)}>Guardar</button>
          <button className="boton2" style={{ color: "var(--mal)", borderColor: "#ff8a8055" }} onClick={eliminar}>Eliminar tarea</button>
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="boton2" style={{ marginTop: 14 }} onClick={() => guardar(true)}>Guardar y otra</button>
          <button className="boton" onClick={() => guardar(false)}>Guardar</button>
        </div>
      )}
    </Hoja>
  );
}
