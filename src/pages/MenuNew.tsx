import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useMesaStore } from '@/store/mesaStore'
import { useCarritoStore } from '@/store/carritoStore'
import { useClienteWebSocket } from '@/hooks/useClienteWebSocket'
import { toast } from 'sonner'
import { ShoppingCart, Plus, Minus, Trash2, Users, CheckCircle, ArrowLeft, MapPin, Wifi, WifiOff, Package } from 'lucide-react'
import { ProductDetailDrawer } from '@/components/ProductDetailDrawer'
import { ThemeToggle } from '@/components/ThemeToggle'

const Menu = () => {
  const navigate = useNavigate()
  const { mesa, productos, clientes, clienteNombre, qrToken } = useMesaStore()
  const { items, addItem, updateCantidad, removeItem, getTotal, getMisItems } = useCarritoStore()
  const { state: wsState, isConnected, sendMessage } = useClienteWebSocket()

  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<typeof productos[0] | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [clientesAbierto, setClientesAbierto] = useState(false)

  // Verificar que el usuario haya ingresado su nombre
  useEffect(() => {
    if (!clienteNombre || !qrToken) {
      toast.error('Debes ingresar tu nombre primero')
      navigate(`/mesa/${qrToken || 'invalid'}`)
    }
  }, [clienteNombre, qrToken])

  // Obtener categorías únicas de los productos
  const categorias = ['All', ...Array.from(new Set(productos.map(p => p.categoria).filter(Boolean)))]
  const productosFiltrados = selectedCategory === 'All'
    ? productos
    : productos.filter(p => p.categoria === selectedCategory)

  const abrirDetalleProducto = (producto: typeof productos[0]) => {
    setSelectedProduct(producto)
    setDrawerOpen(true)
  }

  const agregarAlPedido = (producto: typeof productos[0] | any, cantidad: number = 1) => {
    if (!clienteNombre) return

    addItem({
      productoId: producto.id,
      nombre: producto.nombre,
      precio: typeof producto.precio === 'number' ? producto.precio : parseFloat(producto.precio),
      cantidad,
      clienteNombre,
      imagenUrl: producto.imagenUrl,
    })

    // Enviar al WebSocket
    sendMessage({
      type: 'AGREGAR_ITEM',
      payload: {
        productoId: producto.id,
        clienteNombre,
        cantidad,
        precioUnitario: String(producto.precio),
      },
    })

    toast.success('Agregado al pedido', {
      description: `${producto.nombre} x${cantidad}`,
    })
    setCarritoAbierto(true)
  }

  const handleAumentarCantidad = (itemId: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    updateCantidad(itemId, item.cantidad + 1)

    // TODO: Enviar actualización al WebSocket
    sendMessage({
      type: 'ACTUALIZAR_CANTIDAD',
      payload: {
        itemId: item.productoId,
        cantidad: item.cantidad + 1,
      },
    })
  }

  const handleDisminuirCantidad = (itemId: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item || item.cantidad <= 1) return

    updateCantidad(itemId, item.cantidad - 1)

    // TODO: Enviar actualización al WebSocket
    sendMessage({
      type: 'ACTUALIZAR_CANTIDAD',
      payload: {
        itemId: item.productoId,
        cantidad: item.cantidad - 1,
      },
    })
  }

  const handleEliminarItem = (itemId: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    removeItem(itemId)

    // TODO: Enviar eliminación al WebSocket
    sendMessage({
      type: 'ELIMINAR_ITEM',
      payload: {
        itemId: item.productoId,
      },
    })

    toast.success('Item eliminado')
  }

  const confirmarPedido = () => {
    sendMessage({
      type: 'CONFIRMAR_PEDIDO',
      payload: {},
    })

    toast.success('¡Pedido confirmado!', {
      description: 'Tu pedido ha sido enviado a la cocina',
    })
    setCarritoAbierto(false)
  }

  const total = getTotal()
  const misItems = getMisItems(clienteNombre || '')
  const todosLosItems = wsState?.items || items

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-secondary"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-secondary"
                onClick={() => setClientesAbierto(true)}
              >
                <Users className="w-5 h-5" />
                {clientes.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary">
                    {clientes.length}
                  </Badge>
                )}
              </Button>
              <Sheet open={carritoAbierto} onOpenChange={setCarritoAbierto}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full bg-secondary relative"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    {misItems.length > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary">
                        {misItems.length}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[85vh]">
                  <SheetHeader>
                    <SheetTitle>Tu Pedido</SheetTitle>
                    <SheetDescription>
                      Revisa y confirma tu pedido
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-4 overflow-y-auto max-h-[60vh]">
                    {todosLosItems.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">El pedido está vacío</p>
                      </div>
                    ) : (
                      todosLosItems.map((item, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold">{item.nombre}</p>
                                  <Badge variant={item.clienteNombre === clienteNombre ? "default" : "outline"} className="text-xs">
                                    {item.clienteNombre}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  ${parseFloat(item.precioUnitario || String(item.precio || 0)).toFixed(2)} c/u
                                </p>
                                {item.clienteNombre === clienteNombre && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 rounded-full"
                                      onClick={() => handleDisminuirCantidad(item.id)}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                    <span className="w-8 text-center font-medium">{item.cantidad}</span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 rounded-full"
                                      onClick={() => handleAumentarCantidad(item.id)}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <p className="font-bold text-lg mb-2">
                                  ${(parseFloat(item.precioUnitario || String(item.precio || 0)) * item.cantidad).toFixed(2)}
                                </p>
                                {item.clienteNombre === clienteNombre && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive rounded-full"
                                    onClick={() => handleEliminarItem(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                  {todosLosItems.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span>Total:</span>
                          <span className="text-primary">${(wsState?.total || total.toFixed(2))}</span>
                        </div>
                        <Button
                          className="w-full rounded-2xl h-14 bg-primary hover:bg-primary/90"
                          size="lg"
                          onClick={confirmarPedido}
                        >
                          <CheckCircle className="mr-2 h-5 w-5" />
                          Confirmar Pedido
                        </Button>
                      </div>
                    </>
                  )}
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Location & Connection Status */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 flex-1">
              <MapPin className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Mesa</p>
                <p className="text-sm font-semibold text-foreground">{mesa?.nombre || 'Cargando...'}</p>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1">
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isConnected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Promo Banner */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-6">
        <Card className="bg-linear-to-r from-card to-secondary border-0 overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex-1">
              <h3 className="font-bold text-foreground mb-1">¡Bienvenido {clienteNombre}!</h3>
              <p className="text-xs text-muted-foreground mb-3">Pedidos rápidos, entrega directa a tu mesa</p>
              <Button size="sm" className="bg-primary hover:bg-primary/90 h-8 px-4 rounded-full text-xs">
                Ver Menú
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Categories */}
      {categorias.length > 1 && (
        <div className="max-w-2xl mx-auto px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">Categorías</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categorias.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "secondary"}
                size="sm"
                onClick={() => setSelectedCategory(category || 'All')}
                className={`rounded-full whitespace-nowrap ${selectedCategory === category
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-secondary hover:bg-secondary/80"
                  }`}
              >
                {category === 'All' ? 'Todas' : category}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="max-w-2xl mx-auto px-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Menú</h2>
        </div>

        {productosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="p-12 flex flex-col items-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">No hay productos disponibles</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {productosFiltrados.map((producto) => (
              <Card
                key={producto.id}
                className="overflow-hidden cursor-pointer hover:border-primary/50 transition-all bg-card border-border"
                onClick={() => abrirDetalleProducto(producto)}
              >
                <div className="flex gap-4 p-3">
                  <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-secondary">
                    {producto.imagenUrl ? (
                      <img
                        src={producto.imagenUrl}
                        alt={producto.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                    <div>
                      <h3 className="font-semibold text-foreground text-base mb-1 truncate">
                        {producto.nombre}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {producto.descripcion || 'Sin descripción'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-primary">${parseFloat(producto.precio).toFixed(2)}</p>
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 h-8 px-4 rounded-full text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          agregarAlPedido(producto)
                        }}
                      >
                        Agregar
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {misItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={() => setCarritoAbierto(true)}
              size="lg"
              className="w-full text-base h-14 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg"
            >
              Ver mi pedido ({misItems.length} {misItems.length === 1 ? "plato" : "platos"})
            </Button>
          </div>
        </div>
      )}

      {/* Clientes Conectados Sheet */}
      <Sheet open={clientesAbierto} onOpenChange={setClientesAbierto}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle>Clientes Conectados</SheetTitle>
            <SheetDescription>
              Personas en esta mesa
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {clientes.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay clientes conectados</p>
              </div>
            ) : (
              clientes.map((cliente) => (
                <Card key={cliente.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {cliente.nombre.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{cliente.nombre}</p>
                        {cliente.nombre === clienteNombre && (
                          <Badge variant="default" className="text-xs">Tú</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Product Detail Drawer */}
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

export default Menu

