import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMesaStore } from '@/store/mesaStore'
import { useClienteWebSocket } from '@/hooks/useClienteWebSocket'
import { mesaApi } from '@/lib/api'
import { toast } from 'sonner'
import {
  Trash2, Maximize2, Minimize2,
  Wifi, WifiOff, Package, UtensilsCrossed, Receipt, Utensils,
  Check, X, Users, Loader2, Share2, Clock
} from 'lucide-react'
import { ProductDetailDrawer } from '@/components/ProductDetailDrawer'
import { ThemeToggle } from '@/components/ThemeToggle'
import { guardarTemaRestaurante, leerTemaRestaurante, RestauranteTheme } from '@/components/RestauranteTheme'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckoutDeliveryGrupal } from '@/components/CheckoutDeliveryGrupal'
import { MisPedidosDrawer } from '@/components/MisPedidosDrawer'

type HorarioTurno = { diaSemana: number; horaApertura: string; horaCierre: string }

function checkIsOpen(horarios: HorarioTurno[]): { abierto: boolean; proximaApertura: string | null } {
  if (!horarios || horarios.length === 0) return { abierto: true, proximaApertura: null }
  const now = new Date()
  const diaHoy = now.getDay()
  const diaAyer = (diaHoy + 6) % 7
  const hhmm = now.getHours() * 60 + now.getMinutes()
  for (const h of horarios) {
    const apertura = parseInt(h.horaApertura.split(':')[0]) * 60 + parseInt(h.horaApertura.split(':')[1])
    const cierre = parseInt(h.horaCierre.split(':')[0]) * 60 + parseInt(h.horaCierre.split(':')[1])
    if (cierre > apertura) {
      if (h.diaSemana === diaHoy && hhmm >= apertura && hhmm < cierre) return { abierto: true, proximaApertura: null }
    } else {
      if (h.diaSemana === diaHoy && hhmm >= apertura) return { abierto: true, proximaApertura: null }
      if (h.diaSemana === diaAyer && hhmm < cierre) return { abierto: true, proximaApertura: null }
    }
  }
  const DIAS_NOMBRE = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  let mejor: { minutos: number; texto: string } | null = null
  for (const h of horarios) {
    const apertura = parseInt(h.horaApertura.split(':')[0]) * 60 + parseInt(h.horaApertura.split(':')[1])
    let diasHasta = (h.diaSemana - diaHoy + 7) % 7
    let minutosHasta = diasHasta * 1440 + (apertura - hhmm)
    if (minutosHasta <= 0) minutosHasta += 7 * 1440
    if (!mejor || minutosHasta < mejor.minutos) {
      const esHoy = diasHasta === 0 && apertura > hhmm
      mejor = { minutos: minutosHasta, texto: esHoy ? `hoy a las ${h.horaApertura}` : `${DIAS_NOMBRE[h.diaSemana]} ${h.horaApertura}` }
    }
  }
  return { abierto: false, proximaApertura: mejor?.texto || null }
}

