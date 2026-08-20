import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { MapPin, Store, Truck, AlertTriangle, Loader2, Pencil, X, Tag, Home, Building2, Clock, CreditCard, Wallet, Banknote, ChevronLeft, Check, Zap, MessageCircle } from 'lucide-react'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { AddressMapPreview } from '@/components/AddressMapPreview'
import type { CheckoutDeliveryData, CheckoutEditSemaphore } from '@/store/mesaStore'

type MetodoPublico = { id: string; label: string; automatico: boolean }
type FranjaHorario = { id: number; nombre: string; horaInicio: string; horaFin: string }

type PasoCheckout = 'tipo' | 'datos' | 'ubicacion' | 'extras'

interface CheckoutDeliveryGrupalProps {
  restauranteId: number
  restauranteUsername?: string | null
  itemsTotal: string
  totalItems: number
  onConfirmarClick: () => void
  sendMessage: (msg: any) => void
  clienteId: string
  clienteNombre: string
  checkoutData: CheckoutDeliveryData | null
  editSemaphore: CheckoutEditSemaphore | null
  restauranteDireccion?: string
  /** 'completo' = formulario completo scrolleable (drawer expandido). 'pasos' = wizard paso a paso (drawer comprimido). */
  modo: 'completo' | 'pasos'
  /** Volver a la vista del carrito */
  onVolverCarrito: () => void
  /** Callback para notificar el título actual al drawer padre */
  onTituloChange?: (titulo: string) => void
  /** Texto personalizado para el botón del último paso (default: 'Guardar datos') */
  labelGuardar?: string
  /** El local está cerrado ahora mismo. Si solo se puede pedir por estar habilitados los pedidos programados, obliga a elegir un horario (no se puede pedir "para ahora"). */
  localCerrado?: boolean
  /** Sin Avisos automáticos, el cliente debe enviar el pedido desde su WhatsApp. */
  enviarPedidoWhatsapp?: boolean
}

