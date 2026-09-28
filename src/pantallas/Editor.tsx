import { useState } from "react";
import type { Datos } from "../datos";
import { archivar, crearHabito, guardarHabito, nuevoId, reactivar } from "../lib/acciones";
import { textoFrecuencia } from "../lib/calculos";
import { DIAS_LARGOS, INICIALES } from "../lib/fecha";
import type { Frecuencia, Habito, TipoHabito } from "../tipos";
import { Barra, Hoja, Icono, Interruptor } from "../ui/piezas";
import { ConfirmarEliminar } from "./Detalle";
import { MOMENTOS } from "./Hoy";

const COLORES = ["#80CBC4", "#69F0AE", "#AED581", "#FFF176", "#FFD54F", "#FFB74D", "#FF8A80", "#F48FB1", "#CE93D8", "#B39DDB", "#64B5F6", "#4DD0E1", "#BDBDBD"];

interface Props {
  datos: Datos;
  hoy: string;
  /** Sin hábito: se crea uno nuevo (primero se elige el tipo). */
  habito?: Habito;
  volver: () => void;
  alTerminar: () => void;
  avisar: (c: React.ReactNode, ms?: number) => void;
}

export default function Editor(p: Props) {
  const [tipo, setTipo] = useState<TipoHabito | null>(p.habito?.tipo ?? null);
  if (!tipo) return <ElegirTipo {...p} elegir={setTipo} />;
  return <Formulario {...p} tipo={tipo} />;
}

