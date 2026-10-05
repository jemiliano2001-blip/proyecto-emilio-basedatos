# Permisos y consistencia: publicación verificada

Fecha: 2026-10-01. Tras autorización de Emilio, cambios aplicados a Supabase y publicados en Vercel. Complementa la auditoría `2026-10-01-consistencia-flujos-permisos.md`, cuyo diagnóstico describe el estado anterior. La verificación remota incluye configuración, lecturas por perfil SQL, relaciones PostgREST y HTTP; no incluye recorridos autenticados completos en navegador.

## Decisiones confirmadas por Emilio

- Personal puede tener varios proyectos asignados; Acceso Total administra la asignación en Usuarios.
- Crear y editar proyectos sigue reservado a Operación y Acceso Total.
- Personal puede solicitar y confirmar traspasos de sus proyectos asignados.

## Comportamiento implementado

| Área | Resultado local |
|---|---|
| Asignaciones | Usuarios permite reemplazar atómicamente el conjunto de proyectos de una cuenta Personal. Sin asignación, no obtiene acceso a proyectos. No se asignan proyectos automáticamente. |
| Alcance de Personal | Proyectos, inventario y cantidades quedan sujetos a asignación. Solicitudes y detalle de recepción conservan además el control de propietario. Solicitar traspaso exige acceso a ambos proyectos; confirmar exige acceso al destino. |
| Identidad activa | RPC de escritura/consulta privilegiada rechazan ausencia de identidad o rol activo. Las políticas restrictivas también impiden lectura con perfil inactivo. |
| Datos financieros | Vistas de lectura entregan NULL en precio base, presupuesto MXN e importe de partidas para Personal; las columnas sensibles de tablas base dejan de tener SELECT directo. Oficina usa las mismas vistas conservando importes. Consultas de kits adaptadas al nuevo contrato. |
| Documentos | Bucket `obra-documentos` privado; Personal no obtiene documentos clasificados como presupuesto/conciliación. Apertura autenticada por ID con política de proyecto/tipo y URL firmada de 60 segundos. |
| Navegación | Abastecimiento abre únicamente las pestañas pertinentes por rol; Personal tiene acceso uniforme a traspasos. La guía de roles refleja los permisos reales. |
| Solicitudes | Historial explícito conserva filtros y paginación. La selección en lote determina una etapa homogénea: Compras o Finanzas; el servidor valida esa etapa y su permiso, incluido Acceso Total. |
| Servicios | Flete, camiones y otras partidas de servicio participan en cotización; requieren proveedor activo e importe positivo antes de Compras y pago. La RPC mantiene reserva/gasto y emisión de OC existentes. No se añadió un flujo nuevo de recepción física de servicios. |
| Recepciones | Metadatos de fotografías y vínculos de cabecera/renglones se guardan en una RPC atómica. Si falla la evidencia después de guardar la recepción, aparece éxito parcial con recuperación usando el mismo ID. Finanzas conserva lectura sin permiso de captura/evidencia. |
| Instalaciones | Cola IndexedDB aislada por usuario y sincronización con ID estable; repetir una captura idéntica devuelve el mismo registro. Reutilizar el ID con otro contenido o exceder inventario produce conflicto. |
| Indicadores | Se retiraron porcentajes y series inventados. Un error de saldo financiero se muestra como dato no disponible, con reintento; no se sustituye por presupuesto completo. `Finalizada` se aclara como pago/OC emitida. |

## Migraciones para revisión

| Archivo | Alcance |
|---|---|
| `0034_acceso_proyectos_y_recepciones.sql` | Asignaciones, guardas activas y alcance de proyectos/propietario en RLS/RPC. Restaura lectura de recepción para Finanzas tras redefiniciones antiguas. |
| `0034a_preparacion_publicacion.sql` | Prepara vistas protegidas y RPC de evidencia antes de promover el frontend. Conserva permisos de columnas/escrituras y bucket de la versión anterior. |
| `0035_lecturas_financieras_y_documentos.sql` | Vistas sin importes para Personal, permisos de columnas, vistas de cantidades acotadas y documentos privados. |
| `0036_instalaciones_idempotentes.sql` | ID estable, bloqueo por proyecto, validación de cantidad/saldo y reintentos sin duplicar instalación. |
| `0037_evidencias_recepcion_atomicas.sql` | Evidencia/metadatos transaccionales y validación de pertenencia al checklist. |
| `0038_cotizacion_servicios.sql` | Proveedor activo e importe positivo para servicios en Compras y pago, preservando funciones financieras instaladas. |
| `0039_health_sin_datos.sql` | Recupera `/api/health` con SELECT(id) anónimo y política restrictiva que devuelve cero filas; no habilita importes ni wildcard. |

