/** Fecha local sin hora, "AAAA-MM-DD". */
export type Dia = string;

export type TipoHabito = "hacer" | "medir" | "evitar";
export type Momento = "manana" | "dia" | "noche" | "todo";

/**
 * Lo que se guarda por día. Un día sin registro es "no hecho".
 * - hecho: completo
 * - minima: versión mínima (en Evitar, "dentro del límite": cuenta medio día)
 * - libre: día libre, no cuenta como fallo
 */
export type Valor = "hecho" | "minima" | "libre";

/**
 * `num` veces cada `den` días. Días fijos: `dias` con 0 = lunes … 6 = domingo
 * (entonces num = dias.length y den = 7).
 */
export interface Frecuencia {
  num: number;
  den: number;
  dias?: number[];
}

/** Cada cambio de frecuencia se guarda con la fecha desde la que aplica, así el pasado no cambia. */
export interface VersionFrecuencia {
  desde: Dia;
  frecuencia: Frecuencia;
}

export interface Medicion {
  sentido: "alMenos" | "comoMaximo";
  cantidad: number;
  unidad: string;
  por: "dia" | "semana";
}

export interface Habito {
  id: string;
  nombre: string;
  color: string;
  tipo: TipoHabito;
  frecuencias: VersionFrecuencia[];
  medicion?: Medicion;
  momento: Momento;
  area: string;
  identidad: string | null;
  despuesDe: string | null;
  recordatorio: string | null; // "HH:MM"
  minima: string | null; // límite escrito; sin texto no hay versión mínima
  nuncaDosVeces: boolean;
  variantes: string[];
  pregunta: string | null;
  notas: string | null;
  orden: number;
  archivado: boolean;
  creado: Dia;
  /** Si vino de Loop: su posición original y los datos para detectar copias. */
  loop?: { posicion: string; nombre: string };
}

export interface Registro {
  habito: string;
  dia: Dia;
  valor: Valor;
  variante?: string;
  cantidad?: number;
  /** Día libre puesto por una pausa: no se guarda en la base, se calcula al leer. */
  porPausa?: boolean;
}

/** Modo pausa: vacaciones, enfermedad. Todos los hábitos quedan como día libre en el rango. */
export interface Pausa {
  desde: Dia;
  hasta: Dia;
  motivo: string;
}

export interface Identidad {
  id: string;
  frase: string;
  color: string;
}

export type PeriodoObjetivo = "mes" | "anio" | "periodo";
export type MedidaObjetivo = "siNo" | "cantidad" | "veces" | "racha" | "tareas";

/** Paso de un objetivo: hecho o no hecho. El orden del arreglo es el orden en pantalla (las hechas se muestran al final). */
export interface Tarea {
  id: string;
  texto: string;
  hecha: boolean;
  fecha: Dia | null;
  nota: string;
}

export interface Objetivo {
  id: string;
  nombre: string;
  descripcion: string;
  periodo: PeriodoObjetivo;
  desde: Dia;
  hasta: Dia;
  medida: MedidaObjetivo;
  meta: number;
  habitos: string[];
  manual: number;
  logrado: boolean | null;
  identidad: string | null;
  /** Cualquier objetivo puede tener tareas; si la medida es "tareas", el avance sale de ellas. */
  tareas?: Tarea[];
  /** El cierre de mes ya preguntó qué hacer con las tareas que quedaron sin hacer. */
  pendientesResueltas?: boolean;
}
