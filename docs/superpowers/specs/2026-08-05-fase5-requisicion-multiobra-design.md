# Fase 5 — Requisición multi-obra (repartir compras genéricas entre obras)

Estado: aprobado por Emiliano, pendiente de plan de implementación.

## Contexto

El roadmap del proyecto (`README.md`, `.cursorrules`) llama a esta fase
"Asignación de materiales a obra". Al definirla con el usuario, se confirmó
que el significado real (no el que sugerían los comentarios de código de
Fase 4) es:

> Compras (Talía) a veces compra un lote de material sin tenerlo amarrado a
> una sola obra desde el inicio — por ejemplo, comprar por volumen y repartir
> el lote entre varias obras conforme se necesita. Hoy el sistema obliga a
> que toda requisición tenga una única obra desde que se crea.

Fase 5 = permitir que **una sola requisición** tenga renglones destinados a
**distintas obras**, y que esa requisición avance por aprobación (Compras) y
pago (Finanzas) **como una sola unidad** ("todo o nada" — no se aprueba o
paga la porción de una obra sin la otra).

No es esto: no se trata de registrar consumo físico real en obra (instalado
vs. sobrante) — eso quedó descartado explícitamente por el usuario como
alcance de esta fase.

## Decisiones de diseño (de las preguntas de aclaración)

1. "Asignar" = repartir una compra genérica entre obras, no marcar consumo físico.
2. La requisición multi-obra nace del mismo flujo ya existente
   (requisición → Compras aprueba → Finanzas paga → OC), solo que sin una
   obra fija desde el inicio.
3. Quien levanta una requisición multi-obra es Compras (Talía) — Personal
   sigue usando el flujo de una sola obra, sin cambios.
4. La aprobación y el pago avanzan **juntos** para todos los renglones de la
   requisición — no existe aprobación/pago parcial por obra.

## Enfoque elegido: obra por renglón, misma requisición

Se evaluaron 3 opciones (ver historial de la conversación de diseño):

- **A — Obra por renglón, misma requisición (elegida).** Cambio mínimo:
  agrega `obra_id` opcional a `solicitud_items`; la cabecera
  (`solicitudes_material.obra_id`) sigue obligatoria y sirve como
  obra de referencia/despliegue. Aísla el riesgo a las RPCs financieras
  (`aprobar_solicitud_compras`, `aprobar_pago_solicitud`, `rechazar_solicitud`).
- **B — Varias solicitudes ligadas por un lote.** No toca RPCs existentes,
  pero requiere construir una capa de orquestación nueva para lograr
  "todo o nada" entre varias filas — complejidad nueva en vez de reformar
  la existente, y dejaría de ser "una" requisición en reportes.
- **C — Rediseño completo (obra solo a nivel renglón, para todo el sistema).**
  Demasiado grande: tocaría el flujo de Personal, que hoy funciona bien y no
  lo necesita.

Se eligió A por ser el cambio más chico que logra fielmente lo que describió
el usuario, aislando el riesgo a un número acotado de funciones.

## 1. Modelo de datos (migración `0008`)

- `solicitud_items` gana columna `obra_id uuid references obras(id)`,
  **nullable**. Cuando es null, el renglón hereda la obra de la cabecera
  (comportamiento actual, sin cambios para Personal).
- `solicitudes_material.obra_id` **no cambia** (sigue `not null`). Para una
  requisición multi-obra, se guarda ahí la obra del primer renglón que
  Talía captura en el formulario (el primero en orden de captura, no una
  obra "más importante") — solo para que las vistas que hoy asumen "una
  obra por requisición" (lista, notificaciones) sigan mostrando algo
  razonable sin tener que tocarlas.
- El índice único `solicitud_items_solicitud_material_uidx`
  (hoy `unique (solicitud_id, material_id) where material_id is not null`)
  se reemplaza por uno que compone el `obra_id` resuelto, usando
  `coalesce(obra_id, '00000000-0000-0000-0000-000000000000'::uuid)` para
  que los renglones con `obra_id` null (flujo normal de Personal) sigan
  colisionando entre sí igual que hoy. Esto preserva la regla "no repetir
  material en la misma obra" y habilita repetir material en obras
  distintas.
- `solicitud_reservas_cantidad` cambia su restricción única de
  `unique (solicitud_id, material_id)` a
  `unique (solicitud_id, material_id, obra_id)` — aquí `obra_id` siempre es
  no-nulo (se resuelve antes de insertar), así que no hace falta el truco
  de `coalesce`.

## 2. Reglas de negocio (RPCs `security definer`)

