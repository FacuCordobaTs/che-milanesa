import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { toast } from 'sonner'
import {
    Trash2, Maximize2, Minimize2, Loader2,
    Package, Receipt, UtensilsCrossed, Utensils, Clock, Share2, User, Plus
} from 'lucide-react'
import { ProductDetailDrawer } from '@/components/ProductDetailDrawer'
import { ThemeToggle } from '@/components/ThemeToggle'
import { MisPedidosDrawer } from '@/components/MisPedidosDrawer'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CheckoutDeliveryGrupal } from '@/components/CheckoutDeliveryGrupal'
import { redirectPedidoAlWhatsapp } from '@/lib/checkoutWhatsapp'
import { guardarTemaRestaurante, leerTemaRestaurante, RestauranteTheme } from '@/components/RestauranteTheme'

type HorarioTurno = { diaSemana: number; horaApertura: string; horaCierre: string }

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

function checkIsOpen(horarios: HorarioTurno[]): { abierto: boolean; proximaApertura: string | null } {
    if (!horarios || horarios.length === 0) return { abierto: true, proximaApertura: null }

    const now = new Date()
    const diaHoy = now.getDay() // 0=Dom
    const diaAyer = (diaHoy + 6) % 7
    const hhmm = now.getHours() * 60 + now.getMinutes()

    for (const h of horarios) {
        const apertura = parseInt(h.horaApertura.split(':')[0]) * 60 + parseInt(h.horaApertura.split(':')[1])
        const cierre = parseInt(h.horaCierre.split(':')[0]) * 60 + parseInt(h.horaCierre.split(':')[1])

        if (cierre > apertura) {
            if (h.diaSemana === diaHoy && hhmm >= apertura && hhmm < cierre) {
                return { abierto: true, proximaApertura: null }
            }
        } else {
            // Cruza medianoche: ej 20:00-02:00
            // Parte nocturna (mismo día del turno, después de apertura)
            if (h.diaSemana === diaHoy && hhmm >= apertura) {
                return { abierto: true, proximaApertura: null }
            }
            // Parte madrugada (día siguiente al turno, antes de cierre)
            if (h.diaSemana === diaAyer && hhmm < cierre) {
                return { abierto: true, proximaApertura: null }
            }
        }
    }

    // Encontrar la próxima apertura
    const DIAS_NOMBRE = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    let mejor: { minutos: number; texto: string } | null = null

    for (const h of horarios) {
        const apertura = parseInt(h.horaApertura.split(':')[0]) * 60 + parseInt(h.horaApertura.split(':')[1])
        let diasHasta = (h.diaSemana - diaHoy + 7) % 7
        let minutosHasta = diasHasta * 1440 + (apertura - hhmm)
        if (minutosHasta <= 0) minutosHasta += 7 * 1440

        if (!mejor || minutosHasta < mejor.minutos) {
            const esHoy = diasHasta === 0 && apertura > hhmm
            mejor = {
                minutos: minutosHasta,
                texto: esHoy ? `hoy a las ${h.horaApertura}` : `${DIAS_NOMBRE[h.diaSemana]} ${h.horaApertura}`
            }
        }
    }

    return { abierto: false, proximaApertura: mejor?.texto || null }
}