La inspección remota de solo lectura mostró que `0019_evidencias_fotograficas_metadatos.sql` no estaba aplicada y faltaba `recepcion_fotos`. **En ese estado, aplicar 0019 antes de 0034–0038**. Aplicarla después reemplazaría funciones protegidas. 0037 aborta si falta esa tabla. El historial de 0027 no basta: 0038 depende de las definiciones efectivas con el comportamiento de cotización encontrado y aborta si no reconoce sus puntos de inserción. Revisar definiciones y secuencia inmediatamente antes de autorizar la aplicación; no volver a ejecutar migraciones antiguas sobre las guardas nuevas.

Este conjunto cambia permisos y contrato del frontend. La revisión automática rechazó aplicar 0035 con el frontend antiguo activo, por riesgo de interrupción. Se ajustó la publicación a dos etapas compatibles: **0019 → 0034 → 0034a → 0036 → promover frontend nuevo → 0035 → 0037 → 0038**. Primero crear build de producción con `--skip-domain` y confirmar READY. 0034a crea lecturas/RPC nuevas sin revocar permisos base, escrituras de fotos ni cambiar el bucket; 0036 mantiene llamadas antiguas de cuatro argumentos mediante DEFAULT. Promover ese build antes de completar las restricciones de 0035/0037. La preparación no completa el cierre financiero hasta que se aplique 0035. No ejecutar un rollback automático de permisos financieros.

Después del SQL, Acceso Total debe asignar proyectos a Personal antes de reanudar su operación. La ausencia de asignaciones bloquea el acceso por diseño. No hay borrado de proyectos, solicitudes o catálogo ni reasignación masiva implícita. Los enlaces públicos antiguos de `obra-documentos` dejan de funcionar al volver privado el bucket; la aplicación utiliza la apertura autenticada por ID.

## Evidencia de validación

- Suite final `npm.cmd test`: **62/62 aprobadas**, exit 0. Además de las diez regresiones iniciales, cubre preparación compatible de publicación y salud anónima sin acceso a datos. Ambas reprodujeron su falla antes del fix y luego pasaron.
- `npm.cmd run typecheck`: exit 0.
- `npm.cmd run lint`: exit 0.
- `npm.cmd run build`: exit 0; compilación de producción de Next.js y endpoints nuevos.
- Revisión independiente del diff: aprobada sin hallazgos pendientes de alta confianza; ejecutó además las 10 pruebas dirigidas. Detectó dos embeds de kits contra columnas base revocadas y se corrigieron antes del cierre.
- Regresiones reproducidas antes del fix cuando fue viable: acceso ajeno/inactivo en recepción, lectura financiera directa y falta de contrato idempotente. Las pruebas nuevas también cubren asignación inválida sin pérdida de asignaciones previas, Finanzas tras 0019, rollback de evidencia, servicios con presupuesto/OC y traspasos de destino asignado.

