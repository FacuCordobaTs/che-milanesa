import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMesaStore } from '@/store/mesaStore'
import { mesaApi, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, Utensils, ChevronRight, UtensilsCrossed, Truck, CreditCard, Package, ShoppingCart } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Features para el carrusel
const features = [
  {
    icon: UtensilsCrossed,
    title: 'Explorá el menú',
    description: 'Mirá todos los productos disponibles con fotos y precios',
  },
  {
    icon: Truck,
    title: 'Delivery o takeaway',
    description: 'Pedí a domicilio o retirá en el local, como prefieras',
  },
  {
    icon: CreditCard,
    title: 'Pagá online',
    description: 'Pagá de forma segura con tarjeta, transferencia o efectivo',
  },
  {
    icon: Package,
    title: 'Seguí tu pedido',
    description: 'Te avisamos en tiempo real cuando tu pedido está listo',
  },
]

const Nombre = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { qrToken: urlQrToken } = useParams<{ qrToken: string }>()
  const [nombre, setNombre] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [shouldAskName, setShouldAskName] = useState(false)
  const [currentFeature, setCurrentFeature] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false) // Flag para saber si ya se cargaron datos del servidor
  const [showCarritoModal, setShowCarritoModal] = useState(false) // Modal para carritos existentes
  const {
    setMesa, setProductos, setQrToken, setClienteInfo, setPedidoId, setPedido, setRestaurante,
    pedido, clienteNombre, qrToken: storedQrToken, isHydrated, sessionEnded,
    reset, clearPedidoCerrado, restaurante, mesa
  } = useMesaStore()

  // Carrusel automático
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  // Efecto para verificar si el usuario ya tiene datos guardados
  useEffect(() => {
    // Esperar a que el store se hidrate
    if (!isHydrated) return

    // Si es un nuevo QR diferente al guardado, o la sesión terminó, limpiar datos
    if (urlQrToken && (urlQrToken !== storedQrToken || sessionEnded)) {
      console.log('Nuevo QR o sesión terminada, limpiando datos anteriores', { urlQrToken, storedQrToken, sessionEnded })
      const storedLocalName = localStorage.getItem('cliente_nombre')
      reset()
      clearPedidoCerrado()
      setDataLoaded(false) // Marcar que necesitamos recargar datos

      if (storedLocalName) {
        const clienteId = `cliente-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        setClienteInfo(clienteId, storedLocalName)
      } else {
        setShouldAskName(true)
      }
      return // Importante: retornar para no seguir con la redirección
    }

    // Si ya tiene nombre para este mismo QR y la sesión no terminó, redirigir automáticamente
    // PERO solo si ya tenemos datos del servidor cargados (dataLoaded)
    if (urlQrToken === storedQrToken && clienteNombre && !sessionEnded && dataLoaded) {
      console.log('Usuario ya registrado, redirigiendo según estado del pedido', { estado: pedido?.estado })
      const estadoPedido = pedido?.estado
      if (estadoPedido === 'preparing') {
        navigate('/pedido-confirmado')
      } else if (estadoPedido === 'closed') {
        navigate('/pedido-cerrado')
      } else {
        const isSala = location.pathname.includes('/sala/')
        navigate(isSala ? `/sala/${urlQrToken}` : '/menu')
      }
    } else if (!clienteNombre) {
      // Si no hay nombre, mostrar formulario
      setShouldAskName(true)
    }
  }, [isHydrated, urlQrToken, storedQrToken, clienteNombre, sessionEnded, pedido?.estado, navigate, dataLoaded])

  // Efecto para cargar datos de la mesa
  useEffect(() => {
    const cargarMesa = async () => {
      if (!urlQrToken) {
        toast.error('Token de mesa no válido')
        navigate('/')
        return
      }

      // Esperar a que el store se hidrate antes de cargar
      if (!isHydrated) return

      setQrToken(urlQrToken)
      setIsLoading(true)

      try {
        const response = await mesaApi.join(urlQrToken) as {
          success: boolean
          data?: {
            mesa: {
              id: number
              nombre: string
              restauranteId: number
              qrToken: string
              createdAt: string
            }
            productos: Array<{
              id: number
              nombre: string
              descripcion: string | null
              precio: string
              imagenUrl: string | null
              categoriaId: number | null
              categoria: string | null
            }>
            pedido: {
              id: number
              mesaId: number
              restauranteId: number
              estado: string
              total: string
              createdAt: string
              nombrePedido?: string | null
            }
            restaurante: {
              id: number
              nombre: string
              imagenUrl: string | null
              mpConnected: boolean | null
              esCarrito: boolean | null
              splitPayment: boolean | null
              soloCartaDigital: boolean
            } | null
          }
        }

        console.log('response', response)

        if (response.success && response.data) {
          setMesa(response.data.mesa)
          setProductos(response.data.productos || [])
          setPedidoId(response.data.pedido.id)
          setPedido(response.data.pedido)
          setRestaurante(response.data.restaurante || null)
          setDataLoaded(true) // Marcar que los datos del servidor ya se cargaron

          // Si es carrito y ya tiene nombrePedido, mostrar modal de bienvenida
          if (response.data.restaurante?.esCarrito && response.data.pedido.nombrePedido) {
            setShowCarritoModal(true)
          }
        } else {
          toast.error('Error al cargar la mesa')
          navigate('/')
        }
      } catch (error) {
        console.error('Error cargando mesa:', error)
        if (error instanceof ApiError) {
          toast.error('Mesa no encontrada', {
            description: error.message,
          })
        } else {
          toast.error('Error de conexión')
          console.error('Error de conexión:', error)
        }
        navigate('/')
      } finally {
        setIsLoading(false)
      }
    }

    cargarMesa()
  }, [urlQrToken, isHydrated])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (nombre.trim()) {
      // Generar ID único para el cliente
      const clienteId = `cliente-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      setClienteInfo(clienteId, nombre.trim())
      localStorage.setItem('cliente_nombre', nombre.trim())

      // Redirigir según el estado del pedido del SERVIDOR (no del localStorage viejo)
      // El pedido ya se actualizó desde el servidor en el useEffect de carga
      const estadoPedido = pedido?.estado
      console.log('Redirigiendo después de ingresar nombre, estado:', estadoPedido)

      if (estadoPedido === 'preparing' || estadoPedido === 'delivered') {
        navigate('/pedido-confirmado')
      } else if (estadoPedido === 'closed') {
        // Si el pedido está cerrado, ir directamente a la pantalla de pago
        navigate('/pedido-cerrado')
      } else {
        // pending o cualquier otro estado -> ir al menú o sala
        const isSala = location.pathname.includes('/sala/')
        navigate(isSala ? `/sala/${urlQrToken}` : '/menu')
      }
    }
  }

  // Colores hardcodeados para single tenant
  const primario = '#0a331d'
  const secundario = '#eae7e0'

  // Mostrar cargando mientras se hidrata el store o se carga la mesa
  if (isLoading || !isHydrated || !shouldAskName) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: secundario }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse" style={{ backgroundColor: primario }}>
            <Utensils className="h-8 w-8 text-white" style={{ color: secundario }} />
          </div>
          <div className="flex items-center gap-2 text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Cargando...</span>
          </div>
        </div>
      </div>
    )
  }

  const themeStyles = (
    <style dangerouslySetInnerHTML={{
      __html: `
        :root {
          --background: ${secundario};
          --foreground: ${primario};
          --card: ${secundario};
          --card-foreground: ${primario};
          --popover: ${secundario};
          --popover-foreground: ${primario};
          --primary: ${primario};
          --primary-foreground: ${secundario};
          --secondary: ${primario}18;
          --secondary-foreground: ${primario};
          --muted: ${primario}15;
          --muted-foreground: ${primario}99;
          --border: ${primario}30;
          --input: ${primario}30;
        }
        .dark {
          --background: ${primario};
          --foreground: ${secundario};
          --card: ${primario};
          --card-foreground: ${secundario};
          --popover: ${primario};
          --popover-foreground: ${secundario};
          --primary: ${secundario};
          --primary-foreground: ${primario};
          --secondary: ${secundario}18;
          --secondary-foreground: ${secundario};
          --muted: ${secundario}15;
          --muted-foreground: ${secundario}b3;
          --border: ${secundario}30;
          --input: ${secundario}30;
        }
      `}} />
  )

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      {themeStyles}
      {/* Header con logo pequeño del restaurante */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Logo pequeño del restaurante + mesa */}
        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 flex items-center gap-3">
          {restaurante?.imagenUrl ? (
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg ring-2 ring-white dark:ring-neutral-800">
              <img
                src={restaurante.imagenUrl}
                alt={restaurante.nombre || 'Restaurante'}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-neutral-900 dark:bg-white flex items-center justify-center shadow-lg">
              <Utensils className="h-5 w-5 text-white dark:text-neutral-900" />
            </div>
          )}
          <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-700" />
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {mesa?.nombre || 'Tu mesa'}
          </span>
        </div>

        {/* Carrusel de features */}
        <div className="w-full max-w-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          <div className="relative h-32 overflow-hidden">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const isActive = index === currentFeature

              return (
                <div
                  key={index}
                  className={`absolute inset-0 flex flex-col items-center justify-center text-center px-4 transition-all duration-500 ease-out ${isActive
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4 pointer-events-none'
                    }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-neutral-900 dark:bg-white flex items-center justify-center mb-3 shadow-lg">
                    <Icon className="h-7 w-7 text-white dark:text-neutral-900" />
                  </div>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                    {feature.title}
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Indicadores del carrusel */}
          <div className="flex justify-center gap-2 mt-4">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentFeature(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentFeature
                  ? 'w-6 bg-neutral-900 dark:bg-white'
                  : 'w-1.5 bg-neutral-300 dark:bg-neutral-600'
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Card principal con formulario */}
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <div className="bg-card rounded-3xl p-8 shadow-xl border border-border">
            {/* Instrucción clara */}
            <div className="text-center mb-6">
              <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
                Ingresá tu nombre para unirte al pedido
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Input
                  id="nombre"
                  type="text"
                  placeholder="¿Cómo te llamas?"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  autoFocus
                  autoComplete="off"
                  className="h-14 text-lg text-center rounded-2xl border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:bg-white dark:focus:bg-neutral-900 transition-colors placeholder:text-neutral-400"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                disabled={!nombre.trim()}
              >
                <span>Comenzar</span>
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer branding */}
      <div className="pb-6 pt-4 text-center">
        <p className="text-[10px] text-neutral-300 dark:text-neutral-700 font-medium tracking-wider uppercase">
          Powered by Piru
        </p>
      </div>

      {/* Modal para carritos existentes */}
      <Dialog open={showCarritoModal} onOpenChange={setShowCarritoModal}>
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
              <ShoppingCart className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <DialogTitle className="text-xl">
              {pedido?.nombrePedido ? `Pedido de ${pedido.nombrePedido}` : 'Pedido en grupo'}
            </DialogTitle>
            <DialogDescription className="text-center pt-2 space-y-2">
              <p>Te estás uniendo a un pedido existente.</p>
              <p className="font-medium text-orange-700 dark:text-orange-300">
                Cuando el pedido esté listo, serán llamados como "{pedido?.nombrePedido ? `Pedido de ${pedido.nombrePedido}` : 'este pedido'}"
              </p>
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => setShowCarritoModal(false)}
            className="w-full h-12 mt-4 rounded-2xl font-semibold"
          >
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Nombre
