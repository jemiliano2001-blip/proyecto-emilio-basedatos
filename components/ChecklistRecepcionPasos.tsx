import type { ReactNode } from 'react'
import { IconAlerta, IconCerrar, IconCheckCircle, IconFlechaAtras } from '@/components/icons'
import {
  CLASE_BOTON_GRANDE,
  cantidadTexto,
  errorDeRenglon,
  estaRevisado,
  motivoMateriales,
  moverCantidad,
  noLlegaron,
  pasoDe,
  resumir,
  textoProgreso,
  type MarcaChecklist,
  type MaterialChecklist,
  type PasoChecklist,
  type RenglonChecklist,
} from '@/lib/checklist-recepcion'

export interface MaterialVista extends MaterialChecklist {
  marca: MarcaChecklist | null
  bien: number | null
  rotos: number | null
  nota: string
  tieneFoto: boolean
}

function aRenglon(material: MaterialVista): RenglonChecklist {
  return {
    orden_item_id: material.orden_item_id,
    marca: material.marca,
    bien: material.bien,
    rotos: material.rotos,
    nota: material.nota,
    tieneFoto: material.tieneFoto,
  }
}

function claseMarca(marca: MarcaChecklist, activa: boolean): string {
  const base = `${CLASE_BOTON_GRANDE} border-2`
  if (!activa) return `${base} border-border bg-card text-foreground`
  if (marca === 'llego') return `${base} border-success bg-success-soft text-success-soft-foreground`
  if (marca === 'incompleto') {
    return `${base} border-warning bg-warning-soft text-warning-soft-foreground`
  }
  return `${base} border-danger bg-danger-soft text-danger-soft-foreground`
}

function Stepper({
  etiqueta,
  valor,
  tope,
  onChange,
}: {
  etiqueta: string
  valor: number | null
  tope: number
  onChange: (valor: number | null) => void
}) {
  const paso = pasoDe(tope)
  const visible = valor === null ? '' : String(valor)
  return (
    <div className="flex w-full flex-col gap-2">
      <label className="text-base text-foreground">{etiqueta}</label>
      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          aria-label={`Menos ${etiqueta}`}
          onClick={() => onChange(moverCantidad(valor, -paso, tope))}
          className="flex min-h-14 min-w-14 items-center justify-center rounded-xl border border-border bg-card px-3 text-base font-semibold text-foreground"
        >
          Menos
        </button>
        <input
          inputMode="decimal"
          value={visible}
          aria-label={etiqueta}
          onChange={(evento) => {
            const crudo = evento.target.value.trim().replace(',', '.')
            if (crudo === '') {
              onChange(null)
              return
            }
            const numero = Number(crudo)
            if (!Number.isFinite(numero)) return
            onChange(moverCantidad(numero, 0, tope))
          }}
          className="min-h-14 w-full rounded-xl border border-input bg-card px-3 text-center text-base text-foreground"
        />
        <button
          type="button"
          aria-label={`Más ${etiqueta}`}
          onClick={() => onChange(moverCantidad(valor, paso, tope))}
          className="flex min-h-14 min-w-14 items-center justify-center rounded-xl border border-border bg-card px-3 text-base font-semibold text-foreground"
        >
          Más
        </button>
      </div>
    </div>
  )
}

