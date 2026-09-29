import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { Habito, Valor } from "../tipos";
import { DIAS_CORTOS, MESES_CORTOS, fechaCorta, lunes, sumarDias } from "../lib/fecha";

export const redondeo = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

interface PropsBarras {
  valores: number[];
  etiquetas: string[];
  /** Encima de cada barra, en gris (días libres). */
  apiladas?: number[];
  /** Línea punteada: un número o uno por barra. */
  meta?: number | number[];
  color: string;
  alto?: number;
  formato?: (v: number, i: number) => string;
  /** Qué barras van con color pleno; por defecto, las que llegan a la meta. */
  destacada?: (i: number) => boolean;
  /** Ancho en píxeles para gráficos que se desplazan; sin él, ocupa el ancho disponible. */
  ancho?: number;
}

/** Barras con el número arriba de cada una y, si hay, la línea de meta. */
export function Barras({ valores, etiquetas, apiladas, meta, color, alto = 132, formato = redondeo, destacada, ancho }: PropsBarras) {
  const W = ancho ?? 340, arriba = 18, abajo = 20, n = valores.length, cw = W / n, bw = Math.min(22, cw * 0.62);
  const tot = valores.map((v, i) => v + (apiladas?.[i] ?? 0));
  const metaMax = Array.isArray(meta) ? Math.max(...meta) : meta ?? 0;
  const max = Math.max(1, ...tot, metaMax) * 1.08;
  const y = (v: number) => arriba + (alto - arriba - abajo) * (1 - v / max);
  const metaDe = (i: number) => (Array.isArray(meta) ? meta[i] : meta);
  let camino = "";
  if (Array.isArray(meta)) meta.forEach((m, i) => { camino += `${i ? "L" : "M"}${i * cw} ${y(m)}H${(i + 1) * cw}`; });
  return (
    <svg viewBox={`0 0 ${W} ${alto}`} width={ancho ?? "100%"} height={ancho ? alto : undefined} role="img" aria-label="Gráfico de barras" style={{ display: "block" }}>
      {valores.map((v, i) => {
        const x = i * cw + (cw - bw) / 2;
        const m = metaDe(i);
        const pleno = destacada ? destacada(i) : m == null || tot[i] >= m - 1e-9;
        const extra = apiladas?.[i] ?? 0;
        return (
          <g key={i}>
            {v > 0 && <rect x={x} y={y(v)} width={bw} height={y(0) - y(v)} rx={3} fill={pleno ? color : color + "66"} />}
            {extra > 0 && <rect x={x} y={y(tot[i])} width={bw} height={y(v) - y(tot[i])} rx={3} fill="#4a4a4a" />}
            <text x={x + bw / 2} y={y(tot[i]) - 5} textAnchor="middle" fontSize={10} fill="#e8e8e8">{formato(v, i)}</text>
            <text x={x + bw / 2} y={alto - 5} textAnchor="middle" fontSize={9.5} fill="#8a8a8a">{etiquetas[i]}</text>
          </g>
        );
      })}
      {Array.isArray(meta) && <path d={camino} fill="none" stroke="#ffd54f" strokeDasharray="4 3" strokeWidth={1.2} />}
      {typeof meta === "number" && <line x1={0} x2={W} y1={y(meta)} y2={y(meta)} stroke="#ffd54f" strokeDasharray="4 3" strokeWidth={1.2} />}
    </svg>
  );
}

interface Serie { valores: (number | null)[]; color: string; etiqueta?: string; grosor?: number; puntos?: boolean; punteada?: boolean }

