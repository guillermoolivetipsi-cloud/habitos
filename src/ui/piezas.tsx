import { useRef, type CSSProperties, type ReactNode } from "react";
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
  etiqueta: string;
  alTocar: () => void;
  alMantener: () => void;
}

/** Toque: marca o desmarca. Mantener 450 ms: día libre. */
export function Circulo({ h, valor, variante, chico, esHoy, etiqueta, alTocar, alMantener }: PropsCirculo) {
  const t = useRef<number | undefined>(undefined);
  const mantuvo = useRef(false);
  const inicio = useRef<[number, number] | null>(null);
  const { estilo, hecho } = estiloCirculo(h.color, valor);
  const cancelar = () => { window.clearTimeout(t.current); inicio.current = null; };
  return (
    <button
      className={`circulo${chico ? " chico-c" : ""}${esHoy ? " hoy" : ""}`}
      style={estilo}
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
      {hecho && variante ? <b style={{ fontWeight: 500, color: h.color }}>{variante[0]}</b> : hecho ? <Icono n="check" estilo={{ color: h.color }} /> : null}
    </button>
  );
}

export const Interruptor = ({ on, etiqueta, alCambiar }: { on: boolean; etiqueta: string; alCambiar: () => void }) => (
  <button className={`interruptor${on ? " on" : ""}`} role="switch" aria-checked={on} aria-label={etiqueta} onClick={alCambiar} />
);

export const Barra = ({ titulo, children, izquierda }: { titulo: ReactNode; children?: ReactNode; izquierda?: ReactNode }) => (
  <div className="barra">{izquierda}<h1>{titulo}</h1>{children}</div>
);

/** Hoja que sube desde abajo. Tocar afuera la cierra. */
export function Hoja({ children, cerrar }: { children: ReactNode; cerrar: () => void }) {
  return (
    <div className="velo" onClick={cerrar}>
      <div className="hoja" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="agarre" />
        {children}
      </div>
    </div>
  );
}