Los tests SQL corren en PGlite con fixture de Auth/Storage; los de cola usan IndexedDB simulado. No prueban infraestructura de Storage, cookies, relaciones PostgREST ni navegación autenticada en producción. Las vistas preservan claves para relaciones, conforme al contrato de [PostgREST sobre embedding de vistas](https://postgrest.org/en/v12/references/api/resource_embedding.html); los embeds deben comprobarse en el servidor real después de refrescar su esquema.

## Comprobación después de la publicación autorizada

1. Acceso Total asigna dos proyectos a Personal y verifica que un ID de un tercero no permite lectura ni escritura. Cuenta sin asignaciones e inactiva quedan bloqueadas.
2. Personal consulta catálogo/proyecto/inventario y solicita materiales sin importes; no abre presupuesto/conciliación ni recepción ajena por URL o RPC. También solicita entre proyectos asignados y confirma en destino asignado.
3. Operación y Acceso Total abren Nuevo proyecto y asignación de materiales con kits cargados; Proyectos mantiene sus facultades sin crear/editar proyectos.
4. Compras aprueba una solicitud con material y servicio/proveedor; Finanzas paga una sola vez y puede leer recepción sin capturarla. Acceso Total ejecuta ambos tipos de lote según etapa y abre historial completo.
5. Documento operativo permitido abre con firma; documento financiero rechazado para Personal y URL pública antigua inaccesible. Verificar Storage real, relaciones de vistas y caché del esquema.
6. Instalación offline se sincroniza una sola vez tras reintento; otra cuenta no lee la cola. Un conflicto conserva el registro para revisión. Falla de evidencia muestra estado parcial y la recuperación no crea otra recepción.

## Límites pendientes

- **Fotografías/remisiones:** continúan en el bucket público `materiales`. Ocultar columnas MXN o proteger PDFs no elimina un precio impreso en una fotografía ni revoca URLs ya compartidas. Hace falta diseñar almacenamiento privado de evidencias y tratamiento de archivos históricos; este cierre no declara resuelta esa privacidad. No se volvió privado `materiales`, porque también aloja fotos públicas del catálogo.
- La clasificación del documento la captura quien lo sube; no se analiza su contenido para detectar importes dentro de un plano u otro documento operativo.
- Una URL firmada ya emitida sigue utilizable durante sus 60 segundos de vigencia. No se declara revocación inmediata de enlaces emitidos.
- Una falla entre subir una foto a Storage y vincularla puede dejar un objeto huérfano; la RPC garantiza atomicidad de datos, no una transacción distribuida con Storage.
- Publicación y SQL ya autorizados/aplicados. Quedan pendientes recorridos completos con sesiones reales y descargas Storage: no había documentos ni recepciones reales para comprobar estos últimos sin fabricar transacciones.

## Publicación observada

- Sitio: [Proyecto Emilio](https://proyecto-emilio-basedatos.vercel.app).
- Vercel: `dpl_3UeyjUx2rvxDbjZpN5q6HktffRYy`, target production, READY. Build remoto 1m29s; producción y alias principal comprobados contra ese mismo ID. Copia de 240 archivos de aplicación, sin `.env*`, grafo privado ni instrucciones ajenas. Hashes cotejados con el checkout antes de promover. No commit/push.
- Secuencia efectiva del historial remoto: 0019 (18:53:14 UTC), 0034 (18:53:19), 0034a (18:59:51), 0036 (18:59:57), promoción del build, 0035 (19:01:08), 0037 (19:01:13), 0038 (19:01:18), 0039 (19:09:35).
- 0035 se rechazó inicialmente por revisión automática por riesgo de interrumpir el frontend anterior. No se ejecutó ese intento. Se prepararon contratos compatibles, se verificó que las columnas antiguas continuaban disponibles, se promovió el frontend y se completó 0035 después. Ajuste probado y aprobado en revisión independiente.
- El chequeo HTTP encontró `/api/health` 503 después de revocar SELECT anónimo. La causa se confirmó por ACL, y 0039 se añadió con regresión/revisión. Después: `/api/health` **200**, `healthy`, `database.connected`; `/login` **200** con formulario. Lectura anónima real: cero filas y presupuesto denegado.
- Endpoints publicados de documento e instalación: sin sesión Supabase respondieron **401**, sin escrituras.
- PostgREST real: tres consultas de embedding (kits/items, material principal y solicitud/obra/partidas/material) respondieron **200**. Se verificó estructura usando credenciales solo dentro del proceso; no se imprimieron secretos ni payloads comerciales.
- Perfil Personal en SQL real: cero proyectos/solicitudes al tener cero asignaciones; precios enmascarados, checklist/recepciones acotados. Acceso Total: conserva un proyecto, una solicitud y veinte materiales visibles. Solo SELECT y transacciones revertidas; no se añadieron compras, recepciones, asignaciones ni documentos de prueba.
- ACL y RLS reales: columnas financieras directas denegadas, DML directo de fotos denegado, nueva tabla con RLS, RPC de evidencia denegada a anon y bucket `obra-documentos` privado. Catálogo/proyectos/solicitudes conservan conteos 20/1/1; recepciones/documentos 0/0.
- Logs del deployment desde 19:09:44 UTC: **0 entradas de nivel error** en la consulta realizada. Ventana breve después del fix; no demuestra ausencia de errores futuros.

### Asesor de seguridad de Supabase

El asesor no quedó sin alertas: marcó seis [vistas con permisos del propietario](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), usadas intencionalmente con filtros explícitos de identidad/proyecto y enmascaramiento porque el rol PostgreSQL compartido pierde lectura de columnas base. Se contrastaron fuentes, regresiones y lecturas reales; no se cambió a security_invoker, que rompería ese contrato. Esta excepción queda documentada, no se oculta el resultado ERROR del asesor.

También reportó dos [funciones históricas ejecutables por anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) (`eliminar_item_solicitud`, `fn_usuarios_before_update`), 38 [funciones definer ejecutables por authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), y [protección de contraseñas filtradas deshabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Las funciones de negocio mantienen guardas de rol/identidad; el inventario de estos avisos no equivale a exposición probada. No se modificaron configuraciones de Auth ni permisos históricos fuera de este lote para silenciar avisos.

Graphify: impacto de roles y sincronización consultado y contrastado con fuentes/SQL. Una actualización AST local con `GRAPHIFY_NO_AUTO_REFRESH=1 graphify update . --no-cluster`, exit 0; respaldo privado conservado. JSON válido: de 1590 nodos/4769 relaciones a 1841/5250. Verificada presencia y ubicación de `asignarProyectosUsuarioAction`, `syncInstalacionPayload`, `validateInstalacionInput`, `etapaAprobacionLote` y `UsuarioProyectosForm`. Grafo excluido de Git; sin pasada semántica. No sustituye pruebas de permisos ni actualiza HTML/wiki por sí solo.

Cierre de la fase de publicación: una actualización AST adicional por las regresiones nuevas, con respaldo privado; JSON válido 1844 nodos/5256 relaciones y `tests_access_fixture_accessfixture` cotejado contra `tests/access-fixture.mjs`. Sin semántica ni publicación del grafo. Lección de salud y hub actualizados en Obsidian con evidencia real y límites; sin commit/push del vault.