/** Líneas con eje ajustado y etiqueta al final de cada serie. */
export function Lineas({ series, etiquetas, min = 0, max, alto = 140, margenDerecho = 38, ancho, ejeDerecha }: { series: Serie[]; etiquetas: string[]; min?: number; max?: number; alto?: number; margenDerecho?: number; ancho?: number; ejeDerecha?: boolean }) {
  // Con el eje a la derecha (gráficos que se desplazan y arrancan en lo más reciente), los números quedan a la vista.
  const W = ancho ?? 340, arriba = 14, abajo = 20, izq = ejeDerecha ? 8 : 24, der = W - (ejeDerecha ? 28 : margenDerecho);
  const todos = series.flatMap((s) => s.valores.filter((v): v is number => v != null));
  const mx = max ?? Math.max(1, ...todos) * 1.05;
  const n = etiquetas.length;
  const x = (i: number) => izq + (der - izq) * (n === 1 ? 0 : i / (n - 1));
  const y = (v: number) => arriba + (alto - arriba - abajo) * (1 - (v - min) / (mx - min || 1));
  return (
    <svg viewBox={`0 0 ${W} ${alto}`} width={ancho ?? "100%"} height={ancho ? alto : undefined} role="img" aria-label="Gráfico de líneas" style={{ display: "block" }}>
      {[min, (min + mx) / 2, mx].map((t) => (
        <g key={t}>
          <line x1={izq} x2={der} y1={y(t)} y2={y(t)} stroke="#1f1f1f" />
          <text x={ejeDerecha ? W - 2 : 0} y={y(t) + 3} fontSize={9} fill="#6e6e6e" textAnchor={ejeDerecha ? "end" : "start"}>{Math.round(t)}</text>
        </g>
      ))}
      {etiquetas.map((l, i) => l && <text key={i} x={x(i)} y={alto - 5} textAnchor="middle" fontSize={9.5} fill="#8a8a8a">{l}</text>)}
      {series.map((s, k) => {
        const pts = s.valores.map((v, i) => (v == null ? null : [x(i), y(v)] as const)).filter((p): p is readonly [number, number] => !!p);
        if (!pts.length) return null;
        const ult = pts[pts.length - 1];
        return (
          <g key={k}>
            <polyline fill="none" stroke={s.color} strokeWidth={s.grosor ?? 2} strokeDasharray={s.punteada ? "4 3" : undefined} points={pts.map((p) => p.join(",")).join(" ")} />
            {s.puntos && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.3} fill={s.color} />)}
            {s.etiqueta && <text x={ult[0] + 5} y={ult[1] + 3} fontSize={10} fill={s.color}>{s.etiqueta}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function AnilloPuntuacion({ valor, color }: { valor: number; color: string }) {
  const c = 2 * Math.PI * 26;
  return (
    <svg width={62} height={62} viewBox="0 0 64 64" role="img" aria-label={`Puntuación ${valor}`}>
      <circle cx={32} cy={32} r={26} fill="none" stroke="#1f1f1f" strokeWidth={7} />
      <circle cx={32} cy={32} r={26} fill="none" stroke={color} strokeWidth={7} strokeDasharray={`${(valor / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
      <text x={32} y={37} textAnchor="middle" fill="#e8e8e8" fontSize={16}>{valor}</text>
    </svg>
  );
}

const muestra = (fondo: string) => <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: fondo, verticalAlign: -1, marginRight: 4 }} />;

/** Calendario como el de Loop: semanas en columnas, número de día en cada celda. */
export function Calendario({ h, valor, hoy, semanas = 14, alTocar, alMantener }: {
  h: Habito; valor: (d: string) => Valor | undefined; hoy: string; semanas?: number;
  alTocar: (d: string) => void; alMantener: (d: string) => void;
}) {
  const inicio = sumarDias(lunes(hoy), -7 * (semanas - 1));
  const c = h.color;
  const fondo = (v: Valor | undefined) =>
    v === "hecho" ? c : v === "minima" ? `linear-gradient(90deg, ${c} 50%, #1e1e1e 50%)` : v === "libre" ? `repeating-linear-gradient(45deg, ${c}66 0 3px, #0d0d0d 3px 6px)` : "#1e1e1e";
  let timer: number | undefined;
  let mantuvo = false;
  const cols = Array.from({ length: semanas }, (_, w) => sumarDias(inicio, 7 * w));
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${semanas}, ${semanas > 14 ? "21px" : "1fr"}) 28px`, gap: 3, fontSize: 10, width: semanas > 14 ? semanas * 24 + 28 : undefined }}>
        {cols.map((l, w) => {
          let etiqueta = "";
          for (let k = 0; k < 7; k++) { const d = sumarDias(l, k); if (+d.slice(8) === 1 || (w === 0 && k === 0)) etiqueta = MESES_CORTOS[+d.slice(5, 7) - 1]; }
          return <span key={l} style={{ color: "var(--mu)", height: 14, whiteSpace: "nowrap" }}>{etiqueta}</span>;
        })}
        <span />
        {Array.from({ length: 7 }, (_, k) => (
          <div key={k} style={{ display: "contents" }}>
            {cols.map((l) => {
              const d = sumarDias(l, k);
              if (d > hoy) return <span key={d} />;
              const v = valor(d);
              return (
                <button key={d} aria-label={fechaCorta(d)}
                  onPointerDown={() => { mantuvo = false; timer = window.setTimeout(() => { mantuvo = true; alMantener(d); }, 450); }}
                  onPointerUp={() => window.clearTimeout(timer)} onPointerCancel={() => window.clearTimeout(timer)}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => { if (!mantuvo) alTocar(d); }}
                  style={{ aspectRatio: "1", borderRadius: 4, background: fondo(v), color: v === "hecho" ? "#000" : "#9a9a9a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, userSelect: "none", outline: d === hoy ? "1.5px solid #e8e8e8" : undefined }}>
                  {+d.slice(8)}
                </button>
              );
            })}
            <span style={{ color: "var(--mu)", alignSelf: "center" }}>{DIAS_CORTOS[k]}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 10.5, color: "var(--mu)", marginTop: 8 }}>
        <span>{muestra(c)}hecho</span>
        <span>{muestra(`linear-gradient(90deg, ${c} 50%, #1e1e1e 50%)`)}mínima</span>
        <span>{muestra(`repeating-linear-gradient(45deg, ${c}66 0 3px, #0d0d0d 3px 6px)`)}día libre</span>
        <span>{muestra("#1e1e1e")}no</span>
      </div>
    </>
  );
}

/** Frecuencia (como Loop): un punto por día de la semana y mes, más grande cuantas más veces. */
export function FrecuenciaPuntos({ datos, color }: { datos: { mes: string; veces: number[] }[]; color: string }) {
  const W = 340, izq = 6, der = W - 30, cw = (der - izq) / datos.length, rh = 22, H = 7 * rh + 22;
  const max = Math.max(1, ...datos.flatMap((d) => d.veces));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Frecuencia por día de la semana y mes">
      {Array.from({ length: 7 }, (_, k) => (
        <g key={k}>
          <line x1={izq} x2={der} y1={k * rh + rh / 2} y2={k * rh + rh / 2} stroke="#161616" />
          <text x={der + 6} y={k * rh + rh / 2 + 3} fontSize={9.5} fill="#8a8a8a">{DIAS_CORTOS[k]}</text>
          {datos.map((m, i) => m.veces[k] > 0 && (
            <circle key={m.mes} cx={izq + cw * i + cw / 2} cy={k * rh + rh / 2} r={2 + (m.veces[k] / max) * 6.5} fill={color} opacity={0.45 + (0.55 * m.veces[k]) / max}>
              <title>{`${m.veces[k]} ${DIAS_CORTOS[k]} en ${MESES_CORTOS[+m.mes.slice(5) - 1]}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {datos.map((m, i) => <text key={m.mes} x={izq + cw * i + cw / 2} y={H - 4} textAnchor="middle" fontSize={9.5} fill="#8a8a8a">{MESES_CORTOS[+m.mes.slice(5) - 1]}</text>)}
    </svg>
  );
}


/**
 * Contenedor que se desplaza hacia los costados. Arranca mostrando el final (lo más reciente);
 * arrastrando hacia la derecha se ve el pasado. `clave` vuelve a llevarlo al final cuando cambia la escala.
 */
export function Desplazable({ children, clave }: { children: ReactNode; clave: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; inicio: number; movio: boolean } | null>(null);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth; }, [clave]);
  // Con el dedo el desplazamiento es nativo. Con el mouse se arrastra a mano; un clic sin moverse sigue funcionando.
  return (
    <div ref={ref} className="desplazable"
      onPointerDown={(e) => { if (e.pointerType === "mouse" && ref.current) arrastre.current = { x: e.clientX, inicio: ref.current.scrollLeft, movio: false }; }}
      onPointerMove={(e) => {
        const a = arrastre.current;
        if (!a || !ref.current) return;
        if (!a.movio && Math.abs(e.clientX - a.x) > 5) { a.movio = true; ref.current.setPointerCapture(e.pointerId); }
        if (a.movio) ref.current.scrollLeft = a.inicio - (e.clientX - a.x);
      }}
      onPointerUp={() => { window.setTimeout(() => { arrastre.current = null; }); }}
      onPointerCancel={() => { arrastre.current = null; }}
      onClickCapture={(e) => { if (arrastre.current?.movio) { e.stopPropagation(); e.preventDefault(); } }}>
      {children}
    </div>
  );
}

/** Selector de escala (Día, Semana, Mes…), como el de Loop. */
export function SelectorEscala<T extends string>({ valor, opciones, alCambiar }: { valor: T; opciones: [T, string][]; alCambiar: (v: T) => void }) {
  return (
    <div className="escalas" role="tablist">
      {opciones.map(([k, l]) => <button key={k} role="tab" aria-selected={valor === k} className={valor === k ? "activo" : ""} onClick={() => alCambiar(k)}>{l}</button>)}
    </div>
  );
}
