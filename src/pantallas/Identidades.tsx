import { useState } from "react";
import type { Datos } from "../datos";
import { asignarIdentidad, borrarIdentidad, guardarIdentidad } from "../lib/acciones";
import type { Identidad } from "../tipos";
import { Barra, Hoja, Icono } from "../ui/piezas";

const COLORES = ["#69F0AE", "#FFF176", "#64B5F6", "#FFB74D", "#CE93D8", "#FF8A80", "#80CBC4"];

/** Identidades: una frase que agrupa hábitos. Cada hábito vota por una sola. */
export default function Identidades({ datos, volver, avisar }: { datos: Datos; volver: () => void; avisar: (c: React.ReactNode) => void }) {
  const [editando, setEditando] = useState<Identidad | null>(null);
  const nueva = () => setEditando({ id: `i-${Date.now().toString(36)}`, frase: "", color: COLORES[datos.identidades.length % COLORES.length] });
  return (
    <>
      <Barra titulo="Identidades" izquierda={<button className="icono-btn" aria-label="Volver" onClick={volver}><Icono n="arrow_back" /></button>} />
      <p className="mu">Cada día que marcás un hábito es un voto por la persona que querés ser. Cada identidad agrupa varios hábitos y cada hábito vota por una sola. Se ven en el detalle, en Revisión y en los cierres.</p>
      {datos.identidades.map((i) => {
        const hs = datos.habitos.filter((h) => h.identidad === i.id);
        return (
          <button key={i.id} className="item" onClick={() => setEditando(i)}>
            <span className="punto" style={{ background: i.color }} />
            <div className="t"><div>{i.frase}</div><div className="chico">{hs.length ? hs.map((h) => h.nombre).join(", ") : "Sin hábitos"}</div></div>
            <Icono n="chevron_right" estilo={{ color: "#555" }} />
          </button>
        );
      })}
      <button className="boton2" onClick={nueva}>+ Nueva identidad</button>
      {editando && <Editar datos={datos} identidad={editando} cerrar={() => setEditando(null)} avisar={avisar} />}
    </>
  );
}

function Editar({ datos, identidad, cerrar, avisar }: { datos: Datos; identidad: Identidad; cerrar: () => void; avisar: (c: React.ReactNode) => void }) {
  const [frase, setFrase] = useState(identidad.frase);
  const [color, setColor] = useState(identidad.color);
  const [elegidos, setElegidos] = useState(new Set(datos.habitos.filter((h) => h.identidad === identidad.id).map((h) => h.id)));
  const [error, setError] = useState(false);
  const existe = datos.identidades.some((i) => i.id === identidad.id);
  const guardar = async () => {
    if (!frase.trim()) { setError(true); return; }
    await guardarIdentidad({ ...identidad, frase: frase.trim(), color });
    for (const h of datos.habitos) {
      const quiere = elegidos.has(h.id);
      if (quiere && h.identidad !== identidad.id) await asignarIdentidad(h.id, identidad.id);
      if (!quiere && h.identidad === identidad.id) await asignarIdentidad(h.id, null);
    }
    avisar("Identidad guardada");
    cerrar();
  };
  return (
    <Hoja cerrar={cerrar}>
      <div className={`campo${error && !frase.trim() ? " error" : ""}`} style={{ marginTop: 4 }}>
        <label htmlFor="i-frase">Frase</label>
        <input id="i-frase" value={frase} placeholder="Alguien que se mueve y se cuida" onChange={(e) => setFrase(e.target.value)} />
      </div>
      {error && !frase.trim() && <div className="chico" style={{ color: "var(--mal)", marginTop: 4 }}>Escribí la frase.</div>}
      <div className="chips" style={{ margin: "12px 0" }}>
        {COLORES.map((c) => <button key={c} aria-label={c} onClick={() => setColor(c)} style={{ width: 30, height: 30, borderRadius: "50%", background: c, outline: color === c ? "2px solid #fff" : undefined, outlineOffset: 2 }} />)}
      </div>
      <p className="sub">Hábitos que votan por esta identidad</p>
      <div className="chips">
        {datos.habitos.map((h) => {
          const otra = h.identidad && h.identidad !== identidad.id ? datos.identidades.find((i) => i.id === h.identidad) : null;
          const on = elegidos.has(h.id);
          return (
            <button key={h.id} className={`chip${on ? " activo" : ""}`} aria-pressed={on} title={otra ? `Ahora vota por: ${otra.frase}` : undefined}
              onClick={() => { const s = new Set(elegidos); if (on) s.delete(h.id); else s.add(h.id); setElegidos(s); }}>
              {h.nombre}{otra && !on ? " ·" : ""}
            </button>
          );
        })}
      </div>
      <p className="chico" style={{ marginTop: 6 }}>Los que tienen "·" ya votan por otra identidad: si los elegís, se pasan a esta.</p>
      <button className="boton" onClick={guardar}>Guardar</button>
      {existe && <button className="boton2" style={{ color: "var(--mal)" }} onClick={async () => { await borrarIdentidad(identidad.id); avisar("Identidad borrada"); cerrar(); }}>Borrar identidad</button>}
    </Hoja>
  );
}
