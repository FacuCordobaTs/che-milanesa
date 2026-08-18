import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ShoppingCart, Plus, Minus, Trash2, Users, CheckCircle, ArrowLeft, Search, Star, Clock, MapPin } from 'lucide-react'
import { ProductDetailDrawer } from '@/components/ProductDetailDrawer'
import { ThemeToggle } from '@/components/ThemeToggle'

// Datos de ejemplo con imágenes del proyecto de referencia
const productosEjemplo = [
  {
    id: 1,
    nombre: 'Pizza Margarita',
    descripcion: 'Salsa de tomate, mozzarella fresca, albahaca y aceite de oliva',
    precio: 12.50,
    imagenUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=400&fit=crop',
    categoria: 'Pizzas'
  },
  {
    id: 2,
    nombre: 'Hamburguesa Clásica',
    descripcion: 'Carne de res, lechuga, tomate, cebolla, queso cheddar y papas fritas',
    precio: 8.75,
    imagenUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=400&fit=crop',
    categoria: 'Hamburguesas'
  },
  {
    id: 3,
    nombre: 'Coca Cola',
    descripcion: 'Refresco de 500ml',
    precio: 2.50,
    imagenUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&h=400&fit=crop',
    categoria: 'Bebidas'
  },
  {
    id: 4,
    nombre: 'Papas Fritas',
    descripcion: 'Porción grande de papas fritas caseras',
    precio: 4.00,
    imagenUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop',
    categoria: 'Acompañamientos'
  },
  {
    id: 5,
    nombre: 'Ensalada César',
    descripcion: 'Lechuga romana, pollo grillado, croutons, parmesano y aderezo césar',
    precio: 9.50,
    imagenUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=400&fit=crop',
    categoria: 'Ensaladas'
  },
]

interface ItemPedido {
  id: number
  nombre: string
  precio: number
  cantidad: number
  cliente: string
}