Resolución de obra por renglón en las 3 funciones tocadas:
`obra_efectiva := coalesce(solicitud_items.obra_id, solicitudes_material.obra_id)`.

- **`aprobar_solicitud_compras`**: en vez de revisar el saldo de una sola
  obra, recorre los renglones agrupados por `obra_efectiva`. Si cualquier
  obra involucrada no tiene saldo de cantidad o dinero suficiente, la
  función completa lanza excepción y no reserva nada (atomicidad de
  transacción de Postgres ya lo garantiza, solo hay que quitar el supuesto
  de "una obra"). Las filas de `solicitud_reservas_cantidad` se insertan con
  el `obra_id` resuelto del renglón, no con el de la cabecera.
- **`aprobar_pago_solicitud`**: agrupa los renglones por `obra_efectiva` y
  emite **una Orden de Compra por cada obra distinta**, cada una con su
  propio folio (`next_folio_orden_compra()`) y su propio total. Cambia el
  tipo de retorno de `uuid` (una OC) a un arreglo de `uuid` (una o más OC),
  porque hoy la app usa ese valor para redirigir directo a la pantalla de
  la orden.
- **`rechazar_solicitud`** — **corrección necesaria, no solo adaptación**:
  hoy libera el dinero reservado como un monto único acreditado a la obra
  de la cabecera. Con multi-obra, eso acreditaría mal el dinero de una obra
  a otra. Se corrige para calcular y liberar el monto de cada obra por
  separado, contra su propio `obra_id`.
- `cancelar_solicitud` no cambia — ya delega en `rechazar_solicitud`.

## 3. Interfaz

- `SolicitudForm` (usado en `/solicitudes/nueva`): nueva opción "requisición
  multi-obra", visible solo para rol `compras` (y `acceso_total`). Al
  activarla, cada renglón agrega su propio selector de obra. Personal no ve
  esta opción — su formulario no cambia.
- `/solicitudes/[id]`: cuando la requisición es multi-obra, muestra la obra
  de cada renglón en vez de una sola obra para toda la requisición.
- `/solicitudes` (lista): etiqueta visible "multi-obra" en las filas que
  aplican.
- Tras pagar: si resultó en más de una OC, la acción regresa a la vista de
  la requisición (con links a las OC generadas) en vez de redirigir directo
  a una sola orden como hoy.
- Recepción/checklist (`/ordenes`, `/recepciones`): sin cambios — cada OC
  generada sigue siendo de una sola obra.

## 4. Manejo de errores y casos borde

- Saldo insuficiente en cualquiera de las obras involucradas → falla la
  aprobación completa, mensaje indica material/obra en conflicto, nada
  queda reservado a medias.
- Duplicar material en la misma obra dentro de una requisición sigue
  bloqueado; duplicarlo entre obras distintas está permitido.
- No existe aprobación/rechazo/pago parcial por obra — es todo o nada, por
  decisión explícita del usuario.
- Cambios de estado de obra (pausada/cerrada) entre creación y aprobación:
  mismo comportamiento que ya existe hoy (solo se valida al crear la
  requisición) — no es un caso nuevo introducido por esta fase.
- Offline: sin impacto — este cambio es exclusivo del flujo de
  Compras/Finanzas (oficina, con conexión), no toca la lógica offline de
  Personal.

## 5. Plan de pruebas

- Regresión manual + `scripts/e2e-fase3.ps1` para confirmar que una
  requisición de una sola obra se comporta exactamente igual que hoy.
- Casos nuevos a probar a mano (sin automatizar en v1):
  1. Requisición con 2 obras, ambas con saldo suficiente → aprueba, paga,
     resultan 2 OC, cada una recibible por separado en Fase 4.
  2. Requisición con 2 obras, una sin saldo suficiente → falla completa,
     nada reservado a medias.
  3. Rechazo de una multi-obra ya aprobada → el dinero se libera
     correctamente a cada obra por separado.
  4. Mismo material en 2 obras distintas dentro de una requisición →
     permitido; mismo material repetido en la misma obra → sigue bloqueado.
- Toda migración se revisa (Emiliano/Emilio) antes de aplicarse en Supabase
  remoto — nada se sube en automático.

## Fuera de alcance (explícitamente descartado)

- Registrar consumo físico real de material en obra (instalado vs.
  sobrante) — no es lo que esta fase resuelve, según confirmó el usuario.
- Aprobación/pago parcial por obra dentro de una misma requisición
  multi-obra.
- Traspasos de material entre obras ya asignadas (eso es Fase 6, deliberadamente
  fuera de esta fase).
