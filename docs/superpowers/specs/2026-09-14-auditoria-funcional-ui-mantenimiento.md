# Auditoría funcional, UI y mantenimiento — Proyecto Emilio

Fecha: 2026-09-14  
Modo: auditoría de solo lectura; no se modificó código, datos ni Supabase.

## Alcance y evidencia

- Se revisaron rutas, componentes, Server Actions, validaciones y capas offline de toda la aplicación, divididas por catálogo/proyectos, compra/recepción y operación/plataforma.
- Se contrastó la UI contra `design.md`: sistema navy `#132A45` y teal `#1E7F7A`, fuentes de sistema, controles táctiles y shell móvil propio de Emilio.
- Verificaciones locales: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test` (**28/28**) y `npm.cmd run build` pasaron. `npm.cmd audit --omit=dev --json` reportó **0 vulnerabilidades de producción**.
- Revisión visual en vivo: `/login` en móvil no desborda horizontalmente, los campos miden 50 px y el CTA 48 px; no hubo errores de consola. Las rutas protegidas no se navegaron porque no se recibió una sesión de pruebas.
- La build avisa que no detectó el plugin de Next en la configuración ESLint, aunque `eslint.config.mjs` sí carga `@next/next`; es una advertencia de integración a comprobar, no un fallo de compilación.

No se confirmó una migración remota, RLS remoto ni comportamiento contra datos de producción.

## Prioridad 1 — corregir antes de ampliar uso operativo

### Kits, asignaciones y presupuesto

1. **[alto, alta] Un kit acepta componentes repetidos y descarta el segundo sin avisar.** `components/KitForm.tsx:184-195`, `lib/validations/kit.ts:63-79`. La pantalla permite dos renglones, pero la validación conserva sólo uno; las cantidades de una plantilla que llega al presupuesto no coinciden con lo que vio la persona. Esfuerzo pequeño.
2. **[alto, alta] Una cantidad inválida en un kit se convierte silenciosamente en `1`.** `components/KitForm.tsx:68-79,199-208`, `lib/validations/kit.ts:70-79`. Un error de captura termina como una unidad válida y afecta requisiciones/presupuesto. Esfuerzo pequeño.
3. **[alto, alta] Editar un kit no es atómico.** `lib/actions/kits.ts:95-127`. Se actualiza cabecera, se borran componentes y luego se insertan; una falla intermedia puede dejar el kit vacío o parcialmente actualizado. Esfuerzo mediano y requiere transacción/RPC.
4. **[alto, alta] La asignación masiva de topes puede aplicar sólo parte de los materiales aunque comunique error.** `lib/actions/topes.ts:118-188`. Actualiza uno a uno sin rollback y varias lecturas/actualizaciones ignoran errores. Afecta saldo y presupuesto del proyecto. Esfuerzo mediano y requiere transacción/RPC.

### Solicitud, cotización y OC

5. **[alto, alta] Faltan en la UI los renglones no materiales.** `components/SolicitudForm.tsx:202`. El modelo/validador admite Flete, Camiones, Mantenimiento y Otro, pero la requisición sólo deja agregar materiales. Impide registrar gastos operativos que deben descontar presupuesto. Esfuerzo mediano.
6. **[alto, alta] El flujo legado de cotización puede emitir OC y finalizar una requisición sin pasar por Finanzas.** `app/solicitudes/[id]/page.tsx:142`. El enlace “Cotizar (flujo anterior)” conserva una ruta que no usa la reserva/pago del flujo actual. Esfuerzo mediano; decisión de negocio: retirar o migrar registros legacy sin perder trazabilidad.
7. **[alto, alta] Una OC emitida puede quedar sin proveedor y desaparecer de la recepción.** `components/OrdenCompraProveedorModal.tsx:86`. La edición acepta proveedor nulo, pero la consulta de recepción hace join con proveedores. Resultado: no se puede abrir el checklist para recibir la compra. Esfuerzo pequeño.

## Prioridad 2 — brechas funcionales y estados engañosos

### Errores presentados como “no hay datos”

8. **[medio, alta] El inicio muestra cero proyectos si fallan ambas consultas.** `app/page.tsx:43-55,88-108,152-156`. El fallback descarta su error y renderiza una lista vacía, pudiendo inducir altas duplicadas.
9. **[medio, alta] Kits convierte un error de lectura en “No hay kits”.** `app/kits/page.tsx:17-18,76,167-181`.
10. **[medio, alta] El catálogo mezcla alerta de error con “El catálogo está vacío”.** `app/materiales/page.tsx:22-29,51-60`, `components/CatalogoMaterialesView.tsx:751-764`.
11. **[medio, alta] Inventario convierte fallas de consulta en inventario vacío o 404.** `app/inventario/page.tsx:33-56,77-82`, `app/inventario/[obraId]/page.tsx:39-47,163,230-235`.
12. **[medio, alta] La creación de traspaso interpreta fallas de sus fuentes como falta de proyectos o saldo cero.** `app/traspasos/nuevo/page.tsx:17-29,40-50`.
13. **[bajo, alta] Crear proyecto ignora los errores al cargar materiales y kits.** `app/obras/nueva/page.tsx:19-28,31-57,85-106`. El CTA puede quedar bloqueado sin explicar el origen.

Acción común recomendada: distinguir explícitamente `error`, `sin permisos`, `sin datos` y `cargando`, con reintento cuando corresponda. Esfuerzo pequeño por pantalla, alto valor operativo.

### Controles que no hacen lo que prometen

14. **[medio, alta] “Limpiar búsqueda” no limpia.** `components/HomeProjectsWorkbench.tsx:256-265`, `components/EmptyState.tsx:57-75`. Al llevar `href="#"`, `EmptyState` renderiza enlace e ignora el `onClick` que limpia el filtro. Esfuerzo trivial.
15. **[medio, alta] “Quitar fotografía” de proyecto vuelve a guardar la foto existente.** `components/PhotoUploadInput.tsx:143-155,177-180`, `lib/actions/obras.ts:190-201`. Sólo borra la previsualización; el hidden de la URL persiste. Esfuerzo pequeño.
16. **[medio, alta] Una vista guardada de categoría eliminada deja el catálogo vacío sin explicación.** `components/CatalogoMaterialesView.tsx:213-219,314-320,401-407,461-463`. Esfuerzo pequeño.
17. **[medio, alta] El rechazo de cotización comunica una acción más leve de la que realiza.** `components/AprobarRechazarCotizacion.tsx:27`. También rechaza la requisición y notifica al solicitante, sin nombrar claramente el cierre ni pedir confirmación específica. Esfuerzo pequeño.
18. **[medio, alta] El estado manual de recepción puede contradecir cantidades recibidas.** `components/RecepcionForm.tsx:80`. Se sugiere un estado por cantidades pero el selector posterior permite uno incompatible. Esfuerzo pequeño.
19. **[medio, alta] La vista previa de factura intenta abrir XML como imagen.** `components/OrdenCompraFacturasSection.tsx:287`. La UI permite XML pero el visor no tiene tratamiento de archivo no visualizable. Esfuerzo trivial.
20. **[medio, alta] “Registrar otra recepción” se muestra a roles que no pueden capturarla.** `app/recepciones/[id]/page.tsx:184`. La ruta posterior los redirige. Esfuerzo trivial.
21. **[medio, alta] Editar un tope se guarda al perder foco.** `components/EditTopeInline.tsx:54-65`. `requestSubmit()` ejecuta una modificación de presupuesto antes de presionar Guardar; Cancelar deja de ser una confirmación efectiva. Esfuerzo trivial.
22. **[bajo, alta] Notificaciones no muestran error ni estado pendiente al marcar leído.** `app/notificaciones/page.tsx:71-81`, `lib/actions/notificaciones.ts:92-99`. Esfuerzo pequeño.

### Datos que no pueden recuperarse desde la UI

23. **[medio, alta] Un material inactivo no se puede volver a encontrar desde el catálogo.** `app/materiales/page.tsx:23-29`, `components/MaterialForm.tsx:217-230`. Falta vista/filtro de inactivos. Esfuerzo pequeño; decidir primero si una baja puede revertirse desde UI.
24. **[medio, alta] Categoría y subcategoría de material aceptan combinaciones libres.** `lib/validations/material.ts:45-51,74-85`, `lib/actions/materiales.ts:74-90`, `supabase/migrations/0015_p2_catalogo_categorias_storage_kits.sql:9-34`. Un formulario manipulado u obsoleto puede crear combinaciones que el catálogo no clasifica. Esfuerzo mediano; debe validar contra la fuente de verdad de datos.

## Prioridad 2 — permisos, navegación y offline

25. **[medio, alta] Traspasos oculta navegación/CTA, pero listado y detalle no verifican `puedeVerTraspasos`.** `app/traspasos/page.tsx:60-65`, `app/traspasos/[id]/page.tsx:61-102`. Una URL, aviso o atajo permite intentar entrar. RLS sigue siendo el límite de datos, pero la experiencia es incoherente. Esfuerzo pequeño; confirmar semántica de rol antes de modificar guardas.
26. **[medio, alta] La paleta de comandos busca dinámicamente proyectos y catálogo sin aplicar el filtro de rol.** `components/CommandPalette.tsx:292-352,354-369`. Puede descubrir recursos que la navegación de campo oculta. Esfuerzo pequeño; no sustituye RLS.
27. **[medio, media] El shell aparece para sesión Auth sin perfil activo/rol.** `lib/auth/session.ts:40-70`, `app/layout.tsx:108-120`, `middleware.ts:175-195`. Una cuenta incompleta ve chrome y entra a pantallas que luego dependen de RLS. Esfuerzo pequeño; requiere validar el comportamiento deseado para perfiles inactivos.
28. **[medio, alta] El aviso offline promete preservar capturas de campo que no cubre.** `components/NetworkStatusIndicator.tsx:100-109`, `components/ReportarInstalacionForm.tsx:24-32`, `components/OfflineQueueBanner.tsx:102-104`. Instalaciones usan Server Action directa y no ingresan a la cola offline. Esfuerzo mediano; decisión de producto: extender cola o corregir la promesa.
29. **[medio, alta] La cola offline de recepción no conserva fotos, evidencia ni algunos ítems.** `components/RecepcionForm.tsx:100`. La pantalla promete guardarlo para envío posterior, pero persiste sólo cantidades/referencia/nota. Esfuerzo mediano; decidir si se implementa almacenamiento local de evidencia o se bloquea/declara la limitación.

## Consistencia de UI Emilio

La base es coherente: `app/globals.css:36,52-119` define tokens propios y componentes canónicos; `components/icons.tsx` suministra SVG locales. No se hallaron importaciones de Lucide ni Google Fonts. El acceso público conserva tamaños táctiles válidos y no tiene desbordamiento horizontal en 417 px.

30. **[bajo, alta] `MoreSheet` no limita alto ni tiene scroll vertical.** `components/MoreSheet.tsx:96-97,113-193`. Con todas las opciones habilitadas, el final incluido Salir puede quedar fuera de una pantalla móvil baja. Esfuerzo trivial.
31. **[bajo, alta] La paleta usa `blue-*` en resultados de proyecto.** `components/CommandPalette.tsx:507-510,520-526`. Es una paleta paralela a navy/teal. Esfuerzo trivial.
32. **[bajo, alta] Hay objetivos táctiles menores a 44 px en detalle de proyecto.** `components/ObraMaterialesList.tsx:205-245,369-381`. Es una desviación para uso de campo. Esfuerzo pequeño.
33. **[bajo, alta] Kits inactivos se listan sin identificador de estado, aunque no se ofrecen al crear proyecto.** `app/kits/page.tsx:95-165`, `app/obras/nueva/page.tsx:31-57`. La UI sugiere que son utilizables. Esfuerzo trivial.

## Controles comprobados que sí cierran el ciclo

- Búsqueda y filtros del inicio actualizan lista y URL: `components/HomeProjectsWorkbench.tsx:45-75,116-159`.
- Densidad, fotos, exportación y altas de categorías del catálogo actualizan estado/localStorage o invocan acciones: `components/CatalogoMaterialesView.tsx:174-224,288-345,374-400`.
- El flujo moderno separa acciones de Compras y Finanzas; cancelación de solicitud confirma; la recepción valida en servidor/RPC y bloquea sobrerecepción.
- Traspasos usan acciones/RPC reales con estado pendiente y errores; usuarios/bitácora aplican guardas por rol; la campana actualiza por Realtime.
- `MoreSheet` conserva foco, permite Escape y atrapa Tab; la navegación móvil mantiene menos de cinco destinos.

## Mantenimiento preventivo

- `strict` e `isolatedModules` ya están activados en `tsconfig.json`.
- No se hallaron vulnerabilidades en dependencias de producción. No se aplicó `npm audit fix`, porque no había un parche que aplicar.
- La app usa import dinámico para exportar el catálogo (`components/CatalogoMaterialesView.tsx:221-224`), una separación adecuada para una función bajo demanda.
- La limpieza de eventos, streams de cámara y temporizadores revisados sigue patrones de cleanup; no se detectó una fuga confirmada en el barrido.
- Investigar aparte el aviso de `next build` sobre detección del plugin ESLint. El lint sí ejecutó reglas de Next y pasó, por lo que no conviene cambiar la configuración sin reproducir una pérdida de cobertura concreta.

## Triage para una siguiente implementación

### Seguro de implementar sin cambiar política

Corregir 1, 2, 8-22, 30-33, más estados de error/reintento y confirmaciones/etiquetas exactas. Aun así, ejecutar typecheck, lint, suite y casos nuevos por cada flujo afectado.

### Requiere decisión explícita antes de tocarlo

- 3 y 4: transacciones/RPC de kits y topes que afectan integridad de presupuesto.
- 6: retiro o migración de cotizaciones legacy para no dejar requisiciones históricas sin salida.
- 23 y 24: reversibilidad de inactivos y validez de categorías en datos existentes.
- 25-27: semántica exacta de acceso por rol; toda modificación debe acompañarse de pruebas RLS/direct PostgREST.
- 28-29: alcance contractual de trabajo offline y almacenamiento de evidencia fotográfica.

