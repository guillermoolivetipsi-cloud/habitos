import { useState } from "react";
import type { Datos } from "../datos";
import type { Preferencias } from "../db";
import { alternarLibre, cambiarValor, elegirVariante, tocar } from "../lib/acciones";
import {
  diasSinSeguidos, esperado, fallaAnterior, pausaActiva, hechoEnSemana, metaSemana, patronDelDia, sumar, unidad, valorEn,
  type Historial, type Opciones,
} from "../lib/calculos";
import { DIAS_CORTOS, DIAS_LARGOS, DIAS_PLURAL, INICIALES, diaSemana, diasEntre, fechaCorta, mesDe, primerDia, sumarDias } from "../lib/fecha";
import type { Dia, Habito } from "../tipos";
import { Barra, Circulo, Icono } from "../ui/piezas";

export const MOMENTOS: [Habito["momento"], string][] = [["manana", "Mañana"], ["dia", "Durante el día"], ["noche", "Noche"], ["todo", "Todo el día"]];

interface Props {
  datos: Datos;
  hoy: Dia;
  avisar: (contenido: React.ReactNode, ms?: number) => void;
  abrirDetalle: (h: Habito) => void;
  irAImportar: () => void;
  nuevo: () => void;
}

function grupos(habitos: Habito[], p: Preferencias): [string, Habito[]][] {
  if (p.agrupar === "area") {
    const areas = [...new Set(habitos.map((h) => h.area || "Sin área"))];
    return areas.map((a) => [a, habitos.filter((h) => (h.area || "Sin área") === a)]);
  }
  return MOMENTOS.map(([k, l]) => [l, habitos.filter((h) => h.momento === k)] as [string, Habito[]]);
}

export default function Hoy({ datos, hoy, avisar, abrirDetalle, irAImportar, nuevo }: Props) {
  const [modo, setModo] = useState<"hoy" | "semana">("hoy");
  const { habitos, prefs, cargando } = datos;
  if (cargando) return null;
  if (!habitos.length)
    return (
      <>
        <Barra titulo="Hoy" />
        <div className="tarjeta" style={{ marginTop: 20 }}>
          <div style={{ fontSize: 16 }}>Traé tus hábitos de Loop</div>
          <div className="mu" style={{ marginTop: 4 }}>Importá la exportación CSV de Loop y seguís con todo tu historial.</div>
          <button className="boton" onClick={irAImportar}>Importar desde Loop</button>
          <button className="boton2" onClick={nuevo}>Crear un hábito</button>
        </div>
      </>
    );
  const selector = (
    <div className="selector" role="tablist">
      <button role="tab" aria-selected={modo === "hoy"} className={modo === "hoy" ? "activo" : ""} onClick={() => setModo("hoy")}>Hoy</button>
      <button role="tab" aria-selected={modo === "semana"} className={modo === "semana" ? "activo" : ""} onClick={() => setModo("semana")}>Semana</button>
    </div>
  );
  const op: Opciones = { libresCumplen: prefs.libresCumplen };
  const marcar = async (h: Habito, d: Dia) => {
    const r = await tocar(h, d);
    if (r !== "marcado" || (!h.variantes.length && !h.minima)) return;
    const reg = datos.historiales.get(h.id)?.get(d);
    avisar(
      <OpcionesRapidas h={h} dia={d} varianteInicial={reg?.variante} avisar={avisar} />,
      4500,
    );
  };
  const mantener = async (h: Habito, d: Dia) => {
    const puesto = await alternarLibre(h, d);
    avisar(`${h.nombre}: ${puesto ? `día libre el ${DIAS_CORTOS[diaSemana(d)]} ${fechaCorta(d)}` : "día libre quitado"}`, 1800);
  };
  return modo === "hoy"
    ? <VistaHoy {...{ datos, hoy, op, selector, marcar, mantener, abrirDetalle, nuevo }} />
    : <VistaSemana {...{ datos, hoy, op, selector, marcar, mantener, abrirDetalle }} />;
}

function OpcionesRapidas({ h, dia, varianteInicial, avisar }: { h: Habito; dia: Dia; varianteInicial?: string; avisar: Props["avisar"] }) {
  const [v, setV] = useState(varianteInicial);
  return (
    <div>
      <div className="chico" style={{ marginBottom: 6 }}>{h.nombre} · marcado</div>
      <div className="chips">
        {h.variantes.map((x) => (
          <button key={x} className={`chip${x === v ? " activo" : ""}`} onClick={async () => { setV(x); await elegirVariante(h, dia, x); }}>{x}</button>
        ))}
        {h.minima && (
          <button className="chip" onClick={async () => { await cambiarValor(h, dia, "minima"); avisar(`${h.nombre}: ${h.tipo === "evitar" ? "dentro del límite" : "versión mínima"} · ${h.minima}`, 2200); }}>
            {h.tipo === "evitar" ? "Dentro del límite" : "Fue la mínima"}
          </button>
        )}
      </div>
    </div>
  );
}

