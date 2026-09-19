'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Avatar } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SelectCustom } from '@/components/ui/select-custom'
import { FileUploader } from '@/components/ui/file-uploader'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Card, CardCaregiver, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { KpiMetricCard } from '@/components/ui/kpi-metric-card'
import { DataTable, type ColumnDef } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { HeroCaregiverSection } from '@/components/marketing/HeroCaregiverSection'
import { BentoFeatureGrid } from '@/components/marketing/BentoFeatureGrid'
import { PricingMatrix } from '@/components/marketing/PricingMatrix'
import { FaqAccordion } from '@/components/marketing/FaqAccordion'

interface DemoRow {
  id: string
  codigo: string
  nombre: string
  categoria: string
  disponible: number
  unidad: string
  estatus: 'disponible' | 'bajo_stock' | 'agotado'
}

const DEMO_TABLE_DATA: DemoRow[] = [
  { id: '1', codigo: 'MAT-001', nombre: 'Tubo Conduit PVC Pesado 2"', categoria: 'Obra Civil', disponible: 140, unidad: 'PZA', estatus: 'disponible' },
  { id: '2', codigo: 'MAT-002', nombre: 'Transformador Trifásico 75kVA', categoria: 'Electromecánico', disponible: 2, unidad: 'PZA', estatus: 'bajo_stock' },
  { id: '3', codigo: 'MAT-003', nombre: 'Cable de Cobre THW Cal. 2/0', categoria: 'Electromecánico', disponible: 650, unidad: 'MTR', estatus: 'disponible' },
  { id: '4', codigo: 'MAT-004', nombre: 'Registro de Concreto 60x60x80cm', categoria: 'Obra Civil', disponible: 0, unidad: 'PZA', estatus: 'agotado' },
  { id: '5', codigo: 'MAT-005', nombre: 'Conector Subterráneo 200A', categoria: 'Electromecánico', disponible: 32, unidad: 'PZA', estatus: 'disponible' },
  { id: '6', codigo: 'MAT-006', nombre: 'Luminaria Alumbrado Público LED 100W', categoria: 'Electromecánico', disponible: 18, unidad: 'PZA', estatus: 'disponible' },
]

