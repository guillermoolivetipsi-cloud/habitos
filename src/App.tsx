import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDatos } from "./datos";
import { buscarActualizacion, descargar, type Actualizacion } from "./lib/actualizacion";
import { copiaAutomatica } from "./lib/copia";
import { escucharAcciones, programarAvisos } from "./lib/notificaciones";
import { planificarAvisos } from "./lib/recordatorios";
import { hoy as calcularHoy } from "./lib/fecha";
import Ajustes, { type SubAjustes } from "./pantallas/Ajustes";
import Detalle from "./pantallas/Detalle";
import Editor from "./pantallas/Editor";
import Cierre from "./pantallas/Cierre";
import Hoy from "./pantallas/Hoy";
import Objetivos, { DetalleObjetivo, FormObjetivo, type NuevoObjetivo } from "./pantallas/Objetivos";
import Revision, { type Cierre as TipoCierre } from "./pantallas/Revision";
import type { Habito } from "./tipos";
import { Icono } from "./ui/piezas";

type Encima = { tipo: "detalle"; id: string } | { tipo: "editor"; id?: string } | { tipo: "cierre"; cierre: TipoCierre } | { tipo: "objetivo"; id: string } | { tipo: "formObjetivo"; nuevo: NuevoObjetivo; id?: string };
const claveEncima = (e?: Encima) => (!e ? "" : e.tipo === "cierre" ? `cierre${e.cierre.periodo}${e.cierre.inicio}` : e.tipo === "formObjetivo" ? `form${e.id ?? e.nuevo.mes ?? ""}` : `${e.tipo}${e.id ?? ""}`);
type Pestana = "hoy" | "objetivos" | "revision" | "ajustes";
const PESTANAS: [Pestana, string, string][] = [["hoy", "check_box", "Hoy"], ["objetivos", "flag", "Objetivos"], ["revision", "insights", "Revisión"], ["ajustes", "settings", "Ajustes"]];

