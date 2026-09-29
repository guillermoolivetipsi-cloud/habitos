import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { Habito, Valor } from "../tipos";

export const Icono = ({ n, estilo }: { n: string; estilo?: CSSProperties }) => (
  <span className="material-symbols-outlined" aria-hidden="true" style={estilo}>{n}</span>
);

/** Aspecto del círculo según el valor del día. */
function estiloCirculo(color: string, v: Valor | undefined): { estilo: CSSProperties; hecho: boolean } {
  if (v === "hecho") return { estilo: { background: color + "40", borderColor: color + "90" }, hecho: true };
  if (v === "minima") return { estilo: { background: `linear-gradient(90deg, ${color}66 50%, transparent 50%)`, borderColor: color + "90" }, hecho: false };
  if (v === "libre") return { estilo: { background: `repeating-linear-gradient(45deg, ${color}40 0 3px, transparent 3px 6px)`, borderColor: color + "55" }, hecho: false };
  return { estilo: {}, hecho: false };
}

interface PropsCirculo {
  h: Habito;
  valor: Valor | undefined;
  variante?: string;
  chico?: boolean;
  esHoy?: boolean;
  /** Vista Semana: solo el tilde, sin círculo. Día libre = tilde tenue; sin marcar = punto tenue. */
  soloTilde?: boolean;
  etiqueta: string;
  alTocar: () => void;
  alMantener: () => void;
}

/** Toque: marca o desmarca. Mantener 450 ms: día libre. */
export function Circulo({ h, valor, variante, chico, esHoy, soloTilde, etiqueta, alTocar, alMantener }: PropsCirculo) {
  const t = useRef<number | undefined>(undefined);
  const mantuvo = useRef(false);
  const inicio = useRef<[number, number] | null>(null);
  const { estilo, hecho } = estiloCirculo(h.color, valor);
  const cancelar = () => { window.clearTimeout(t.current); inicio.current = null; };
  return (
    <button
      className={soloTilde ? "marca" : `circulo${chico ? " chico-c" : ""}${esHoy ? " hoy" : ""}`}
      style={soloTilde ? undefined : estilo}
      aria-label={etiqueta}
      onPointerDown={(e) => {
        mantuvo.current = false;
        inicio.current = [e.clientX, e.clientY];
        t.current = window.setTimeout(() => {
          mantuvo.current = true;
          navigator.vibrate?.(15);
          alMantener();
        }, 450);
      }}
      onPointerMove={(e) => {
        if (inicio.current && Math.hypot(e.clientX - inicio.current[0], e.clientY - inicio.current[1]) > 10) cancelar();
      }}
      onPointerUp={cancelar}
      onPointerCancel={cancelar}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (mantuvo.current) { mantuvo.current = false; return; }
        alTocar();
      }}
    >
      {soloTilde ? marcaTilde(h.color, valor, variante, !!esHoy)
        : hecho && variante ? <b style={{ fontWeight: 500, color: h.color }}>{variante[0]}</b> : hecho ? <Icono n="check" estilo={{ color: h.color }} /> : null}
    </button>
  );
}

function marcaTilde(color: string, v: Valor | undefined, variante: string | undefined, esHoy: boolean) {
  if (v === "hecho" && variante) return <b style={{ fontWeight: 500, fontSize: 15, color }}>{variante[0]}</b>;
  if (v === "hecho") return <Icono n="check" estilo={{ color, fontSize: 20 }} />;
  if (v === "minima") return <Icono n="check" estilo={{ color, fontSize: 20, opacity: 0.65 }} />;
  if (v === "libre") return <Icono n="check" estilo={{ color, fontSize: 20, opacity: 0.38 }} />;
  // Sin marcar: una ✕ gris, como Loop, para que la grilla se vea pareja.
  return <span className={`material-symbols-outlined cruz-vacia${esHoy ? " hoy" : ""}`} aria-hidden="true">close</span>;
}

export const Interruptor = ({ on, etiqueta, alCambiar }: { on: boolean; etiqueta: string; alCambiar: () => void }) => (
  <button className={`interruptor${on ? " on" : ""}`} role="switch" aria-checked={on} aria-label={etiqueta} onClick={alCambiar} />
);

export const Barra = ({ titulo, children, izquierda }: { titulo: ReactNode; children?: ReactNode; izquierda?: ReactNode }) => (
  <div className="barra">{izquierda}<h1>{titulo}</h1>{children}</div>
);

/** Hoja que sube desde abajo. Tocar afuera la cierra. */
/** Hojas abiertas, la de más arriba al final: el botón atrás de Android cierra esa antes que la pantalla. */
const hojasAbiertas: { cerrar: () => void }[] = [];
export function cerrarHojaDeArriba(): boolean {
  const h = hojasAbiertas[hojasAbiertas.length - 1];
  if (!h) return false;
  h.cerrar();
  return true;
}

export function Hoja({ children, cerrar }: { children: ReactNode; cerrar: () => void }) {
  const ultima = useRef(cerrar);
  ultima.current = cerrar;
  useEffect(() => {
    const h = { cerrar: () => ultima.current() };
    hojasAbiertas.push(h);
    return () => { const i = hojasAbiertas.indexOf(h); if (i >= 0) hojasAbiertas.splice(i, 1); };
  }, []);
  return (
    <div className="velo" onClick={cerrar}>
      <div className="hoja" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="agarre" />
        {children}
      </div>
    </div>
  );
}

/** Recordatorio de un hábito: apagado o a una hora. Se usa en el editor y en el detalle. */
export function CampoRecordatorio({ valor, alCambiar }: { valor: string | null; alCambiar: (v: string | null) => void }) {
  const encendido = valor != null;
  return (
    <div className="campo">
      <label>Recordatorio</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Icono n={encendido ? "notifications_active" : "notifications_off"} estilo={{ color: encendido ? "var(--acento)" : "var(--dim)" }} />
        <div style={{ flex: 1 }}>{encendido ? "Todos los días que toca, a las" : "Apagado"}</div>
        <Interruptor on={encendido} etiqueta="Recordatorio" alCambiar={() => alCambiar(encendido ? null : "20:00")} />
      </div>
      {encendido && (
        <input aria-label="Hora del recordatorio" type="time" value={valor} onChange={(e) => e.target.value && alCambiar(e.target.value)}
          style={{ fontSize: 26, marginTop: 10, padding: "6px 10px", border: "1px solid var(--linea2)", borderRadius: 8, width: "auto" }} />
      )}
    </div>
  );
}