interface PropsVista {
  datos: Datos;
  hoy: Dia;
  op: Opciones;
  selector: React.ReactNode;
  marcar: (h: Habito, d: Dia) => void;
  mantener: (h: Habito, d: Dia) => void;
  abrirDetalle: (h: Habito) => void;
  nuevo?: () => void;
}

function Subtitulo({ h, hist, d, op, patrones }: { h: Habito; hist: Historial; d: Dia; op: Opciones; patrones: boolean }) {
  const partes: string[] = [];
  if (h.despuesDe) partes.push(`después de ${h.despuesDe}`);
  if (h.tipo === "evitar") {
    const inicio = primerDia(mesDe(d));
    partes.push(`${diasSinSeguidos(hist, d)} días sin`);
    if (d > inicio) partes.push(`mes: ${Math.round(sumar(h, hist, inicio, sumarDias(d, -1), op, true) * 10) / 10} de ${diasEntre(inicio, d)}`);
  } else if (unidad(h, d) === "semana") partes.push(`semana ${Math.round(hechoEnSemana(h, hist, d, op))} de ${metaSemana(h, d)}`);
  // En pausa no se muestran patrones ni "ayer no": ese día no cuenta.
  const enPausa = !!hist.get(d)?.porPausa;
  const p = patrones && !enPausa ? patronDelDia(h, hist, d) : null;
  const falla = enPausa ? null : fallaAnterior(h, hist, d, op);
  return (
    <>
      {partes.length > 0 && <div className="chico">{partes.join(" · ")}</div>}
      {p && <div className="nota" style={{ color: "var(--patron)" }}><Icono n="event" /> los {DIAS_PLURAL[p.dia]} {p.tasa}% · el resto {p.resto}%</div>}
      {falla && <div className="nota" style={{ color: "var(--aviso)" }}><Icono n="undo" /> {falla}</div>}
    </>
  );
}