export function CheckoutDeliveryGrupal({
  restauranteId,
  restauranteUsername,
  itemsTotal,
  totalItems,
  onConfirmarClick,
  sendMessage,
  clienteId,
  clienteNombre,
  checkoutData,
  editSemaphore,
  restauranteDireccion,
  modo,
  onVolverCarrito,
  onTituloChange,
  labelGuardar,
  localCerrado = false,
  enviarPedidoWhatsapp = false,
}: CheckoutDeliveryGrupalProps) {
  const [tipoPedido, setTipoPedido] = useState<'delivery' | 'takeaway'>(checkoutData?.tipoPedido || 'delivery')
  const [nombre, setNombre] = useState(checkoutData?.nombre || localStorage.getItem('cliente_nombre') || '')
  const [telefono, setTelefono] = useState(checkoutData?.telefono || localStorage.getItem('cliente_telefono') || '')
  const [direccion, setDireccion] = useState(checkoutData?.direccion || '')
  const [lat, setLat] = useState<number | null>(checkoutData?.lat ?? null)
  const [lng, setLng] = useState<number | null>(checkoutData?.lng ?? null)
  const [notas, setNotas] = useState(checkoutData?.notas || '')
  const [tipoDomicilio, setTipoDomicilio] = useState<'casa' | 'departamento' | null>(checkoutData?.tipoDomicilio ?? null)
  const [piso, setPiso] = useState('')
  const [numeroDepartamento, setNumeroDepartamento] = useState('')
  const [programarPedido, setProgramarPedido] = useState(!!(checkoutData?.horarioProgramado))
  const [horarioProgramado, setHorarioProgramado] = useState(checkoutData?.horarioProgramado || '')
  const [metodoPago, setMetodoPago] = useState<string | null>(checkoutData?.metodoPago ?? null)
  const [sucursales, setSucursales] = useState<Array<{
    id: number
    nombre: string
    direccion: string | null
    direccionLat: string | null
    direccionLng: string | null
    direccionCiudad: string | null
  }>>([])
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<number | null>(checkoutData?.sucursalId ?? null)
  const [sucursalDelivery, setSucursalDelivery] = useState<number | null>(null)
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<MetodoPublico[]>([])
  const [restauranteData, setRestauranteData] = useState<any>(null)
  const [isLoadingRestaurante, setIsLoadingRestaurante] = useState(false)
  const [franjas, setFranjas] = useState<FranjaHorario[]>([])

  const [zonaDeliveryFee, setZonaDeliveryFee] = useState<number | null>(checkoutData ? checkoutData.deliveryFee : null)
  const [zonaNombre, setZonaNombre] = useState<string | null>(checkoutData?.zonaNombre ?? null)
  const [isCheckingZona, setIsCheckingZona] = useState(false)
  const [fueraDeZona, setFueraDeZona] = useState(false)
  const [codigoInput, setCodigoInput] = useState('')
  const [codigoDescuentoId, setCodigoDescuentoId] = useState<number | null>(checkoutData?.codigoDescuentoId ?? null)
  const [montoDescuento, setMontoDescuento] = useState(checkoutData?.montoDescuento ?? 0)
  const [validandoCodigo, setValidandoCodigo] = useState(false)
  const [codigoError, setCodigoError] = useState<string | null>(null)

  const [paso, setPaso] = useState(0)
  const pasos: PasoCheckout[] = ['tipo', 'datos', 'ubicacion', 'extras']

  const estoyEditando = editSemaphore?.clienteId === clienteId
  const alguienEditando = editSemaphore && !estoyEditando

  const codigoDescuentoEnabled = !restauranteData || restauranteData.codigoDescuentoEnabled === true
  const deliveryFee = zonaDeliveryFee !== null ? zonaDeliveryFee : 0
  const itemsTotalNum = parseFloat(itemsTotal)
  const subtotalConEnvio = tipoPedido === 'delivery' ? itemsTotalNum + deliveryFee : itemsTotalNum
  const total = Math.max(0, subtotalConEnvio - montoDescuento)
  const ciudadesSucursales = Array.from(new Set(
    sucursales.map((s) => s.direccionCiudad?.trim()).filter((city): city is string => Boolean(city)),
  ))
  const ubicacionesSucursales = sucursales.flatMap((s) => {
    const sucursalLat = Number(s.direccionLat)
    const sucursalLng = Number(s.direccionLng)
    return Number.isFinite(sucursalLat) && Number.isFinite(sucursalLng)
      ? [{ lat: sucursalLat, lng: sucursalLng }]
      : []
  })
  const direccionRetiro = sucursales.length === 1
    ? sucursales[0].direccion
    : restauranteDireccion

  useEffect(() => {
    if (!restauranteUsername || !estoyEditando || restauranteData) return
    const fetchRestaurante = async () => {
      setIsLoadingRestaurante(true)
      try {
        const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
        const response = await fetch(`${url}/public/restaurante/${restauranteUsername}`)
        const data = await response.json()
        if (data.success && data.data?.restaurante) {
          const r = data.data.restaurante
          setAvailablePaymentMethods(Array.isArray(r.metodosPago) ? r.metodosPago : [])
          setRestauranteData(r)
          const s = Array.isArray(data.data.sucursales) ? data.data.sucursales : []
          setSucursales(s)
          if (s.length === 1) setSucursalSeleccionada(s[0].id)
          if (Array.isArray(data.data.franjas)) setFranjas(data.data.franjas)
          const delEn = r.deliveryEnabled !== false
          const tkEn = r.takeawayEnabled !== false
          if (delEn && !tkEn) setTipoPedido('delivery')
          else if (!delEn && tkEn) setTipoPedido('takeaway')
        }
      } catch { /* ignore */ }
      finally { setIsLoadingRestaurante(false) }
    }
    fetchRestaurante()
  }, [restauranteUsername, estoyEditando])

  useEffect(() => {
    if (!availablePaymentMethods.length) return
    const allowed = new Set(availablePaymentMethods.map(m => m.id))
    setMetodoPago(prev => {
      if (prev && allowed.has(prev)) return prev
      return availablePaymentMethods[0].id
    })
  }, [availablePaymentMethods])

  useEffect(() => {
    if (!checkoutData) return
    setTipoPedido(checkoutData.tipoPedido)
    setNombre(checkoutData.nombre)
    setTelefono(checkoutData.telefono)
    setDireccion(checkoutData.direccion)
    setLat(checkoutData.lat)
    setLng(checkoutData.lng)
    setNotas(checkoutData.notas)
    setZonaDeliveryFee(checkoutData.deliveryFee)
    setZonaNombre(checkoutData.zonaNombre)
    setCodigoDescuentoId(checkoutData.codigoDescuentoId ?? null)
    setMontoDescuento(checkoutData.montoDescuento ?? 0)
    if (checkoutData.metodoPago) setMetodoPago(checkoutData.metodoPago)
    if (checkoutData.horarioProgramado) {
      setProgramarPedido(true)
      setHorarioProgramado(checkoutData.horarioProgramado)
    }
    if (checkoutData.tipoDomicilio) setTipoDomicilio(checkoutData.tipoDomicilio)
    if (checkoutData.sucursalId) setSucursalSeleccionada(checkoutData.sucursalId)
  }, [checkoutData?.nombre, checkoutData?.telefono, checkoutData?.direccion, checkoutData?.tipoPedido, checkoutData?.notas, checkoutData?.deliveryFee, checkoutData?.zonaNombre, checkoutData?.codigoDescuentoId, checkoutData?.montoDescuento, checkoutData?.metodoPago, checkoutData?.horarioProgramado, checkoutData?.tipoDomicilio, checkoutData?.sucursalId])

  useEffect(() => {
    if (lat === null || lng === null || !restauranteId) {
      if (!checkoutData?.deliveryFee) {
        setZonaDeliveryFee(null)
        setZonaNombre(null)
      }
      setFueraDeZona(false)
      setSucursalDelivery(null)
      return
    }
    const checkZona = async () => {
      setIsCheckingZona(true)
      setFueraDeZona(false)
      try {
        const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
        const res = await fetch(`${url}/public/restaurante/${restauranteId}/check-zona?lat=${lat}&lng=${lng}`)
        const data = await res.json()
        if (data.code === 'FUERA_DE_ZONA') {
          setFueraDeZona(true)
          setZonaDeliveryFee(null)
          setZonaNombre(null)
          setSucursalDelivery(null)
        } else if (data.success) {
          setFueraDeZona(false)
          setZonaDeliveryFee(parseFloat(data.deliveryFee))
          setZonaNombre(data.zonaNombre || null)
          setSucursalDelivery(data.sucursalId ?? null)
        }
      } catch {
        setZonaDeliveryFee(null)
        setZonaNombre(null)
        setSucursalDelivery(null)
      } finally {
        setIsCheckingZona(false)
      }
    }
    checkZona()
  }, [lat, lng, restauranteId])

  const handleAddressChange = useCallback((address: string, newLat: number | null, newLng: number | null) => {
    setDireccion(address)
    setLat(newLat)
    setLng(newLng)
    if (newLat === null || newLng === null) {
      setZonaDeliveryFee(null)
      setZonaNombre(null)
      setFueraDeZona(false)
      setSucursalDelivery(null)
    }
  }, [])

  const handleIniciarEdicion = () => {
    sendMessage({ type: 'INICIAR_EDICION_CHECKOUT', payload: { clienteId, clienteNombre } })
  }

  const handleCancelarEdicion = () => {
    sendMessage({ type: 'CANCELAR_EDICION_CHECKOUT', payload: { clienteId, clienteNombre } })
  }

  const handleValidarCodigo = async () => {
    if (!codigoInput.trim() || !restauranteId) return
    setValidandoCodigo(true)
    setCodigoError(null)
    try {
      const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
      const res = await fetch(`${url}/public/descuentos/validar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restauranteId, codigo: codigoInput.trim().toUpperCase(), totalCarrito: subtotalConEnvio }),
      })
      const data = await res.json()
      if (data.success && data.data) {
        setCodigoDescuentoId(data.data.codigoDescuentoId)
        setMontoDescuento(parseFloat(data.data.montoDescuento))
        toast.success(`Código aplicado: -$${parseFloat(data.data.montoDescuento).toFixed(0)}`)
      } else {
        setCodigoError(data.message || 'Código no válido')
        setCodigoDescuentoId(null)
        setMontoDescuento(0)
      }
    } catch {
      setCodigoError('Error al validar')
      setCodigoDescuentoId(null)
      setMontoDescuento(0)
    } finally {
      setValidandoCodigo(false)
    }
  }

  const quitarCodigo = () => {
    setCodigoInput('')
    setCodigoDescuentoId(null)
    setMontoDescuento(0)
    setCodigoError(null)
  }

  const handleGuardarEdicion = () => {
    if (tipoPedido === 'delivery' && (!nombre.trim() || !telefono.trim() || !direccion.trim())) {
      toast.error('Completa nombre, celular y dirección')
      return
    }
    if (tipoPedido === 'takeaway' && (!nombre.trim() || !telefono.trim())) {
      toast.error('Completa nombre y celular')
      return
    }
    if (tipoPedido === 'delivery' && (lat === null || lng === null)) {
      toast.error('Selecciona una dirección de las sugerencias')
      return
    }
    if (tipoPedido === 'delivery' && fueraDeZona) {
      toast.error('La dirección está fuera del área de delivery')
      return
    }
    if (tipoPedido === 'delivery' && !tipoDomicilio) {
      toast.error('Indicá si es casa o departamento')
      return
    }
    if (tipoPedido === 'delivery' && tipoDomicilio === 'departamento' && (!piso.trim() || !numeroDepartamento.trim())) {
      toast.error('Ingresá el piso y el número de departamento')
      return
    }
    if (tipoPedido === 'takeaway' && sucursales.length > 1 && !sucursalSeleccionada) {
      toast.error('Seleccioná un local de retiro')
      return
    }
    const requiereHorarioProgramado = usarFranjas ? franjaObligatoria : (programacionObligatoria || programarPedido)
    if (requiereHorarioProgramado && !horarioProgramado.trim()) {
      toast.error(usarFranjas ? 'Seleccioná un horario de entrega' : (localCerrado ? 'El local está cerrado, indicá a qué hora querés tu pedido' : 'Ingresa el horario para tu pedido'))
      return
    }

    const notasLimpias = notas.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '').trim()
    const notasFinal = (tipoPedido === 'delivery' && tipoDomicilio === 'departamento')
      ? (notasLimpias ? `Piso ${piso.trim()} Dpto ${numeroDepartamento.trim()}\n${notasLimpias}` : `Piso ${piso.trim()} Dpto ${numeroDepartamento.trim()}`)
      : notasLimpias

    const sucursalId = tipoPedido === 'delivery'
      ? (sucursalDelivery ?? null)
      : (sucursales.length === 1 ? sucursales[0].id : sucursalSeleccionada) ?? null

    const updates: Record<string, unknown> = {
      tipoPedido,
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      direccion: tipoPedido === 'delivery' ? direccion.trim() : '',
      lat: tipoPedido === 'delivery' ? lat : null,
      lng: tipoPedido === 'delivery' ? lng : null,
      notas: notasFinal,
      tipoDomicilio: tipoPedido === 'delivery' ? tipoDomicilio : null,
      deliveryFee,
      zonaNombre,
      itemsTotal,
      total: total.toFixed(2),
      codigoDescuentoId: codigoDescuentoId ?? null,
      montoDescuento,
      metodoPago: metodoPago ?? null,
      horarioProgramado: usarFranjas ? horarioProgramado : ((programacionObligatoria || programarPedido) ? horarioProgramado : ''),
      sucursalId,
    }

    sendMessage({ type: 'MODIFICAR_CHECKOUT', payload: { clienteId, updates } })
    sendMessage({ type: 'ACEPTAR_EDICION_CHECKOUT', payload: { clienteId, clienteNombre } })

    localStorage.setItem('cliente_nombre', nombre.trim())
    localStorage.setItem('cliente_telefono', telefono.trim())
  }

  const handleConfirmarPedido = () => {
    if (!checkoutData) {
      toast.error('Completa los datos de envío antes de confirmar')
      return
    }
    if (!checkoutData.nombre?.trim() || !checkoutData.telefono?.trim()) {
      toast.error('Faltan nombre o celular')
      return
    }
    if (checkoutData.tipoPedido === 'delivery' && !checkoutData.direccion?.trim()) {
      toast.error('Falta la dirección de entrega')
      return
    }
    onConfirmarClick()
  }

  useEffect(() => {
    if (!checkoutData && !editSemaphore && !estoyEditando) {
      handleIniciarEdicion()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (estoyEditando) setPaso(0)
  }, [estoyEditando])

  const validarPaso = (p: number): boolean => {
    const k = pasos[p]
    if (k === 'datos') {
      if (!nombre.trim() || !telefono.trim()) { toast.error('Completa nombre y celular'); return false }
    }
    if (k === 'ubicacion') {
      if (tipoPedido === 'delivery') {
        if (!direccion.trim()) { toast.error('Ingresa la dirección'); return false }
        if (lat === null || lng === null) { toast.error('Selecciona una dirección de las sugerencias'); return false }
        if (fueraDeZona) { toast.error('La dirección está fuera del área de delivery'); return false }
        if (!tipoDomicilio) { toast.error('Indicá si es casa o departamento'); return false }
        if (tipoDomicilio === 'departamento' && (!piso.trim() || !numeroDepartamento.trim())) { toast.error('Ingresá el piso y el número de departamento'); return false }
      } else {
        if (sucursales.length > 1 && !sucursalSeleccionada) { toast.error('Seleccioná un local de retiro'); return false }
      }
    }
    if (k === 'extras') {
      const requiere = usarFranjas ? franjaObligatoria : (programacionObligatoria || programarPedido)
      if (requiere && !horarioProgramado.trim()) { toast.error(usarFranjas ? 'Seleccioná un horario de entrega' : (localCerrado ? 'El local está cerrado, indicá a qué hora querés tu pedido' : 'Ingresa el horario para tu pedido')); return false }
    }
    return true
  }

  const handleSiguiente = () => {
    if (!validarPaso(paso)) return
    if (paso < pasos.length - 1) setPaso(paso + 1)
    else handleGuardarEdicion()
  }

  const handleAtras = () => {
    if (estoyEditando && modo === 'pasos' && paso > 0) { setPaso(paso - 1); return }
    if (estoyEditando) handleCancelarEdicion()
    onVolverCarrito()
  }

  const paymentTitle = (m: MetodoPublico) => {
    switch (m.id) {
      case 'cash': return 'Efectivo'
      case 'manual_transfer': return 'Transferencia manual'
      case 'transferencia_automatica_cucuru':
      case 'transferencia_automatica_talo': return 'Transferencia automática'
      case 'mercadopago_checkout': return 'Mercado Pago'
      case 'mercadopago_bricks': return 'Tarjeta'
      default: return m.label
    }
  }

  const paymentIcon = (m: MetodoPublico) => {
    const cls = `w-4 h-4 shrink-0 ${metodoPago === m.id ? 'text-foreground' : 'text-muted-foreground'}`
    if (m.id === 'cash') return <Banknote className={cls} />
    if (m.id === 'mercadopago_checkout') return <Wallet className={cls} />
    if (m.id === 'mercadopago_bricks') return <CreditCard className={cls} />
    return <CreditCard className={cls} />
  }

  const datosCompletos = checkoutData &&
    checkoutData.nombre?.trim() &&
    checkoutData.telefono?.trim() &&
    (checkoutData.tipoPedido === 'takeaway' || (checkoutData.direccion?.trim() && checkoutData.lat != null && checkoutData.lng != null))

  const delEn = restauranteData ? restauranteData.deliveryEnabled !== false : true
  const tkEn = restauranteData ? restauranteData.takeawayEnabled !== false : true
  const permitirProgramar = !!restauranteData?.permitirPedidosProgramados
  const usarFranjas = !!restauranteData?.usarFranjasHorario
  // Si el local está cerrado y solo se puede pedir porque están habilitados los pedidos programados,
  // el cliente está obligado a elegir un horario (no puede pedir "para ahora"), igual que con soloPedidosProgramados.
  // La opción "Lo antes posible" solo existe cuando NO es obligatorio programar (local abierto y se puede pedir para ahora).
  const programacionObligatoria = permitirProgramar && (!!restauranteData?.soloPedidosProgramados || localCerrado)
  const franjaObligatoria = usarFranjas && programacionObligatoria

  const inputCls = "h-12 rounded-2xl bg-secondary/60 border-0 shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base px-4"

  // ===== Secciones del formulario =====

  const secTipo = (
    <section>
      {restauranteData && !delEn && !tkEn ? (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-destructive/10 rounded-2xl">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium">El local no está aceptando pedidos ahora.</p>
        </div>
      ) : (
        <div className="bg-secondary/60 rounded-2xl p-1 grid grid-cols-2 gap-1">
          <button
            type="button"
            className={`flex items-center justify-center gap-2 py-4 rounded-xl transition-all duration-200 ${
              restauranteData && !delEn
                ? 'opacity-40 cursor-not-allowed'
                : `cursor-pointer ${tipoPedido === 'delivery' ? 'bg-background shadow-sm' : ''}`
            }`}
            onClick={() => (!restauranteData || delEn) && setTipoPedido('delivery')}
          >
            <MapPin className={`w-4 h-4 ${tipoPedido === 'delivery' ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`text-sm font-semibold ${tipoPedido === 'delivery' ? 'text-foreground' : 'text-muted-foreground'}`}>Delivery</span>
          </button>
          <button
            type="button"
            className={`flex items-center justify-center gap-2 py-4 rounded-xl transition-all duration-200 ${
              restauranteData && !tkEn
                ? 'opacity-40 cursor-not-allowed'
                : `cursor-pointer ${tipoPedido === 'takeaway' ? 'bg-background shadow-sm' : ''}`
            }`}
            onClick={() => (!restauranteData || tkEn) && setTipoPedido('takeaway')}
          >
            <Store className={`w-4 h-4 ${tipoPedido === 'takeaway' ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`text-sm font-semibold ${tipoPedido === 'takeaway' ? 'text-foreground' : 'text-muted-foreground'}`}>Take Away</span>
          </button>
        </div>
      )}
    </section>
  )

  const secDatos = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Nombre</Label>
        <Input id="nombre-grupal" placeholder="Quien recibe el pedido" className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Celular</Label>
        <Input id="telefono-grupal" type="tel" placeholder="Ej: 5491112345678" className={inputCls} value={telefono} onChange={e => setTelefono(e.target.value.replace(/\D/g, ''))} />
      </div>
    </div>
  )

  const secUbicacion = (
    <div className="space-y-5">
      {tipoPedido === 'takeaway' && sucursales.length > 1 && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">¿En qué local retirás?</Label>
          <div className="space-y-2">
            {sucursales.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSucursalSeleccionada(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 text-left ${sucursalSeleccionada === s.id ? 'bg-primary/10' : 'bg-secondary/50 hover:bg-secondary/80'}`}
              >
                <Store className={`w-4 h-4 shrink-0 ${sucursalSeleccionada === s.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{s.nombre}</p>
                  {s.direccion && <p className="text-xs text-muted-foreground mt-0.5">{s.direccion}</p>}
                </div>
                {sucursalSeleccionada === s.id && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {tipoPedido === 'delivery' && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Dirección de entrega</Label>
          <AddressAutocomplete
            value={direccion}
            onChange={handleAddressChange}
            placeholder={ciudadesSucursales.length === 1
              ? `Ej: calle y número, ${ciudadesSucursales[0]}`
              : 'Ej: calle y número'}
            allowedCities={ciudadesSucursales}
            biasLocations={ubicacionesSucursales}
          />
          {lat !== null && lng !== null && <AddressMapPreview lat={lat} lng={lng} />}
          {lat !== null && lng !== null && direccion && (
            <div className="animate-in fade-in duration-300">
              {isCheckingZona ? (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-secondary/50 rounded-2xl">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Verificando zona de delivery...</span>
                </div>
              ) : fueraDeZona ? (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-destructive/10 rounded-2xl">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  <span className="text-sm text-destructive font-medium">Fuera del área de delivery. Probá Take Away.</span>
                </div>
              ) : zonaDeliveryFee !== null ? (
                <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 rounded-2xl">
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground">Envío{zonaNombre ? ` · ${zonaNombre}` : ''}</span>
                  </div>
                  <span className="text-sm font-bold">
                    {deliveryFee === 0 ? 'Gratis' : `$${deliveryFee.toFixed(0)}`}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {tipoPedido === 'delivery' && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Tipo de domicilio</Label>
          <div className="bg-secondary/60 rounded-2xl p-1 grid grid-cols-2 gap-1">
            <button
              type="button"
              className={`flex items-center justify-center gap-2 py-4 rounded-xl transition-all duration-200 cursor-pointer ${tipoDomicilio === 'casa' ? 'bg-background shadow-sm' : ''}`}
              onClick={() => { setTipoDomicilio('casa'); setPiso(''); setNumeroDepartamento('') }}
            >
              <Home className={`w-4 h-4 ${tipoDomicilio === 'casa' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-semibold ${tipoDomicilio === 'casa' ? 'text-foreground' : 'text-muted-foreground'}`}>Casa</span>
            </button>
            <button
              type="button"
              className={`flex items-center justify-center gap-2 py-4 rounded-xl transition-all duration-200 cursor-pointer ${tipoDomicilio === 'departamento' ? 'bg-background shadow-sm' : ''}`}
              onClick={() => setTipoDomicilio('departamento')}
            >
              <Building2 className={`w-4 h-4 ${tipoDomicilio === 'departamento' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-semibold ${tipoDomicilio === 'departamento' ? 'text-foreground' : 'text-muted-foreground'}`}>Departamento</span>
            </button>
          </div>
          {tipoDomicilio === 'departamento' && (
            <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Piso</Label>
                <Input id="piso-grupal" placeholder="Ej: 4" className={inputCls} value={piso} onChange={e => setPiso(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Depto</Label>
                <Input id="depto-grupal" placeholder="Ej: C" className={inputCls} value={numeroDepartamento} onChange={e => setNumeroDepartamento(e.target.value.toUpperCase())} />
              </div>
            </div>
          )}
        </div>
      )}

      {tipoPedido === 'takeaway' && direccionRetiro && sucursales.length <= 1 && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-secondary/50 rounded-2xl">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Retirás en <span className="font-semibold text-foreground">{direccionRetiro}</span></span>
        </div>
      )}
    </div>
  )

  const secExtras = (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Notas <span className="normal-case font-normal">(opcional)</span></Label>
        <Textarea
          id="notas-grupal"
          placeholder="Ej: El timbre no anda..."
          className="rounded-2xl bg-secondary/60 border-0 shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none text-base min-h-[90px] px-4 py-3"
          value={notas}
          onChange={(e: any) => setNotas(e.target.value)}
        />
      </div>

      {restauranteData?.permitirPedidosProgramados && (
        usarFranjas ? (
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Horario de entrega {franjaObligatoria && <span className="text-destructive">*</span>}
            </Label>
            <p className="text-xs text-muted-foreground px-1">
              {franjaObligatoria ? 'Seleccioná un horario para continuar con tu pedido' : 'Elegí cuándo querés recibirlo'}
            </p>
            {/* "Lo antes posible" solo cuando el local está abierto y se puede pedir para ahora */}
            {!programacionObligatoria && (
              <button
                type="button"
                onClick={() => setHorarioProgramado('')}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 ${horarioProgramado === '' ? 'bg-primary/10' : 'bg-secondary/50 hover:bg-secondary/80'}`}
              >
                <Zap className={`w-4 h-4 shrink-0 ${horarioProgramado === '' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-sm font-semibold ${horarioProgramado === '' ? 'text-primary' : 'text-foreground'}`}>Lo antes posible</span>
                {horarioProgramado === '' && <Check className="w-4 h-4 text-primary shrink-0 ml-auto" />}
              </button>
            )}
            {franjas.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {franjas.map(f => {
                  const valor = `${f.horaInicio}-${f.horaFin}`
                  const selected = horarioProgramado === valor
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setHorarioProgramado(selected && !franjaObligatoria ? '' : valor)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 ${selected ? 'bg-primary/10' : 'bg-secondary/50 hover:bg-secondary/80'}`}
                    >
                      <span className={`font-semibold text-sm ${selected ? 'text-primary' : 'text-foreground'}`}>{f.nombre}</span>
                      <span className="text-xs text-muted-foreground">{f.horaInicio} – {f.horaFin}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="px-4 py-3 bg-secondary/50 rounded-2xl text-sm text-muted-foreground">
                No hay horarios disponibles por el momento.
              </div>
            )}
          </div>
        ) : programacionObligatoria ? (
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Horario de entrega <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground px-1">
              {localCerrado
                ? 'El local está cerrado. Indicá a qué hora querés recibir tu pedido.'
                : 'Indicá a qué hora querés recibir tu pedido.'}
            </p>
            <input
              id="horario-grupal"
              type="time"
              className="w-full h-12 rounded-2xl bg-secondary/60 px-4 text-base font-semibold text-foreground border-0 outline-none"
              value={horarioProgramado}
              onChange={e => setHorarioProgramado(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">¿Cuándo lo querés?</Label>
            <div className="bg-secondary/60 rounded-2xl p-1 grid grid-cols-2 gap-1">
              <button
                type="button"
                className={`flex items-center justify-center gap-2 py-4 rounded-xl transition-all duration-200 cursor-pointer ${!programarPedido ? 'bg-background shadow-sm' : ''}`}
                onClick={() => { setProgramarPedido(false); setHorarioProgramado('') }}
              >
                <Zap className={`w-4 h-4 ${!programarPedido ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-sm font-semibold ${!programarPedido ? 'text-foreground' : 'text-muted-foreground'}`}>Lo antes posible</span>
              </button>
              <button
                type="button"
                className={`flex items-center justify-center gap-2 py-4 rounded-xl transition-all duration-200 cursor-pointer ${programarPedido ? 'bg-background shadow-sm' : ''}`}
                onClick={() => setProgramarPedido(true)}
              >
                <Clock className={`w-4 h-4 ${programarPedido ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-sm font-semibold ${programarPedido ? 'text-foreground' : 'text-muted-foreground'}`}>Programar</span>
              </button>
            </div>
            {programarPedido && (
              <div className="animate-in fade-in slide-in-from-top-2 space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">¿A qué hora?</Label>
                <input
                  id="horario-grupal"
                  type="time"
                  className="w-full h-12 rounded-2xl bg-secondary/60 px-4 text-base font-semibold text-foreground border-0 outline-none"
                  value={horarioProgramado}
                  onChange={e => setHorarioProgramado(e.target.value)}
                />
              </div>
            )}
          </div>
        )
      )}

      {codigoDescuentoEnabled && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Código de descuento <span className="normal-case font-normal">(opcional)</span></Label>
          {codigoDescuentoId ? (
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-secondary/60">
              <div className="flex items-center gap-2.5">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold">Descuento aplicado · -${montoDescuento.toFixed(0)}</span>
              </div>
              <button type="button" onClick={quitarCodigo} className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                id="codigo-grupal"
                placeholder="CODIGO10"
                className="h-12 rounded-2xl bg-secondary/60 border-0 shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono uppercase text-base"
                value={codigoInput}
                onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setCodigoError(null) }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleValidarCodigo())}
              />
              <Button
                type="button"
                variant="ghost"
                className="rounded-2xl shrink-0 h-12 px-5 bg-secondary/60 hover:bg-secondary/80 font-semibold"
                onClick={handleValidarCodigo}
                disabled={validandoCodigo || !codigoInput.trim()}
              >
                {validandoCodigo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
              </Button>
            </div>
          )}
          {codigoError && <p className="text-xs text-destructive px-1 font-medium">{codigoError}</p>}
        </div>
      )}

      {!isLoadingRestaurante && availablePaymentMethods.length > 0 && (
        <div className="space-y-2 animate-in fade-in">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Método de pago</Label>
          <div className="space-y-1.5">
            {availablePaymentMethods.map(m => {
              const selected = metodoPago === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-200 ${selected ? 'bg-primary/10' : 'bg-secondary/50 hover:bg-secondary/80'}`}
                  onClick={() => setMetodoPago(m.id)}
                >
                  <div className="flex items-center gap-3">
                    {paymentIcon(m)}
                    <span className="text-sm font-semibold">{paymentTitle(m)}</span>
                  </div>
                  {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  const tituloPaso: Record<PasoCheckout, string> = {
    tipo: '¿Cómo lo querés?',
    datos: 'Tus datos',
    ubicacion: tipoPedido === 'delivery' ? 'Dirección de entrega' : 'Retiro',
    extras: 'Pago y detalles',
  }

  useEffect(() => {
    if (!onTituloChange) return
    if (estoyEditando && modo === 'pasos') {
      onTituloChange(tituloPaso[pasos[paso]])
    } else if (checkoutData && !estoyEditando) {
      onTituloChange('Revisá tu pedido')
    } else {
      onTituloChange('Datos de envío')
    }
  }, [onTituloChange, estoyEditando, modo, paso, checkoutData, tipoPedido])

  const readOnly = (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datos guardados</span>
        <button type="button" onClick={handleIniciarEdicion} className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </button>
      </div>
      <div className="bg-secondary/40 rounded-2xl overflow-hidden">
        <div className="px-4 py-3.5">
          <p className="text-xs text-muted-foreground mb-0.5">Tipo</p>
          <p className="text-sm font-semibold">{checkoutData?.tipoPedido === 'delivery' ? 'Delivery' : 'Take Away'}</p>
        </div>
        <div className="h-px bg-background mx-4" />
        <div className="px-4 py-3.5">
          <p className="text-xs text-muted-foreground mb-0.5">Nombre</p>
          <p className="text-sm font-semibold">{checkoutData?.nombre}</p>
        </div>
        <div className="h-px bg-background mx-4" />
        <div className="px-4 py-3.5">
          <p className="text-xs text-muted-foreground mb-0.5">Celular</p>
          <p className="text-sm font-semibold">{checkoutData?.telefono}</p>
        </div>
        {checkoutData?.tipoPedido === 'delivery' && checkoutData.direccion && (
          <>
            <div className="h-px bg-background mx-4" />
            <div className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground mb-0.5">Dirección</p>
              <p className="text-sm font-semibold">{checkoutData.direccion}</p>
              {checkoutData.tipoDomicilio && (
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{checkoutData.tipoDomicilio}</p>
              )}
              {(checkoutData.deliveryFee ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Envío: ${checkoutData.deliveryFee.toFixed(0)}{checkoutData.zonaNombre ? ` · ${checkoutData.zonaNombre}` : ''}
                </p>
              )}
            </div>
          </>
        )}
        {checkoutData?.metodoPago && (
          <>
            <div className="h-px bg-background mx-4" />
            <div className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground mb-0.5">Método de pago</p>
              <p className="text-sm font-semibold capitalize">{checkoutData.metodoPago.replace(/_/g, ' ')}</p>
            </div>
          </>
        )}
        {checkoutData?.horarioProgramado && (
          <>
            <div className="h-px bg-background mx-4" />
            <div className="px-4 py-3.5 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <p className="text-sm">Programado para las <span className="font-semibold">{checkoutData.horarioProgramado}</span></p>
            </div>
          </>
        )}
        {(checkoutData?.montoDescuento ?? 0) > 0 && (
          <>
            <div className="h-px bg-background mx-4" />
            <div className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground mb-0.5">Descuento</p>
              <p className="text-sm font-semibold">-${(checkoutData?.montoDescuento ?? 0).toFixed(0)}</p>
            </div>
          </>
        )}
        {checkoutData?.notas && (
          <>
            <div className="h-px bg-background mx-4" />
            <div className="px-4 py-3.5">
              <p className="text-xs text-muted-foreground mb-0.5">Notas</p>
              <p className="text-sm text-muted-foreground line-clamp-2">{checkoutData.notas}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )

  const totalSummary = (
    <div className="bg-secondary/40 rounded-2xl px-4 py-4 space-y-2.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal · {totalItems} items <span className="sr-only">con variantes seleccionadas incluidas</span></span>
        <span className="font-semibold">${itemsTotal}</span>
      </div>
      {checkoutData?.tipoPedido === 'delivery' && (checkoutData.deliveryFee ?? 0) > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Delivery</span>
          <span className="font-semibold">${checkoutData.deliveryFee.toFixed(2)}</span>
        </div>
      )}
      {(checkoutData?.montoDescuento ?? montoDescuento) > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Descuento</span>
          <span className="font-semibold">-${(checkoutData?.montoDescuento ?? montoDescuento).toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-base pt-2.5">
        <span>Total</span>
        <span>${checkoutData?.total || total.toFixed(2)}</span>
      </div>
    </div>
  )

  const accionDisabled = tipoPedido === 'delivery' && (fueraDeZona || (isCheckingZona && (modo === 'completo' || pasos[paso] === 'ubicacion')))

  let footerButton: React.ReactNode
  if (alguienEditando) {
    footerButton = (
      <Button disabled className="w-full h-12 rounded-2xl font-bold text-base">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        {editSemaphore?.clienteNombre} está editando...
      </Button>
    )
  } else if (estoyEditando) {
    const esUltimo = modo === 'pasos' ? paso === pasos.length - 1 : true
    footerButton = (
      <Button
        className={`w-full h-12 rounded-2xl font-bold text-base ${enviarPedidoWhatsapp && esUltimo ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
        onClick={modo === 'pasos' ? handleSiguiente : handleGuardarEdicion}
        disabled={accionDisabled}
      >
        {enviarPedidoWhatsapp && esUltimo && <MessageCircle className="w-5 h-5 mr-2" />}
        {modo === 'pasos' && !esUltimo ? 'Siguiente' : (labelGuardar || 'Guardar datos')}
      </Button>
    )
  } else if (checkoutData) {
    footerButton = datosCompletos ? (
      <Button className={`w-full h-12 rounded-2xl font-bold text-base ${enviarPedidoWhatsapp ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`} onClick={handleConfirmarPedido}>
        {enviarPedidoWhatsapp && <MessageCircle className="w-5 h-5 mr-2" />}
        {enviarPedidoWhatsapp ? 'Enviar pedido al WhatsApp' : 'Confirmar Pedido'}
      </Button>
    ) : (
      <p className="text-xs text-muted-foreground text-center py-2">Esperando que se completen los datos...</p>
    )
  } else {
    footerButton = (
      <Button className="w-full h-12 rounded-2xl font-bold text-base" onClick={handleIniciarEdicion}>
        <Pencil className="w-4 h-4 mr-2" />
        Completar datos de envío
      </Button>
    )
  }

  const compacto = modo === 'pasos'

  return (
    <div className={`flex flex-col ${compacto ? '' : 'flex-1 min-h-0'}`}>
      <div className="shrink-0 flex items-center gap-3 px-5 pt-3 pb-1 lg:w-full lg:max-w-md lg:mx-auto">
        <button
          type="button"
          onClick={handleAtras}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition-colors shrink-0"
          aria-label="Atrás"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        {estoyEditando && modo === 'pasos' ? (
          <>
            <div className="flex-1 flex items-center gap-1.5">
              {pasos.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= paso ? 'bg-primary' : 'bg-secondary'}`}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-muted-foreground shrink-0">{paso + 1}/{pasos.length}</span>
          </>
        ) : (
          <span className="text-sm font-bold">
            {estoyEditando ? 'Datos de envío' : checkoutData ? 'Revisá tu pedido' : 'Datos de envío'}
          </span>
        )}
      </div>

      <div className={`lg:w-full lg:max-w-md lg:mx-auto ${compacto ? 'px-5 py-4 space-y-5' : 'flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0'}`}>
        {alguienEditando && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-secondary/60 rounded-2xl">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-muted-foreground">
              {editSemaphore?.clienteNombre} está editando
            </span>
          </div>
        )}

        {estoyEditando && !alguienEditando && (
          modo === 'completo' ? (
            <>
              {secTipo}
              {secDatos}
              {secUbicacion}
              {secExtras}
              {totalSummary}
            </>
          ) : (
            <>
              {pasos[paso] === 'tipo' && secTipo}
              {pasos[paso] === 'datos' && secDatos}
              {pasos[paso] === 'ubicacion' && secUbicacion}
              {pasos[paso] === 'extras' && secExtras}
            </>
          )
        )}

        {checkoutData && !estoyEditando && !alguienEditando && (
          <>
            {readOnly}
            {totalSummary}
          </>
        )}

        {!checkoutData && !estoyEditando && !alguienEditando && (
          <div className="flex flex-col items-center justify-center text-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando datos de envío...</span>
          </div>
        )}
      </div>

      <div className={`px-5 pb-5 pt-4 bg-background space-y-3 lg:w-full lg:max-w-md lg:mx-auto ${compacto ? 'sticky bottom-0 z-10' : 'shrink-0'}`}>
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-2xl font-black tracking-tight">${checkoutData?.total || total.toFixed(2)}</span>
        </div>
        {footerButton}
      </div>
    </div>
  )
}