const MenuDelivery = () => {
    const navigate = useNavigate()
    // Che Milanesa es un deploy single-tenant: ésta es la única identidad
    // hardcodeada; sucursales, direcciones y teléfonos siempre vienen del backend.
    const username = 'chemilanesa'
    const [searchParams, setSearchParams] = useSearchParams()
    const repAplicadoRef = useRef(false)

    const [carritoAbierto, setCarritoAbierto] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<string>('All')
    const [cartAnimation, setCartAnimation] = useState(false)

    const [restaurante, setRestaurante] = useState<any>(null)
    const [productos, setProductos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [horarios, setHorarios] = useState<HorarioTurno[]>([])
    const [estadoAbierto, setEstadoAbierto] = useState<{ abierto: boolean; proximaApertura: string | null }>({ abierto: true, proximaApertura: null })

    const [modalSalaOpen, setModalSalaOpen] = useState(false)
    const [nombreSala, setNombreSala] = useState('')
    const [creandoSala, setCreandoSala] = useState(false)

    const [cartItems, setCartItems] = useState<any[]>(() => {
        const saved = localStorage.getItem(`deliveryCart_${username}`)
        if (saved) {
            try { return JSON.parse(saved).items || [] } catch { return [] }
        }
        return []
    })

    useEffect(() => {
        if (restaurante) {
            localStorage.setItem(`deliveryCart_${username}`, JSON.stringify({
                items: cartItems,
                restauranteId: restaurante.id,
                deliveryFee: restaurante.deliveryFee
            }))
        }
    }, [cartItems, restaurante, username])

    const [telefonoCliente, setTelefonoCliente] = useState(localStorage.getItem('cliente_telefono') || '')
    const [puntosCliente, setPuntosCliente] = useState<number | null>(null)
    const [loadingPuntos, setLoadingPuntos] = useState(false)
    const [modalPuntosOpen, setModalPuntosOpen] = useState(false)
    const [misPedidosOpen, setMisPedidosOpen] = useState(false)

    const [mostrarCheckoutEnCarrito, setMostrarCheckoutEnCarrito] = useState(false)
    const [expandido, setExpandido] = useState(false)
    const [checkoutDeliveryData, setCheckoutDeliveryData] = useState<any>(null)
    const [editSemaphoreLocal, setEditSemaphoreLocal] = useState<{ clienteId: string; clienteNombre: string } | null>(null)
    const [tituloCheckout, setTituloCheckout] = useState('¿Cómo lo querés?')
    const [submittingOrder, setSubmittingOrder] = useState(false)
    const checkoutDataRef = useRef<any>(null)
    const isSubmittingRef = useRef(false)

    // Function to fetch points
    const fetchPuntos = useCallback(async (telefono: string, restauranteId: number) => {
        if (!telefono || !restauranteId) return
        setLoadingPuntos(true)
        try {
            const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
            const res = await fetch(`${url}/public/restaurante/${restauranteId}/cliente/${encodeURIComponent(telefono)}`)
            if (res.ok) {
                const data = await res.json()
                if (data.success) {
                    setPuntosCliente(data.data.puntos)
                } else {
                    setPuntosCliente(0) // No client yet
                }
            } else {
                setPuntosCliente(0)
            }
        } catch (error) {
            console.error('Error fetching puntos:', error)
            setPuntosCliente(0)
        } finally {
            setLoadingPuntos(false)
        }
    }, [])

    useEffect(() => {
        const fetchRestaurante = async () => {
            try {
                const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
                const res = await fetch(`${url}/public/restaurante/${username}`)
                if (!res.ok) {
                    throw new Error('Restaurante no encontrado')
                }
                const data = await res.json()
                if (data.success) {
                    setRestaurante(data.data.restaurante)
                    setProductos(data.data.productos)
                    if (data.data.horarios) {
                        setHorarios(data.data.horarios)
                        setEstadoAbierto(checkIsOpen(data.data.horarios))
                    }
                    guardarTemaRestaurante(`theme_${username}`, data.data.restaurante)
                    if (data.data.restaurante.sistemaPuntos && telefonoCliente) {
                        fetchPuntos(telefonoCliente, data.data.restaurante.id)
                    }
                } else {
                    toast.error(data.message)
                }
            } catch (error) {
                toast.error('Error al cargar restaurante')
            } finally {
                setLoading(false)
            }
        }
        if (username) {
            fetchRestaurante()
        }
    }, [username])

    useEffect(() => {
        if (horarios.length === 0) return
        const interval = setInterval(() => {
            setEstadoAbierto(checkIsOpen(horarios))
        }, 60_000)
        return () => clearInterval(interval)
    }, [horarios])

    const abrirCarrito = useCallback(() => {
        window.history.pushState({ drawer: 'carrito' }, '')
        setCarritoAbierto(true)
        if (!mostrarCheckoutEnCarrito) setExpandido(true)
    }, [mostrarCheckoutEnCarrito])

    // Deep link con carrito precargado (tarea 4.3 · Motor de Recompra). Los mensajes del motor
    // (p. ej. recupero de dormidos) abren la tienda con `?rep=12x2-15x1` = el pedido de siempre del
    // cliente. Lo resolvemos contra los productos ya cargados, armamos el carrito solo y lo abrimos:
    // del antojo al pago sin volver a elegir nada. Se aplica una sola vez y limpia el query param.
    useEffect(() => {
        if (repAplicadoRef.current) return
        if (productos.length === 0) return
        const rep = searchParams.get('rep')
        if (!rep) return
        repAplicadoRef.current = true

        const pares = rep.split('-').map(p => {
            const [idStr, qtyStr] = p.split('x')
            return { id: Number(idStr), qty: Math.max(1, Math.min(99, Number(qtyStr) || 1)) }
        }).filter(p => Number.isFinite(p.id) && p.id > 0)

        const nuevos: any[] = []
        for (const par of pares) {
            const producto = productos.find(p => p.id === par.id)
            if (!producto) continue
            if (producto.disponible === false) continue
            if (producto.puntosNecesarios > 0) continue // el canje por puntos no se precarga
            const basePrecio = parseFloat(producto.precio)
            let precioFinal = basePrecio
            if (producto.descuento && producto.descuento > 0) precioFinal = basePrecio * (1 - producto.descuento / 100)
            nuevos.push({
                id: Math.random().toString(36).substr(2, 9),
                productoId: producto.id,
                nombre: producto.nombre,
                precio: precioFinal.toFixed(2),
                precioOriginal: producto.precio,
                descuento: producto.descuento || 0,
                imagenUrl: producto.imagenUrl,
                cantidad: par.qty,
                ingredientesExcluidos: [],
                ingredientesExcluidosNombres: [],
                agregados: [],
                esCanjePuntos: false,
                puntosNecesarios: 0,
                puntosGanados: producto.puntosGanados
            })
        }

        // Limpiamos el query param para que no se reaplique al navegar / recargar.
        searchParams.delete('rep')
        setSearchParams(searchParams, { replace: true })

        if (nuevos.length > 0) {
            setCartItems(nuevos)
            toast.success('Te dejamos listo tu pedido de siempre 🛒')
            setTimeout(() => abrirCarrito(), 500)
        }
    }, [productos])

    const cerrarCarrito = useCallback(() => {
        setCarritoAbierto(false)
        setMostrarCheckoutEnCarrito(false)
        setExpandido(false)
        setEditSemaphoreLocal(null)
        setCheckoutDeliveryData(null)
        checkoutDataRef.current = null
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

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (carritoAbierto) {
                setCarritoAbierto(false)
                setMostrarCheckoutEnCarrito(false)
                setExpandido(false)
                setEditSemaphoreLocal(null)
                setCheckoutDeliveryData(null)
                checkoutDataRef.current = null
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

    const handleLoginPuntos = (e: any) => {
        e.preventDefault()
        const tel = new FormData(e.target).get('telefono') as string
        if (tel) {
            localStorage.setItem('cliente_telefono', tel)
            setTelefonoCliente(tel)
            setModalPuntosOpen(false)
            fetchPuntos(tel, restaurante?.id)
        }
    }

    const ordenCategoria = (nombre: string) =>
        productos.find(p => p.categoria === nombre)?.categoriaOrden ?? 0
    const compararCategorias = (a: string, b: string) => {
        if (a === 'Sin categoría') return 1
        if (b === 'Sin categoría') return -1
        return ordenCategoria(a) - ordenCategoria(b) || a.localeCompare(b)
    }
    const categoriasBase = Array.from(new Set<string>(productos.map(p => p.categoria).filter(Boolean))).sort(compararCategorias)
    const tieneProductosCanje = productos.some(p => p.puntosNecesarios > 0)
    const categorias = ['All', ...categoriasBase]
    if (restaurante?.sistemaPuntos && tieneProductosCanje) categorias.push('Canje Puntos')

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

    const categoriasOrdenadas = Object.keys(productosPorCategoria).sort(compararCategorias)

    const abrirDetalleProducto = (producto: any) => {
        setSelectedProduct(producto)
        abrirProductoDrawer()
    }

    // Lista ordenada de productos "hermanos" para poder saltar de uno a otro dentro
    // del drawer (mismo orden en que se ven en pantalla). El canje por puntos queda
    // fuera: es un flujo aparte (`intentandoCanjear`) que no se navega.
    const productosNavegables: any[] = selectedProduct?.intentandoCanjear
        ? []
        : selectedCategory === 'All'
            ? categoriasOrdenadas.flatMap(c => productosPorCategoria[c] || [])
            : selectedCategory === 'Canje Puntos'
                ? []
                : productosFiltrados

    const agregarAlPedido = (producto: any, cantidad: number = 1, ingredientesExcluidos?: number[], agregados?: any[], varianteSeleccionada?: any, varianteSecundariaSeleccionada?: any) => {
        let ingExNombres: string[] = []
        if (ingredientesExcluidos && ingredientesExcluidos.length > 0) {
            ingExNombres = producto.ingredientes
                .filter((i: any) => ingredientesExcluidos.includes(i.id))
                .map((i: any) => i.nombre)
        }

        const esCanje = !!producto.intentandoCanjear;
        if (esCanje) {
            const puntosRestantes = (puntosCliente || 0) - puntosEnCarrito() - (producto.puntosNecesarios * cantidad);
            if (puntosRestantes < 0) {
                toast.error('No tienes suficientes puntos para agregar este producto.');
                return;
            }
        }

        // Calculate discounted price
        let basePrecio = varianteSeleccionada ? parseFloat(varianteSeleccionada.precio) : parseFloat(producto.precio)
        basePrecio += varianteSecundariaSeleccionada ? parseFloat(varianteSecundariaSeleccionada.precio) : 0
        let precioFinal = basePrecio
        if (!esCanje && producto.descuento && producto.descuento > 0) {
            precioFinal = basePrecio * (1 - producto.descuento / 100)
        }

        const precioAgregados = agregados ? agregados.reduce((sum: number, ag: any) => sum + parseFloat(ag.precio || 0), 0) : 0;
        const precioFinalNumber = esCanje ? 0 : precioFinal + precioAgregados;

        const nombresVariantes = [varianteSeleccionada?.nombre, varianteSecundariaSeleccionada?.nombre].filter(Boolean).join(' · ')
        const baseNombre = nombresVariantes ? `${producto.nombre} - ${nombresVariantes}` : producto.nombre;
        const nombreFinal = esCanje ? `${baseNombre} (Canje)` : baseNombre;

        const newItem = {
            id: Math.random().toString(36).substr(2, 9),
            productoId: producto.id,
            categoria: producto.categoria,
            nombre: nombreFinal,
            precio: precioFinalNumber.toFixed(2),
            precioOriginal: varianteSeleccionada ? varianteSeleccionada.precio : producto.precio,
            descuento: producto.descuento || 0,
            imagenUrl: producto.imagenUrl,
            cantidad,
            varianteId: varianteSeleccionada?.id,
            varianteNombre: varianteSeleccionada?.nombre,
            varianteSecundariaId: varianteSecundariaSeleccionada?.id,
            varianteSecundariaNombre: varianteSecundariaSeleccionada?.nombre,
            ingredientesExcluidos: ingredientesExcluidos || [],
            ingredientesExcluidosNombres: ingExNombres,
            agregados: agregados || [],
            esCanjePuntos: esCanje,
            puntosNecesarios: esCanje ? producto.puntosNecesarios : 0,
            puntosGanados: esCanje ? 0 : producto.puntosGanados
        }

        setCartItems(prev => [...prev, newItem])

        const bumpCart = () => {
            setTimeout(() => {
                setCartAnimation(true)
                setTimeout(() => setCartAnimation(false), 300)
            }, 850)
        }

        bumpCart()
    }

    const handleEliminarItem = (itemId: string) => {
        setCartItems(prev => prev.filter(item => item.id !== itemId))
    }

    const totalPedido = cartItems.reduce((sum, item) => sum + (parseFloat(item.precio) * item.cantidad), 0).toFixed(2)
    const puntosEnCarrito = () => cartItems.reduce((sum, item) => sum + (item.esCanjePuntos ? item.puntosNecesarios * item.cantidad : 0), 0)
    const puntosGanadosCarrito = () => cartItems.reduce((sum, item) => sum + (!item.esCanjePuntos && item.puntosGanados ? item.puntosGanados * item.cantidad : 0), 0)

    const alturaCarrito = (() => {
        const n = cartItems.length
        if (n >= 4) return '85vh'
        return ['28vh', '42vh', '57vh', '71vh'][n]
    })()

    const submitOrder = useCallback(async (data: any) => {
        if (!data || !restaurante || !username) return

        // Local pausado por suscripción (Tarea 8): cerrado temporalmente, no toma pedidos nuevos.
        if (restaurante?.pausadoPorSuscripcion) {
            toast.error('El local está cerrado temporalmente', {
                description: 'No está recibiendo pedidos en este momento.',
                duration: 5000
            })
            isSubmittingRef.current = false
            return
        }

        const estadoActual = checkIsOpen(horarios)
        if (!estadoActual.abierto && !restaurante?.permitirPedidosProgramados) {
            toast.error('El restaurante está cerrado', {
                description: estadoActual.proximaApertura
                    ? `Abre ${estadoActual.proximaApertura}`
                    : 'El restaurante no está disponible en este momento.',
                duration: 5000
            })
            isSubmittingRef.current = false
            return
        }

        setSubmittingOrder(true)
        try {
            const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
            const tipoPedido = data.tipoPedido as 'delivery' | 'takeaway'
            const endpoint = tipoPedido === 'delivery' ? '/public/delivery/create' : '/public/takeaway/create'
            const payload: any = {
                restauranteId: restaurante.id,
                nombreCliente: data.nombre,
                telefono: data.telefono,
                notas: data.notas || '',
                items: cartItems.map((i: any) => ({
                    productoId: i.productoId,
                    varianteId: i.varianteId,
                    varianteSecundariaId: i.varianteSecundariaId,
                    cantidad: i.cantidad,
                    ingredientesExcluidos: i.ingredientesExcluidos,
                    agregados: i.agregados || [],
                    esCanjePuntos: i.esCanjePuntos || false
                })),
                metodoPago: data.metodoPago,
            }
            if (data.codigoDescuentoId) payload.codigoDescuentoId = data.codigoDescuentoId
            if (tipoPedido === 'delivery') {
                payload.direccion = data.direccion
                payload.lat = data.lat
                payload.lng = data.lng
                if (data.sucursalId) payload.sucursalId = data.sucursalId
            }
            if (tipoPedido === 'takeaway' && data.sucursalId) payload.sucursalId = data.sucursalId
            if (data.horarioProgramado) payload.horarioProgramado = data.horarioProgramado
            const res = await fetch(`${url}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const result = await res.json()
            if (result.success) {
                localStorage.setItem('cliente_nombre', data.nombre)
                localStorage.setItem('cliente_telefono', data.telefono)
                if (tipoPedido === 'delivery') {
                    localStorage.setItem('cliente_direccion', data.direccion || '')
                    if (data.lat != null) localStorage.setItem('cliente_lat', String(data.lat))
                    if (data.lng != null) localStorage.setItem('cliente_lng', String(data.lng))
                }
                localStorage.removeItem(`deliveryCart_${username}`)
                const orderInfo = {
                    pedidoId: result.data.id,
                    tipoPedido,
                    total: result.data.total ? parseFloat(result.data.total) : parseFloat(data.total || '0'),
                    items: cartItems,
                    metodoPago: data.metodoPago,
                    nombreCliente: data.nombre,
                    aliasDinamico: result.data.aliasDinamico,
                    cvuDinamico: result.data.cvuDinamico,
                    deliveryFee: result.data.deliveryFee,
                    zonaNombre: result.data.zonaNombre,
                    direccion: tipoPedido === 'delivery' ? data.direccion : null,
                    montoDescuento: data.montoDescuento > 0 ? data.montoDescuento : undefined,
                    horarioProgramado: data.horarioProgramado || undefined,
                    notas: data.notas || undefined,
                }
                sessionStorage.setItem('deliveryOrderInfo', JSON.stringify(orderInfo))
                if (restaurante.avisosWhatsappClienteEnabled === false) {
                    const redirected = await redirectPedidoAlWhatsapp(
                        orderInfo,
                        restaurante,
                        result.data.whatsappDestino,
                        result.data.transferenciaAliasDestino,
                    )
                    if (!redirected) {
                        toast.error('No pudimos abrir WhatsApp', { description: 'Podés continuar desde el resumen de tu pedido.' })
                        navigate('/success')
                    }
                } else {
                    navigate('/success')
                }
            } else {
                if (result.code === 'FUERA_DE_ZONA') {
                    toast.error('Fuera de zona', { description: 'Tu dirección está fuera del área de delivery. Probá con otra dirección o elegí Take Away.', duration: 6000 })
                } else {
                    toast.error(result.message || 'Error al crear el pedido')
                }
            }
        } catch {
            toast.error('Ocurrió un error al enviar el pedido')
        } finally {
            setSubmittingOrder(false)
            isSubmittingRef.current = false
        }
    }, [restaurante, username, cartItems, navigate, horarios])

    const handleCheckoutMessage = useCallback((msg: any) => {
        if (msg.type === 'INICIAR_EDICION_CHECKOUT') {
            setEditSemaphoreLocal({ clienteId: 'solo', clienteNombre: msg.payload.clienteNombre })
        } else if (msg.type === 'CANCELAR_EDICION_CHECKOUT') {
            setEditSemaphoreLocal(null)
        } else if (msg.type === 'MODIFICAR_CHECKOUT') {
            checkoutDataRef.current = msg.payload.updates
            setCheckoutDeliveryData(msg.payload.updates)
        } else if (msg.type === 'ACEPTAR_EDICION_CHECKOUT') {
            if (isSubmittingRef.current) return
            isSubmittingRef.current = true
            submitOrder(checkoutDataRef.current)
        }
    }, [submitOrder])
    const crearSala = async (nombreParaSala: string) => {
        if (!nombreParaSala.trim() || !restaurante?.id) return
        setCreandoSala(true)
        try {
            const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
            const res = await fetch(`${url}/public/sala/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restauranteId: restaurante.id, nombreCliente: nombreParaSala.trim() })
            })
            const data = await res.json()
            if (data.success && data.data?.token) {
                localStorage.setItem('cliente_nombre', nombreParaSala.trim())
                setModalSalaOpen(false)
                navigate(`/sala/${data.data.token}/nombre`)
            } else {
                toast.error('Error al crear el pedido entre amigos')
            }
        } catch (e) {
            toast.error('Error al conectar con el servidor')
        } finally {
            setCreandoSala(false)
        }
    }

    const handleCrearSala = async (e: React.FormEvent) => {
        e.preventDefault()
        await crearSala(nombreSala)
    }

    const onArmarPedidoClick = () => {
        if (creandoSala) return
        const storedName = localStorage.getItem('cliente_nombre')
        if (storedName) {
            crearSala(storedName)
        } else {
            setModalSalaOpen(true)
        }
    }

    const cachedTheme = leerTemaRestaurante(`theme_${username}`)
    const themeStyles = <RestauranteTheme restaurante={restaurante} cachedTheme={cachedTheme} />

    if (loading) {
        return (
            <div className="min-h-screen bg-background text-foreground flex justify-center items-center">
                {themeStyles}
                <div className="flex flex-col items-center gap-2">
                    <span className="text-sm font-medium animate-pulse">Cargando...</span>
                </div>
            </div>
        )
    }

    if (!restaurante) {
        return <div className="min-h-screen flex justify-center items-center">Restaurante no encontrado</div>
    }

    return (
        <div className="min-h-screen pb-32 bg-background font-sans selection:bg-primary/20">
            {themeStyles}
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 supports-backdrop-filter:bg-background/60">
                <div className="max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                        </div>
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

            {restaurante?.pausadoPorSuscripcion ? (
                // Local pausado por suscripción (Tarea 8): cerrado temporalmente, no toma pedidos.
                // Tiene prioridad sobre el banner de horario y no se puede sortear con pedidos programados.
                <div className="bg-red-600 text-white">
                    <div className="max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto px-5 py-3 flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4 shrink-0" />
                        <p className="text-sm font-semibold text-center">
                            Cerrado temporalmente. No estamos recibiendo pedidos por ahora.
                        </p>
                    </div>
                </div>
            ) : !estadoAbierto.abierto && (
                <div className={restaurante?.permitirPedidosProgramados ? "bg-amber-500 text-white" : "bg-red-600 text-white"}>
                    <div className="max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto px-5 py-3 flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4 shrink-0" />
                        <p className="text-sm font-semibold text-center">
                            {restaurante?.permitirPedidosProgramados
                                ? 'Estamos cerrados. Podés programar tu pedido para después'
                                : `Estamos cerrados${estadoAbierto.proximaApertura ? `. Abrimos ${estadoAbierto.proximaApertura}` : ''}`
                            }
                        </p>
                    </div>
                </div>
            )}

            <div className="max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto px-5 pt-4 space-y-6">
                <section className="space-y-4">
                    <div className="flex items-center justify-center gap-4">
                        {restaurante.imagenUrl && (
                            <img
                                src={restaurante.imagenUrl}
                                alt="logo"
                                className={`w-48 h-48 rounded-md object-cover ${restaurante.imagenLightUrl ? 'hidden dark:block' : ''}`}
                            />
                        )}
                        {restaurante.imagenLightUrl && (
                            <img
                                src={restaurante.imagenLightUrl}
                                alt="logo"
                                className="w-48 h-48 rounded-md object-cover block dark:hidden"
                            />
                        )}
                        {/* <div>
                            <p className="text-sm text-muted-foreground font-medium mb-0.5">Bienvenido a</p>
                            <h1 className="text-3xl font-extrabold tracking-tight text-primary">
                                {restaurante.nombre}
                            </h1>
                        </div> */}
                    </div>
                </section>

                {restaurante?.orderGroupEnabled !== false && (
                    <section
                        role="button"
                        aria-label="Crear pedido entre amigos"
                        className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-primary/5 border border-primary/15 cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 active:scale-[0.98] lg:max-w-2xl lg:mx-auto lg:w-full"
                        onClick={onArmarPedidoClick}
                    >
                        <AvatarStack />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground leading-tight">¿Piden entre varios?</p>
                            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">Compartí un link y cada uno agrega lo suyo</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-bold text-primary-foreground bg-primary rounded-full px-3 py-2 shadow-sm">
                            {creandoSala ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Share2 className="w-3.5 h-3.5" />
                            )}
                            {creandoSala ? 'Creando…' : 'Crear link'}
                        </div>
                    </section>
                )}

                {restaurante?.sistemaPuntos && (
                    <section className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-center justify-between shadow-sm lg:max-w-2xl lg:mx-auto lg:w-full">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold">PUNTOS</span>
                                {puntosCliente !== null && (
                                    <span className="font-semibold text-foreground text-sm">
                                        {puntosCliente - puntosEnCarrito() + puntosGanadosCarrito()} pts
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground max-w-[200px]">
                                {puntosCliente === null ? 'Identifícate para ver tus puntos disponibles y canjear.' : 'Puntos acumulados. Canjea por productos.'}
                            </p>
                        </div>
                        <div>
                            {puntosCliente === null ? (
                                <Button size="sm" onClick={() => setModalPuntosOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-semibold rounded-lg text-xs">
                                    Identifícate
                                </Button>
                            ) : (
                                <Button disabled variant="outline" size="sm" className="bg-background/80 border-primary/30 text-xs font-semibold text-primary/80">
                                    Activo
                                </Button>
                            )}
                        </div>
                    </section>
                )}

                {categorias.length > 1 && (
                    <section className="space-y-3 pt-2">
                        <h2 className="text-lg font-bold text-foreground px-1">Categorías</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 px-1">
                            {categorias.map((category) => (
                                <Button
                                    key={category}
                                    onClick={() => setSelectedCategory(category || 'All')}
                                    variant={selectedCategory === category ? "default" : "secondary"}
                                    className={`rounded-lg px-5 h-10 text-xs font-medium transition-all ${selectedCategory === category
                                        ? "shadow-md"
                                        : "bg-secondary/50 hover:bg-secondary border border-transparent"
                                        }`}
                                >
                                    <span className="truncate">{category === 'All' ? 'Todas' : category}</span>
                                </Button>
                            ))}
                        </div>
                    </section>
                )}

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
                                            {productosDeCategoria.map((producto: any) => (
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
                    ) : selectedCategory === 'Canje Puntos' ? (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                                Productos a Canjear
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-1">
                                {productos.filter(p => p.puntosNecesarios > 0).map((producto: any) => (
                                    <ProductoCanjeCard
                                        key={producto.id}
                                        producto={producto}
                                        onClick={() => abrirDetalleProducto({ ...producto, intentandoCanjear: true })}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        productosFiltrados.length > 0 ? (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                                    {selectedCategory}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-1">
                                    {productosFiltrados.map((producto: any) => (
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

            {/* FOOTER / VER PEDIDO */}
            <div className={`fixed bottom-6 left-0 right-0 flex justify-center z-40 transition-all duration-500 ${cartItems.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
                <button
                    onClick={abrirCarrito}
                    className={`
            group relative flex items-center gap-4 pl-5 pr-6 py-3.5 rounded-full
            shadow-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300
            bg-zinc-900 text-white shadow-zinc-900/20
            dark:bg-white/10 dark:text-white dark:backdrop-blur-xl
            dark:border dark:border-white/10 dark:shadow-[0_0_20px_rgba(255,255,255,0.05)]
            ${cartAnimation ? 'scale-105' : 'scale-100'}
          `}
                >
                    <div className={`absolute -top-2 -right-1 bg-red-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full border-2 border-background z-10 transition-transform duration-300 ${cartAnimation ? 'scale-125' : 'scale-100'}`}>
                        {cartItems.length}
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

            {/* CARRITO OVERLAY */}
            {carritoAbierto && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
                    onClick={cerrarCarrito}
                />
            )}

            {/* CARRITO DRAWER */}
            <div
                className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${carritoAbierto ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
            >
                <div
                    className={`mx-auto max-w-2xl lg:max-w-lg bg-background rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.28)] border-t border-border flex flex-col transition-[height] duration-300 ease-out relative ${(!mostrarCheckoutEnCarrito || expandido) ? 'overflow-hidden' : 'overflow-y-auto'}`}
                    style={!mostrarCheckoutEnCarrito ? { height: alturaCarrito } : expandido ? { height: '85vh' } : { maxHeight: '88vh' }}
                >
                    {submittingOrder && (
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex items-center justify-center rounded-t-3xl">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm font-medium">Enviando pedido...</p>
                            </div>
                        </div>
                    )}

                    <div className="shrink-0 sticky top-0 z-10 bg-background pt-2">
                        <div className="w-full flex justify-center pt-3 pb-1">
                            <span className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
                        </div>
                        <div className="flex items-center justify-between px-4 pb-3 pt-2">
                            <div className="w-8 h-8" />
                            <span className="text-xl font-extrabold">
                                {mostrarCheckoutEnCarrito ? tituloCheckout : 'Tu Pedido'}
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

                    {mostrarCheckoutEnCarrito ? (
                        <CheckoutDeliveryGrupal
                            modo={expandido ? 'completo' : 'pasos'}
                            onVolverCarrito={() => {
                                setMostrarCheckoutEnCarrito(false)
                                setExpandido(true)
                                setCheckoutDeliveryData(null)
                                checkoutDataRef.current = null
                                setEditSemaphoreLocal(null)
                            }}
                            restauranteId={restaurante?.id ?? 0}
                            restauranteUsername={username ?? null}
                            itemsTotal={totalPedido}
                            totalItems={cartItems.length}
                            onConfirmarClick={() => {}}
                            sendMessage={handleCheckoutMessage}
                            clienteId="solo"
                            clienteNombre={localStorage.getItem('cliente_nombre') || ''}
                            checkoutData={checkoutDeliveryData}
                            editSemaphore={editSemaphoreLocal}
                            restauranteDireccion={restaurante?.direccionTexto ?? restaurante?.direccion ?? undefined}
                            onTituloChange={setTituloCheckout}
                            labelGuardar={restaurante?.avisosWhatsappClienteEnabled === false ? 'Enviar pedido al WhatsApp' : 'Confirmar y pedir'}
                            enviarPedidoWhatsapp={restaurante?.avisosWhatsappClienteEnabled === false}
                            localCerrado={!estadoAbierto.abierto || !!restaurante?.pausadoPorSuscripcion}
                        />
                    ) : cartItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center gap-4 opacity-60 px-5 py-12">
                            <div className="bg-secondary p-6 rounded-full">
                                <UtensilsCrossed className="w-10 h-10" />
                            </div>
                            <p className="font-medium">El pedido está vacío.</p>
                            <Button variant="link" onClick={cerrarCarrito}>Ir al menú</Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
                                {cartItems.map((item) => {
                                    const imagen = item.imagenUrl
                                    const precio = parseFloat(item.precio || 0)
                                    return (
                                        <div key={item.id} className="relative flex gap-4 p-3 rounded-2xl border transition-all bg-card border-primary/20 shadow-sm">
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
                                                        <p className="font-bold text-sm truncate">{item.nombre}</p>
                                                        {item.ingredientesExcluidosNombres?.length > 0 && (
                                                            <p className="text-xs text-primary/80 font-medium mt-1">
                                                                ⚠️ Sin: {item.ingredientesExcluidosNombres.join(', ')}
                                                            </p>
                                                        )}
                                                        {item.agregados?.length > 0 && (
                                                            <div className="mt-1">
                                                                {item.agregados.map((ag: any) => (
                                                                    <p key={ag.id} className="text-xs text-muted-foreground font-medium">+ {ag.nombre}</p>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        {item.descuento > 0 && (
                                                            <p className="text-[10px] text-muted-foreground line-through">${(parseFloat(item.precioOriginal) * item.cantidad).toFixed(2)}</p>
                                                        )}
                                                        <p className="font-bold text-base">${(precio * item.cantidad).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-end gap-3 mt-2">
                                                    <button onClick={() => handleEliminarItem(item.id)} className="w-8 h-8 flex items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="shrink-0 p-4 border-t border-border bg-background">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-muted-foreground text-sm">Total a pagar</span>
                                    <span className="text-2xl font-black tracking-tight">${totalPedido}</span>
                                </div>
                                <Button
                                    className="w-full h-12 rounded-xl font-bold text-base shadow-md"
                                    disabled={!!restaurante?.pausadoPorSuscripcion || (!estadoAbierto.abierto && !restaurante?.permitirPedidosProgramados)}
                                    onClick={() => {
                                        if (restaurante?.pausadoPorSuscripcion) return
                                        if (!estadoAbierto.abierto && !restaurante?.permitirPedidosProgramados) return
                                        setMostrarCheckoutEnCarrito(true)
                                        setExpandido(false)
                                    }}
                                >
                                    {restaurante?.pausadoPorSuscripcion
                                        ? 'Cerrado temporalmente'
                                        : (!estadoAbierto.abierto && !restaurante?.permitirPedidosProgramados ? 'Cerrado' : 'Continuar')}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <Sheet open={modalPuntosOpen} onOpenChange={setModalPuntosOpen}>
                <SheetContent side="bottom" className="rounded-t-3xl border-none">
                    <form onSubmit={handleLoginPuntos} className="p-4 py-8 space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                            </div>
                            <h3 className="text-xl font-bold">Consulta tus Puntos</h3>
                            <p className="text-sm text-muted-foreground">Ingresa tu celular de WhatsApp para ver los puntos de pedidos anteriores.</p>
                        </div>
                        <div className="space-y-2">
                            <input type="tel" name="telefono" required defaultValue={telefonoCliente} className="w-full text-center py-4 rounded-xl border border-input bg-transparent text-lg placeholder:text-muted-foreground focus:ring-2 focus:ring-primary transition-all outline-none" placeholder="Tu número de celular" />
                        </div>
                        <Button type="submit" className="w-full h-12 rounded-xl text-base bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                            {loadingPuntos ? 'Consultando...' : 'Ver Puntos'}
                        </Button>
                    </form>
                </SheetContent>
            </Sheet>

            <ProductDetailDrawer
                product={selectedProduct ? { ...selectedProduct, categoria: selectedProduct.categoria ?? undefined } : null}
                open={drawerOpen}
                onClose={cerrarProductoDrawer}
                onAddToOrder={agregarAlPedido}
                siblings={productosNavegables}
                onNavigate={(p) => setSelectedProduct(p)}
            />

            <MisPedidosDrawer
                open={misPedidosOpen}
                onOpenChange={setMisPedidosOpen}
                restauranteId={restaurante?.id ?? null}
            />

            <Dialog open={modalSalaOpen} onOpenChange={setModalSalaOpen}>
                <DialogContent className="max-w-sm rounded-3xl p-6">
                    <DialogHeader className="text-center sm:text-center">
                        <div className="mx-auto mb-4">
                            <AvatarStack grande />
                        </div>
                        <DialogTitle className="text-xl">Pedido entre amigos</DialogTitle>
                        <DialogDescription className="text-center pt-1">
                            Un solo pedido para todo el grupo, sin pasarse la lista.
                        </DialogDescription>
                    </DialogHeader>
                    <ol className="mt-4 space-y-3">
                        {[
                            'Compartís el link con tu grupo',
                            'Cada uno agrega lo suyo desde su celu',
                            'Todo sale junto, en un solo pedido',
                        ].map((paso, i) => (
                            <li key={i} className="flex items-center gap-3">
                                <span className="w-6 h-6 shrink-0 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">
                                    {i + 1}
                                </span>
                                <span className="text-sm text-foreground/80 leading-snug">{paso}</span>
                            </li>
                        ))}
                    </ol>
                    <form onSubmit={handleCrearSala} className="mt-5 space-y-3">
                        <Input
                            placeholder="¿Cuál es tu nombre?"
                            value={nombreSala}
                            onChange={(e) => setNombreSala(e.target.value)}
                            required
                            autoComplete="off"
                            autoFocus
                            className="h-12 text-center rounded-xl"
                        />
                        <DialogFooter className="flex-col gap-2 sm:gap-2">
                            <Button
                                type="submit"
                                size="lg"
                                disabled={creandoSala || !nombreSala.trim()}
                                className="w-full rounded-2xl font-semibold"
                            >
                                {creandoSala ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Creando tu link…
                                    </>
                                ) : (
                                    <>
                                        <Share2 className="w-4 h-4" />
                                        Crear mi link
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// Pila de avatares con un lugar libre ("+"): el visual de "un grupo con lugar para vos".
// Es lo que hace legible el pedido entre amigos sin leer ni una palabra.
const AvatarStack = ({ grande }: { grande?: boolean }) => {
    const circulo = grande ? 'w-11 h-11' : 'w-8 h-8'
    const icono = grande ? 'w-5 h-5' : 'w-4 h-4'
    return (
        <div className={`flex shrink-0 ${grande ? '-space-x-3' : '-space-x-2.5'}`}>
            <div className={`${circulo} rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background z-[2]`}>
                <User className={icono} />
            </div>
            <div className={`${circulo} rounded-full bg-primary/25 text-primary flex items-center justify-center ring-2 ring-background z-[1]`}>
                <User className={icono} />
            </div>
            <div className={`${circulo} rounded-full border-2 border-dashed border-primary/40 text-primary/60 bg-background flex items-center justify-center`}>
                <Plus className={icono} />
            </div>
        </div>
    )
}

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

    // ─────────────────────────────────────────────
    // DISEÑO 3: TEXT-ONLY (SIN IMAGEN)
    // ─────────────────────────────────────────────
    if (!producto.imagenUrl) {
        return (
            <div
                className={`group relative flex flex-col justify-between ${fullWidth ? 'w-full' : 'w-44 shrink-0 lg:w-full'} min-h-[140px] p-4.5 rounded-[24px] bg-card border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/30 hover:bg-accent/20 hover:scale-[1.02] active:scale-[0.98] ${!fullWidth ? 'snap-start' : ''}`}
                onClick={onClick}
            >
                <div className="flex-1">
                    <div className="flex justify-between items-start gap-3 mb-2">
                        <h3 className="font-bold text-[15px] leading-snug text-foreground line-clamp-3">
                            {producto.nombre}
                        </h3>
                        {tieneDescuento && (
                            <span className="shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                -{producto.descuento}%
                            </span>
                        )}
                    </div>
                    {producto.descripcion && (
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed font-medium">
                            {producto.descripcion}
                        </p>
                    )}
                </div>

                <div className="mt-4 flex items-end gap-1.5">
                    <span className={`font-black text-[18px] ${tieneDescuento ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`}>
                        ${precioFinal.toFixed(0)}
                    </span>
                    {tieneDescuento && (
                        <span className="text-[11px] font-semibold text-muted-foreground line-through opacity-70 mb-0.5">
                            ${precioOriginal.toFixed(0)}
                        </span>
                    )}
                </div>
                {tieneDescuento && producto.descuentoFechaFin && formatTimeLeft(producto.descuentoFechaFin) && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-500/20 w-fit">
                        <span>⏱</span>
                        <span>Vence en {formatTimeLeft(producto.descuentoFechaFin)}</span>
                    </div>
                )}
            </div>
        )
    }

    // ─────────────────────────────────────────────
    // DISEÑO SÓLIDO (CON IMAGEN) — único diseño; el glassmorphism quedó discontinuado
    // ─────────────────────────────────────────────
    return (
        <div
            className={`group relative flex flex-col ${fullWidth ? 'w-full' : 'w-48 shrink-0 lg:w-full'} h-[260px] rounded-[24px] bg-card border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden ${!fullWidth ? 'snap-start' : ''}`}
            onClick={onClick}
        >
            <div className="w-full h-[130px] shrink-0 bg-zinc-900 relative">
                <img
                    src={producto.imagenUrl}
                    alt={producto.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                {tieneDescuento && (
                    <div className="absolute top-2.5 left-2.5 z-10">
                        <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-lg uppercase tracking-wide">
                            {producto.descuento}% OFF
                        </span>
                    </div>
                )}
            </div>

            <div className="p-3.5 flex flex-col flex-1 bg-card">
                <div className="flex-1">
                    <h3 className="font-bold text-[14px] line-clamp-2 text-foreground leading-tight">
                        {producto.nombre}
                    </h3>
                    {producto.descripcion && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-snug font-medium">
                            {producto.descripcion}
                        </p>
                    )}
                </div>

                <div className="flex items-baseline gap-1.5 mt-2">
                    <span className={`font-black text-[17px] ${tieneDescuento ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`}>
                        ${precioFinal.toFixed(0)}
                    </span>
                    {tieneDescuento && (
                        <span className="text-[11px] font-semibold text-muted-foreground line-through opacity-70">
                            ${precioOriginal.toFixed(0)}
                        </span>
                    )}
                </div>
                {tieneDescuento && producto.descuentoFechaFin && formatTimeLeft(producto.descuentoFechaFin) && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-500/20 w-fit">
                        <span>⏱</span>
                        <span>Vence en {formatTimeLeft(producto.descuentoFechaFin)}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default MenuDelivery

const ProductoCanjeCard = ({ producto, onClick }: { producto: any, onClick: () => void }) => (
    <div
        className="group relative w-full h-24 rounded-2xl overflow-hidden cursor-pointer shadow-sm border border-primary/20 hover:border-primary/50 bg-card hover:bg-secondary/50 transition-all duration-300 flex items-center p-3 gap-4"
        onClick={onClick}
    >
        <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-zinc-900 border border-border/50">
            {producto.imagenUrl ? (
                <img src={producto.imagenUrl} alt={producto.nombre} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-zinc-800 to-zinc-900"><Utensils className="w-6 h-6 text-primary" /></div>
            )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="font-semibold text-sm text-foreground truncate">{producto.nombre}</h3>
            <p className="text-xs text-muted-foreground line-clamp-1">{producto.descripcion || 'Canje de puntos'}</p>
        </div>
        <div className="flex flex-col items-end justify-center px-2">
            <span className="text-[10px] font-bold text-primary mb-0.5">COSTO</span>
            <span className="font-extrabold text-primary text-lg leading-none">{producto.puntosNecesarios}</span>
            <span className="text-[10px] font-medium text-primary mt-0.5">pts</span>
        </div>
    </div>
)
