import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useMesaStore } from '@/store/mesaStore'
import { useClienteWebSocket } from '@/hooks/useClienteWebSocket'
import { toast } from 'sonner'
import { ArrowLeft, Package, Utensils, Receipt, UtensilsCrossed, Trash2 } from 'lucide-react'
import { ProductDetailDrawer } from '@/components/ProductDetailDrawer'

const AgregarProducto = () => {
  const navigate = useNavigate()
  const { productos, clienteNombre, qrToken, mesa } = useMesaStore()
  const { state: wsState, sendMessage } = useClienteWebSocket()

  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [selectedProduct, setSelectedProduct] = useState<typeof productos[0] | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [carritoAbierto, setCarritoAbierto] = useState(false)

  useEffect(() => {
    if (!clienteNombre || !qrToken) {
      navigate('/pedido-confirmado')
    }
  }, [clienteNombre, qrToken])

  const abrirCarrito = useCallback(() => {
    window.history.pushState({ drawer: 'carrito' }, '')
    setCarritoAbierto(true)
  }, [])

  const cerrarCarrito = useCallback(() => {
    setCarritoAbierto(false)
    if (window.history.state?.drawer === 'carrito') {
      window.history.back()
    }
  }, [])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (carritoAbierto) {
        setCarritoAbierto(false)
        event.preventDefault()
        return
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [carritoAbierto])

  const categorias = ['All', ...Array.from(new Set(productos.map(p => p.categoria).filter(Boolean)))]

  const productosPorCategoria = productos.reduce((acc, producto) => {
    const categoria = producto.categoria || 'Sin categoría'
    if (!acc[categoria]) {
      acc[categoria] = []
    }
    acc[categoria].push(producto)
    return acc
  }, {} as Record<string, typeof productos>)

  const productosFiltrados = selectedCategory === 'All'
    ? productos
    : productos.filter(p => p.categoria === selectedCategory)

  const categoriasOrdenadas = Object.keys(productosPorCategoria).sort((a, b) => {
    if (a === 'Sin categoría') return 1
    if (b === 'Sin categoría') return -1
    return a.localeCompare(b)
  })

  const agregarAlPedido = (producto: typeof productos[0] | any, cantidad: number = 1, ingredientesExcluidos?: number[], agregados?: any[]) => {
    if (!clienteNombre) return
    sendMessage({
      type: 'AGREGAR_ITEM',
      payload: {
        productoId: producto.id,
        clienteNombre,
        cantidad,
        precioUnitario: String(producto.precio),
        imagenUrl: producto.imagenUrl,
        ingredientesExcluidos: ingredientesExcluidos || [],
        agregados: agregados || []
      },
    })
    toast.success('Agregado a la orden', { description: `${producto.nombre}`, duration: 1500 })
    // Abrir el carrito automáticamente tras agregar un producto
    setTimeout(() => abrirCarrito(), 350)
  }

  const handleEliminarItem = (itemPedidoId: number) => {
    sendMessage({ type: 'ELIMINAR_ITEM', payload: { itemId: itemPedidoId } })
  }

  const todosLosItems = wsState?.items || []
  const totalPedido = wsState?.total || '0.00'

  const abrirDetalleProducto = (producto: typeof productos[0]) => {
    setSelectedProduct(producto)
    setDrawerOpen(true)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => navigate('/pedido-confirmado')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold">Agregar Producto</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-4 space-y-6">
        {/* Categorías */}
        {categorias.length > 1 && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold px-1">Categorías</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 mx-2 scrollbar-hide snap-x">
              {categorias.map((category) => (
                <Button
                  key={category}
                  onClick={() => setSelectedCategory(category || 'All')}
                  variant={selectedCategory === category ? "default" : "secondary"}
                  className={`rounded-lg px-5 h-10 text-xs font-medium whitespace-nowrap snap-start transition-all ${selectedCategory === category
                    ? "shadow-md"
                    : "bg-secondary/50 hover:bg-secondary border border-transparent"
                    }`}
                >
                  {category === 'All' ? 'Todas' : category}
                </Button>
              ))}
            </div>
          </section>
        )}

        {/* Productos */}
        <section className="space-y-8 min-h-[50vh]">
          {selectedCategory === 'All' ? (
            categoriasOrdenadas.length > 0 ? (
              categoriasOrdenadas.map((categoriaNombre) => {
                const productosDeCategoria = productosPorCategoria[categoriaNombre]
                if (!productosDeCategoria || productosDeCategoria.length === 0) return null

                return (
                  <div key={categoriaNombre} className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                      {categoriaNombre}
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-3 ml-2 scrollbar-hide snap-x snap-mandatory">
                      {productosDeCategoria.map((producto) => (
                        <ProductoCard
                          key={producto.id}
                          producto={producto}
                          onClick={() => abrirDetalleProducto(producto)}
                        />
                      ))}
                      <div className="min-w-1 shrink-0" />
                    </div>
                  </div>
                )
              })
            ) : (
              <EmptyState />
            )
          ) : (
            productosFiltrados.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {selectedCategory}
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-3 ml-2 scrollbar-hide snap-x snap-mandatory">
                  {productosFiltrados.map((producto) => (
                    <ProductoCard
                      key={producto.id}
                      producto={producto}
                      onClick={() => abrirDetalleProducto(producto)}
                    />
                  ))}
                  <div className="min-w-1 shrink-0" />
                </div>
              </div>
            ) : (
              <EmptyState />
            )
          )}
        </section>
      </div>

      {/* --- BOTÓN FLOTANTE CARRITO --- */}
      <div className={`fixed bottom-6 left-0 right-0 flex justify-center z-40 transition-all duration-500 ${todosLosItems.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
        <button
          onClick={abrirCarrito}
          className={`
            group relative flex items-center gap-4 pl-5 pr-6 py-3.5 rounded-full 
            shadow-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300
            bg-zinc-900 text-white shadow-zinc-900/20
            dark:bg-white/10 dark:text-white dark:backdrop-blur-xl 
            dark:border dark:border-white/10 dark:shadow-[0_0_20px_rgba(255,255,255,0.05)]
          `}
        >
          <div className="absolute -top-2 -right-1 bg-red-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full border-2 border-background z-10">
            {todosLosItems.length}
          </div>

          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-current opacity-90" />
            <span className="font-semibold text-sm tracking-wide">Ver Pedido</span>
          </div>

          <div className="h-4 w-px bg-current opacity-20"></div>

          <span className="font-bold text-base font-mono">
            ${totalPedido}
          </span>
        </button>
      </div>

      {/* --- DRAWER DEL PEDIDO --- */}
      <Sheet open={carritoAbierto} onOpenChange={(open) => !open && cerrarCarrito()}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 border-l-0 sm:border-l bg-background">
          <div className="flex flex-col h-full">
            <div className="px-5 py-4 flex items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
              <Button variant="ghost" size="icon" className="rounded-full -ml-2 hover:bg-secondary" onClick={cerrarCarrito}>
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <div>
                <SheetTitle className="text-xl">Tu Pedido</SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Mesa {mesa?.nombre} • {todosLosItems.length} items</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
              {todosLosItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                  <div className="bg-secondary p-6 rounded-full">
                    <UtensilsCrossed className="w-10 h-10" />
                  </div>
                  <p className="font-medium">El pedido está vacío.</p>
                  <Button variant="link" onClick={cerrarCarrito}>Continuar agregando</Button>
                </div>
              ) : (
                todosLosItems.map((item) => {
                  const esMio = item.clienteNombre === clienteNombre;
                  const prodOriginal = productos.find(p => p.id === (item.productoId || item.id));
                  const imagen = item.imagenUrl || prodOriginal?.imagenUrl;
                  const precio = parseFloat(item.precioUnitario || String(item.precio || 0));

                  return (
                    <div key={item.id} className={`relative flex gap-4 p-3 rounded-2xl border transition-all ${esMio ? 'bg-card border-primary/20 shadow-sm' : 'bg-secondary/30 border-transparent opacity-90 grayscale-[0.3]'
                      }`}>
                      <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-secondary">
                        {imagen ? (
                          <img src={imagen} alt="img" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Utensils className="w-6 h-6 text-orange-500" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{item.nombreProducto || item.nombre}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge variant="secondary" className={`h-5 text-[10px] px-1.5 font-normal rounded-md ${esMio ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : ''}`}>
                                {esMio ? 'Tú' : item.clienteNombre}
                              </Badge>
                            </div>
                            {(item as any).ingredientesExcluidosNombres?.length > 0 && (
                              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1">
                                ⚠️ Sin: {(item as any).ingredientesExcluidosNombres.join(', ')}
                              </p>
                            )}
                            {(item as any).agregados?.length > 0 && (
                              <div className="mt-1">
                                {(item as any).agregados.map((ag: any) => (
                                  <p key={ag.id} className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                    <span>+ {ag.nombre}</span>
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="font-bold text-base">${(precio * item.cantidad).toFixed(2)}</p>
                        </div>

                        {esMio ? (
                          <div className="flex items-center justify-end gap-3 mt-2">
                            <button onClick={() => handleEliminarItem(item.id)} className="w-8 h-8 flex items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end mt-2">
                            <span className="text-xs text-muted-foreground">x{item.cantidad} unidades</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {todosLosItems.length > 0 && (
              <div className="p-5 bg-background border-t border-border shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-muted-foreground text-sm">Total a pagar</span>
                  <span className="text-2xl font-black tracking-tight">${totalPedido}</span>
                </div>
                <Button
                  className="w-full h-14 text-base font-bold rounded-2xl shadow-lg shadow-primary/20"
                  size="lg"
                  onClick={() => navigate('/pedido-confirmado')}
                >
                  Ver Pedido Completo
                  <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ProductDetailDrawer
        product={selectedProduct ? { ...selectedProduct, categoria: selectedProduct.categoria ?? undefined } : null}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setTimeout(() => setSelectedProduct(null), 300)
        }}
        onAddToOrder={agregarAlPedido}
      />
    </div>
  )
}

// Componentes auxiliares
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
    <Package className="w-10 h-10 mb-2" />
    <p className="text-sm">Sin productos disponibles.</p>
  </div>
)

const ProductoCard = ({ producto, onClick }: { producto: any, onClick: () => void }) => (
  <div
    className="group relative w-44 h-52 shrink-0 rounded-3xl overflow-hidden cursor-pointer snap-start shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
    onClick={onClick}
  >
    {/* Background Image */}
    <div className="absolute inset-0 bg-zinc-900">
      {producto.imagenUrl ? (
        <img
          src={producto.imagenUrl}
          alt={producto.nombre}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-zinc-800 to-zinc-900">
          <Utensils className="w-12 h-12 text-orange-500" />
        </div>
      )}
    </div>

    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />

    {/* Glassmorphism overlay */}
    <div className="absolute bottom-0 left-0 right-0 p-3.5">
      <div
        className="
          rounded-2xl p-3 
          bg-white/70 dark:bg-white/10
          backdrop-blur-md backdrop-saturate-150
          border border-white/30 dark:border-white/10
          shadow-[0_4px_30px_rgba(0,0,0,0.1)]
        "
      >
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-white truncate leading-tight">
          {producto.nombre}
        </h3>
        <span className="font-bold text-lg text-zinc-800 dark:text-white/90 mt-0.5 block">
          ${parseFloat(producto.precio).toFixed(2)}
        </span>
      </div>
    </div>
  </div>
)

export default AgregarProducto

