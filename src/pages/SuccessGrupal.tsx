import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { CheckCircle2, Copy, Loader2, Store, Truck, MapPin, Clock, Users } from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ThemeToggle'
import { guardarTemaRestaurante, leerTemaRestaurante, RestauranteTheme } from '@/components/RestauranteTheme'
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react'

const MP_CHECKOUT_LAUNCHED_KEY = 'mpCheckoutLaunchedSalaPedidoId'

function getEffectiveMetodo(orderInfo: { metodoPago?: string; aliasDinamico?: string; cvuDinamico?: string } | null): string {
  if (!orderInfo) return ''
  const raw = orderInfo.metodoPago || ''
  if (raw === 'efectivo') return 'cash'
  if (raw === 'mercadopago') return 'mercadopago_bricks'
  if (raw === 'transferencia') {
    return orderInfo.aliasDinamico || orderInfo.cvuDinamico ? 'transferencia_automatica_cucuru' : 'manual_transfer'
  }
  return raw
}

const SuccessGrupal = () => {
  const { qrToken } = useParams()
  const navigate = useNavigate()
  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [status, setStatus] = useState<'pending_payment' | 'verifying' | 'confirmed'>('pending_payment')
  const [restauranteData, setRestauranteData] = useState<any>(null)
  const [pedidoEstado, setPedidoEstado] = useState<string | null>(null)
  const [rapiboyTrackingUrl, setRapiboyTrackingUrl] = useState<string | null>(null)
  const [isCreatingMP, setIsCreatingMP] = useState(false)
  const metaPurchaseTracked = useRef(false)

  useEffect(() => {
    const savedInfo = sessionStorage.getItem('salaOrderInfo')
    if (savedInfo) {
      setOrderInfo(JSON.parse(savedInfo))
    } else if (qrToken) {
      navigate(`/sala/${qrToken}`)
    }
  }, [qrToken, navigate])

  useEffect(() => {
    const fetchRestaurante = async () => {
      if (!orderInfo?.token) return
      try {
        const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
        const res = await fetch(`${url}/public/sala/join/${orderInfo.token}`)
        const data = await res.json()
        if (data.success && data.data?.restaurante) {
          const rest = data.data.restaurante
          setRestauranteData(rest)
          guardarTemaRestaurante(`theme_sala_${orderInfo.token}`, rest)
          const m = getEffectiveMetodo(JSON.parse(sessionStorage.getItem('salaOrderInfo') || '{}'))
          if (m === 'cash') setStatus('confirmed')
        }
      } catch (err) {
        console.error('Error fetching restaurante:', err)
      }
    }
    if (orderInfo?.token) fetchRestaurante()
  }, [orderInfo?.token])

  useLayoutEffect(() => {
    const m = getEffectiveMetodo(orderInfo)
    if (!orderInfo || m !== 'mercadopago_bricks' || !restauranteData?.mpPublicKey) return
    initMercadoPago(restauranteData.mpPublicKey, { locale: 'es-AR' })
  }, [orderInfo, restauranteData?.mpPublicKey])

  useEffect(() => {
    if (!orderInfo?.pedidoId || !orderInfo?.tipoPedido) return
    const fetchStatus = async () => {
      try {
        const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
        const res = await fetch(`${url}/public/pedido/${orderInfo.tipoPedido}/${orderInfo.pedidoId}/status`)
        const data = await res.json()
        if (data.success) {
          if (data.pagado) {
            setStatus('confirmed')
            sessionStorage.removeItem(MP_CHECKOUT_LAUNCHED_KEY)
          } else {
            const launched = sessionStorage.getItem(MP_CHECKOUT_LAUNCHED_KEY)
            if (launched === String(orderInfo.pedidoId)) setStatus('verifying')
          }
          if (data.estado) setPedidoEstado(data.estado)
          if (data.rapiboyTrackingUrl) setRapiboyTrackingUrl(data.rapiboyTrackingUrl)
        }
      } catch (err) {
        console.error('Error fetching status:', err)
      }
    }
    fetchStatus()
  }, [orderInfo?.pedidoId, orderInfo?.tipoPedido])

  useEffect(() => {
    if (!orderInfo?.pedidoId || !orderInfo?.tipoPedido) return
    let ws: WebSocket
    let isConnecting = false

    const connectWebSocket = () => {
      if (isConnecting) return
      isConnecting = true
      const wsBase = import.meta.env.VITE_WS_URL
        ? import.meta.env.VITE_WS_URL
        : import.meta.env.VITE_API_URL
          ? import.meta.env.VITE_API_URL.replace('http', 'ws').replace('/api', '')
          : 'ws://localhost:3000'
      ws = new WebSocket(`${wsBase}/ws/public/${orderInfo.tipoPedido}/${orderInfo.pedidoId}`)
      ws.onopen = () => { isConnecting = false }
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'PAGO_ACREDITADO') {
            setStatus('confirmed')
            sessionStorage.removeItem(MP_CHECKOUT_LAUNCHED_KEY)
            toast.success('¡Transferencia recibida!', {
              icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
              duration: 6000
            })
          } else if (data.type === 'PEDIDO_ESTADO_ACTUALIZADO') {
            setPedidoEstado(data.payload.estado)
            if (data.payload.trackingUrl) setRapiboyTrackingUrl(data.payload.trackingUrl)
            if (data.payload.estado === 'dispatched' || data.payload.estado === 'archived') {
              toast.success('¡Tu pedido va en camino!', {
                icon: <Truck className="w-5 h-5 text-blue-500" />,
                duration: 6000
              })
            }
          }
        } catch (e) {
          console.error('Error parsing WS message', e)
        }
      }
      ws.onclose = () => {
        isConnecting = false
        setTimeout(() => connectWebSocket(), 3000)
      }
    }
    connectWebSocket()
    return () => { if (ws) ws.close() }
  }, [orderInfo?.pedidoId, orderInfo?.tipoPedido])

  useEffect(() => {
    if (status !== 'verifying' || !orderInfo) return
    let isChecking = false
    const checkPaymentStatus = async () => {
      if (isChecking) return
      isChecking = true
      try {
        const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
        const res = await fetch(`${url}/public/pedido/${orderInfo.tipoPedido}/${orderInfo.pedidoId}/status`)
        const data = await res.json()
        if (data.success && data.pagado) {
          setStatus('confirmed')
          sessionStorage.removeItem(MP_CHECKOUT_LAUNCHED_KEY)
          toast.success('¡Pago confirmado!', {
            icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
            duration: 6000
          })
        }
      } catch (err) {
        console.error('Error verificando pago:', err)
      } finally {
        isChecking = false
      }
    }
    const pollInterval = setInterval(checkPaymentStatus, 4000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkPaymentStatus()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [status, orderInfo])

  useEffect(() => {
    if (status !== 'confirmed' || !orderInfo || metaPurchaseTracked.current) return
    const total = parseFloat(orderInfo.total)
    if (isNaN(total) || total <= 0) return
    metaPurchaseTracked.current = true
    try {
      const fbq = (window as any).fbq
      if (typeof fbq === 'function') fbq('track', 'Purchase', { currency: 'ARS', value: total })
    } catch { /* ignore */ }
  }, [status, orderInfo])

  if (!orderInfo) return null

  const handleCopyAlias = async (aliasToCopy: string) => {
    try {
      await navigator.clipboard.writeText(aliasToCopy)
      toast.success('Alias copiado', { description: aliasToCopy })
    } catch {
      toast.error('No se pudo copiar el alias')
    }
  }

  const handleCardPaymentSubmit = async (formData: {
    token: string
    issuer_id: string
    payment_method_id: string
    transaction_amount: number
    installments: number
    payer: { email?: string; identification?: { type?: string; number?: string } }
  }) => {
    setIsCreatingMP(true)
    try {
      const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
      const response = await fetch(`${url}/mp/process-brick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: formData.token,
          installments: formData.installments,
          payment_method_id: formData.payment_method_id,
          issuer_id: formData.issuer_id,
          payer: {
            email: formData.payer?.email,
            identification: formData.payer?.identification
              ? { type: formData.payer.identification.type, number: formData.payer.identification.number }
              : undefined
          },
          pedidoId: orderInfo.pedidoId
        })
      })
      const data = await response.json()
      if (data.success) {
        if (data.status === 'approved') { setStatus('confirmed'); return }
        if (data.status === 'pending') {
          setStatus('verifying')
          toast.message('Pago en proceso', { description: 'Te avisamos cuando se acredite. No cierres esta pantalla.' })
          return
        }
        if (data.status === 'rejected') {
          toast.error('Pago rechazado', { description: data.message || 'Revisá los datos o probá con otra tarjeta.' })
          throw new Error('mp_rejected')
        }
        toast.error('No se pudo completar el pago', { description: 'Intentá de nuevo.' })
        throw new Error('mp_error')
      }
      toast.error('No se pudo procesar el pago', { description: data.error || 'Intentá de nuevo' })
      throw new Error('mp_error')
    } catch (err) {
      console.error(err)
      if (err instanceof Error && err.message !== 'mp_rejected' && err.message !== 'mp_error') {
        toast.error('Error de conexión al procesar el pago')
      }
      throw err
    } finally {
      setIsCreatingMP(false)
    }
  }

  const handleMercadoPagoCheckoutRedirect = async () => {
    setIsCreatingMP(true)
    try {
      const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
      const response = await fetch(`${url}/mp/crear-preferencia-externo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId: orderInfo.pedidoId }),
      })
      const data = await response.json()
      if (data.success && data.url_pago) {
        sessionStorage.setItem(MP_CHECKOUT_LAUNCHED_KEY, String(orderInfo.pedidoId))
        window.location.href = data.url_pago
        return
      }
      toast.error('No se pudo iniciar el pago', { description: data.error || 'Intentá de nuevo.' })
    } catch {
      toast.error('Error de conexión al iniciar Mercado Pago')
    } finally {
      setIsCreatingMP(false)
    }
  }

  const { items, tipoPedido, total, pedidoId, deliveryFee, direccion, aliasDinamico, cvuDinamico } = orderInfo
  const effectiveMetodo = getEffectiveMetodo(orderInfo)
  const isManualTransferMetodo = effectiveMetodo === 'manual_transfer'
  const isAutoTransferMetodo = effectiveMetodo === 'transferencia_automatica_cucuru' || effectiveMetodo === 'transferencia_automatica_talo'
  const isMpBricksMetodo = effectiveMetodo === 'mercadopago_bricks' || effectiveMetodo === 'mercadopago'
  const isMpCheckoutMetodo = effectiveMetodo === 'mercadopago_checkout'
  const isDispatched = pedidoEstado === 'dispatched' || pedidoEstado === 'archived'

  const cachedTheme = leerTemaRestaurante(orderInfo?.token ? `theme_sala_${orderInfo.token}` : null)
  const themeStyles = <RestauranteTheme restaurante={restauranteData} cachedTheme={cachedTheme} />

  const OrderItems = () => (
    <div className="relative">
      <div
        className="bg-white text-black overflow-visible"
        style={{ '--foreground': '#111827', '--muted-foreground': '#6b7280' } as React.CSSProperties}
      >
        <div className="px-5 pt-5 pb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Pedido grupal
          </p>
          <div className="divide-y divide-gray-100">
            {items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-start py-4">
                <div className="flex gap-2.5 min-w-0">
                  <span className="font-medium text-gray-400 min-w-5 shrink-0 tabular-nums">{item.cantidad}×</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 leading-tight">{item.nombreProducto || item.nombre}</p>
                    {item.clienteNombre && (
                      <p className="text-xs text-gray-400 mt-0.5">de {item.clienteNombre}</p>
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium shrink-0 ml-4 tabular-nums text-gray-800">
                  ${(parseFloat(item.precio || '0') * (item.cantidad || 1)).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          {tipoPedido === 'delivery' && (
            <div className="flex justify-between items-center py-4 border-t border-gray-100">
              <span className="text-sm text-gray-400">Envío</span>
              <span className="text-sm font-medium tabular-nums text-gray-800">
                {parseFloat(String(deliveryFee ?? 0)) === 0 ? 'Gratis' : `$${parseFloat(String(deliveryFee)).toFixed(2)}`}
              </span>
            </div>
          )}
          {orderInfo?.montoDescuento != null && parseFloat(String(orderInfo.montoDescuento)) > 0 && (
            <div className="flex justify-between items-center py-4 border-t border-gray-100">
              <span className="text-sm text-emerald-500">Descuento</span>
              <span className="text-sm text-emerald-500 tabular-nums">-${parseFloat(String(orderInfo.montoDescuento)).toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="relative flex items-center my-4">
          <div className="absolute -left-5 w-10 h-10 rounded-full bg-background z-10" />
          <div className="w-full border-t-2 border-dashed border-gray-200 mx-3" />
          <div className="absolute -right-5 w-10 h-10 rounded-full bg-background z-10" />
        </div>
        <div className="px-5 pb-5 pt-1">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold tabular-nums text-gray-900">${parseFloat(total || '0').toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20 pb-24 flex flex-col items-center">
      {themeStyles}

      <div className="w-full fixed top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-foreground/5">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          <span className="font-semibold text-foreground">Che Milanesa</span>
          <ThemeToggle />
        </div>
      </div>

      <div className="max-w-xl w-full mx-auto px-5 pt-24 flex-1 flex flex-col">

        {/* ── PENDING PAYMENT ── */}
        {status === 'pending_payment' && (
          <div className="space-y-12 animate-in fade-in duration-400">
            <div className="space-y-2 pt-4">
              <p className="text-sm text-muted-foreground">Pedido grupal #{pedidoId}</p>
              <h1 className="text-4xl font-bold tracking-tight leading-tight">Completá tu pago</h1>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1.5">
                {isMpBricksMetodo || isMpCheckoutMetodo ? 'Total a pagar' : 'Total a transferir'}
              </p>
              <p className="text-6xl font-bold tracking-tight tabular-nums">${parseFloat(total || '0').toFixed(2)}</p>
            </div>

            <div>
              {isManualTransferMetodo ? (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Transferí el monto exacto al alias del local y envianos el comprobante para acelerar la verificación.
                  </p>
                  {restauranteData?.transferenciaAlias ? (
                    <button
                      onClick={() => handleCopyAlias(restauranteData.transferenciaAlias)}
                      className="w-full flex items-center justify-between px-5 py-4 bg-foreground/5 rounded-2xl hover:bg-foreground/[0.08] transition-colors text-left"
                    >
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Alias</p>
                        <p className="font-semibold">{restauranteData.transferenciaAlias}</p>
                      </div>
                      <Copy className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
                    </button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Este local no indicó un alias. Contactalos para coordinar el pago.
                    </p>
                  )}
                </div>
              ) : isAutoTransferMetodo ? (
                <div className="space-y-5">
                  {(aliasDinamico || cvuDinamico) ? (
                    <>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {aliasDinamico
                          ? 'Cada pedido genera un alias único. Copialo antes de hacer la transferencia.'
                          : 'Cada pedido genera un CBU único. Copialo antes de hacer la transferencia.'}
                      </p>
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 bg-foreground/5 rounded-2xl hover:bg-foreground/[0.08] transition-colors text-left"
                        onClick={() => {
                          handleCopyAlias(aliasDinamico || cvuDinamico!)
                          setStatus('verifying')
                        }}
                      >
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">{aliasDinamico ? 'Alias único' : 'CBU'}</p>
                          <p className="font-semibold">{aliasDinamico || cvuDinamico}</p>
                        </div>
                        <Copy className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
                      </button>
                      <p className="text-xs text-center text-muted-foreground">
                        Tocá para copiar y transferir desde tu app bancaria
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No se pudo obtener el alias. Actualizá la página o contactá al local.
                    </p>
                  )}
                </div>
              ) : isMpBricksMetodo ? (
                restauranteData?.mpPublicKey ? (
                  <div className="relative space-y-4">
                    {isCreatingMP && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
                        <Loader2 className="w-7 h-7 text-foreground/50 animate-spin" />
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Completá los datos de tu tarjeta. El cobro lo procesa Mercado Pago de forma segura.
                    </p>
                    <CardPayment
                      locale="es-AR"
                      initialization={{ amount: Number(total) }}
                      customization={{ paymentMethods: { maxInstallments: 12 } }}
                      onSubmit={handleCardPaymentSubmit}
                      onError={() => {
                        toast.error('No se pudo cargar el formulario de pago', {
                          description: 'Actualizá la página o probá más tarde.'
                        })
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Este local no tiene habilitado el pago con tarjeta. Elegí otro método o contactá al restaurante.
                  </p>
                )
              ) : isMpCheckoutMetodo ? (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Te redirigimos a Mercado Pago para abonar con dinero en cuenta, tarjeta u otros medios.
                  </p>
                  <button
                    className="w-full px-5 py-4 bg-[#009EE3] text-white rounded-2xl font-semibold text-base flex items-center justify-center disabled:opacity-50 transition-opacity"
                    onClick={handleMercadoPagoCheckoutRedirect}
                    disabled={isCreatingMP}
                  >
                    {isCreatingMP ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ir a Mercado Pago'}
                  </button>
                </div>
              ) : null}
            </div>

            <OrderItems />
          </div>
        )}

        {/* ── VERIFYING ── */}
        {status === 'verifying' && (
          <div className="space-y-12 animate-in fade-in duration-300">
            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Verificando</span>
              </div>
              <p className="text-sm text-muted-foreground">Pedido grupal #{pedidoId}</p>
              <h1 className="text-4xl font-bold tracking-tight leading-tight">
                {isMpCheckoutMetodo
                  ? 'Confirmando con Mercado Pago...'
                  : isMpBricksMetodo
                    ? 'Confirmando pago con tarjeta...'
                    : 'Aguardando transferencia...'}
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed pt-1">
                {isMpCheckoutMetodo || isMpBricksMetodo
                  ? 'La acreditación puede tardar unos segundos. No cierres esta pantalla.'
                  : 'Realizá el pago y no cierres esta pantalla. Todos verán cuando se confirme.'}
              </p>
            </div>

            {!isMpBricksMetodo && !isMpCheckoutMetodo && (aliasDinamico || cvuDinamico) && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Transferir a</p>
                <button
                  className="w-full flex items-center justify-between px-5 py-4 bg-foreground/5 rounded-2xl hover:bg-foreground/[0.08] transition-colors text-left"
                  onClick={() => handleCopyAlias(aliasDinamico || cvuDinamico!)}
                >
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{aliasDinamico ? 'Alias único' : 'CBU'}</p>
                    <p className="font-semibold">{aliasDinamico || cvuDinamico}</p>
                  </div>
                  <Copy className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
                </button>
                <div className="flex justify-between items-center px-1">
                  <span className="text-sm text-muted-foreground">Monto exacto</span>
                  <span className="font-semibold tabular-nums">${parseFloat(total || '0').toFixed(2)}</span>
                </div>
              </div>
            )}

            <OrderItems />
          </div>
        )}

        {/* ── CONFIRMED ── */}
        {status === 'confirmed' && (
          <div className="space-y-12 animate-in fade-in duration-700 w-full">
            <div className="space-y-3 pt-4">
              {isDispatched ? (
                <>
                  <Truck className="w-10 h-10 text-blue-500 mb-3" />
                  <p className="text-sm text-muted-foreground">Pedido grupal #{pedidoId}</p>
                  <h1 className="text-4xl font-bold tracking-tight text-blue-500">En camino</h1>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Tu pedido ya fue despachado y está en camino.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                  <p className="text-sm text-muted-foreground">Pedido grupal #{pedidoId}</p>
                  <h1 className="text-4xl font-bold tracking-tight">Pedido confirmado</h1>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Ya estamos preparando el pedido grupal.
                  </p>
                </>
              )}
            </div>

            {/* Info rows */}
            <div className="space-y-7">
              {tipoPedido === 'delivery' && direccion ? (
                <div className="space-y-1 px-0.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    {isDispatched ? 'En camino' : 'Dirección de entrega'}
                  </p>
                  <p className="text-sm text-foreground font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {direccion}
                  </p>
                  {isDispatched && (
                    <p className="text-xs text-muted-foreground pl-5">El repartidor se dirige a la dirección.</p>
                  )}
                </div>
              ) : tipoPedido === 'takeaway' ? (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                    <Store className="w-7 h-7 text-foreground/40" />
                  </div>
                  <div className="space-y-1 pt-1.5">
                    <p className="font-semibold text-sm">Retiro en local</p>
                    <div className="space-y-0.5">
                      {restauranteData?.direccion && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {restauranteData.direccion}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        Estará listo en ~10 minutos
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!['dispatched', 'delivered', 'archived'].includes(pedidoEstado || '') && (
                <>
                  {isAutoTransferMetodo && (aliasDinamico || cvuDinamico) && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                        <Copy className="w-7 h-7 text-foreground/40" />
                      </div>
                      <div className="space-y-2 flex-1 pt-1.5">
                        <p className="font-semibold text-sm">Alias de transferencia</p>
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 bg-foreground/5 rounded-xl hover:bg-foreground/[0.08] transition-colors text-left"
                          onClick={() => handleCopyAlias(aliasDinamico || cvuDinamico!)}
                        >
                          <p className="text-sm font-medium">{aliasDinamico || cvuDinamico}</p>
                          <Copy className="w-3.5 h-3.5 text-muted-foreground ml-3 shrink-0" />
                        </button>
                        <p className="text-xs text-muted-foreground">El pedido comenzará a prepararse al recibir el pago.</p>
                      </div>
                    </div>
                  )}

                  {isManualTransferMetodo && restauranteData?.transferenciaAlias && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                        <Copy className="w-7 h-7 text-foreground/40" />
                      </div>
                      <div className="space-y-2 flex-1 pt-1.5">
                        <p className="font-semibold text-sm">Alias del local</p>
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 bg-foreground/5 rounded-xl hover:bg-foreground/[0.08] transition-colors text-left"
                          onClick={() => handleCopyAlias(restauranteData.transferenciaAlias)}
                        >
                          <p className="text-sm font-medium">{restauranteData.transferenciaAlias}</p>
                          <Copy className="w-3.5 h-3.5 text-muted-foreground ml-3 shrink-0" />
                        </button>
                      </div>
                    </div>
                  )}

                  {effectiveMetodo === 'cash' && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-2xl font-semibold text-emerald-500">$</span>
                      </div>
                      <div className="pt-1.5">
                        <p className="font-semibold text-sm">Efectivo al recibir</p>
                        <p className="text-sm text-muted-foreground">Abona el importe exacto al recibir el pedido.</p>
                      </div>
                    </div>
                  )}

                  {isMpCheckoutMetodo && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-[#009EE3]">MP</span>
                      </div>
                      <div className="pt-1.5">
                        <p className="font-semibold text-sm">Mercado Pago</p>
                        <p className="text-sm text-muted-foreground">Pago acreditado vía Mercado Pago Checkout.</p>
                      </div>
                    </div>
                  )}

                  {isMpBricksMetodo && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-[#009EE3]">MP</span>
                      </div>
                      <div className="pt-1.5">
                        <p className="font-semibold text-sm">Pago con tarjeta</p>
                        <p className="text-sm text-muted-foreground">El cobro fue procesado por Mercado Pago.</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {rapiboyTrackingUrl && (
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 bg-orange-500/10 rounded-2xl hover:bg-orange-500/15 transition-colors text-left"
                  onClick={() => window.open(rapiboyTrackingUrl, '_blank')}
                >
                  <div className="w-10 h-10 flex items-center justify-center shrink-0">
                    <Truck className="w-7 h-7 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Rastrear en vivo</p>
                    <p className="text-xs text-muted-foreground">Seguí el recorrido del pedido de Rapiboy</p>
                  </div>
                </button>
              )}
            </div>

            <OrderItems />
          </div>
        )}
      </div>
    </div>
  )
}

export default SuccessGrupal