const Menu = () => {
  const [searchParams] = useSearchParams()
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [pedido, setPedido] = useState<ItemPedido[]>([])
  const [pedidoConfirmado, setPedidoConfirmado] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<typeof productosEjemplo[0] | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const clienteNombre = localStorage.getItem('clienteNombre') || 'Cliente'

  const categorias = ['All', 'Pizzas', 'Hamburguesas', 'Bebidas', 'Acompañamientos', 'Ensaladas']
  const productosFiltrados = selectedCategory === 'All'
    ? productosEjemplo
    : productosEjemplo.filter(p => p.categoria === selectedCategory)

  const abrirDetalleProducto = (producto: typeof productosEjemplo[0]) => {
    setSelectedProduct(producto)
    setDrawerOpen(true)
  }

  const agregarAlPedido = (producto: typeof productosEjemplo[0] | any, cantidad: number = 1) => {
    const nuevoItem: ItemPedido = {
      id: producto.id,
      nombre: producto.nombre,
      precio: typeof producto.precio === 'number' ? producto.precio : parseFloat(producto.precio),
      cantidad,
      cliente: clienteNombre
    }
    setPedido([...pedido, nuevoItem])
    setCarritoAbierto(true)
  }

  const aumentarCantidad = (index: number) => {
    const nuevoPedido = [...pedido]
    nuevoPedido[index].cantidad += 1
    setPedido(nuevoPedido)
  }

  const disminuirCantidad = (index: number) => {
    const nuevoPedido = [...pedido]
    if (nuevoPedido[index].cantidad > 1) {
      nuevoPedido[index].cantidad -= 1
      setPedido(nuevoPedido)
    }
  }

  const eliminarItem = (index: number) => {
    const nuevoPedido = pedido.filter((_, i) => i !== index)
    setPedido(nuevoPedido)
  }

  const total = pedido.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
  const misPedidos = pedido.filter(p => p.cliente === clienteNombre)

  const confirmarPedido = () => {
    setPedidoConfirmado(true)
    setCarritoAbierto(false)
  }

  const pedirMas = () => {
    setPedidoConfirmado(false)
    setPedido([])
  }

  const pedirCuenta = () => {
    window.location.href = `/pago?token=${searchParams.get('token')}`
  }

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" className="rounded-full bg-secondary">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="rounded-full bg-secondary">
                <Search className="w-5 h-5" />
              </Button>
              <Sheet open={carritoAbierto} onOpenChange={setCarritoAbierto}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full bg-secondary relative"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    {misPedidos.length > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary">
                        {misPedidos.length}
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
                    {pedido.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Tu pedido está vacío</p>
                      </div>
                    ) : (
                      pedido.map((item, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold">{item.nombre}</p>
                                  <Badge variant="outline" className="text-xs">
                                    {item.cliente}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  ${item.precio.toFixed(2)} c/u
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => disminuirCantidad(index)}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-8 text-center font-medium">{item.cantidad}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => aumentarCantidad(index)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="font-bold text-lg mb-2">
                                  ${(item.precio * item.cantidad).toFixed(2)}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive rounded-full"
                                  onClick={() => eliminarItem(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                  {pedido.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span>Total:</span>
                          <span className="text-primary">${total.toFixed(2)}</span>
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

          {/* Location */}
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-primary" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Mesa</p>
              <p className="text-sm font-semibold text-foreground">Mesa 5</p>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {clienteNombre}
            </Badge>
          </div>
        </div>
      </div>

      {/* Promo Banner */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-6">
        <Card className="bg-linear-to-r from-card to-secondary border-0 overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex-1">
              <h3 className="font-bold text-foreground mb-1">¡Bienvenido a PIRU!</h3>
              <p className="text-xs text-muted-foreground mb-3">Pedidos rápidos, entrega directa a tu mesa</p>
              <Button size="sm" className="bg-primary hover:bg-primary/90 h-8 px-4 rounded-full text-xs">
                Ver Menú
              </Button>
            </div>
            <div className="w-24 h-24 relative">
              <img
                src="https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&h=200&fit=crop"
                alt="Promo"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Categories */}
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
              onClick={() => setSelectedCategory(category)}
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

      {/* Popular Items */}
      <div className="max-w-2xl mx-auto px-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Popular</h2>
        </div>

        <div className="grid gap-4">
          {productosFiltrados.map((producto) => (
            <Card
              key={producto.id}
              className="overflow-hidden cursor-pointer hover:border-primary/50 transition-all bg-card border-border"
              onClick={() => abrirDetalleProducto(producto)}
            >
              <div className="flex gap-4 p-3">
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-secondary">
                  <img
                    src={producto.imagenUrl}
                    alt={producto.nombre}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div>
                    <h3 className="font-semibold text-foreground text-base mb-1 truncate">
                      {producto.nombre}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-primary text-primary" />
                        <span className="text-foreground font-medium">4.9</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>25 Min</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-primary">${producto.precio.toFixed(2)}</p>
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
      </div>

      {/* Contenido Principal */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {pedidoConfirmado && (
          <Card className="bg-primary/5 border-primary">
            <CardContent className="p-6 text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-primary mx-auto" />
              <h2 className="text-2xl font-bold">¡Pedido Confirmado!</h2>
              <p className="text-muted-foreground">
                Tu pedido ha sido enviado a la cocina. El mozo te lo traerá pronto.
              </p>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 rounded-2xl" onClick={pedirMas}>
                  Pedir Más
                </Button>
                <Button className="flex-1 rounded-2xl" onClick={pedirCuenta}>
                  Pedir Cuenta
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Floating Cart Button */}
      {misPedidos.length > 0 && !pedidoConfirmado && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={() => setCarritoAbierto(true)}
              size="lg"
              className="w-full text-base h-14 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg"
            >
              Ver mi pedido ({misPedidos.length} {misPedidos.length === 1 ? "plato" : "platos"})
            </Button>
          </div>
        </div>
      )}

      {/* Product Detail Drawer */}
      <ProductDetailDrawer
        product={selectedProduct}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          // Delay clearing the product to allow exit animation to complete (approx 300ms)
          setTimeout(() => setSelectedProduct(null), 300)
        }}
        onAddToOrder={agregarAlPedido}
      />
    </div>
  )
}

export default Menu