function ElegirTipo({ datos, volver, elegir, avisar }: Props & { elegir: (t: TipoHabito) => void }) {
  const recuperables = datos.archivados.slice(0, 8);
  return (
    <>
      <Barra titulo="Nuevo hábito" izquierda={<button className="icono-btn" aria-label="Cerrar" onClick={volver}><Icono n="close" /></button>} />
      <p className="mu">¿Qué tipo de hábito es?</p>
      {([
        ["hacer", "check_circle", "Hacer", "Sí o no. Leer, meditar, hacer ejercicio."],
        ["medir", "straighten", "Medir", "Un número por día: al menos o como máximo. 2 litros de agua, máximo 1 cerveza."],
        ["evitar", "block", "Evitar", "Algo que querés dejar. Cuenta días sin, con un margen opcional."],
      ] as const).map(([k, i, t, d]) => (
        <button key={k} className="tarjeta" style={{ display: "flex", gap: 12, width: "100%", textAlign: "left" }} onClick={() => elegir(k)}>
          <Icono n={i} estilo={{ color: "var(--acento)", fontSize: 24 }} />
          <div><div style={{ fontSize: 15 }}>{t}</div><div className="chico">{d}</div></div>
        </button>
      ))}
      {recuperables.length > 0 && (
        <>
          <p className="chico" style={{ margin: "18px 0 8px" }}>O recuperá uno archivado, con su historial</p>
          <div className="chips">
            {recuperables.map((h) => (
              <button key={h.id} className="chip" onClick={async () => { await reactivar(h.id); avisar(`${h.nombre} vuelve a Hoy con su historial`); volver(); }}>{h.nombre}</button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

interface Borrador {
  nombre: string;
  color: string;
  frecuencia: Frecuencia;
  medicion: NonNullable<Habito["medicion"]>;
  margen: number;
  margenPor: "no" | "semana" | "mes";
  momento: Habito["momento"];
  area: string;
  identidad: string | null;
  despuesDe: string;
  variantes: string[];
  nuevaVariante: string;
  recordatorio: string;
  minimaActiva: boolean;
  minima: string;
  nuncaDosVeces: boolean;
  pregunta: string;
  notas: string;
}

function borradorDe(h: Habito | undefined, datos: Datos): Borrador {
  const f = h?.frecuencias[h.frecuencias.length - 1].frecuencia ?? { num: 1, den: 1 };
  const evitarPor = h?.tipo === "evitar" && f.num < f.den ? (f.den === 7 ? "semana" : "mes") : "no";
  return {
    nombre: h?.nombre ?? "", color: h?.color ?? COLORES[datos.habitos.length % COLORES.length], frecuencia: f,
    medicion: h?.medicion ?? { sentido: "alMenos", cantidad: 2, unidad: "litros", por: "dia" },
    margen: h?.tipo === "evitar" && evitarPor !== "no" ? f.den - f.num : 0, margenPor: evitarPor,
    momento: h?.momento ?? "noche", area: h?.area ?? "", identidad: h?.identidad ?? null, despuesDe: h?.despuesDe ?? "",
    variantes: [...(h?.variantes ?? [])], nuevaVariante: "", recordatorio: h?.recordatorio ?? "",
    minimaActiva: !!h?.minima, minima: h?.minima ?? "", nuncaDosVeces: h?.nuncaDosVeces ?? false,
    pregunta: h?.pregunta ?? "", notas: h?.notas ?? "",
  };
}

function frecuenciaFinal(tipo: TipoHabito, b: Borrador): Frecuencia {
  if (tipo === "medir") return { num: 1, den: 1 };
  if (tipo === "evitar") {
    if (b.margenPor === "no" || !b.margen) return { num: 1, den: 1 };
    const den = b.margenPor === "semana" ? 7 : 30;
    return { num: Math.max(1, den - b.margen), den };
  }
  return b.frecuencia;
}

function Formulario({ datos, hoy, habito, volver, alTerminar, avisar, tipo }: Props & { tipo: TipoHabito }) {
  const [b, setB] = useState<Borrador>(() => borradorDe(habito, datos));
  const [error, setError] = useState(false);
  const [hoja, setHoja] = useState<null | "frecuencia" | "color" | "desde" | "eliminar">(null);
  const [mas, setMas] = useState(!!(habito?.pregunta || habito?.notas));
  const cambiar = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }));
  const areas = [...new Set([...datos.habitos, ...datos.archivados].map((h) => h.area).filter(Boolean))];
  const titulo = { hacer: "Hacer", medir: "Medir", evitar: "Evitar" }[tipo];

  const construir = (): Habito => ({
    id: habito?.id ?? nuevoId(), nombre: b.nombre.trim(), color: b.color, tipo,
    frecuencias: habito?.frecuencias ?? [{ desde: hoy, frecuencia: frecuenciaFinal(tipo, b) }],
    medicion: tipo === "medir" ? b.medicion : undefined,
    momento: b.momento, area: b.area.trim(), identidad: b.identidad, despuesDe: b.despuesDe.trim() || null,
    recordatorio: b.recordatorio || null, minima: b.minimaActiva ? b.minima.trim() : null, nuncaDosVeces: b.nuncaDosVeces,
    variantes: b.variantes, pregunta: b.pregunta.trim() || null, notas: b.notas.trim() || null,
    orden: habito?.orden ?? 0, archivado: habito?.archivado ?? false, creado: habito?.creado ?? hoy, loop: habito?.loop,
  });

  const guardar = async (desde?: "hoy" | "todo") => {
    if (!b.nombre.trim() || (b.minimaActiva && !b.minima.trim())) { setError(true); return; }
    const h = construir();
    if (!habito) { await crearHabito(h); avisar(`${h.nombre} agregado a Hoy`); alTerminar(); return; }
    const antes = habito.frecuencias[habito.frecuencias.length - 1].frecuencia;
    const nueva = frecuenciaFinal(tipo, b);
    const cambio = JSON.stringify(antes) !== JSON.stringify(nueva);
    if (cambio && !desde) { setHoja("desde"); return; }
    await guardarHabito(h, cambio ? { frecuencia: nueva, desde: desde!, hoy } : undefined);
    avisar(cambio ? (desde === "hoy" ? "Guardado. La nueva frecuencia rige desde hoy; el pasado no cambia." : "Guardado. Historial recalculado con la nueva frecuencia.") : "Cambios guardados");
    volver();
  };

  const falta = (x: boolean) => error && x;
  return (
    <>
      <Barra titulo={habito ? "Editar hábito" : titulo} izquierda={<button className="icono-btn" aria-label="Volver" onClick={volver}><Icono n="arrow_back" /></button>}>
        <button className="guardar" onClick={() => guardar()}>GUARDAR</button>
      </Barra>

      <div style={{ display: "flex", gap: 8 }}>
        <div className={`campo${falta(!b.nombre.trim()) ? " error" : ""}`} style={{ flex: 1 }}>
          <label htmlFor="e-nombre">{tipo === "evitar" ? "¿Qué querés evitar?" : "Nombre"}</label>
          <input id="e-nombre" value={b.nombre} placeholder={tipo === "evitar" ? "Fumar" : "Ejercicio"} onChange={(e) => cambiar("nombre", e.target.value)} />
        </div>
        <div className="campo" style={{ width: 64, display: "flex", justifyContent: "center" }}>
          <label>Color</label>
          <button aria-label="Cambiar color" onClick={() => setHoja("color")} style={{ width: 28, height: 20, borderRadius: 3, background: b.color }} />
        </div>
      </div>
      {falta(!b.nombre.trim()) && <div className="chico" style={{ color: "var(--mal)", marginTop: 4 }}>Escribí un nombre.</div>}

      {tipo === "hacer" && (
        <div className="campo">
          <label>Frecuencia</label>
          <button style={{ display: "flex", justifyContent: "space-between", width: "100%" }} onClick={() => setHoja("frecuencia")}>
            {textoFrecuencia(b.frecuencia)} <Icono n="arrow_drop_down" />
          </button>
        </div>
      )}
      {tipo === "medir" && (
        <div className="campo">
          <label>Objetivo</label>
          <Chips valor={b.medicion.sentido} opciones={[["alMenos", "Al menos"], ["comoMaximo", "Como máximo"]]} alElegir={(v) => cambiar("medicion", { ...b.medicion, sentido: v })} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <input aria-label="Cantidad" type="number" min={0} value={b.medicion.cantidad} onChange={(e) => cambiar("medicion", { ...b.medicion, cantidad: Number(e.target.value) })} style={{ width: 60, borderBottom: "1px solid #555", fontSize: 18, textAlign: "center" }} />
            <input aria-label="Unidad" value={b.medicion.unidad} placeholder="unidad" onChange={(e) => cambiar("medicion", { ...b.medicion, unidad: e.target.value })} style={{ width: 90, borderBottom: "1px solid #555" }} />
            <span className="chico">por</span>
            <Chips valor={b.medicion.por} opciones={[["dia", "día"], ["semana", "semana"]]} alElegir={(v) => cambiar("medicion", { ...b.medicion, por: v })} />
          </div>
        </div>
      )}
      {tipo === "evitar" && (
        <div className="campo">
          <label>Margen permitido</label>
          <Chips valor={b.margenPor} opciones={[["no", "Ninguno"], ["semana", "Por semana"], ["mes", "Por mes"]]} alElegir={(v) => { cambiar("margenPor", v); if (v !== "no" && !b.margen) cambiar("margen", v === "semana" ? 1 : 5); }} />
          {b.margenPor !== "no" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
              <Pasos valor={b.margen} min={1} max={b.margenPor === "semana" ? 6 : 29} alCambiar={(v) => cambiar("margen", v)} />
              <span className="chico">veces por {b.margenPor === "semana" ? "semana" : "mes"}</span>
            </div>
          )}
        </div>
      )}

      <div className="campo"><label>Momento del día</label><Chips valor={b.momento} opciones={MOMENTOS} alElegir={(v) => cambiar("momento", v)} /></div>
      <div className="campo">
        <label htmlFor="e-area">Área</label>
        {areas.length > 0 && <Chips valor={b.area} opciones={areas.map((a) => [a, a] as [string, string])} alElegir={(v) => cambiar("area", v)} />}
        <input id="e-area" value={b.area} placeholder={areas.length ? "o escribí una nueva" : "Cuerpo, Mente, Finanzas…"} onChange={(e) => cambiar("area", e.target.value)} style={{ marginTop: areas.length ? 8 : 0 }} />
      </div>
      {datos.identidades.length > 0 && (
        <div className="campo">
          <label>Identidad · opcional</label>
          <Chips valor={b.identidad ?? ""} opciones={[["", "Ninguna"], ...datos.identidades.map((i) => [i.id, i.frase] as [string, string])]} alElegir={(v) => cambiar("identidad", v || null)} />
        </div>
      )}
      {tipo === "hacer" && (
        <>
          <div className="campo"><label htmlFor="e-despues">Después de… · opcional</label><input id="e-despues" value={b.despuesDe} placeholder="cenar" onChange={(e) => cambiar("despuesDe", e.target.value)} /></div>
          <div className="campo">
            <label htmlFor="e-variante">Variantes · opcional</label>
            <div className="chips" style={{ alignItems: "center" }}>
              {b.variantes.map((v, i) => (
                <button key={v} className="chip" aria-label={`Quitar ${v}`} onClick={() => cambiar("variantes", b.variantes.filter((_, j) => j !== i))}>{v} ×</button>
              ))}
              <input id="e-variante" value={b.nuevaVariante} placeholder="+ agregar" style={{ width: 100, fontSize: 12.5 }}
                onChange={(e) => cambiar("nuevaVariante", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && b.nuevaVariante.trim() && !b.variantes.includes(b.nuevaVariante.trim())) {
                    e.preventDefault();
                    setB((x) => ({ ...x, variantes: [...x.variantes, x.nuevaVariante.trim()], nuevaVariante: "" }));
                  }
                }} />
            </div>
          </div>
        </>
      )}
      <div className="campo"><label htmlFor="e-rec">Recordatorio</label><input id="e-rec" type="time" value={b.recordatorio} onChange={(e) => cambiar("recordatorio", e.target.value)} /></div>

      <div className="item" style={{ marginTop: 6 }}>
        <div className="t"><div>Versión mínima</div><div className="chico">{tipo === "evitar" ? 'Un límite: si no lo evitás, ¿qué sería "dentro del límite"? Cuenta medio día.' : "Para los días flojos. Cuenta como hecho."}</div></div>
        <Interruptor on={b.minimaActiva} etiqueta="Versión mínima" alCambiar={() => cambiar("minimaActiva", !b.minimaActiva)} />
      </div>
      {b.minimaActiva && (
        <>
          <div className={`campo${falta(!b.minima.trim()) ? " error" : ""}`} style={falta(!b.minima.trim()) ? undefined : { borderColor: "var(--acento)" }}>
            <label htmlFor="e-minima" style={{ color: falta(!b.minima.trim()) ? undefined : "var(--acento)" }}>Límite mínimo · obligatorio</label>
            <input id="e-minima" value={b.minima} placeholder={tipo === "evitar" ? "Solo después de las 22" : tipo === "medir" ? "Al menos 1" : "Leer 1 página"} onChange={(e) => cambiar("minima", e.target.value)} />
          </div>
          {falta(!b.minima.trim()) && <div className="chico" style={{ color: "var(--mal)", marginTop: 4 }}>Escribí el límite para poder guardar.</div>}
        </>
      )}
      <div className="item">
        <div className="t"><div>Nunca fallar dos veces</div><div className="chico">Si un período no lo cumplís (día, semana o mes, según la frecuencia), el siguiente te lo recuerdo.</div></div>
        <Interruptor on={b.nuncaDosVeces} etiqueta="Nunca fallar dos veces" alCambiar={() => cambiar("nuncaDosVeces", !b.nuncaDosVeces)} />
      </div>
      <button className="chico" style={{ marginTop: 12 }} onClick={() => setMas(!mas)} aria-expanded={mas}>
        <Icono n={mas ? "expand_less" : "expand_more"} estilo={{ fontSize: 16 }} /> Más opciones: pregunta, notas
      </button>
      {mas && (
        <>
          <div className="campo"><label htmlFor="e-preg">Pregunta</label><input id="e-preg" value={b.pregunta} placeholder="¿Hiciste ejercicio hoy?" onChange={(e) => cambiar("pregunta", e.target.value)} /></div>
          <div className="campo"><label htmlFor="e-notas">Notas</label><textarea id="e-notas" rows={2} value={b.notas} onChange={(e) => cambiar("notas", e.target.value)} /></div>
        </>
      )}

      {habito && (
        <div style={{ marginTop: 22, borderTop: ".5px solid var(--linea2)", paddingTop: 6 }}>
          <button className="boton2" onClick={async () => { await archivar(habito.id); avisar(`${habito.nombre} archivado`); alTerminar(); }}>
            <Icono n="archive" estilo={{ fontSize: 17 }} /> Archivar hábito
          </button>
          <button className="boton2" style={{ color: "var(--mal)", borderColor: "#ff8a8055" }} onClick={() => setHoja("eliminar")}>
            <Icono n="delete" estilo={{ fontSize: 17 }} /> Eliminar hábito
          </button>
        </div>
      )}

      {hoja === "frecuencia" && <HojaFrecuencia inicial={b.frecuencia} cerrar={() => setHoja(null)} aplicar={(f) => { cambiar("frecuencia", f); setHoja(null); }} />}
      {hoja === "color" && (
        <Hoja cerrar={() => setHoja(null)}>
          <div style={{ fontSize: 16, marginBottom: 10 }}>Color</div>
          <div className="chips">
            {COLORES.map((c) => (
              <button key={c} aria-label={c} onClick={() => { cambiar("color", c); setHoja(null); }}
                style={{ width: 40, height: 40, borderRadius: "50%", background: c, outline: b.color === c ? "2px solid #fff" : undefined, outlineOffset: 2 }} />
            ))}
          </div>
        </Hoja>
      )}
      {hoja === "desde" && habito && (
        <Hoja cerrar={() => setHoja(null)}>
          <div style={{ fontSize: 16 }}>¿Desde cuándo aplica el cambio?</div>
          <div className="chico" style={{ margin: "4px 0 10px" }}>Hasta hoy, {habito.nombre} era {textoFrecuencia(habito.frecuencias[habito.frecuencias.length - 1].frecuencia, tipo).toLowerCase()}.</div>
          <button className="tarjeta" style={{ width: "100%", textAlign: "left", borderColor: "var(--acento)" }} onClick={() => guardar("hoy")}>
            <div>Desde hoy</div><div className="chico">El pasado se sigue midiendo con la frecuencia anterior. Tus estadísticas no cambian.</div>
          </button>
          <button className="tarjeta" style={{ width: "100%", textAlign: "left" }} onClick={() => guardar("todo")}>
            <div>Todo el historial</div><div className="chico">Recalcula todo como si siempre hubiera sido la nueva frecuencia.</div>
          </button>
        </Hoja>
      )}
      {hoja === "eliminar" && habito && (
        <ConfirmarEliminar h={habito} registros={datos.historiales.get(habito.id)?.size ?? 0} cerrar={() => setHoja(null)} alListo={alTerminar} avisar={avisar} />
      )}
    </>
  );
}

function Chips<T extends string>({ valor, opciones, alElegir }: { valor: T; opciones: readonly (readonly [T, string])[]; alElegir: (v: T) => void }) {
  return (
    <div className="chips">
      {opciones.map(([k, l]) => (
        <button key={k} className={`chip${valor === k ? " activo" : ""}`} aria-pressed={valor === k} onClick={() => alElegir(k)}>{l}</button>
      ))}
    </div>
  );
}

function Pasos({ valor, min, max, alCambiar }: { valor: number; min: number; max: number; alCambiar: (v: number) => void }) {
  return (
    <span className="pasos">
      <button aria-label="Menos" onClick={() => alCambiar(Math.max(min, valor - 1))}>−</button>
      <span>{valor}</span>
      <button aria-label="Más" onClick={() => alCambiar(Math.min(max, valor + 1))}>+</button>
    </span>
  );
}

type Clase = "dia" | "fijos" | "semana" | "mes" | "cada" | "nm";

/** Opción A: todas las formas de Loop más días fijos, con una frase que explica lo elegido. */
function HojaFrecuencia({ inicial, cerrar, aplicar }: { inicial: Frecuencia; cerrar: () => void; aplicar: (f: Frecuencia) => void }) {
  const claseInicial: Clase = inicial.dias ? "fijos" : inicial.den === 1 && inicial.num === 1 ? "dia" : inicial.den === 7 ? "semana" : inicial.den >= 28 && inicial.den <= 31 ? "mes" : inicial.num === 1 ? "cada" : "nm";
  const [clase, setClase] = useState<Clase>(claseInicial);
  const [v, setV] = useState({
    dias: inicial.dias ?? [0, 1, 2, 3, 4], semana: inicial.den === 7 && !inicial.dias ? inicial.num : 3, mes: inicial.den >= 28 ? inicial.num : 10,
    cada: claseInicial === "cada" ? inicial.den : 3, n: claseInicial === "nm" ? inicial.num : 3, m: claseInicial === "nm" ? inicial.den : 14,
  });
  const resultado = (): Frecuencia | null => {
    switch (clase) {
      case "dia": return { num: 1, den: 1 };
      case "fijos": return v.dias.length ? { num: v.dias.length, den: 7, dias: [...v.dias].sort() } : null;
      case "semana": return { num: v.semana, den: 7 };
      case "mes": return { num: v.mes, den: 30 };
      case "cada": return { num: 1, den: v.cada };
      case "nm": return { num: v.n, den: v.m };
    }
  };
  const frase = () => {
    if (clase === "dia") return "Todos los días. Un día sin marcar cuenta como no hecho.";
    if (clase === "fijos") {
      if (!v.dias.length) return "Elegí al menos un día.";
      const fuera = [0, 1, 2, 3, 4, 5, 6].filter((i) => !v.dias.includes(i)).map((i) => DIAS_LARGOS[i]);
      const resto = fuera.join(" y ");
      return `Solo ${[...v.dias].sort().map((i) => DIAS_LARGOS[i]).join(", ")}.${fuera.length ? ` ${resto[0].toUpperCase()}${resto.slice(1)} no ${fuera.length > 1 ? "cuentan" : "cuenta"} como fallo.` : ""}`;
    }
    if (clase === "semana") return `${v.semana} de cada 7 días, cualquiera. La semana va de lunes a domingo.`;
    if (clase === "mes") return `${v.mes} veces en el mes, cualquier día.`;
    if (clase === "cada") return `Una vez cada ${v.cada} días.`;
    return `${v.n} veces en cualquier período de ${v.m} días.`;
  };
  const opcion = (k: Clase, contenido: React.ReactNode) => (
    <div className="opcion" onClick={() => setClase(k)}>
      <span className={`radio${clase === k ? " on" : ""}`} role="radio" aria-checked={clase === k} />{contenido}
    </div>
  );
  const pasos = (k: "semana" | "mes" | "cada" | "n" | "m", min: number, max: number) => (
    <Pasos valor={v[k]} min={min} max={max} alCambiar={(x) => { setV({ ...v, [k]: x }); setClase(k === "n" || k === "m" ? "nm" : k); }} />
  );
  return (
    <Hoja cerrar={cerrar}>
      <div style={{ fontSize: 16, marginBottom: 4 }}>Frecuencia</div>
      {opcion("dia", "Todos los días")}
      {opcion("fijos", "Días fijos")}
      {clase === "fijos" && (
        <div style={{ display: "flex", gap: 5, padding: "4px 0 10px 28px" }}>
          {INICIALES.map((l, i) => (
            <button key={i} className={`dia-sem${v.dias.includes(i) ? " activo" : ""}`} aria-pressed={v.dias.includes(i)} aria-label={DIAS_LARGOS[i]}
              onClick={() => setV({ ...v, dias: v.dias.includes(i) ? v.dias.filter((x) => x !== i) : [...v.dias, i] })}>{l}</button>
          ))}
        </div>
      )}
      {opcion("semana", <>{pasos("semana", 1, 6)} veces por semana</>)}
      {opcion("mes", <>{pasos("mes", 1, 30)} veces al mes</>)}
      {opcion("cada", <>Cada {pasos("cada", 2, 30)} días</>)}
      {opcion("nm", <>{pasos("n", 1, 60)} veces en {pasos("m", 2, 90)} días</>)}
      <div style={{ background: "#0d0d0d", borderRadius: 8, padding: "9px 11px", marginTop: 12, fontSize: 12.5, color: "var(--tx2)" }}>{frase()}</div>
      <div style={{ textAlign: "right", marginTop: 12 }}>
        <button style={{ color: "var(--acento)", letterSpacing: ".5px" }} onClick={() => { const f = resultado(); if (f) aplicar(f); }}>LISTO</button>
      </div>
    </Hoja>
  );
}
