import { useState, useEffect } from 'react'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
import { Check, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Ingrediente {
  id: number
  nombre: string
}

interface Agregado {
  id: number
  nombre: string
  precio: string
}

interface Variante {
  id: number
  nombre: string
  precio: string
}

interface Product {
  id: number
  nombre: string
  descripcion: string | null
  precio: number | string
  imagenUrl: string | null
  categoria?: string
  ingredientes?: Ingrediente[]
  agregados?: Agregado[]
  variantes?: Variante[]
  variantesSecundarias?: Variante[]
  descuento?: number | null
  descuentoFechaFin?: string | null
}

interface ProductDetailDrawerProps {
  product: Product | null
  open: boolean
  onClose: () => void
  onAddToOrder: (product: Product, quantity: number, ingredientesExcluidos?: number[], agregados?: Agregado[], varianteSeleccionada?: Variante, varianteSecundariaSeleccionada?: Variante) => void
  /** Lista ordenada de productos "hermanos" navegables desde el detalle. Si tiene ≥2
   *  items, se puede pasar al producto anterior/siguiente sin cerrar el drawer. */
  siblings?: Product[]
  /** Se llama con el producto destino al navegar (el padre actualiza el producto abierto). */
  onNavigate?: (product: Product) => void
}

function formatTimeLeft(fechaFin: string | Date | null): string | null {
  if (!fechaFin) return null
  const now = Date.now()
  const end = new Date(fechaFin).getTime()
  const diff = end - now
  if (diff <= 0) return null
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'menos de 1h'
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

/** Altura fija de la imagen (px). Ahora es idéntica en ambas etapas. */
const IMG_H = 220
const SPRING = { type: 'spring' as const, stiffness: 320, damping: 34 }
/** Transición del crossfade deslizante entre el contenido de las dos etapas. */
const SLIDE = { type: 'tween' as const, duration: 0.34, ease: [0.22, 1, 0.36, 1] as const }
/** Transición del deslizamiento horizontal al pasar de un producto a otro. */
const NAV_SLIDE = { type: 'tween' as const, duration: 0.42, ease: [0.32, 0.72, 0, 1] as const }

// Altura base etapa 1: imagen + descripción + botón, sin variantes
const STAGE1_BASE_H = 390
// Cada fila (variante / ingrediente / extra) (py-3.5 + texto + gap)
const ROW_H = 58
// Label "Elegí una opción" / "Ingredientes" / "Extras" + space
const LABEL_H = 44
// Máximo de variantes visibles antes de scroll
const MAX_VISIBLE_VARIANTS = 3
// Base etapa 2: imagen + padding de la hoja + botón agregar
const STAGE2_BASE_H = IMG_H + 168

// ── Variante SIN IMAGEN: diseño plano (sin foto ni hoja superpuesta) ──
// Espeja el card text-only de MenuDelivery: nombre/precio en texto foreground, todo al ras.
// Alto del header de texto (badges + nombre + precio) que reemplaza a la imagen.
const FLAT_HEADER_H = 120
// Bases equivalentes a las de arriba pero descontando la imagen y sumando el header de texto.
const FLAT_STAGE1_BASE_H = STAGE1_BASE_H - IMG_H + FLAT_HEADER_H
const FLAT_STAGE2_BASE_H = STAGE2_BASE_H - IMG_H + FLAT_HEADER_H

// Al navegar entre productos, la tarjeta entrante llega desde el lado del gesto y la
// saliente se va con un leve parallax. `dir` = +1 (siguiente) / -1 (anterior).
const navVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? '100%' : '-100%', opacity: 0.35 }),
  center: { x: '0%', opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? '-42%' : '42%', opacity: 0 }),
}


