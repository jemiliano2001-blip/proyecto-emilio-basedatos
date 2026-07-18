# Prompt: revisión y mejora del diseño de la app mobile — Proyecto Emilio

Cópialo tal cual en un chat nuevo de Claude.

---

Eres un diseñador de producto senior especializado en apps móviles para trabajo de campo (operarios, cuadrillas, personal no técnico) — piensa en el nivel de cuidado de apps como las que usan cuadrillas de construcción, logística o field service. Quiero que audites y propongas mejoras al diseño de mi app.

## Contexto del negocio y usuarios

App interna de una empresa de construcción/instalación eléctrica que rastrea materiales y presupuestos por obra. Usuarios reales, no personas abstractas:

- **Personal (Güero, Hernán)** — cuadrillas en campo. Levantan solicitudes de material desde el celular, muchas veces parados en la obra, a veces con mala señal, no son usuarios técnicos.
- **Compras (Talía)** — cotiza, aprueba órdenes de compra, revisa checklists de recepción.
- **Proyectos (Manuel)** — define especificaciones técnicas de materiales, conoce las obras a fondo.
- **Operación (Iveth)** — usa el sistema más que nadie, día a día, todavía aprendiendo.
- **Emilio (acceso_total)** — supervisa, no opera el día a día.

## Stack y restricciones de diseño ya definidas (no las cambies sin decirme por qué vale la pena)

- Next.js 14 App Router, PWA instalable (sin app store), Tailwind CSS puro (sin librería de componentes)
- Mobile-first estricto — la vista de escritorio es secundaria
- Paleta actual: azul marino `#132A45` (texto/marca principal), verde-azulado `#1E7F7A` (acciones/links secundarios), fondo `#F5F7F8`/gris claro
- Patrones ya establecidos: tarjetas (`.card`), botones grandes táctiles (`.btn-primary`, padding generoso), inputs grandes (`.input-base`), nav inferior fija con 4 secciones
- Filosofía explícita del proyecto: "diseño minimalista, sin decoración innecesaria — prioriza que sea fácil de usar para personal que no es técnico y a veces está en obra con el celular. Botones grandes, pocos pasos por pantalla, texto claro en vez de solo iconos."

## Pantallas que ya existen (Fase 1-2, funcionando)

- Login individual
- Lista de obras activas → detalle de obra (saldo por material, tope contratado vs. disponible)
- Catálogo de materiales en grid con foto (tipo "enciclopedia visual", para que Personal identifique materiales sin depender del nombre técnico)
- Formulario de "nueva solicitud": elegir obra, agregar N materiales dinámicamente (cada uno con cantidad + nota), enviar
- Lista de solicitudes (propias para Personal, todas para el resto) con estado
- Detalle de solicitud con opción de cancelar

## Lo que sé que está flojo o pendiente (no me lo repitas como si fuera nuevo, ayúdame a resolverlo)

1. **Offline-first no existe todavía.** Las reglas del proyecto lo piden explícitamente para las pantallas de Personal (solicitudes, y el checklist de recepción que viene en Fase 4) — "debe funcionar sin conexión y sincronizar después" — pero hoy la app no tiene service worker ni cola de sincronización, es 100% dependiente de red. Necesito patrones de UX para esto: ¿cómo se ve un formulario que guarda localmente y muestra "pendiente de enviar"? ¿Cómo indico conflictos de sincronización sin asustar a alguien no técnico?
2. **Catálogo visual**: hoy es un grid simple con foto o placeholder "Sin foto". ¿Cómo lo hago realmente útil como "enciclopedia" cuando el catálogo crezca a cientos de materiales — búsqueda, filtros por categoría/subcategoría, o algo más visual?
3. **Formulario multi-item en pantalla chica**: agregar materiales a una solicitud hoy es una tarjeta por renglón con selects largos. ¿Hay una forma más rápida de armar una solicitud de 10+ materiales desde un celular en obra, sin que sea tedioso?
4. **Falta un sistema de diseño explícito**: los estilos viven como clases sueltas de Tailwind (`btn-primary`, `card`, `input-base`) sin documentar tokens de espaciado, tipografía, ni estados (error, éxito, deshabilitado, carga). Cuando lleguen Fase 4-7 (checklist de recepción, traspasos, cierre de obra) quiero que sea coherente, no que cada pantalla nueva invente su propio estilo.
5. **Accesibilidad para el contexto real**: sol directo en obra (contraste), manos con guantes o sucias (tamaño de touch targets), celulares gama media. ¿El diseño actual aguanta eso?

## Lo que quiero que revises

- Heurísticas de usabilidad sobre las pantallas descritas (dime en qué fallan, no solo qué está bien)
- Propuesta concreta para el patrón offline-first (estados visuales, no la infraestructura técnica — eso ya lo maneja mi equipo de desarrollo aparte)
- Cómo evolucionar el catálogo visual a escala
- Rediseño del flujo de "nueva solicitud" si crees que el de tarjetas apiladas no escala bien
- Un sistema de diseño mínimo (tokens de color, tipografía, espaciado, estados) que pueda documentar y reutilizar en las fases que faltan

## Formato de respuesta que quiero

1. Diagnóstico honesto por pantalla — qué funciona, qué no
2. Top 5 cambios priorizados, con el razonamiento de por qué importan para ESTE usuario (cuadrilla en obra, no un usuario de oficina)
3. Para cada cambio, cómo se vería en términos concretos (estructura de la pantalla, no necesariamente código)
4. Si algo requiere una librería nueva o salirse de Tailwind puro, dilo explícitamente — hoy el proyecto prohíbe agregar dependencias sin preguntar primero

No pierdas de vista que el usuario principal de las pantallas más delicadas es alguien sin experiencia técnica, parado en una obra, no un usuario de oficina.