function VistaHoy({ datos, hoy, op, selector, marcar, mantener, abrirDetalle, nuevo }: PropsVista) {
  const [desfase, setDesfase] = useState(0);
  const [hechosAbiertos, setHechosAbiertos] = useState(false);
  const d = sumarDias(hoy, desfase);
  const { habitos, historiales, prefs } = datos;
  const hist = (h: Habito) => historiales.get(h.id)!;
  // Los días libres puestos por una pausa no cuentan como hechos: el hábito sigue en la lista para poder marcarlo.
  const hechos = habitos.filter((h) => { const r = hist(h).get(d); return r && !r.porPausa; });
  const pendientes = habitos.filter((h) => !hechos.includes(h));
  const cumplidos = pendientes.filter((h) => unidad(h, d) === "semana" && hechoEnSemana(h, hist(h), d, op) >= metaSemana(h, d));
  const resto = pendientes.filter((h) => !cumplidos.includes(h));
  const titulo = desfase === 0 ? "Hoy" : desfase === -1 ? "Ayer" : DIAS_LARGOS[diaSemana(d)][0].toUpperCase() + DIAS_LARGOS[diaSemana(d)].slice(1);
  const fila = (h: Habito, atenuada = false) => (
    <div className="fila" key={h.id} style={atenuada ? { opacity: 0.75 } : undefined}>
      <span className="punto" style={{ background: h.color }} />
      <button className="nombre" onClick={() => abrirDetalle(h)}>
        <div style={{ color: h.color }}>{h.nombre}</div>
        <Subtitulo h={h} hist={hist(h)} d={d} op={op} patrones={prefs.patrones && desfase > -7} />
      </button>
      <Circulo h={h} valor={valorEn(hist(h), d)} variante={hist(h).get(d)?.variante} etiqueta={`Marcar ${h.nombre}`} alTocar={() => marcar(h, d)} alMantener={() => mantener(h, d)} />
    </div>
  );
  return (
    <>
      <Barra
        titulo={titulo}
        izquierda={<button className="icono-btn" aria-label="Día anterior" onClick={() => setDesfase(desfase - 1)}><Icono n="chevron_left" /></button>}
      >
        {desfase < 0 && <button className="icono-btn" aria-label="Día siguiente" onClick={() => setDesfase(desfase + 1)}><Icono n="chevron_right" /></button>}
        <span className="mu">{DIAS_CORTOS[diaSemana(d)]} {fechaCorta(d)}</span>
        <button className="icono-btn" aria-label="Nuevo hábito" onClick={nuevo}><Icono n="add" /></button>
      </Barra>
      {selector}
      {(() => {
        const pausa = pausaActiva(prefs.pausas, d);
        return pausa && <div className="aviso amarillo"><Icono n="pause_circle" /> En pausa hasta el {fechaCorta(pausa.hasta)}{pausa.motivo ? ` · ${pausa.motivo}` : ""}. Nada cuenta como fallo.</div>;
      })()}
      {desfase < 0 && (
        <div className="aviso acento"><Icono n="history" /> Editando un día pasado · <button style={{ textDecoration: "underline" }} onClick={() => setDesfase(0)}>volver a hoy</button></div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 2px" }}>
        <div className="progreso"><i style={{ width: `${(100 * hechos.length) / habitos.length}%` }} /></div>
        <span className="chico">{hechos.length} de {habitos.length}</span>
      </div>
      {hechos.length === habitos.length && (
        <div style={{ textAlign: "center", padding: "26px 0 8px" }}>
          <Icono n="task_alt" estilo={{ fontSize: 40, color: "var(--acento)" }} />
          <div style={{ fontSize: 15, marginTop: 6 }}>Día completo</div>
        </div>
      )}
      {grupos(resto, prefs).map(([nombre, hs]) => hs.length > 0 && (
        <section key={nombre}><div className="grupo">{nombre}</div>{hs.map((h) => fila(h))}</section>
      ))}
      {cumplidos.length > 0 && <section><div className="grupo">Semana ya cumplida</div>{cumplidos.map((h) => fila(h, true))}</section>}
      {hechos.length > 0 && (
        <section>
          <div className="grupo">
            <button onClick={() => setHechosAbiertos(!hechosAbiertos)} aria-expanded={hechosAbiertos}>
              Hechos · {hechos.length} <Icono n={hechosAbiertos ? "expand_less" : "expand_more"} estilo={{ fontSize: 16 }} />
            </button>
          </div>
          {hechosAbiertos ? hechos.map((h) => fila(h)) : <div className="chico" style={{ padding: "6px 0" }}>{hechos.map((h) => h.nombre).join(" · ")}</div>}
        </section>
      )}
    </>
  );
}

function VistaSemana({ datos, hoy, op, selector, marcar, mantener, abrirDetalle }: PropsVista) {
  const [desfase, setDesfase] = useState(0);
  const { habitos, historiales, prefs } = datos;
  const fin = sumarDias(hoy, 7 * desfase);
  const inicio = sumarDias(fin, -6);
  const lista = habitos.filter((h) => h.tipo !== "medir");
  const ds = [0, 1, 2, 3, 4, 5, 6].map((i) => sumarDias(fin, -i));
  const orden = prefs.invertirSemana ? [...ds].reverse() : ds;
  let hecho = 0, meta = 0;
  for (const h of lista) { hecho += sumar(h, historiales.get(h.id)!, inicio, fin, op); meta += esperado(h, inicio, fin); }
  return (
    <>
      <Barra
        titulo={<span style={{ display: "block", textAlign: "center" }}>{desfase === 0 ? "Últimos 7 días" : `${fechaCorta(inicio)} – ${fechaCorta(fin)}`}</span>}
        izquierda={<button className="icono-btn" aria-label="7 días anteriores" onClick={() => setDesfase(desfase - 1)}><Icono n="chevron_left" /></button>}
      >
        <button className="icono-btn" aria-label="7 días siguientes" disabled={desfase >= 0} onClick={() => setDesfase(desfase + 1)}><Icono n="chevron_right" /></button>
      </Barra>
      {selector}
      <div className="chico" style={{ textAlign: "right", marginBottom: 4 }}>{Math.round(hecho)} de {Math.round(meta)}</div>
      <div className="semana">
        <span />
        {orden.map((d) => <span key={d} className={`cab${d === hoy ? " hoy" : ""}`}>{INICIALES[diaSemana(d)]}<br />{+d.slice(8)}</span>)}
        <span />
        {grupos(lista, prefs).map(([nombre, hs]) => hs.length > 0 && (
          <div className="fila-s" key={nombre}>
            <div className="grupo g" style={{ margin: "10px 0 0" }}>{nombre}</div>
            {hs.map((h) => {
              const hist = historiales.get(h.id)!;
              const x = sumar(h, hist, inicio, fin, op);
              const m = Math.round(esperado(h, inicio, fin));
              const cumple = h.tipo !== "evitar" && x >= m;
              return (
                <div className="fila-s" key={h.id}>
                  <button className="n" style={{ color: h.color }} onClick={() => abrirDetalle(h)}><span>{h.nombre}</span></button>
                  {orden.map((d) => (
                    <span className="c" key={d}>
                      {d > hoy ? null : (
                        <Circulo chico esHoy={d === hoy} h={h} valor={valorEn(hist, d)} variante={hist.get(d)?.variante}
                          etiqueta={`${h.nombre} ${fechaCorta(d)}`} alTocar={() => marcar(h, d)} alMantener={() => mantener(h, d)} />
                      )}
                    </span>
                  ))}
                  <span className="p" style={cumple ? { color: h.color } : undefined}>
                    {h.tipo === "evitar" ? `${Math.round(sumar(h, hist, inicio, fin, op, true) * 10) / 10}d` : `${Math.round(x)}/${m}`}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="chico" style={{ marginTop: 12 }}>Hoy es la primera columna. Tocá para marcar o desmarcar; mantené presionado para día libre.</p>
    </>
  );
}