export function ChecklistRecepcionPasos({
  paso,
  indice,
  vistaMaterial,
  folio,
  obraNombre,
  materiales,
  tieneTalon,
  quienEntrego,
  aviso,
  zonaTalon,
  fotosExtra,
  zonaFotoRenglon,
  onAtras,
  onSiguiente,
  onIrAMaterial,
  onMarca,
  onBien,
  onRotos,
  onNota,
  onQuien,
  onTerminar,
}: {
  paso: PasoChecklist
  /** Material que se está viendo. En la foto y el resumen no cambia la pantalla. */
  indice: number
  /** "marca" es la decisión. "detalle" pide cantidad y foto, en otra pantalla. */
  vistaMaterial: 'marca' | 'detalle'
  folio: string
  obraNombre: string
  materiales: MaterialVista[]
  tieneTalon: boolean
  quienEntrego: string
  aviso: string | null
  zonaTalon: ReactNode
  fotosExtra: ReactNode
  zonaFotoRenglon: (ordenItemId: string) => ReactNode
  onAtras: () => void
  onSiguiente: () => void
  /** Salta a otro material de la lista. */
  onIrAMaterial: (indice: number) => void
  onMarca: (ordenItemId: string, marca: MarcaChecklist) => void
  onBien: (ordenItemId: string, valor: number | null) => void
  onRotos: (ordenItemId: string, valor: number | null) => void
  onNota: (ordenItemId: string, nota: string) => void
  onQuien: (valor: string) => void
  onTerminar: () => void
}) {
  const renglones = materiales.map(aRenglon)
  const base = materiales.map(({ orden_item_id, nombre, unidad, esperado }) => ({
    orden_item_id,
    nombre,
    unidad,
    esperado,
  }))
  const bloqueoMateriales = motivoMateriales(base, renglones)
  const revisados = base.filter((row, i) => estaRevisado(row, renglones[i])).length
  const materialActual = materiales[indice] ?? null
  const baseActual = materialActual
    ? (base.find((row) => row.orden_item_id === materialActual.orden_item_id) ?? null)
    : null
  const errorDetalle =
    materialActual && baseActual ? errorDeRenglon(baseActual, aRenglon(materialActual)) : null
  const faltanDetalle =
    !materialActual || materialActual.bien === null || materialActual.rotos === null
      ? null
      : noLlegaron(materialActual.esperado, materialActual.bien, materialActual.rotos)
  const bloqueoTalon = tieneTalon ? null : 'Falta la foto del talón.'
  const bloqueo = bloqueoMateriales ?? bloqueoTalon
  const resumen = resumir(base, renglones)
  const tituloPaso =
    paso === 2
      ? vistaMaterial === 'detalle'
        ? '¿Cuánto llegó mal?'
        : '¿Qué llegó?'
      : paso === 3
        ? 'Foto del talón o remisión'
        : 'Revisa y termina'
  const puesto = paso === 2 ? indice + 1 : Math.max(materiales.length, 1)
  const progreso = textoProgreso(puesto, materiales.length)

  return (
    <div
      className="flex min-h-[calc(100dvh-8rem)] w-full flex-col gap-4"
      data-checklist="recepcion"
      data-paso={paso}
      data-decision={paso === 2 ? vistaMaterial : paso === 3 ? 'talon' : 'terminar'}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onAtras}
            className="-ml-2 inline-flex min-h-12 items-center rounded-lg px-3 text-base font-semibold text-primary"
          >
            <IconFlechaAtras className="mr-1 h-5 w-5" />
            Atrás
          </button>
          <p
            className="rounded-full bg-muted px-4 py-1 text-lg font-semibold tabular-nums text-foreground"
            data-contador="1"
          >
            {progreso}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Material revisado"
          aria-valuemin={0}
          aria-valuemax={materiales.length}
          aria-valuenow={revisados}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-success"
            style={{ width: `${materiales.length === 0 ? 0 : (revisados / materiales.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Recibir material</h1>
        <p className="line-clamp-2 text-sm text-muted-foreground">{obraNombre}</p>
        <p className="text-sm font-semibold text-muted-foreground">{folio}</p>
      </div>
      <h2 className="text-xl font-semibold text-foreground">{tituloPaso}</h2>
      {paso === 2 && materialActual && (
        <div className="rounded-2xl border-2 border-primary bg-primary-soft px-4 py-4">
          <p className="text-2xl font-semibold text-foreground">{materialActual.nombre}</p>
          <p className="mt-1 text-lg text-primary-soft-foreground">
            Esperado: <span className="font-semibold">{cantidadTexto(materialActual.esperado, materialActual.unidad)}</span>
          </p>
        </div>
      )}
      {aviso && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-base text-danger-soft-foreground">
          {aviso}
        </p>
      )}

      {paso === 2 && materialActual && vistaMaterial === 'marca' && (
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            data-marca="llego"
            aria-pressed={materialActual.marca === 'llego'}
            onClick={() => onMarca(materialActual.orden_item_id, 'llego')}
            className={claseMarca('llego', materialActual.marca === 'llego')}
          >
            <IconCheckCircle className="mr-2 h-6 w-6" />
            Llegó
          </button>
          <button
            type="button"
            data-marca="incompleto"
            aria-pressed={materialActual.marca === 'incompleto'}
            onClick={() => onMarca(materialActual.orden_item_id, 'incompleto')}
            className={claseMarca('incompleto', materialActual.marca === 'incompleto')}
          >
            <IconAlerta className="mr-2 h-6 w-6" />
            Llegó incompleto o dañado
          </button>
          <button
            type="button"
            data-marca="no_llego"
            aria-pressed={materialActual.marca === 'no_llego'}
            onClick={() => onMarca(materialActual.orden_item_id, 'no_llego')}
            className={claseMarca('no_llego', materialActual.marca === 'no_llego')}
          >
            <IconCerrar className="mr-2 h-6 w-6" />
            No llegó
          </button>
        </div>
      )}

      {paso === 2 && materialActual && vistaMaterial === 'marca' && (
        <ListaMateriales materiales={materiales} indice={indice} onElegir={onIrAMaterial} />
      )}

      {paso === 2 && materialActual && vistaMaterial === 'detalle' && (
        <div className="mt-auto flex w-full flex-col gap-3">
          <Stepper
            etiqueta="¿Cuántos llegaron bien?"
            valor={materialActual.bien}
            tope={Math.max(0, materialActual.esperado - (materialActual.rotos ?? 0))}
            onChange={(valor) => onBien(materialActual.orden_item_id, valor)}
          />
          <Stepper
            etiqueta="¿Cuántos llegaron rotos?"
            valor={materialActual.rotos}
            tope={Math.max(0, materialActual.esperado - (materialActual.bien ?? 0))}
            onChange={(valor) => onRotos(materialActual.orden_item_id, valor)}
          />
          <p className="text-base text-foreground">
            No llegaron:{' '}
            {faltanDetalle === null ? '—' : cantidadTexto(faltanDetalle, materialActual.unidad)}
          </p>
          <label className="flex flex-col gap-2 text-base text-foreground">
            Nota
            <input
              value={materialActual.nota}
              onChange={(evento) => onNota(materialActual.orden_item_id, evento.target.value)}
              className="min-h-14 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground"
            />
          </label>
          {zonaFotoRenglon(materialActual.orden_item_id)}
          {errorDetalle && (
            <p role="status" className="text-base text-foreground">
              {errorDetalle}
            </p>
          )}
          <button
            type="button"
            onClick={onSiguiente}
            disabled={errorDetalle !== null}
            className={`${CLASE_BOTON_GRANDE} bg-primary text-primary-foreground disabled:opacity-50`}
          >
            Listo
          </button>
        </div>
      )}

      {paso === 3 && (
        <div className="mt-auto flex w-full flex-col gap-4">
          <p className="text-base text-foreground">Que se lean el folio y la firma.</p>
          {zonaTalon}
          {fotosExtra && (
            <div className="flex w-full flex-col gap-3">
              <h3 className="text-base font-semibold text-foreground">Otra foto, si quieres</h3>
              {fotosExtra}
            </div>
          )}
          {bloqueoTalon && (
            <p role="status" className="text-base text-foreground">
              {bloqueoTalon}
            </p>
          )}
          <button
            type="button"
            onClick={onSiguiente}
            disabled={!tieneTalon}
            className={`${CLASE_BOTON_GRANDE} bg-primary text-primary-foreground disabled:opacity-50`}
          >
            Siguiente
          </button>
        </div>
      )}

      {paso === 4 && (
        <div className="flex w-full flex-col gap-4">
          <p className="text-base text-foreground">
            Foto del talón: {tieneTalon ? 'ya está' : 'falta'}
          </p>
          <ResumenGrupo titulo="Llegó" lineas={resumen.llego} />
          <ResumenGrupo titulo="Falta" lineas={resumen.falta} />
          <ResumenGrupo titulo="Dañado" lineas={resumen.danado} />
          <label className="flex flex-col gap-2 text-base text-foreground">
            Quién entregó o número de guía
            <input
              value={quienEntrego}
              onChange={(evento) => onQuien(evento.target.value)}
              className="min-h-14 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground"
            />
          </label>
          {bloqueo && (
            <p role="status" className="text-base text-foreground">
              {bloqueo}
            </p>
          )}
          <button
            type="button"
            data-terminar="1"
            onClick={onTerminar}
            disabled={bloqueo !== null}
            className={`${CLASE_BOTON_GRANDE} bg-primary text-primary-foreground disabled:opacity-50`}
          >
            Terminar
          </button>
        </div>
      )}
    </div>
  )
}

const ESTADO_FILA: Record<MarcaChecklist, { icono: string; texto: string; clase: string }> = {
  llego: { icono: '✓', texto: 'Llegó', clase: 'bg-success text-success-foreground' },
  incompleto: { icono: '!', texto: 'Incompleto', clase: 'bg-warning text-warning-foreground' },
  no_llego: { icono: '✕', texto: 'No llegó', clase: 'bg-danger text-danger-foreground' },
}

function ListaMateriales({
  materiales,
  indice,
  onElegir,
}: {
  materiales: MaterialVista[]
  indice: number
  onElegir: (indice: number) => void
}) {
  if (materiales.length < 2) return null
  return (
    <ol className="flex w-full flex-col gap-2" aria-label="Lista de material">
      {materiales.map((material, i) => {
        const estado = material.marca ? ESTADO_FILA[material.marca] : null
        const actual = i === indice
        return (
          <li key={material.orden_item_id}>
            <button
              type="button"
              aria-current={actual ? 'step' : undefined}
              onClick={() => onElegir(i)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left ${
                actual ? 'border-primary bg-primary-soft' : 'border-border bg-card'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  estado ? estado.clase : 'border-2 border-border'
                }`}
              >
                {estado?.icono}
              </span>
              <span className="min-w-0 flex-1 truncate text-base text-foreground">
                {material.nombre}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {estado ? estado.texto : 'Pendiente'}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function ResumenGrupo({
  titulo,
  lineas,
}: {
  titulo: string
  lineas: { orden_item_id: string; nombre: string; texto: string }[]
}) {
  return (
    <section className="flex w-full flex-col gap-2">
      <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
      {lineas.length === 0 ? (
        <p className="text-base text-muted-foreground">Nada en esta lista.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lineas.map((linea) => (
            <li key={linea.orden_item_id} className="text-base text-foreground">
              <span className="font-semibold">{linea.nombre}. </span>
              {linea.texto}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
