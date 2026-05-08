# NOTAS — Lab PostgreSQL Avanzado

## Pregunta 1: ¿Cuándo es contraproducente crear un índice?

Un índice es contraproducente principalmente en **tablas con muchas escrituras**
(INSERT, UPDATE, DELETE). Cada vez que se modifica un dato, PostgreSQL no solo
actualiza la tabla principal sino **también todos los índices asociados**, añadiendo
overhead en cada operación de escritura.

Casos concretos en los que un índice perjudica más de lo que ayuda:

- **Tablas de logs o auditoría** (como nuestra `auditoria_peliculas`): reciben
  inserciones constantes y raramente se consultan filtrando por columnas específicas.
  Un índice aquí ralentizaría cada registro de auditoría.
- **Columnas con baja cardinalidad**: un índice en una columna `activo` (solo
  `true`/`false`) no aporta valor porque el planificador igualmente recorre casi
  toda la tabla.
- **Tablas muy pequeñas**: con pocas filas, un _sequential scan_ es más rápido que
  seguir el árbol B del índice.
- **Cargas masivas (bulk insert)**: se recomienda eliminar índices antes de una
  carga masiva y recrearlos después, porque mantenerlos durante la carga multiplica
  el tiempo de inserción.
- **Índices redundantes**: si ya tienes un índice compuesto `(genero_id, nota)`,
  un índice simple sobre `genero_id` es redundante y consume espacio y escrituras
  innecesariamente.

**Regla práctica**: crea índices en columnas que aparezcan frecuentemente en
`WHERE`, `JOIN ON` u `ORDER BY`, pero comprueba siempre con `EXPLAIN ANALYZE` que
el planificador los usa y que la ganancia en lectura compensa el coste en escritura.

---

## Pregunta 2: ¿Qué diferencia hay entre `RANK()` y `DENSE_RANK()`?

Ambas asignan una posición a cada fila dentro de una partición ordenada, pero
difieren en cómo tratan los **empates**:

| Función        | Empates                                 | Huecos en la numeración     |
| -------------- | --------------------------------------- | --------------------------- |
| `RANK()`       | Las filas empatadas reciben el mismo nº | Sí — el siguiente se salta  |
| `DENSE_RANK()` | Las filas empatadas reciben el mismo nº | No — numeración consecutiva |

**Ejemplo con nuestros datos** — en ciencia ficción, `Dune` y `Blade Runner 2049`
comparten nota 8.0:

```sql
SELECT titulo, nota,
  RANK()       OVER (PARTITION BY genero_id ORDER BY nota DESC) AS rank,
  DENSE_RANK() OVER (PARTITION BY genero_id ORDER BY nota DESC) AS dense_rank
FROM peliculas
JOIN generos g ON g.id = peliculas.genero_id
WHERE g.slug = 'ciencia-ficcion';
```

| titulo            | nota | RANK  | DENSE_RANK |
| ----------------- | ---- | ----- | ---------- |
| Inception         | 8.8  | 1     | 1          |
| Interstellar      | 8.6  | 2     | 2          |
| Dune              | 8.0  | 3     | 3          |
| Blade Runner 2049 | 8.0  | 3     | 3          |
| Arrival           | 7.9  | **5** | **4**      |

Con `RANK()`, Arrival ocupa el puesto **5** (se salta el 4 por el empate anterior).  
Con `DENSE_RANK()`, Arrival ocupa el puesto **4** (sin huecos).

Usa `RANK()` cuando el número refleje cuántas filas hay por delante (ranking
deportivo). Usa `DENSE_RANK()` cuando solo quieras agrupar niveles sin saltos
(categorías de calidad).

---

## Pregunta 3: ¿Por qué el trigger usa `AFTER` en lugar de `BEFORE`?

La diferencia determina **en qué momento** del ciclo de la operación se ejecuta
el trigger:

- **`BEFORE`**: se dispara antes de que la fila sea modificada. Se usa cuando
  quieres **validar o transformar** datos antes de escribirlos (forzar un valor
  por defecto, cancelar la operación, etc.).
- **`AFTER`**: se dispara después de que la operación completó exitosamente.
  Se usa cuando quieres **reaccionar** a un cambio que ya ocurrió.

Para auditoría, `AFTER` es la elección correcta por tres razones:

1. **Los datos son definitivos**: en `AFTER INSERT`, `NEW` ya contiene valores
   generados por la base de datos como el `id` (SERIAL) o el `created_at`
   (DEFAULT NOW()). Con `BEFORE INSERT` el `id` todavía no ha sido asignado
   y no podríamos registrarlo en la auditoría.

2. **Solo se audita lo que realmente ocurrió**: si la operación falla por un
   constraint o un error, el trigger `AFTER` no se ejecuta. Con `BEFORE`
   podríamos registrar en auditoría operaciones que luego no completaron,
   generando un log inconsistente.

3. **No interfiere con la operación principal**: un trigger `BEFORE` puede
   cancelar o modificar la operación devolviendo `NULL`. Un trigger `AFTER`
   de auditoría es puramente observador, que es exactamente lo que queremos.

En resumen: `AFTER` garantiza que el log refleja únicamente cambios que
realmente ocurrieron, con los datos definitivos tal como quedaron en disco.
