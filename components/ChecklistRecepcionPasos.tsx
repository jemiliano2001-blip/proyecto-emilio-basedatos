import type { ReactNode } from 'react'
import {
  CLASE_BOTON_GRANDE,
  cantidadTexto,
  contarRevisados,
  motivoMateriales,
  moverCantidad,
  noLlegaron,
  pasoDe,
  resumir,
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
  onMarca,
  onBien,
  onRotos,
  onNota,
  onQuien,
  onTerminar,
}: {
  paso: PasoChecklist
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
  const cuenta = contarRevisados(base, renglones)
  const bloqueoMateriales = motivoMateriales(base, renglones)
  const bloqueoTalon = tieneTalon ? null : 'Falta la foto del talón.'
  const bloqueo = bloqueoMateriales ?? bloqueoTalon
  const resumen = resumir(base, renglones)
  const tituloPaso =
    paso === 2 ? '¿Qué llegó?' : paso === 3 ? 'Foto del talón o remisión' : 'Revisa y termina'

  return (
    <div className="flex w-full flex-col gap-4" data-checklist="recepcion" data-paso={paso}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onAtras}
          className="inline-flex min-h-12 items-center px-1 text-base font-semibold text-primary"
        >
          Atrás
        </button>
        <p className="text-base text-muted-foreground">{paso} de 4</p>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Recibir material</h1>
        <p className="text-base text-foreground">
          {folio} · {obraNombre}
        </p>
      </div>
      <h2 className="text-xl font-semibold text-foreground">{tituloPaso}</h2>
      {aviso && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-base text-danger-soft-foreground">
          {aviso}
        </p>
      )}

      {paso === 2 && (
        <div className="flex w-full flex-col gap-3">
          <p className="text-base font-semibold text-foreground" data-contador="1">
            {cuenta.texto}
          </p>
          {materiales.map((material) => {
            const faltan =
              material.bien === null || material.rotos === null
                ? null
                : noLlegaron(material.esperado, material.bien, material.rotos)
            return (
              <article
                key={material.orden_item_id}
                className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div>
                  <p className="text-base font-semibold text-foreground">{material.nombre}</p>
                  <p className="text-base text-muted-foreground">
                    Esperado: {cantidadTexto(material.esperado, material.unidad)}
                  </p>
                </div>
                <button
                  type="button"
                  data-marca="llego"
                  aria-pressed={material.marca === 'llego'}
                  onClick={() => onMarca(material.orden_item_id, 'llego')}
                  className={claseMarca('llego', material.marca === 'llego')}
                >
                  ✅ Llegó
                </button>
                <button
                  type="button"
                  data-marca="incompleto"
                  aria-pressed={material.marca === 'incompleto'}
                  onClick={() => onMarca(material.orden_item_id, 'incompleto')}
                  className={claseMarca('incompleto', material.marca === 'incompleto')}
                >
                  ⚠️ Llegó incompleto o dañado
                </button>
                <button
                  type="button"
                  data-marca="no_llego"
                  aria-pressed={material.marca === 'no_llego'}
                  onClick={() => onMarca(material.orden_item_id, 'no_llego')}
                  className={claseMarca('no_llego', material.marca === 'no_llego')}
                >
                  ❌ No llegó
                </button>
                {material.marca === 'incompleto' && (
                  <div className="flex w-full flex-col gap-3">
                    <Stepper
                      etiqueta="¿Cuántos llegaron bien?"
                      valor={material.bien}
                      tope={Math.max(0, material.esperado - (material.rotos ?? 0))}
                      onChange={(valor) => onBien(material.orden_item_id, valor)}
                    />
                    <Stepper
                      etiqueta="¿Cuántos llegaron rotos?"
                      valor={material.rotos}
                      tope={Math.max(0, material.esperado - (material.bien ?? 0))}
                      onChange={(valor) => onRotos(material.orden_item_id, valor)}
                    />
                    <p className="text-base text-foreground">
                      No llegaron:{' '}
                      {faltan === null ? '—' : cantidadTexto(faltan, material.unidad)}
                    </p>
                    <label className="flex flex-col gap-2 text-base text-foreground">
                      Nota
                      <input
                        value={material.nota}
                        onChange={(evento) => onNota(material.orden_item_id, evento.target.value)}
                        className="min-h-14 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground"
                      />
                    </label>
                    {zonaFotoRenglon(material.orden_item_id)}
                  </div>
                )}
              </article>
            )
          })}
          {bloqueoMateriales && (
            <p role="status" className="text-base text-foreground">
              {bloqueoMateriales}
            </p>
          )}
          <button
            type="button"
            onClick={onSiguiente}
            disabled={bloqueoMateriales !== null}
            className={`${CLASE_BOTON_GRANDE} bg-primary text-primary-foreground disabled:opacity-50`}
          >
            Siguiente
          </button>
        </div>
      )}

      {paso === 3 && (
        <div className="flex w-full flex-col gap-4">
          <p className="text-base text-foreground">Que se lean el folio y la firma.</p>
          {zonaTalon}
          <div className="flex w-full flex-col gap-3">
            <h3 className="text-base font-semibold text-foreground">Fotos extra</h3>
            <p className="text-base text-muted-foreground">Si quieres, agrega más fotos. No son obligatorias.</p>
            {fotosExtra}
          </div>
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
            Foto del talón: {tieneTalon ? 'lista' : 'falta'}
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
