import initSqlJs from "sql.js";
import wasm from "sql.js/dist/sql-wasm.wasm?url";

/** SQLite en el navegador, para leer la copia de seguridad de Loop. El .wasm va dentro de la app, sin conexión. */
export const iniciarSql = () => initSqlJs({ locateFile: () => wasm });