export default function SistemaDisenoPage() {
  const [activeTab, setActiveTab] = React.useState('atomos')
  const [switchVal, setSwitchVal] = React.useState(true)
  const [selectVal, setSelectVal] = React.useState('obra-civil')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [btnLoading, setBtnLoading] = React.useState(false)

  const tableColumns: ColumnDef<DemoRow>[] = [
    { key: 'codigo', header: 'Código', sortable: true },
    { key: 'nombre', header: 'Material / Descripción', sortable: true },
    { key: 'categoria', header: 'Categoría', sortable: true },
    {
      key: 'disponible',
      header: 'Disponible',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-foreground">
          {row.disponible} {row.unidad}
        </span>
      ),
    },
    {
      key: 'estatus',
      header: 'Estatus',
      align: 'center',
      render: (row) => {
        if (row.estatus === 'disponible') {
          return <Badge variant="success">Disponible</Badge>
        }
        if (row.estatus === 'bajo_stock') {
          return <Badge variant="warning">Bajo Stock</Badge>
        }
        return <Badge variant="danger">Agotado</Badge>
      },
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Top Banner de Navegación */}
      <div className="border-b border-border/80 bg-card/90 px-4 py-3 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <span>←</span>
              <span>Volver a ObraTrack</span>
            </Link>
            <span className="text-border">|</span>
            <span className="hero-pill">
              🎨 Especificación UI/UX 2026: Cálido & Orgánico (El Cuidador)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            >
              ⌘K Buscador
            </Button>
            <Button size="xs" onClick={() => setDialogOpen(true)}>
              Probar Modal
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-12">
        {/* Cabecera del Estudio de Diseño */}
        <div className="rounded-3xl border border-amber-200/70 bg-gradient-to-r from-amber-50/70 via-card to-card p-6 sm:p-10 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-3 py-1 rounded-full">
                SaaS Dashboard · B2B Enterprise · The Caregiver
              </span>
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mt-3">
                Sistema de Diseño UI/UX 2026
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-[70ch]">
                Implementación con rigor de producción de la arquitectura en 4 capas de diseño atómico, regla 60-30-10, contraste WCAG AAA y radio consistente de 16px.
              </p>
            </div>

            {/* Muestras de Color 60-30-10 */}
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-xs">
              <div className="flex flex-col items-center">
                <div className="size-8 rounded-xl bg-[#F8FAFC] border border-border shadow-xs" title="60% Lienzo #F8FAFC" />
                <span className="text-[10px] font-mono text-muted-foreground mt-1">60%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="size-8 rounded-xl bg-[#FFFFFF] border border-border shadow-xs" title="30% Estructural #FFFFFF" />
                <span className="text-[10px] font-mono text-muted-foreground mt-1">30%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="size-8 rounded-xl bg-[#0369A1] shadow-xs" title="10% Acento CTA #0369A1" />
                <span className="text-[10px] font-mono text-muted-foreground mt-1 font-bold text-[#0369A1]">10%</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="size-8 rounded-xl bg-[#0F766E] shadow-xs" title="Soporte #0F766E" />
                <span className="text-[10px] font-mono text-muted-foreground mt-1 text-[#0F766E]">Sec</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pestañas para navegar las 4 Capas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} variant="segmented">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
            <TabsTrigger value="atomos">Capa 1: Átomos</TabsTrigger>
            <TabsTrigger value="moleculas">Capa 2: Moléculas</TabsTrigger>
            <TabsTrigger value="aplicacion">Capa 3: Aplicación</TabsTrigger>
            <TabsTrigger value="marketing">Capa 4: Marketing</TabsTrigger>
          </TabsList>

          {/* ==================== CAPA 1: ÁTOMOS ==================== */}
          <TabsContent value="atomos" className="space-y-8 mt-6">
            {/* Botones y Matriz de Estados */}
            <CardCaregiver>
              <CardHeader className="p-0 pb-4">
                <CardTitle>1.1 Botones & Matriz de Estados Obligatoria</CardTitle>
                <CardDescription>
                  Radio ergonómico consistente de 16px (rounded-2xl), compresión física active:scale-[0.98], opacidad hover 90%, foco accesible ring-2 y spinner SVG.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-6">
                {/* Variantes */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Variantes Cromáticas
                  </h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="default">Primario (#0369A1)</Button>
                    <Button variant="support">Soporte (#0F766E)</Button>
                    <Button variant="secondary">Secundario</Button>
                    <Button variant="soft">Tinte Suave</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Peligro / Destructivo</Button>
                  </div>
                </div>

                {/* Tamaños */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Escala de Tamaños (Touch Targets ≥44px para Campo)
                  </h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="lg">Grande (48px - Obra)</Button>
                    <Button size="default">Estándar (44px - Táctil)</Button>
                    <Button size="sm">Compacto (40px - Oficina)</Button>
                    <Button size="xs">Micro (32px - Toolbars)</Button>
                  </div>
                </div>

                {/* Estados Físicos */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Estados de Interacción
                  </h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => setBtnLoading(!btnLoading)} loading={btnLoading}>
                      {btnLoading ? 'Cargando...' : 'Clic para Simular Carga'}
                    </Button>
                    <Button disabled title="Acción deshabilitada por falta de permisos">
                      Deshabilitado (Tooltip)
                    </Button>
                    <Button className="focus-visible:ring-2 focus-visible:ring-ring">
                      Foco Accesible
                    </Button>
                  </div>
                </div>
              </CardContent>
            </CardCaregiver>

            {/* Badges y Etiquetas Semánticas */}
            <Card>
              <CardHeader>
                <CardTitle>1.2 Badges & Etiquetas de Estado</CardTitle>
                <CardDescription>
                  Variantes solid, soft y outline para estados semánticos con contraste reforzado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold w-20 text-muted-foreground">Soft (UI):</span>
                    <Badge variant="success">Éxito (#10B981)</Badge>
                    <Badge variant="warning">Advertencia (#F59E0B)</Badge>
                    <Badge variant="danger">Error / Retraso (#EF4444)</Badge>
                    <Badge variant="info">Información (#0369A1)</Badge>
                    <Badge variant="secondary">Neutro</Badge>
                    <Badge variant="success" dot>Con indicador Dot</Badge>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold w-20 text-muted-foreground">Solid:</span>
                    <Badge variant="solid-success">Aprobado</Badge>
                    <Badge variant="solid-warning">Por Cotizar</Badge>
                    <Badge variant="solid-danger">Cancelado</Badge>
                    <Badge variant="solid-info">En Ruta</Badge>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold w-20 text-muted-foreground">Outline:</span>
                    <Badge variant="outline-success">Recepción OK</Badge>
                    <Badge variant="outline-warning">Revisión</Badge>
                    <Badge variant="outline-danger">Merma</Badge>
                    <Badge variant="outline-info">OC Generada</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inputs, Textareas, Switches y Avatares */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>1.3 Campos de Entrada & Error Explícito</CardTitle>
                  <CardDescription>
                    Cumplimiento WCAG AAA: nunca confiar solo en el color para errores; añadir icono y texto de apoyo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="field-label">Nombre del Material o Partida</label>
                    <Input placeholder="Ej. Transformador monofásico 25kVA..." />
                    <p className="field-hint">Ingrese la descripción técnica completa según catálogo.</p>
                  </div>

                  <div>
                    <label className="field-label">Campo con Error Validado</label>
                    <Input error defaultValue="Cantidad negativa" />
                    <p className="field-error">
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      La cantidad solicitada debe ser un valor positivo mayor a cero.
                    </p>
                  </div>

                  <div>
                    <label className="field-label">Notas de Observación en Obra</label>
                    <Textarea placeholder="Escribe detalles adicionales de entrega o remisión..." />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>1.4 Switches & Avatares con Estado</CardTitle>
                  <CardDescription>
                    Componentes táctiles de control y presencia de usuario con pulso animado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Switches */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Interruptores Accesibles
                    </h4>
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/80">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Modo Fuera de Línea</p>
                        <p className="text-xs text-muted-foreground">Habilita almacenamiento local en IndexedDB</p>
                      </div>
                      <Switch checked={switchVal} onCheckedChange={setSwitchVal} />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/80">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Alertas por WhatsApp</p>
                        <p className="text-xs text-muted-foreground">Notificar al proveedor al emitir OC</p>
                      </div>
                      <Switch defaultChecked={false} />
                    </div>
                  </div>

                  {/* Avatares */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Avatares con Badge de Estado (Online / Busy / Offline)
                    </h4>
                    <div className="flex items-center gap-4">
                      <Avatar name="Emilio Sánchez" status="online" size="lg" />
                      <Avatar name="Talía Compras" status="busy" size="md" />
                      <Avatar name="Blanquita Finanzas" status="online" size="md" />
                      <Avatar name="Manuel Proyectos" status="offline" size="sm" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==================== CAPA 2: MOLÉCULAS ==================== */}
          <TabsContent value="moleculas" className="space-y-8 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Select Accesible */}
              <Card>
                <CardHeader>
                  <CardTitle>2.1 Select Custom Accesible</CardTitle>
                  <CardDescription>
                    Dropdown con navegación por teclado (flechas, Enter, Esc), búsqueda rápida y 16px de radio.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SelectCustom
                    label="Categoría de Material"
                    value={selectVal}
                    onChange={setSelectVal}
                    searchable
                    options={[
                      { value: 'obra-civil', label: 'Obra Civil (Registros, Tubería)', description: 'Registros, ductos y bases' },
                      { value: 'transformadores', label: 'Transformadores & Subestación', description: 'Monofásicos y trifásicos' },
                      { value: 'cableado', label: 'Cableado Eléctrico', description: 'Cobre, aluminio y THW' },
                      { value: 'accesorios-sub', label: 'Accesorios Subterráneos', description: 'Conectores, terminales y empalmes' },
                      { value: 'alumbrado', label: 'Alumbrado Público', description: 'Luminarias LED y postes' },
                    ]}
                  />

                  <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 text-xs text-stone-800">
                    <strong>Seleccionado:</strong> {selectVal}
                  </div>
                </CardContent>
              </Card>

              {/* Date Range Picker */}
              <Card>
                <CardHeader>
                  <CardTitle>2.2 Selector de Rango de Fechas</CardTitle>
                  <CardDescription>
                    Accesos directos rápidos (Hoy, Semana, Mes) con campos estándar para auditoría.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DateRangePicker label="Período de Solicitudes y Compras" />
                </CardContent>
              </Card>
            </div>

            {/* File Uploader */}
            <Card>
              <CardHeader>
                <CardTitle>2.3 Subidor de Archivos Drag-and-Drop</CardTitle>
                <CardDescription>
                  Área de arrastre con simulación de barra de progreso y micro-interacciones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUploader
                  label="Cargar Evidencia o Factura CFDI XML / PDF"
                  hint="Soporta archivos PDF, XML, JPG, PNG hasta 10MB con validación instantánea."
                  multiple
                />
              </CardContent>
            </Card>

            {/* Variantes de Tabs */}
            <Card>
              <CardHeader>
                <CardTitle>2.4 Variantes de Tabs (Segmented, Pill, Underline)</CardTitle>
                <CardDescription>
                  Soporte completo de navegación por pestañas en 3 estilos ergonómicos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase text-muted-foreground mb-2 block">Pill Tabs:</span>
                  <Tabs defaultValue="t1" variant="pill">
                    <TabsList>
                      <TabsTrigger value="t1">Todos los Proyectos</TabsTrigger>
                      <TabsTrigger value="t2">Activos (4)</TabsTrigger>
                      <TabsTrigger value="t3">Pausados (1)</TabsTrigger>
                      <TabsTrigger value="t4">Cerrados (8)</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div>
                  <span className="text-xs font-bold uppercase text-muted-foreground mb-2 block">Underline Tabs:</span>
                  <Tabs defaultValue="u1" variant="underline">
                    <TabsList>
                      <TabsTrigger value="u1">Partidas Contratadas</TabsTrigger>
                      <TabsTrigger value="u2">Movimientos Financieros</TabsTrigger>
                      <TabsTrigger value="u3">Recepciones de Campo</TabsTrigger>
                      <TabsTrigger value="u4">Documentación</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== CAPA 3: APLICACIÓN ==================== */}
          <TabsContent value="aplicacion" className="space-y-8 mt-6">
            {/* KPI Metric Cards con Sparklines SVG */}
            <div>
              <h3 className="font-heading text-xl font-bold text-foreground mb-4">
                3.1 Tarjetas KPI con Sparklines SVG & Tendencia
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiMetricCard
                  label="Presupuesto Asignado"
                  value="$1,450,000"
                  hint="En 4 proyectos activos"
                  delta={{ value: '14.2%', isPositive: true, label: 'vs mes anterior' }}
                  sparklineData={[30, 45, 40, 60, 55, 75, 70, 90]}
                  sparklineColor="#0369A1"
                  variant="caregiver"
                />

                <KpiMetricCard
                  label="Requisiciones en Proceso"
                  value="12"
                  hint="6 compras · 6 finanzas"
                  delta={{ value: '2 urgentes', isPositive: false }}
                  sparklineData={[15, 12, 18, 14, 20, 16, 12]}
                  sparklineColor="#F59E0B"
                  variant="warning"
                />

                <KpiMetricCard
                  label="Recepciones Completas"
                  value="148"
                  hint="98.5% validadas con foto"
                  delta={{ value: '98.5%', isPositive: true, label: 'cumplimiento' }}
                  sparklineData={[20, 25, 30, 42, 50, 65, 80]}
                  sparklineColor="#10B981"
                  variant="success"
                />

                <KpiMetricCard
                  label="Ahorro en Negociación"
                  value="$84,200"
                  hint="Consolidación de compras"
                  delta={{ value: '6.4%', isPositive: true, label: 'en costo unitario' }}
                  sparklineData={[10, 15, 22, 35, 48, 60, 84]}
                  sparklineColor="#0F766E"
                />
              </div>
            </div>

            {/* Data Table de Alta Densidad */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <CardTitle>3.2 Data Table de Alta Densidad & Paginación</CardTitle>
                    <CardDescription>
                      Ordenamiento por columnas, checkboxes de selección múltiple, estados semánticos y paginación accesible.
                    </CardDescription>
                  </div>
                  <Button size="sm" variant="support">
                    + Nuevo Material
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={DEMO_TABLE_DATA}
                  columns={tableColumns}
                  keyExtractor={(item) => item.id}
                  pageSize={4}
                  onActionClick={(item) => alert(`Acciones para: ${item.nombre}`)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== CAPA 4: MARKETING & SHOWCASE ==================== */}
          <TabsContent value="marketing" className="space-y-12 mt-6">
            {/* Hero Section */}
            <div>
              <h3 className="font-heading text-xl font-bold text-foreground mb-4">
                4.1 Hero Section con Anuncio Pill & Dual CTA
              </h3>
              <HeroCaregiverSection />
            </div>

            {/* Bento Feature Grid */}
            <div>
              <h3 className="font-heading text-xl font-bold text-foreground mb-4">
                4.2 Bento Feature Grid (Asimétrico 1x1, 2x1, 2x2)
              </h3>
              <BentoFeatureGrid />
            </div>

            {/* Pricing Matrix */}
            <div>
              <h3 className="font-heading text-xl font-bold text-foreground mb-4 text-center">
                4.3 Matriz de Tiers de Operación con Selector Mensual/Anual
              </h3>
              <PricingMatrix />
            </div>

            {/* FAQ Accordion */}
            <div className="flex flex-col items-center">
              <h3 className="font-heading text-xl font-bold text-foreground mb-6 text-center">
                4.4 Acordeón Colapsable de Preguntas Frecuentes
              </h3>
              <FaqAccordion />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal Dialog Demostrativo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modal Accesible 2026</DialogTitle>
            <DialogDescription>
              Diálogo modal con elevación suave, foco automático restringido y cierre por tecla Escape o clic en el fondo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <p className="text-sm text-foreground leading-relaxed">
              Este componente modal está diseñado bajo el arquetipo <strong>El Cuidador</strong>, utilizando bordes de 16px, fondo blanco estructurado y contraste reforzado para garantizar accesibilidad universal.
            </p>
            <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/60 text-xs text-stone-800">
              💡 <strong>Regla de oro:</strong> Una acción primaria por modal (#0369A1) con botón secundario claro de cancelación.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-border">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={() => setDialogOpen(false)}>
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
