import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDatos } from "./datos";
import { hoy as calcularHoy } from "./lib/fecha";
import Ajustes from "./pantallas/Ajustes";
import Detalle from "./pantallas/Detalle";
import Editor from "./pantallas/Editor";
import Cierre from "./pantallas/Cierre";
import Hoy from "./pantallas/Hoy";
import Revision, { type Cierre as TipoCierre } from "./pantallas/Revision";
import type { Habito } from "./tipos";
import { Barra, Icono } from "./ui/piezas";

type Encima = { tipo: "detalle"; id: string } | { tipo: "editor"; id?: string } | { tipo: "cierre"; cierre: TipoCierre };
const claveEncima = (e?: Encima) => (!e ? "" : e.tipo === "cierre" ? `cierre${e.cierre.periodo}${e.cierre.inicio}` : `${e.tipo}${e.id ?? ""}`);
type Pestana = "hoy" | "objetivos" | "revision" | "ajustes";
const PESTANAS: [Pestana, string, string][] = [["hoy", "check_box", "Hoy"], ["objetivos", "flag", "Objetivos"], ["revision", "insights", "Revisión"], ["ajustes", "settings", "Ajustes"]];

export default function App() {
  const datos = useDatos();
  const [pestana, setPestana] = useState<Pestana>("hoy");
  const [subAjustes, setSubAjustes] = useState<null | "importar" | "archivados" | "identidades">(null);
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
    contenido = <Cierre datos={datos} hoy={hoy} cierre={arriba.cierre} volver={volver} irARevision={() => { setPila([]); setPestana("revision"); }} />;
  } else if (pestana === "hoy") contenido = <Hoy datos={datos} hoy={hoy} avisar={avisar} abrirDetalle={(h: Habito) => abrir({ tipo: "detalle", id: h.id })} nuevo={() => abrir({ tipo: "editor" })} irAImportar={() => { setPestana("ajustes"); setSubAjustes("importar"); }} />;
  else if (pestana === "ajustes") contenido = <Ajustes datos={datos} hoy={hoy} sub={subAjustes} setSub={setSubAjustes} avisar={avisar} abrirDetalle={(id) => abrir({ tipo: "detalle", id })} />;
  else if (pestana === "revision") contenido = <Revision datos={datos} hoy={hoy} avisar={avisar} abrirCierre={(c) => abrir({ tipo: "cierre", cierre: c })} abrirDetalle={(id) => abrir({ tipo: "detalle", id })} />;
  else contenido = <Proximamente titulo="Objetivos" texto="Llega en la próxima etapa." />;

  return (
    <div className="app">
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

function Proximamente({ titulo, texto, volver }: { titulo: string; texto: string; volver?: () => void }) {
  return (
    <>
      <Barra titulo={titulo} izquierda={volver && <button className="icono-btn" aria-label="Volver" onClick={volver}><Icono n="arrow_back" /></button>} />
      <div className="tarjeta" style={{ marginTop: 12 }}><div className="mu">{texto}</div></div>
    </>
  );
}