export function ProductDetailDrawer({ product, open, onClose, onAddToOrder, siblings, onNavigate }: ProductDetailDrawerProps) {
  const [stage, setStage] = useState<'primary' | 'secondary' | 'extras'>('primary')
  const [quantity, setQuantity] = useState(1)
  const [ingredientesExcluidos, setIngredientesExcluidos] = useState<number[]>([])
  const [agregadosSeleccionados, setAgregadosSeleccionados] = useState<Agregado[]>([])
  const [varianteSeleccionada, setVarianteSeleccionada] = useState<Variante | null>(null)
  const [varianteSecundariaSeleccionada, setVarianteSecundariaSeleccionada] = useState<Variante | null>(null)
  const [addCount, setAddCount] = useState(0)
  const [showCounter, setShowCounter] = useState(false)
  // Dirección del último salto entre productos (alimenta la animación de deslizamiento).
  const [navDir, setNavDir] = useState(0)

  useEffect(() => {
    if (open && product) {
      setStage('primary')
      setIngredientesExcluidos([])
      setAgregadosSeleccionados([])
      setVarianteSeleccionada(null)
      setVarianteSecundariaSeleccionada(null)
      setQuantity(1)
      setAddCount(0)
      setShowCounter(false)
    }
  }, [open, product?.id])

  const tieneIngredientes = !!(product?.ingredientes && product.ingredientes.length > 0)
  const tieneAgregados = !!(product?.agregados && product.agregados.length > 0)
  const tieneVariantes = !!(product?.variantes && product.variantes.length > 0)
  const tieneVariantesSecundarias = !!(product?.variantesSecundarias && product.variantesSecundarias.length > 0)
  const needsStage2 = tieneIngredientes || tieneAgregados
  // Producto sin foto → diseño plano (espeja el card text-only del menú).
  const sinImagen = !product?.imagenUrl

  // ── Navegación entre productos ──
  const lista = siblings ?? []
  const currentIndex = product ? lista.findIndex(p => p.id === product.id) : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < lista.length - 1
  // Sólo se navega desde la etapa de selección (en "extras" el usuario está personalizando).
  const puedeNavegar = stage === 'primary' && addCount === 0 && currentIndex >= 0 && lista.length > 1

  const irA = (dir: number) => {
    if (!puedeNavegar) return
    const target = lista[currentIndex + dir]
    if (!target) return
    setNavDir(dir)
    onNavigate?.(target)
  }

  // Flechas del teclado en desktop.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasNext) { e.preventDefault(); irA(1) }
      else if (e.key === 'ArrowLeft' && hasPrev) { e.preventDefault(); irA(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, puedeNavegar, currentIndex, lista])

  // Swipe horizontal sobre la foto (área del header) para saltar de producto.
  const onHeaderDragEnd = (_e: unknown, info: PanInfo) => {
    const off = info.offset.x
    const vel = info.velocity.x
    if ((off < -55 || vel < -450) && hasNext) irA(1)
    else if ((off > 55 || vel > 450) && hasPrev) irA(-1)
  }

  const toggleIngrediente = (id: number) =>
    setIngredientesExcluidos(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const toggleAgregado = (agregado: Agregado) =>
    setAgregadosSeleccionados(prev =>
      prev.find(a => a.id === agregado.id) ? prev.filter(a => a.id !== agregado.id) : [...prev, agregado]
    )

  const variantBloqueada = stage === 'primary'
    ? tieneVariantes && !varianteSeleccionada
    : stage === 'secondary'
      ? tieneVariantesSecundarias && !varianteSecundariaSeleccionada
      : false

  // ── Cálculo de precio ──
  const precioBasePrimario = varianteSeleccionada
    ? parseFloat(varianteSeleccionada.precio)
    : parseFloat(String(product?.precio ?? 0))
  const precioBase = precioBasePrimario + (varianteSecundariaSeleccionada ? parseFloat(varianteSecundariaSeleccionada.precio) : 0)
  const tieneDescuento = !!(product?.descuento && product.descuento > 0)
  const precioUnitConDescuento = tieneDescuento ? precioBase * (1 - (product!.descuento! / 100)) : precioBase
  const precioAgregados = agregadosSeleccionados.reduce((sum, ag) => sum + parseFloat(ag.precio || '0'), 0)
  const total = (precioUnitConDescuento + precioAgregados) * quantity
  const totalTachado = (precioBase + precioAgregados) * quantity

  const handleContinue = () => {
    if (variantBloqueada) return
    if (stage === 'primary' && tieneVariantesSecundarias) {
      setStage('secondary')
    } else if (addCount > 0 || !needsStage2) {
      handleAdd()
    } else {
      setStage('extras')
    }
  }

  const handleAdd = () => {
    if (!product) return
    onAddToOrder(
      product,
      quantity,
      ingredientesExcluidos.length > 0 ? ingredientesExcluidos : undefined,
      agregadosSeleccionados.length > 0 ? agregadosSeleccionados : undefined,
      varianteSeleccionada ?? undefined,
      varianteSecundariaSeleccionada ?? undefined
    )
    const newCount = addCount + 1
    setAddCount(newCount)
    if (newCount >= 2) {
      setShowCounter(true)
      setTimeout(() => setShowCounter(false), 700)
    }
  }

  const handlePrimary = () => (stage === 'extras' ? handleAdd() : handleContinue())

  const timeLeft = tieneDescuento ? formatTimeLeft(product?.descuentoFechaFin ?? null) : null

  // ── Cálculo de altura dinámica del drawer ──
  const variantCount = product?.variantes?.length ?? 0
  const secondaryVariantCount = product?.variantesSecundarias?.length ?? 0
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  const stage1Base = sinImagen ? FLAT_STAGE1_BASE_H : STAGE1_BASE_H
  const stage2Base = sinImagen ? FLAT_STAGE2_BASE_H : STAGE2_BASE_H

  // Etapa 1: mínimo equivalente a 1 variante visible, crece hasta 3, techo en 85vh
  const stage1Height = Math.min(
    Math.max(
      stage1Base + LABEL_H + ROW_H,
      stage1Base + (tieneVariantes ? LABEL_H + Math.min(variantCount, MAX_VISIBLE_VARIANTS) * ROW_H : 0)
    ),
    Math.round(vh * 0.85)
  )

  // Etapa 2: crece para mostrar ingredientes + extras, con techo en 90vh (scroll interno)
  const extrasRows = (tieneIngredientes ? product!.ingredientes!.length : 0) + (tieneAgregados ? product!.agregados!.length : 0)
  const extrasLabels = (tieneIngredientes ? 1 : 0) + (tieneAgregados ? 1 : 0)
  const stage2Height = Math.min(
    stage2Base + extrasLabels * LABEL_H + extrasRows * ROW_H,
    Math.round(vh * 0.9)
  )

  const secondaryHeight = Math.min(
    stage1Base + LABEL_H + Math.max(1, Math.min(secondaryVariantCount, MAX_VISIBLE_VARIANTS)) * ROW_H,
    Math.round(vh * 0.85)
  )
  const drawerHeight = stage === 'extras' ? stage2Height : stage === 'secondary' ? secondaryHeight : stage1Height

  const rowBtn = 'flex items-center justify-between rounded-2xl px-4 py-3.5 text-left transition-colors'
  // Flechas de navegación que flanquean el botón principal — mismo alto/redondeo que el
  // botón, en tono secundario para no competir con la acción primaria.
  const navFlankBtn = 'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground transition-all active:scale-[0.98] disabled:opacity-35 disabled:active:scale-100'

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="overflow-hidden border-none bg-background p-0 outline-none [&>div:first-child]:hidden lg:mx-auto lg:max-w-md lg:rounded-t-[28px]">
        <motion.div
          className="relative overflow-hidden bg-background"
          animate={{ height: drawerHeight }}
          transition={SPRING}
        >
          {product ? (
            <>
              {/* Asa de arrastre — fija, no se desliza con el producto */}
              <div className="pointer-events-none absolute inset-x-0 top-2.5 z-40 flex justify-center">
                <div className={cn('h-1.5 w-10 rounded-full', sinImagen ? 'bg-foreground/20' : 'bg-white/60')} />
              </div>

              {/* Controles de navegación entre productos — fijos sobre la imagen */}
              <AnimatePresence>
                {puedeNavegar && (
                  <>
                    {lista.length > 1 && (
                      <motion.div
                        key="counter"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          'absolute right-3 top-3.5 z-40 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums',
                          sinImagen ? 'bg-foreground/10 text-foreground' : 'bg-black/35 text-white backdrop-blur-md'
                        )}
                      >
                        {currentIndex + 1} / {lista.length}
                      </motion.div>
                    )}
                  </>
                )}
              </AnimatePresence>

              {/* ─────────── CAPA DESLIZANTE POR PRODUCTO ───────────
                  Todo lo que cambia al pasar de un producto a otro (imagen, nombre,
                  precio y contenido) vive acá y se desliza horizontalmente. El asa y
                  los controles de navegación quedan fijos por encima. */}
              <AnimatePresence initial={false} mode="popLayout" custom={navDir}>
                <motion.div
                  key={product.id}
                  custom={navDir}
                  variants={navVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={NAV_SLIDE}
                  className="absolute inset-0"
                >
                  {/* CAPA DE IMAGEN — altura fija en ambas etapas (sólo con foto) */}
                  {!sinImagen && (
                    <div className="absolute inset-x-0 top-0 z-0 overflow-hidden bg-secondary" style={{ height: IMG_H }}>
                      <img
                        src={product.imagenUrl!}
                        alt={product.nombre}
                        draggable={false}
                        className="h-full w-full select-none object-cover"
                      />
                      {/* Gradiente inferior — separa el nombre/precio de la imagen. */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
                      />
                    </div>
                  )}

                  {/* Botón volver — sólo en extras, sobre la imagen (el diseño plano tiene el suyo propio) */}
                  <AnimatePresence>
                    {!sinImagen && stage !== 'primary' && (
                      <motion.button
                        key="back"
                        type="button"
                        onClick={() => setStage(stage === 'extras' && tieneVariantesSecundarias ? 'secondary' : 'primary')}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                        className="absolute left-3 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-colors active:bg-black/50"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* ─────────── COLUMNA DE CONTENIDO ─────────── */}
                  <div className="absolute inset-0 z-10 flex flex-col">
                    {/* Header: sobre la imagen (con foto) o de texto al ras (sin foto). Es también el
                        área de swipe (arrastrá de lado a lado para cambiar de producto). */}
                    <motion.div
                      className={cn(
                        'relative shrink-0 select-none',
                        sinImagen && 'px-6 pt-9',
                        puedeNavegar && 'cursor-grab touch-pan-y active:cursor-grabbing'
                      )}
                      style={sinImagen ? undefined : { height: IMG_H }}
                      drag={puedeNavegar ? 'x' : false}
                      dragDirectionLock
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.18}
                      dragSnapToOrigin
                      onDragEnd={onHeaderDragEnd}
                    >
                      {sinImagen ? (
                        <>
                          {/* Botón volver del diseño plano — al ras, no sobre foto */}
                          <AnimatePresence>
                            {stage !== 'primary' && (
                              <motion.button
                                key="back-flat"
                                type="button"
                                onClick={() => setStage(stage === 'extras' && tieneVariantesSecundarias ? 'secondary' : 'primary')}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                                className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground transition-colors active:bg-secondary/70"
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </motion.button>
                            )}
                          </AnimatePresence>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            {tieneDescuento && (
                              <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                                {product.descuento}% OFF
                              </span>
                            )}
                            {timeLeft && (
                              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                <Clock className="h-3 w-3" /> Vence en {timeLeft}
                              </span>
                            )}
                          </div>
                          <div className="flex items-end justify-between gap-4">
                            <h3 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
                              {product.nombre}
                            </h3>
                            <div className="shrink-0 text-right">
                              {tieneDescuento && (
                                <p className="text-sm font-medium text-muted-foreground line-through">
                                  ${totalTachado.toFixed(2)}
                                </p>
                              )}
                              <p className="text-2xl font-bold text-primary">
                                ${total.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-x-0 bottom-0 px-6 pb-8">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            {tieneDescuento && (
                              <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                                {product.descuento}% OFF
                              </span>
                            )}
                            {timeLeft && (
                              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
                                <Clock className="h-3 w-3" /> Vence en {timeLeft}
                              </span>
                            )}
                          </div>
                          <div className="flex items-end justify-between gap-4">
                            <h3 className="text-[28px] font-bold leading-tight tracking-tight text-white drop-shadow-sm">
                              {product.nombre}
                            </h3>
                            <div className="shrink-0 text-right">
                              {tieneDescuento && (
                                <p className="text-sm font-medium text-white/60 line-through">
                                  ${totalTachado.toFixed(2)}
                                </p>
                              )}
                              <p className="text-2xl font-bold text-white drop-shadow-sm">
                                ${total.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* Hoja inferior: el contenido se cruza entre las dos etapas. Con foto se
                        superpone a la imagen (borde redondeado); sin foto va al ras. */}
                    <div className={cn(
                      'relative flex min-h-0 flex-1 flex-col bg-background',
                      !sinImagen && '-mt-5 rounded-t-[28px]'
                    )}>
                      {/* Área animada — misma posición y misma lógica de scroll en ambas etapas */}
                      <div className="relative min-h-0 flex-1">
                        <AnimatePresence initial={false}>
                          {stage !== 'extras' ? (
                            <motion.div
                              key={`content-${stage}`}
                              initial={{ opacity: 0, x: -40 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -40 }}
                              transition={SLIDE}
                              className="absolute inset-0 flex flex-col"
                            >
                              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 pb-4 pt-6">
                                {stage === 'primary' && <p className="text-[15px] leading-relaxed text-foreground/70">
                                  {product.descripcion || 'Sin descripción.'}
                                </p>}

                                {((stage === 'primary' && tieneVariantes) || (stage === 'secondary' && tieneVariantesSecundarias)) && (
                                  <div className="space-y-1">
                                    <p className="px-1 pb-1 text-[13px] font-medium text-muted-foreground">
                                      {stage === 'primary' ? 'Elegí una opción' : 'Elegí también una segunda opción'}
                                    </p>
                                    <div
                                      className="flex flex-col gap-0.5 overflow-y-auto overscroll-contain"
                                      style={{ maxHeight: MAX_VISIBLE_VARIANTS * ROW_H }}
                                    >
                                      {(stage === 'primary' ? product.variantes! : product.variantesSecundarias!).map((v) => {
                                        const sel = (stage === 'primary' ? varianteSeleccionada : varianteSecundariaSeleccionada)?.id === v.id
                                        return (
                                          <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => stage === 'primary' ? setVarianteSeleccionada(v) : setVarianteSecundariaSeleccionada(v)}
                                            className={cn(rowBtn, sel ? 'bg-primary/10' : 'bg-secondary/50')}
                                          >
                                            <span className={cn('text-[15px]', sel ? 'font-semibold text-primary' : 'text-foreground')}>
                                              {v.nombre}
                                            </span>
                                            <span className="flex items-center gap-2">
                                              <span className={cn('text-[15px]', sel ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                                                {stage === 'secondary'
                                                  ? (parseFloat(v.precio) > 0 ? `+$${parseFloat(v.precio).toFixed(2)}` : 'Sin adicional')
                                                  : `$${parseFloat(v.precio).toFixed(2)}`}
                                              </span>
                                              {sel && <Check className="h-[18px] w-[18px] text-primary" />}
                                            </span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="content-extras"
                              initial={{ opacity: 0, x: 40 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 40 }}
                              transition={SLIDE}
                              className="absolute inset-0 flex flex-col"
                            >
                              <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-6 pb-4 pt-6">
                                {tieneIngredientes && (
                                  <div className="space-y-1">
                                    <p className="px-1 pb-1 text-lg font-bold text-foreground">
                                      Ingredientes
                                    </p>
                                    <div className="flex flex-col gap-0.5">
                                      {product.ingredientes!.map((ing) => {
                                        const incluido = !ingredientesExcluidos.includes(ing.id)
                                        return (
                                          <button
                                            key={ing.id}
                                            type="button"
                                            onClick={() => toggleIngrediente(ing.id)}
                                            className={cn(rowBtn, incluido ? 'bg-secondary/60' : 'bg-secondary/30')}
                                          >
                                            <span
                                              className={cn(
                                                'text-[15px]',
                                                incluido ? 'text-foreground' : 'text-muted-foreground line-through'
                                              )}
                                            >
                                              {ing.nombre}
                                            </span>
                                            {incluido && <Check className="h-[18px] w-[18px] text-foreground/70" />}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}

                                {tieneAgregados && (
                                  <div className="space-y-1">
                                    <p className="px-1 pb-1 text-lg font-bold text-foreground">
                                      Extras
                                    </p>
                                    <div className="flex flex-col gap-0.5">
                                      {product.agregados!.map((ag) => {
                                        const sel = !!agregadosSeleccionados.find(a => a.id === ag.id)
                                        return (
                                          <button
                                            key={ag.id}
                                            type="button"
                                            onClick={() => toggleAgregado(ag)}
                                            className={cn(rowBtn, sel ? 'bg-primary/10' : 'bg-secondary/50')}
                                          >
                                            <span className={cn('text-[15px]', sel ? 'font-semibold text-primary' : 'text-foreground')}>
                                              {ag.nombre}
                                            </span>
                                            <span className="flex items-center gap-2">
                                              <span className={cn('text-[15px]', sel ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                                                +${parseFloat(ag.precio).toFixed(2)}
                                              </span>
                                              {sel && <Check className="h-[18px] w-[18px] text-primary" />}
                                            </span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Botón principal — muta entre Continuar y Agregar.
                          Cuando se puede navegar entre productos, lo flanquean flechas anterior/siguiente. */}
                      <div className="shrink-0 space-y-2 px-6 pb-7 pt-2">
                       <div className="flex items-stretch gap-2">
                        {puedeNavegar && (
                          <button
                            type="button"
                            onClick={() => irA(-1)}
                            disabled={!hasPrev}
                            aria-label="Producto anterior"
                            className={navFlankBtn}
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handlePrimary}
                          disabled={stage !== 'extras' && variantBloqueada}
                          className={cn(
                            'relative h-14 min-w-0 flex-1 overflow-hidden rounded-2xl text-[17px] font-semibold transition-all duration-300 active:scale-[0.98]',
                            addCount > 0
                              ? 'bg-emerald-500 text-white'
                              : stage !== 'extras' && variantBloqueada
                                ? 'bg-foreground/10 text-muted-foreground'
                                : 'bg-primary text-primary-foreground'
                          )}
                        >
                          <AnimatePresence mode="wait">
                            {showCounter ? (
                              <motion.span
                                key={`x${addCount}`}
                                initial={{ scale: 0.4, opacity: 0 }}
                                animate={{ scale: 1.1, opacity: 1 }}
                                exit={{ scale: 1.5, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="absolute inset-0 flex items-center justify-center text-2xl font-black"
                              >
                                x{addCount}
                              </motion.span>
                            ) : addCount > 0 ? (
                              <motion.span
                                key="repeat"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 flex items-center justify-center gap-2"
                              >
                                <Check className="h-5 w-5" /> Agregar otro igual
                              </motion.span>
                            ) : stage !== 'extras' && variantBloqueada ? (
                              <motion.span
                                key="blocked"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 flex items-center justify-center"
                              >
                                Elegí una opción
                              </motion.span>
                            ) : stage === 'primary' && (tieneVariantesSecundarias || needsStage2) ? (
                              <motion.span
                                key="continue"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 flex items-center justify-center"
                              >
                                Continuar
                              </motion.span>
                            ) : stage === 'secondary' && needsStage2 ? (
                              <motion.span
                                key="continue-secondary"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 flex items-center justify-center"
                              >
                                Continuar
                              </motion.span>
                            ) : (
                              <motion.span
                                key="add"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 flex items-center justify-center"
                              >
                                Agregar · ${total.toFixed(2)}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </button>
                        {puedeNavegar && (
                          <button
                            type="button"
                            onClick={() => irA(1)}
                            disabled={!hasNext}
                            aria-label="Producto siguiente"
                            className={navFlankBtn}
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        )}
                       </div>
                        {addCount > 0 && (
                          <motion.button
                            type="button"
                            onClick={onClose}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25 }}
                            className="h-14 w-full rounded-2xl bg-secondary text-[17px] font-semibold text-foreground transition-all duration-300 active:scale-[0.98]"
                          >
                            Cerrar
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </>
          ) : (
            <div className="h-full w-full bg-background" />
          )}
        </motion.div>
      </DrawerContent>
    </Drawer>
  )
}