export default function App() {
  const datos = useDatos();
  const [pestana, setPestana] = useState<Pestana>("hoy");
  const [subAjustes, setSubAjustes] = useState<SubAjustes>(null);
  // Pantallas encima de la pestaña: detalle de un hábito y editor.
  const [pila, setPila] = useState<Encima[]>([]);
  const abrir = (e: Encima) => setPila((p) => [...p, e]);
  const volver = () => setPila((p) => p.slice(0, -1));
  const [aviso, setAviso] = useState<ReactNode>(null);
  const reloj = useRef<number | undefined>(undefined);
  const [hoy, setHoy] = useState(calcularHoy());
  // Si la app queda abierta pasada la medianoche, "hoy" se actualiza.
  useEffect(() => {
    const id = window.setInterval(() => setHoy(calcularHoy()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  // Copia automática semanal, una vez por sesión cuando ya cargaron los datos.
  const copiaHecha = useRef(false);
  useEffect(() => {
    if (datos.cargando || copiaHecha.current) return;
    copiaHecha.current = true;
    copiaAutomatica(hoy);
  }, [datos.cargando, hoy]);
  // Botón "atrás" de Android: cierra la pantalla de arriba; si no hay, sale de la subpantalla o minimiza la app.
  const estadoAtras = useRef({ pila, subAjustes, pestana });
  estadoAtras.current = { pila, subAjustes, pestana };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const l = CapApp.addListener("backButton", () => {
      const e = estadoAtras.current;
      if (e.pila.length) setPila((p) => p.slice(0, -1));
      else if (e.subAjustes) setSubAjustes(null);
      else if (e.pestana !== "hoy") setPestana("hoy");
      else CapApp.minimizeApp();
    });
    return () => { l.then((x) => x.remove()); };
  }, []);
  // Actualizaciones: al abrir la app y al volver a ella (como mucho cada 6 horas) se fija si hay una versión nueva.
  const [nueva, setNueva] = useState<Actualizacion | null>(null);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let ultima = 0;
    const revisar = () => { if (Date.now() - ultima > 6 * 3600_000) { ultima = Date.now(); buscarActualizacion().then(setNueva); } };
    revisar();
    const l = CapApp.addListener("appStateChange", (e) => { if (e.isActive) revisar(); });
    return () => { l.then((x) => x.remove()); };
  }, []);
  // Notificaciones: se escuchan los botones una sola vez y se reprograman cuando cambian los datos.
  useEffect(() => {
    escucharAcciones((periodo, inicio) => { setPestana("revision"); setPila([{ tipo: "cierre", cierre: { periodo, inicio } }]); });
  }, []);
  useEffect(() => {
    if (datos.cargando) return;
    const t = window.setTimeout(() => {
      const p = datos.prefs;
      programarAvisos(planificarAvisos([...datos.habitos], datos.historiales, p.pausas, new Date(), hoy, { libresCumplen: p.libresCumplen },
        { noSiHecho: p.avisoNoSiHecho, cierreSemana: p.avisoCierreSemana, cierreMes: p.avisoCierreMes, dias: 14 }));
    }, 1500);
    return () => window.clearTimeout(t);
  }, [datos, hoy]);
  const avisar = (c: ReactNode, ms = 3000) => {
    setAviso(c);
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => setAviso(null), ms);
  };

  const arriba = pila[pila.length - 1];
  const buscar = (id: string) => [...datos.habitos, ...datos.archivados].find((h) => h.id === id);
  let contenido: ReactNode;
  if (arriba?.tipo === "detalle" && buscar(arriba.id)) {
    const h = buscar(arriba.id)!;
    contenido = <Detalle h={h} datos={datos} hoy={hoy} volver={volver} editar={() => abrir({ tipo: "editor", id: h.id })} avisar={avisar} />;
  } else if (arriba?.tipo === "editor") {
    contenido = <Editor datos={datos} hoy={hoy} habito={arriba.id ? buscar(arriba.id) : undefined} volver={volver} alTerminar={() => setPila([])} avisar={avisar} />;
  } else if (arriba?.tipo === "cierre") {
    contenido = <Cierre datos={datos} hoy={hoy} cierre={arriba.cierre} volver={volver} irARevision={() => { setPila([]); setPestana("revision"); }}
      abrirObjetivo={(id) => abrir({ tipo: "objetivo", id })} nuevoObjetivo={(n) => abrir({ tipo: "formObjetivo", nuevo: n })} />;
  } else if (arriba?.tipo === "objetivo" && datos.objetivos.some((o) => o.id === arriba.id)) {
    const o = datos.objetivos.find((x) => x.id === arriba.id)!;
    contenido = <DetalleObjetivo o={o} datos={datos} hoy={hoy} volver={volver} avisar={avisar} editar={() => abrir({ tipo: "formObjetivo", nuevo: { periodo: o.periodo }, id: o.id })} />;
  } else if (arriba?.tipo === "formObjetivo") {
    contenido = <FormObjetivo datos={datos} hoy={hoy} inicial={arriba.nuevo} existente={datos.objetivos.find((o) => o.id === arriba.id)} volver={volver} avisar={avisar} />;
  } else if (pestana === "hoy") contenido = <Hoy datos={datos} hoy={hoy} avisar={avisar} abrirDetalle={(h: Habito) => abrir({ tipo: "detalle", id: h.id })} nuevo={() => abrir({ tipo: "editor" })} irAImportar={() => { setPestana("ajustes"); setSubAjustes("importar"); }} />;
  else if (pestana === "ajustes") contenido = <Ajustes datos={datos} hoy={hoy} sub={subAjustes} setSub={setSubAjustes} avisar={avisar} abrirDetalle={(id) => abrir({ tipo: "detalle", id })} />;
  else if (pestana === "revision") contenido = <Revision datos={datos} hoy={hoy} avisar={avisar} abrirCierre={(c) => abrir({ tipo: "cierre", cierre: c })} abrirDetalle={(id) => abrir({ tipo: "detalle", id })} />;
  else contenido = <Objetivos datos={datos} hoy={hoy} abrir={(id) => abrir({ tipo: "objetivo", id })} nuevo={(n) => abrir({ tipo: "formObjetivo", nuevo: n })} />;

  return (
    <div className="app">
      {nueva && (
        <div className="aviso-version" role="status">
          <Icono n="system_update" estilo={{ color: "var(--acento)" }} />
          <div style={{ flex: 1 }}><div>Hay una versión nueva</div><div className="chico">{nueva.version}{nueva.notas ? ` · ${nueva.notas.split("\n")[0]}` : ""}</div></div>
          <button className="accion principal" onClick={() => descargar(nueva)}>Actualizar</button>
          <button className="icono-btn" aria-label="Ahora no" onClick={() => setNueva(null)}><Icono n="close" /></button>
        </div>
      )}
      <main className="pantalla" key={`${pestana}-${claveEncima(arriba)}-${subAjustes ?? ""}`}>{contenido}</main>
      <nav className="nav">
        {PESTANAS.map(([k, i, l]) => (
          <button key={k} className={pestana === k ? "activo" : ""} aria-current={pestana === k ? "page" : undefined}
            onClick={() => { setPestana(k); setPila([]); setSubAjustes(null); }}>
            <Icono n={i} />{l}
          </button>
        ))}
      </nav>
      {aviso && <div className="aviso-flotante" role="status">{aviso}</div>}
    </div>
  );
}
