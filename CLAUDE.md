# Hábitos

App personal de hábitos para Android que reemplaza a Loop Habit Tracker. Mismo enfoque que `../Gastos`: React + TypeScript + Vite, datos locales en el teléfono con Dexie (IndexedDB), textos y nombres de código en español. Para Android se empaqueta con Capacitor (pendiente: requiere Android Studio instalado).

## Especificación

Todas las decisiones de diseño están en el documento "Rediseño app de hábitos: decisiones":
https://claude.ai/code/artifact/12b27e8f-1238-46b3-a357-83bc989d881b

Prototipo navegable de referencia: https://claude.ai/artifact/6KASiA2qMMYGmxRA7w9dHc

## Reglas de datos que no se negocian

- Un día sin registro es "no hecho". Solo se guardan `hecho`, `minima` y `libre`.
- La frecuencia se guarda por versiones (`frecuencias[]` con `desde`): cambiarla nunca reescribe el pasado salvo que el usuario elija "Todo el historial".
- En Evitar, la versión mínima ("dentro del límite") vale medio día.
- Tocar un círculo marca; volver a tocarlo desmarca. Mantener presionado alterna el día libre. No hay menú.
- La importación desde Loop deja afuera las copias (mismo nombre y todos sus días contenidos en otro hábito).

## Estructura

- `src/tipos.ts`: modelo de datos.
- `src/db.ts`: base local (Dexie).
- `src/lib/estadisticas.ts`: puntuación (misma fórmula que Loop, verificada contra sus valores), rachas, resúmenes y series para los gráficos.
- `src/lib/revision.ts`: cumplimiento global, sugerencias, patrones, votos por identidad y cambios entre períodos. Un período en curso se compara contra el anterior a la misma altura.
- `src/lib/objetivos.ts`: progreso, estado y ritmo de los objetivos.
- `src/lib/calculos.ts`: toda la lógica de frecuencias, progreso, patrones y "nunca fallar dos veces". Funciones puras, con pruebas.
- `src/lib/importarLoop.ts`: lee la copia de seguridad de Loop (.db, SQLite con sql.js; trae recordatorios) o el ZIP "Exportar datos (CSV)". Los dos pasan por la misma conversión.
- `src/lib/acciones.ts`: escrituras (marcar, día libre, importar, preferencias).
- `src/pantallas/`: una por pantalla.

## Comandos

- `npm run dev`: servidor de desarrollo.
- `npm test`: pruebas (Vitest).
- `npm run build`: chequeo de tipos y compilación.

## Etapas

1. Hecha: estructura, modelo, importación desde Loop (copia .db o CSV), Hoy y Semana, Ajustes básicos.
2. Hecha: detalle del hábito (resumen, Progreso, Patrones, Historial), crear, editar (frecuencia por versiones), archivar, eliminar y Archivados.
3. Hecha: Revisión (semana, mes, año, sugerencias con botones, patrones, identidades), cierres de semana, mes y año con notas, e Identidades en Ajustes.
4. Hecha: Objetivos (pestaña propia; por mes, año o período; sí/no, cantidad, veces de hábitos o racha; ritmo necesario, detalle con gráfico, mover fecha y ajustar meta) y objetivos en el cierre de mes.
5. Recordatorios inteligentes, modo pausa, copia de seguridad automática y empaquetado Android con Capacitor.