const Menu = () => {
  const navigate = useNavigate()
  const { qrToken: urlQrToken } = useParams<{ qrToken?: string }>()
  const { mesa, productos, clientes, clienteNombre, clienteId, qrToken, isHydrated, sessionEnded, restaurante, pedido, checkoutDeliveryData, checkoutEditSemaphore, setMesa, setProductos, setPedidoId, setPedido, setRestaurante, setQrToken, setClientes, setCheckoutDeliveryData, setCheckoutEditSemaphore } = useMesaStore()
  const { state: wsState, isConnected, sendMessage, confirmacionGrupal, confirmacionCancelada, clearConfirmacionCancelada } = useClienteWebSocket()

  const [horarios, setHorarios] = useState<HorarioTurno[]>([])
  const [estadoAbierto, setEstadoAbierto] = useState<{ abierto: boolean; proximaApertura: string | null }>({ abierto: true, proximaApertura: null })
  const [permitirProgramados, setPermitirProgramados] = useState(false)

  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<typeof productos[0] | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [misPedidosOpen, setMisPedidosOpen] = useState(false)
  const [confirmacionGrupalOpen, setConfirmacionGrupalOpen] = useState(false)
  // Feedback de envío en solitario: cuando hay un solo cliente no hay votación grupal, pero igual
  // existe un delay entre confirmar y que el WS/poll redirija a la pantalla de éxito. Sin esto el
  // usuario se queda sin ningún feedback durante esos segundos.
  const [enviandoSolo, setEnviandoSolo] = useState(false)
  const [bienvenidaOpen, setBienvenidaOpen] = useState(false)

  const esSala = typeof window !== 'undefined' && window.location.pathname.includes('/sala/')
  const [mostrarCheckoutEnCarrito, setMostrarCheckoutEnCarrito] = useState(false)
  const [tituloCheckout, setTituloCheckout] = useState('¿Cómo lo querés?')

  const compartirLink = useCallback(() => {
    const mensaje = `Armemos un pedido juntos en ${restaurante?.nombre || 'el restaurante'} 🍽️`
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: mensaje, text: mensaje, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(`${mensaje}\n${url}`)
      toast.success('¡Link copiado al portapapeles!')
    }
  }, [restaurante?.nombre])

  const abrirCarrito = useCallback(() => {
    window.history.pushState({ drawer: 'carrito' }, '')
    setCarritoAbierto(true)
    if (!mostrarCheckoutEnCarrito) setExpandido(true)
  }, [mostrarCheckoutEnCarrito])

  const cerrarCarrito = useCallback(() => {
    setCarritoAbierto(false)
    setMostrarCheckoutEnCarrito(false)
    if (window.history.state?.drawer === 'carrito') {
      window.history.back()
    }
  }, [])

  const abrirProductoDrawer = useCallback(() => {
    window.history.pushState({ drawer: 'producto' }, '')
    setDrawerOpen(true)
  }, [])

  const cerrarProductoDrawer = useCallback(() => {
    setDrawerOpen(false)
    setTimeout(() => setSelectedProduct(null), 300)
    if (window.history.state?.drawer === 'producto') {
      window.history.back()
    }
  }, [])

  // Fetch horarios para check de apertura/cierre
  useEffect(() => {
    const username = restaurante?.username || 'chemilanesa'
    if (!username) return
    const fetchHorarios = async () => {
      try {
        const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
        const res = await fetch(`${url}/public/restaurante/${username}`)
        const data = await res.json()
        if (data.success && data.data) {
          setPermitirProgramados(!!data.data.restaurante?.permitirPedidosProgramados)
          if (Array.isArray(data.data.horarios)) {
            setHorarios(data.data.horarios)
            setEstadoAbierto(checkIsOpen(data.data.horarios))
          }
        }
      } catch { /* ignore */ }
    }
    fetchHorarios()
  }, [restaurante?.username])

  useEffect(() => {
    if (horarios.length === 0) return
    const interval = setInterval(() => setEstadoAbierto(checkIsOpen(horarios)), 60_000)
    return () => clearInterval(interval)
  }, [horarios])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (carritoAbierto) {
        setCarritoAbierto(false)
        setExpandido(false)
        event.preventDefault()
        return
      }
      if (drawerOpen) {
        setDrawerOpen(false)
        setTimeout(() => setSelectedProduct(null), 300)
        event.preventDefault()
        return
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [carritoAbierto, drawerOpen])

  // Sincronizar sala cuando la URL tiene un token distinto al del store
  useEffect(() => {
    if (!isHydrated || !esSala || !urlQrToken) return
    if (urlQrToken === qrToken) return
    const syncSala = async () => {
      try {
        const response = await mesaApi.join(urlQrToken) as { success?: boolean; data?: any }
        if (response.success && response.data) {
          setQrToken(urlQrToken)
          setMesa(response.data.mesa)
          setProductos(response.data.productos || [])
          setPedidoId(response.data.pedido.id)
          setPedido(response.data.pedido)
          setRestaurante(response.data.restaurante || null)
          setClientes([])
          setCheckoutDeliveryData(null)
          setCheckoutEditSemaphore(null)
        }
      } catch {
        toast.error('No se pudo cargar la sala')
      }
    }
    syncSala()
  }, [isHydrated, esSala, urlQrToken, qrToken])

  useEffect(() => {
    if (!isHydrated) return
    if (sessionEnded) return

    if (!clienteNombre || (!qrToken && !urlQrToken)) {
      toast.error('Debes ingresar tu nombre primero')
      const isSala = window.location.pathname.includes('/sala/')
      const token = urlQrToken || qrToken || 'invalid'
      navigate(isSala ? `/sala/${token}/nombre` : `/mesa/${token}`)
      return
    }

    if (wsState?.estado) {
      if (wsState.estado === 'preparing') {
        if (restaurante?.esCarrito) {
          navigate('/pedido-cerrado')
        } else {
          navigate('/pedido-confirmado')
        }
      } else if (wsState.estado === 'closed') {
        navigate('/pedido-cerrado')
      }
    }
  }, [clienteNombre, qrToken, urlQrToken, wsState?.estado, navigate, isHydrated, sessionEnded, restaurante?.esCarrito])

  // Mostrar modal de bienvenida la primera vez
  useEffect(() => {
    const t = urlQrToken || qrToken
    if (!isHydrated || !t) return
    const key = `bienvenida_shown_${t}`
    if (!sessionStorage.getItem(key)) {
      setBienvenidaOpen(true)
      sessionStorage.setItem(key, '1')
    }
  }, [isHydrated, urlQrToken, qrToken])

  const categorias = ['All', ...Array.from(new Set(productos.map(p => p.categoria).filter(Boolean)))]

  const productosPorCategoria = productos.reduce((acc, producto) => {
    const categoria = producto.categoria || 'Sin categoría'
    if (!acc[categoria]) acc[categoria] = []
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

  const abrirDetalleProducto = (producto: typeof productos[0]) => {
    setSelectedProduct(producto)
    abrirProductoDrawer()
  }

  // Lista ordenada de productos "hermanos" para saltar de uno a otro dentro del drawer
  // (mismo orden en que se ven en pantalla), igual que en MenuDelivery. Alimenta las
  // flechas anterior/siguiente y el swipe del ProductDetailDrawer.
  const productosNavegables = selectedCategory === 'All'
    ? categoriasOrdenadas.flatMap(c => productosPorCategoria[c] || [])
    : productosFiltrados

  const agregarAlPedido = (producto: typeof productos[0] | any, cantidad: number = 1, ingredientesExcluidos?: number[], agregados?: any[]) => {
    if (!clienteNombre) return
    let precioBase = parseFloat(String(producto.precio))
    if (producto.descuento && producto.descuento > 0) {
      precioBase = precioBase * (1 - producto.descuento / 100)
    }
    const precioAgregados = (agregados || []).reduce((sum: number, ag: any) => sum + parseFloat(ag.precio || '0'), 0)
    const precioUnitario = (precioBase + precioAgregados).toFixed(2)
    sendMessage({
      type: 'AGREGAR_ITEM',
      payload: {
        productoId: producto.id,
        clienteNombre,
        cantidad,
        precioUnitario,
        imagenUrl: producto.imagenUrl,
        ingredientesExcluidos: ingredientesExcluidos || [],
        agregados: agregados || []
      },
    })
    setTimeout(() => abrirCarrito(), 350)
  }

  const handleEliminarItem = (itemPedidoId: number) => {
    sendMessage({ type: 'ELIMINAR_ITEM', payload: { itemId: itemPedidoId } })
  }

  // Iniciar el proceso de confirmación grupal
  const iniciarConfirmacionPedido = () => {
    if (!clienteNombre || !clienteId) return
    if (localCerrado && !puedeProgramar) {
      toast.error('El restaurante está cerrado en este momento')
      return
    }

    if (clientes.length <= 1) {
      sendMessage({ type: 'CONFIRMAR_PEDIDO', payload: {} })
      cerrarCarrito()
      // Feedback visible mientras el WS/poll procesa el pedido y redirige a éxito.
      setEnviandoSolo(true)
      return
    }

    sendMessage({
      type: 'INICIAR_CONFIRMACION',
      payload: { clienteId, clienteNombre }
    })
    cerrarCarrito()
  }

  const confirmarMiParte = () => {
    if (!clienteId) return
    if (localCerrado && !puedeProgramar) {
      toast.error('El restaurante está cerrado en este momento')
      return
    }
    sendMessage({ type: 'USUARIO_CONFIRMO', payload: { clienteId } })
  }

  const cancelarConfirmacion = () => {
    if (!clienteId || !clienteNombre) return
    sendMessage({ type: 'USUARIO_CANCELO', payload: { clienteId, clienteNombre } })
  }

  useEffect(() => {
    if (confirmacionGrupal?.activa) {
      setConfirmacionGrupalOpen(true)
    } else {
      setConfirmacionGrupalOpen(false)
    }
  }, [confirmacionGrupal?.activa])

  useEffect(() => {
    if (confirmacionCancelada) {
      toast.error(`${confirmacionCancelada.canceladoPor} canceló la confirmación`, { duration: 3000 })
      clearConfirmacionCancelada()
    }
  }, [confirmacionCancelada, clearConfirmacionCancelada])

  const yaConfirme = confirmacionGrupal?.confirmaciones.find(c => c.clienteId === clienteId)?.confirmado ?? false
  const totalConfirmados = confirmacionGrupal?.confirmaciones.filter(c => c.confirmado).length ?? 0
  const totalClientes = confirmacionGrupal?.confirmaciones.length ?? 0
  const todosConfirmaron = esSala && totalClientes > 0 && totalConfirmados === totalClientes

  // Fallback poll cuando todos confirmaron en sala (o cuando confirma un cliente solo),
  // por si el WS (SALA_PEDIDO_CREADO) no llega.
  useEffect(() => {
    if (!(todosConfirmaron || (enviandoSolo && esSala)) || !urlQrToken) return
    const token = urlQrToken
    const poll = async () => {
      try {
        const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
        const res = await fetch(`${url}/public/sala/${token}/order-created`)
        const data = await res.json()
        if (data.success && data.order) {
          sessionStorage.setItem('salaOrderInfo', JSON.stringify({
            token: data.order.token,
            pedidoId: data.order.pedidoId,
            tipoPedido: data.order.tipoPedido,
            total: data.order.total,
            items: data.order.items,
            aliasDinamico: data.order.aliasDinamico,
            cvuDinamico: data.order.cvuDinamico,
            deliveryFee: data.order.deliveryFee,
            zonaNombre: data.order.zonaNombre,
            direccion: data.order.direccion,
            metodoPago: data.order.metodoPago || checkoutDeliveryData?.metodoPago || 'transferencia',
            montoDescuento: data.order.montoDescuento ? parseFloat(data.order.montoDescuento) : undefined,
          }))
          window.location.href = `/sala/${data.order.token}/success`
        }
      } catch { /* ignore */ }
    }
    poll()
    const interval = setInterval(poll, 500)
    return () => clearInterval(interval)
  }, [todosConfirmaron, enviandoSolo, esSala, urlQrToken])

  const todosLosItems = wsState?.items || []

  useEffect(() => {
    if (todosLosItems.length === 0) setMostrarCheckoutEnCarrito(false)
  }, [todosLosItems.length])

  const alturaCarrito = (() => {
    const n = todosLosItems.length
    if (n >= 4) return '85vh'
    return ['28vh', '42vh', '57vh', '71vh'][n]
  })()

  const totalPedido = todosLosItems.reduce((sum, item) => {
    const precio = parseFloat((item as any).precioUnitario || String((item as any).precio || 0))
    return sum + precio * item.cantidad
  }, 0).toFixed(2)

  // Cuando el local está cerrado pero permite pedidos programados (solo aplica a sala: son pedidos
  // delivery/takeaway), no se bloquea: el cliente puede pedir eligiendo un horario en el checkout.
  const localCerrado = !estadoAbierto.abierto
  const puedeProgramar = esSala && permitirProgramados
  const bloqueadoPorCierre = localCerrado && !puedeProgramar

  // Guardar tema cuando el restaurante tiene colores propios
  const token = urlQrToken || qrToken
  useEffect(() => {
    if (!restaurante?.colorPrimario || !token) return
    const key = esSala ? `theme_sala_${token}` : `theme_mesa_${token}`
    guardarTemaRestaurante(key, restaurante)
    // También guardar con username para que MenuDelivery y Menu compartan tema
    if (restaurante.username) {
      guardarTemaRestaurante(`theme_${restaurante.username}`, restaurante)
    }
  }, [restaurante?.colorPrimario, restaurante?.colorSecundario, restaurante?.usarColorUnico, restaurante?.username, token, esSala])

  // Si tenemos token pero no tema (ej: llegó por link compartido sin pasar por Nombre), fetchear para obtener colores
  useEffect(() => {
    if (!token || !isHydrated) return
    const hasTheme = (restaurante?.colorPrimario && (restaurante?.usarColorUnico || restaurante?.colorSecundario)) ||
      sessionStorage.getItem(esSala ? `theme_sala_${token}` : `theme_mesa_${token}`) ||
      (restaurante?.username && sessionStorage.getItem(`theme_${restaurante.username}`))
    if (hasTheme) return

    const fetchTheme = async () => {
      try {
        const response = await mesaApi.join(token) as { success?: boolean; data?: any }
        if (response.success && response.data?.restaurante) {
          const rest = response.data.restaurante
          setRestaurante(rest)
          const key = esSala ? `theme_sala_${token}` : `theme_mesa_${token}`
          guardarTemaRestaurante(key, rest)
          if (rest.username) guardarTemaRestaurante(`theme_${rest.username}`, rest)
        }
      } catch { /* ignore */ }
    }
    fetchTheme()
  }, [token, isHydrated, esSala])

  const themeKeySalaMesa = token ? (esSala ? `theme_sala_${token}` : `theme_mesa_${token}`) : null
  const themeKeyUsername = restaurante?.username ? `theme_${restaurante.username}` : null
  const cachedTheme = leerTemaRestaurante(themeKeySalaMesa) || leerTemaRestaurante(themeKeyUsername)
  const themeStyles = <RestauranteTheme restaurante={restaurante} cachedTheme={cachedTheme} />

  const renderItem = (item: any) => {
    const esMio = item.clienteNombre === clienteNombre
    const prodOriginal = productos.find(p => p.id === (item.productoId || item.id))
    const imagen = item.imagenUrl || prodOriginal?.imagenUrl
    const precio = parseFloat(item.precioUnitario || String(item.precio || 0))

    return (
      <div key={item.id} className={`relative flex gap-4 p-3 rounded-2xl border transition-all ${esMio ? 'bg-card border-primary/20 shadow-sm' : 'bg-secondary/30 border-transparent opacity-90 grayscale-[0.3]'}`}>
        <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-secondary">
          {imagen ? (
            <img src={imagen} alt="img" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Utensils className="w-6 h-6 text-primary" />
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
                <p className="text-xs text-primary font-medium mt-1">
                  ⚠️ Sin: {(item as any).ingredientesExcluidosNombres.join(', ')}
                </p>
              )}
              {(item as any).agregados?.length > 0 && (
                <div className="mt-1">
                  {(item as any).agregados.map((ag: any) => (
                    <p key={ag.id} className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <span>+ {ag.nombre || 'Extra'}</span>
                      {ag.precio && parseFloat(ag.precio) > 0 && (
                        <span className="text-primary/80">(+${parseFloat(ag.precio).toFixed(0)})</span>
                      )}
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
  }

  return (
    <div className="min-h-screen pb-32 bg-background font-sans selection:bg-primary/20">
      {themeStyles}

      {/* --- HEADER --- */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 supports-backdrop-filter:bg-background/60">
        <div className="max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50">
              {isConnected ? <Wifi className="w-3.5 h-3.5 text-green-500" /> : <WifiOff className="w-3.5 h-3.5 text-destructive" />}
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline-block">{mesa?.nombre}</span>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => setMisPedidosOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-primary hover:bg-primary/10 transition-colors border border-primary/20"
              >
                <Package className="w-3.5 h-3.5" />
                Mis Pedidos
              </button>
            </div>
          </div>
        </div>
      </div>

      {localCerrado && (
        <div className={puedeProgramar ? "bg-amber-500 text-white" : "bg-red-600 text-white"}>
          <div className="max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto px-5 py-3 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            <p className="text-sm font-semibold text-center">
              {puedeProgramar
                ? 'Estamos cerrados. Podés programar tu pedido para después'
                : `Estamos cerrados${estadoAbierto.proximaApertura ? `. Abrimos ${estadoAbierto.proximaApertura}` : ''}`
              }
            </p>
          </div>
        </div>
      )}

      <div className="max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto px-5 pt-4 space-y-6">

        {/* --- SECCIÓN BIENVENIDA & USUARIOS --- */}
        <section className="space-y-4 lg:max-w-2xl lg:mx-auto lg:w-full">
          <div className="flex items-end justify-between px-1">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-0.5">Bienvenido,</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-primary">
                {clienteNombre}
              </h1>
            </div>
            <div className="text-right">
              {restaurante?.esCarrito && pedido?.nombrePedido ? (
                <>
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider block">Pedido</span>
                  <span className="text-sm font-medium">de {pedido.nombrePedido}</span>
                </>
              ) : (
                <>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Pedido</span>
                  <span className="text-sm font-medium">{mesa?.nombre}</span>
                </>
              )}
            </div>
          </div>

          {/* Lista de Usuarios */}
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                En el pedido:
              </p>
            </div>

            <div className="flex -mx-5 pl-5 overflow-x-auto scrollbar-hide py-2 gap-4 snap-x">
              {/* Usuario actual */}
              <div className="flex flex-col items-center gap-1.5 min-w-[56px] snap-start">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl border-2 shadow-sm ring-2 ring-background bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                    YO
                  </div>
                </div>
                <span className="text-xs font-medium truncate max-w-[60px] text-center">Tú</span>
              </div>

              {/* Otros usuarios */}
              {clientes.filter(c => c.nombre !== clienteNombre).map((cliente) => (
                <div key={cliente.id} className="flex flex-col items-center gap-1.5 min-w-[56px] snap-start opacity-80 hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-xl border border-border shadow-xs bg-secondary text-foreground text-xs font-medium flex items-center justify-center">
                    {cliente.nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs text-muted-foreground truncate max-w-[60px] text-center">
                    {cliente.nombre}
                  </span>
                </div>
              ))}

              {clientes.length === 1 && (
                <div className="flex items-center justify-center pl-2">
                  <p className="text-xs text-muted-foreground italic">Esperando...</p>
                </div>
              )}

              <div className="min-w-5 shrink-0"></div>
            </div>
          </div>

          {/* Botón compartir sala */}
          {window.location.pathname.includes('/sala/') && (
            <button
              onClick={compartirLink}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors text-sm font-semibold"
            >
              <Share2 className="w-4 h-4" />
              Invitá a tus amigos
            </button>
          )}
        </section>
        
        {/* --- CATEGORÍAS --- */}
        {categorias.length > 1 && (
          <section className="space-y-3 pt-2">
            <h2 className="text-lg font-bold text-foreground px-1">Categorías</h2>
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

        {/* --- PRODUCTOS --- */}
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
                    <div className="flex gap-4 overflow-x-auto pb-3 ml-2 scrollbar-hide snap-x snap-mandatory lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:gap-5 lg:ml-0 lg:pb-0 lg:overflow-visible lg:snap-none">
                      {productosDeCategoria.map((producto) => (
                        <ProductoCard
                          key={producto.id}
                          producto={producto}
                          onClick={() => abrirDetalleProducto(producto)}
                        />
                      ))}
                      <div className="min-w-1 shrink-0 lg:hidden" />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-1">
                  {productosFiltrados.map((producto) => (
                    <ProductoCard
                      key={producto.id}
                      producto={producto}
                      onClick={() => abrirDetalleProducto(producto)}
                      fullWidth
                    />
                  ))}
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

      {/* --- OVERLAY DEL PEDIDO --- */}
      {carritoAbierto && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={cerrarCarrito}
        />
      )}

      {/* --- DRAWER VERTICAL DEL PEDIDO --- */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${carritoAbierto ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
      >
        <div
          className={`mx-auto max-w-2xl lg:max-w-lg bg-background rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.28)] border-t border-border flex flex-col transition-[height] duration-300 ease-out ${(!mostrarCheckoutEnCarrito || expandido) ? 'overflow-hidden' : 'overflow-y-auto'}`}
          style={!mostrarCheckoutEnCarrito ? { height: alturaCarrito } : expandido ? { height: '85vh' } : { maxHeight: '88vh' }}
        >
          {/* Header */}
          <div className="shrink-0 sticky top-0 z-10 bg-background pt-2">
            <div className="w-full flex justify-center pt-3 pb-1">
              <span className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 pt-2">
              <div className="w-8 h-8 flex items-center justify-center" />
              <span className="text-xl font-extrabold">
                {mostrarCheckoutEnCarrito ? tituloCheckout : 'Tu pedido'}
              </span>
              {mostrarCheckoutEnCarrito ? (
                <button
                  onClick={() => setExpandido(e => !e)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
                  aria-label={expandido ? 'Minimizar' : 'Maximizar'}
                >
                  {expandido ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              ) : (
                <div className="w-8 h-8" />
              )}
            </div>
          </div>

          {/* Cuerpo */}
          {mostrarCheckoutEnCarrito && esSala ? (
            <CheckoutDeliveryGrupal
              modo={expandido ? 'completo' : 'pasos'}
              onVolverCarrito={() => { setMostrarCheckoutEnCarrito(false); setExpandido(true) }}
              restauranteId={restaurante?.id ?? 0}
              restauranteUsername={restaurante?.username ?? null}
              itemsTotal={totalPedido}
              totalItems={todosLosItems.length}
              onConfirmarClick={iniciarConfirmacionPedido}
              sendMessage={sendMessage}
              clienteId={clienteId ?? ''}
              clienteNombre={clienteNombre ?? ''}
              checkoutData={checkoutDeliveryData}
              editSemaphore={checkoutEditSemaphore}
              restauranteDireccion={restaurante?.direccion ?? undefined}
              onTituloChange={setTituloCheckout}
              localCerrado={localCerrado}
            />
          ) : todosLosItems.length === 0 ? (
            <div className={`flex flex-col items-center justify-center text-center gap-4 opacity-60 px-5 ${expandido ? 'flex-1' : 'py-12'}`}>
              <div className="bg-secondary p-6 rounded-full">
                <UtensilsCrossed className="w-10 h-10" />
              </div>
              <p className="font-medium">El pedido está vacío.</p>
              <Button variant="link" onClick={cerrarCarrito}>Ir al menú</Button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
                {todosLosItems.map((item) => renderItem(item))}
              </div>

              <div className="shrink-0 p-4 border-t border-border bg-background">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-muted-foreground text-sm">Total a pagar</span>
                  <span className="text-2xl font-black tracking-tight">${totalPedido}</span>
                </div>
                {!restaurante?.soloCartaDigital ? (
                  <Button
                    className={`w-full h-12 rounded-xl font-bold text-base shadow-md ${bloqueadoPorCierre ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (bloqueadoPorCierre) {
                        toast.error('El restaurante está cerrado en este momento')
                        return
                      }
                      if (esSala) {
                        setMostrarCheckoutEnCarrito(true)
                        setExpandido(false)
                      } else {
                        iniciarConfirmacionPedido()
                      }
                    }}
                    disabled={bloqueadoPorCierre}
                  >
                    {bloqueadoPorCierre ? 'Restaurante cerrado' : 'Continuar'}
                  </Button>
                ) : (
                  <div className="text-center text-sm font-medium text-primary py-3 bg-primary/10 rounded-xl">
                    Léele tu pedido al mozo o a la caja 😊
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ProductDetailDrawer
        product={selectedProduct ? { ...selectedProduct, categoria: selectedProduct.categoria ?? undefined } : null}
        open={drawerOpen}
        onClose={cerrarProductoDrawer}
        onAddToOrder={agregarAlPedido}
        siblings={productosNavegables as any}
        onNavigate={(p) => setSelectedProduct(p as any)}
      />

      <MisPedidosDrawer
        open={misPedidosOpen}
        onOpenChange={setMisPedidosOpen}
        restauranteId={restaurante?.id ?? null}
      />

      {/* --- MODAL DE CONFIRMACIÓN GRUPAL --- */}
      <Dialog open={confirmacionGrupalOpen} onOpenChange={() => { }}>
        <DialogContent className="max-w-sm rounded-2xl p-4 sm:p-5 max-h-[85dvh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
          {todosConfirmaron ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <DialogTitle className="text-lg font-bold text-center">¡Todos confirmaron!</DialogTitle>
              <DialogDescription className="text-center text-sm">
                Estamos preparando tu pedido, te redirigimos en un momento...
              </DialogDescription>
            </div>
          ) : (
            <>
              <DialogHeader className="text-center shrink-0">
                <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2 sm:mb-3">
                  <Users className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                </div>
                <DialogTitle className="text-lg sm:text-xl">Confirmación del Pedido</DialogTitle>
                <DialogDescription className="text-center pt-1 text-sm">
                  {confirmacionGrupal?.iniciadaPorNombre === clienteNombre
                    ? 'Esperando que todos confirmen...'
                    : `${confirmacionGrupal?.iniciadaPorNombre} quiere confirmar`
                  }
                </DialogDescription>
              </DialogHeader>

              {/* Resumen checkout (sala) */}
              {esSala && checkoutDeliveryData && (
                <div className="mt-2 sm:mt-3 p-3 rounded-xl bg-secondary/50 border border-border/50 space-y-1 text-left shrink-0 overflow-hidden">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Resumen</p>
                  <p className="text-xs truncate"><span className="text-muted-foreground">Nombre:</span> {checkoutDeliveryData.nombre}</p>
                  <p className="text-xs truncate"><span className="text-muted-foreground">Celular:</span> {checkoutDeliveryData.telefono}</p>
                  {checkoutDeliveryData.tipoPedido === 'delivery' && (
                    <p className="text-xs truncate"><span className="text-muted-foreground">Dirección:</span> {checkoutDeliveryData.direccion}</p>
                  )}
                  {checkoutDeliveryData.tipoPedido === 'delivery' && checkoutDeliveryData.deliveryFee > 0 && (
                    <p className="text-xs"><span className="text-muted-foreground">Envío:</span> ${checkoutDeliveryData.deliveryFee.toFixed(2)}</p>
                  )}
                  <p className="text-sm font-bold pt-1.5 border-t border-border/50">Total: ${checkoutDeliveryData.total}</p>
                </div>
              )}

              {/* Lista de usuarios */}
              <div className="mt-2 sm:mt-3 min-h-0 flex-1 overflow-y-auto">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center mb-2">
                  {totalConfirmados}/{totalClientes} confirmados
                </p>
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3 py-2">
                  {confirmacionGrupal?.confirmaciones.map((conf) => {
                    const esYo = conf.clienteId === clienteId
                    return (
                      <div key={conf.clienteId} className="flex flex-col items-center gap-1">
                        <div className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-lg border-2 shadow-sm flex items-center justify-center font-bold text-xs transition-all duration-300 ${conf.confirmado
                          ? 'bg-primary border-primary text-primary-foreground ring-2 ring-primary/30'
                          : 'bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400'
                        }`}>
                          {conf.nombre.slice(0, 2).toUpperCase()}
                          {conf.confirmado && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                          {!conf.confirmado && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-zinc-400 dark:bg-zinc-500 rounded-full flex items-center justify-center">
                              <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
                            </div>
                          )}
                        </div>
                        <span className={`text-[10px] font-medium truncate max-w-[48px] sm:max-w-[56px] text-center ${esYo ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {esYo ? 'Tú' : conf.nombre}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 shrink-0 mt-3 pt-3 border-t border-border/50">
                {!yaConfirme ? (
                  <>
                    <Button
                      size="sm"
                      onClick={confirmarMiParte}
                      className={`w-full h-11 rounded-xl font-semibold ${bloqueadoPorCierre ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}`}
                      disabled={bloqueadoPorCierre}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {bloqueadoPorCierre ? 'Restaurante cerrado' : 'Confirmar mi pedido'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelarConfirmacion}
                      className="w-full h-10 rounded-xl text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="w-full py-2 px-3 rounded-xl bg-primary/10 text-center">
                      <p className="text-xs font-medium text-primary">
                        ✓ Ya confirmaste. Esperando a los demás...
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelarConfirmacion}
                      className="w-full h-10 rounded-xl text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancelar para todos
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --- OVERLAY DE ENVÍO EN SOLITARIO --- */}
      {/* Un solo cliente no pasa por la votación grupal, pero igual hay un delay entre confirmar
          y que el WS/poll redirija a la pantalla de éxito. Este overlay le da feedback de que su
          pedido se está procesando (equivalente al estado "¡Todos confirmaron!" del flujo grupal). */}
      <Dialog open={enviandoSolo} onOpenChange={() => { }}>
        <DialogContent className="max-w-sm rounded-2xl p-4 sm:p-5" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <DialogTitle className="text-lg font-bold text-center">¡Pedido confirmado!</DialogTitle>
            <DialogDescription className="text-center text-sm">
              Estamos preparando tu pedido, te redirigimos en un momento...
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- MODAL DE BIENVENIDA --- */}
      <Dialog open={bienvenidaOpen} onOpenChange={setBienvenidaOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden border-0 shadow-2xl gap-0">
          <div className="bg-primary px-6 pt-8 pb-10 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/5" />
            <div className="absolute -right-4 top-12 w-28 h-28 rounded-full bg-white/5" />
            <div className="w-14 h-14 rounded-2xl bg-primary-foreground/15 flex items-center justify-center mb-4 backdrop-blur-sm shadow-inner">
              <Users className="w-8 h-8 text-primary-foreground" />
            </div>
            <DialogTitle className="text-2xl font-extrabold text-primary-foreground leading-snug">
              Armá el pedido<br />con tus amigos
            </DialogTitle>
            <DialogDescription className="text-sm text-primary-foreground/70 mt-2 leading-relaxed">
              Cada uno elige sus platos y al final confirman juntos con un solo tap.
            </DialogDescription>
          </div>

          <div className="px-6 py-5 space-y-5 bg-background">
            <div className="space-y-3.5">
              {[
                { n: '1', title: 'Elegí tus platos', desc: 'Explorá el menú y sumá lo que quieras al pedido.' },
                { n: '2', title: 'Invitá a tus amigos', desc: 'Compartí el link para que cada uno arme su parte.' },
                { n: '3', title: 'Confirmen juntos', desc: 'Todos confirman y el pedido se envía automáticamente.' },
              ].map(({ n, title, desc }) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-extrabold text-primary">{n}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={compartirLink}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 active:bg-primary/10 transition-colors text-sm font-semibold"
            >
              <Share2 className="w-4 h-4" />
              Compartir link con amigos
            </button>

            <Button
              className="w-full h-12 rounded-xl font-bold text-base shadow-md"
              onClick={() => setBienvenidaOpen(false)}
            >
              ¡Empezar a pedir!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

const ProductoCard = ({ producto, onClick, fullWidth }: { producto: any, onClick: () => void, fullWidth?: boolean }) => {
  const tieneDescuento = !!(producto.descuento && producto.descuento > 0)
  const precioOriginal = parseFloat(producto.precio)
  const precioFinal = tieneDescuento ? precioOriginal * (1 - producto.descuento / 100) : precioOriginal

  // Diseño sólido (único): el glassmorphism quedó discontinuado.
  return (
    <div
      className={`group relative flex flex-col ${fullWidth ? 'w-full' : 'w-48 shrink-0 lg:w-full'} h-[260px] rounded-[24px] bg-card border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden ${!fullWidth ? 'snap-start' : ''}`}
      onClick={onClick}
    >
      <div className="w-full h-[130px] shrink-0 bg-zinc-900 relative">
        {producto.imagenUrl ? (
          <img src={producto.imagenUrl} alt={producto.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-zinc-800 to-zinc-900">
            <Utensils className="w-10 h-10 text-primary" />
          </div>
        )}
        {tieneDescuento && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-lg uppercase tracking-wide">{producto.descuento}% OFF</span>
          </div>
        )}
      </div>
      <div className="p-3.5 flex flex-col flex-1 bg-card">
        <div className="flex-1">
          <h3 className="font-bold text-[14px] line-clamp-2 text-foreground leading-tight">{producto.nombre}</h3>
          {producto.descripcion && <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-snug font-medium">{producto.descripcion}</p>}
        </div>
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className={`font-black text-[17px] ${tieneDescuento ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`}>${precioFinal.toFixed(0)}</span>
          {tieneDescuento && <span className="text-[11px] font-semibold text-muted-foreground line-through opacity-70">${precioOriginal.toFixed(0)}</span>}
        </div>
      </div>
    </div>
  )
}

export default Menu
