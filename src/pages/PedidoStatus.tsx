import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { CheckCircle2, Copy, Loader2, Store, Truck, MapPin, Clock, Package } from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ThemeToggle'
import { MisPedidosDrawer } from '@/components/MisPedidosDrawer'
import { RestauranteTheme } from '@/components/RestauranteTheme'
import { OrderSummaryItemDetails } from '@/components/OrderSummaryItemDetails'
import { AddressMapPreview } from '@/components/AddressMapPreview'
import { inferDeliveryFeeCobrado, orderItemLineSubtotalsFromApi } from '@/lib/orderSummaryItem'
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react'

const MP_CHECKOUT_LAUNCHED_KEY = 'mpCheckoutLaunchedPedidoId'

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

function waMeDigits(phone: string | null | undefined): string | null {
    if (!phone?.trim()) return null
    const d = phone.replace(/\D/g, '')
    return d.length >= 8 ? d : null
}

const PedidoStatus = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const mpCheckoutReturnParams = useMemo(
        () =>
            !!(
                searchParams.get('collection_id') ||
                searchParams.get('payment_id') ||
                searchParams.get('collection_status') ||
                searchParams.get('preference_id') ||
                searchParams.get('status')
            ),
        [searchParams]
    )

    const [orderInfo, setOrderInfo] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [status, setStatus] = useState<'pending_payment' | 'verifying' | 'confirmed'>('pending_payment')
    const [restauranteData, setRestauranteData] = useState<any>(null)
    const [isCreatingMP, setIsCreatingMP] = useState(false)
    const [misPedidosOpen, setMisPedidosOpen] = useState(false)
    const [pedidoEstado, setPedidoEstado] = useState<string | null>(null)
    const [rapiboyTrackingUrl, setRapiboyTrackingUrl] = useState<string | null>(null)
    const metaPurchaseTracked = useRef(false)

    useEffect(() => {
        if (!id) return
        const fetchOrderInfo = async () => {
            try {
                const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
                const response = await fetch(`${url}/public/pedido-info/${id}`)
                const data = await response.json()
                if (data.success && data.data) {
                    const { pedido, items, restaurante, deliveryFeeCobrado } = data.data
                    const totalNum = parseFloat(pedido.total)
                    const feeParsed =
                        deliveryFeeCobrado != null && deliveryFeeCobrado !== ''
                            ? parseFloat(String(deliveryFeeCobrado))
                            : NaN
                    const feeFromApi = Number.isFinite(feeParsed) ? feeParsed : null
                    const deliveryFeeResolved =
                        pedido.tipo === 'delivery'
                            ? feeFromApi ??
                              inferDeliveryFeeCobrado(items || [], {
                                  orderTotal: totalNum,
                                  montoDescuento: pedido.montoDescuento,
                                  tipoPedido: pedido.tipo,
                              })
                            : 0
                    const orderData = {
                        pedidoId: pedido.id,
                        tipoPedido: pedido.tipo,
                        total: totalNum,
                        metodoPago: pedido.metodoPago,
                        nombreCliente: pedido.nombreCliente,
                        direccion: pedido.direccion,
                        items,
                        deliveryFee: deliveryFeeResolved,
                        montoDescuento: pedido.montoDescuento,
                        lat: pedido.latitud ? parseFloat(pedido.latitud) : null,
                        lng: pedido.longitud ? parseFloat(pedido.longitud) : null,
                    }
                    setOrderInfo(orderData)
                    setRestauranteData(restaurante)
                    setPedidoEstado(pedido.estado)
                    if (pedido.rapiboyTrackingUrl) setRapiboyTrackingUrl(pedido.rapiboyTrackingUrl)

                    if (pedido.pagado) {
                        setStatus('confirmed')
                    } else if (getEffectiveMetodo(orderData) === 'cash') {
                        setStatus('confirmed')
                    } else if (mpCheckoutReturnParams) {
                        setStatus('verifying')
                    }
                } else {
                    navigate('/')
                }
            } catch (err) {
                console.error('Error fetching pedido info:', err)
                navigate('/')
            } finally {
                setIsLoading(false)
            }
        }
        fetchOrderInfo()
    }, [id, navigate, mpCheckoutReturnParams])

    useLayoutEffect(() => {
        const m = getEffectiveMetodo(orderInfo)
        if (!orderInfo || (m !== 'mercadopago_bricks' && m !== 'mercadopago') || !restauranteData?.mpPublicKey) return
        initMercadoPago(restauranteData.mpPublicKey, { locale: 'es-AR' })
    }, [orderInfo, restauranteData?.mpPublicKey])

    useEffect(() => {
        if (status !== 'verifying' || !orderInfo) return
        let isChecking = false

        const checkPaymentStatus = async () => {
            if (isChecking) return
            isChecking = true
            try {
                const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
                const response = await fetch(`${url}/public/pedido/${orderInfo.tipoPedido}/${orderInfo.pedidoId}/status`)
                const data = await response.json()
                if (data.success && data.pagado) {
                    setStatus('confirmed')
                    sessionStorage.removeItem(MP_CHECKOUT_LAUNCHED_KEY)
                    toast.success('¡Pago confirmado!', {
                        icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
                        duration: 6000,
                    })
                }
                if (data.estado) setPedidoEstado(data.estado)
                if (data.rapiboyTrackingUrl) setRapiboyTrackingUrl(data.rapiboyTrackingUrl)
            } catch (error) {
                console.error('Error verificando estado del pago', error)
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
        if (!orderInfo) return
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
                        toast.success('¡Pago confirmado!', {
                            icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
                            duration: 6000,
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
                setTimeout(connectWebSocket, 3000)
            }
        }

        connectWebSocket()
        return () => { if (ws) ws.close() }
    }, [orderInfo])

    useEffect(() => {
        if (status !== 'confirmed' || !orderInfo || metaPurchaseTracked.current) return
        const total = parseFloat(orderInfo.total)
        if (isNaN(total) || total <= 0) return
        metaPurchaseTracked.current = true
        try {
            const fbq = (window as any).fbq
            if (typeof fbq === 'function') fbq('track', 'Purchase', { currency: 'ARS', value: total })
        } catch { /* silent */ }
    }, [status, orderInfo])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
        )
    }

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
                    toast.message('Pago en proceso', { description: 'Te avisamos cuando se acredite.' })
                    return
                }
                if (data.status === 'rejected') {
                    toast.error('Pago rechazado', { description: data.message || 'Revisá los datos.' })
                    throw new Error('mp_rejected')
                }
                toast.error('No se pudo completar el pago')
                throw new Error('mp_error')
            }
            toast.error('No se pudo procesar el pago', { description: data.error })
            throw new Error('mp_error')
        } catch (err) {
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
            toast.error('No se pudo iniciar el pago', { description: data.error })
        } catch {
            toast.error('Error de conexión al iniciar Mercado Pago')
        } finally {
            setIsCreatingMP(false)
        }
    }

    const { items, tipoPedido, total, pedidoId, deliveryFee, direccion, nombreCliente, lat, lng } = orderInfo
    const transferenciaAlias = restauranteData?.transferenciaAlias || null

    const effectiveMetodo = getEffectiveMetodo(orderInfo)
    const isManualTransferMetodo = effectiveMetodo === 'manual_transfer'
    const isMpBricksMetodo = effectiveMetodo === 'mercadopago_bricks' || effectiveMetodo === 'mercadopago'
    const isMpCheckoutMetodo = effectiveMetodo === 'mercadopago_checkout'
    const isDispatched = pedidoEstado === 'dispatched' || pedidoEstado === 'archived'

    const clienteNombreWhatsapp = (nombreCliente && String(nombreCliente).trim()) || 'Cliente'
    const comprobantesRaw =
        (restauranteData?.comprobantesWhatsapp && String(restauranteData.comprobantesWhatsapp).trim()) ||
        (restauranteData?.telefono && String(restauranteData.telefono).trim()) || ''
    const whatsappDigits = waMeDigits(comprobantesRaw)
    const whatsappHref = whatsappDigits
        ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Hola, te paso el comprobante de mi pedido #${pedidoId} a nombre de ${clienteNombreWhatsapp}.`)}`
        : null

    const themeStyles = <RestauranteTheme restaurante={restauranteData} />

    const lineSubtotals = orderItemLineSubtotalsFromApi(items || [], {
        orderTotal: typeof total === 'number' ? total : parseFloat(String(total)),
        deliveryFeeCobrado: deliveryFee,
        tipoPedido,
        montoDescuento: orderInfo?.montoDescuento,
    })

    const OrderItems = () => (
        <div className="relative">
            <div
                className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.14)] overflow-visible"
                style={{ '--foreground': '#111827', '--muted-foreground': '#6b7280' } as React.CSSProperties}
            >
                <div className="px-5 pt-5 pb-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Tu pedido</p>
                    <div className="divide-y divide-gray-100">
                        {items?.map((item: any, i: number) => (
                            <div key={item.id ?? i} className="flex justify-between items-start py-4">
                                <div className="flex gap-2.5 min-w-0">
                                    <span className="font-medium text-gray-400 min-w-5 shrink-0 tabular-nums">{item.cantidad}×</span>
                                    <OrderSummaryItemDetails item={item} />
                                </div>
                                <span className="text-sm font-medium shrink-0 ml-4 tabular-nums text-gray-800">
                                    ${(lineSubtotals[i] ?? 0).toFixed(2)}
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
                    <div className="absolute -left-3 w-6 h-6 rounded-full bg-background z-10" />
                    <div className="w-full border-t-2 border-dashed border-gray-200 mx-3" />
                    <div className="absolute -right-3 w-6 h-6 rounded-full bg-background z-10" />
                </div>
                <div className="px-5 pb-5 pt-1">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Total</span>
                        <span className="text-xl font-bold tabular-nums text-gray-900">${total?.toFixed(2)}</span>
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
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setMisPedidosOpen(true)}
                            className="flex items-center gap-1.5 text-sm font-medium text-primary"
                        >
                            <Package className="w-3.5 h-3.5" />
                            Mis Pedidos
                        </button>
                        <ThemeToggle />
                    </div>
                </div>
            </div>

            <div className="max-w-xl w-full mx-auto px-5 pt-24 flex-1 flex flex-col">

                {/* ── PENDING PAYMENT ── */}
                {status === 'pending_payment' && (
                    <div className="space-y-12 animate-in fade-in duration-400">
                        <div className="space-y-2 pt-4">
                            <p className="text-sm text-muted-foreground">Pedido #{pedidoId}</p>
                            <h1 className="text-4xl font-bold tracking-tight leading-tight">Completá tu pago</h1>
                        </div>

                        <div>
                            <p className="text-sm text-muted-foreground mb-1.5">
                                {isMpBricksMetodo || isMpCheckoutMetodo ? 'Total a pagar' : 'Total a transferir'}
                            </p>
                            <p className="text-6xl font-bold tracking-tight tabular-nums">${total?.toFixed(2)}</p>
                        </div>

                        <div>
                            {isMpBricksMetodo ? (
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
                                        Este local no tiene habilitado el pago con tarjeta.
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
                            ) : isManualTransferMetodo ? (
                                <div className="space-y-5">
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Transferí el monto exacto al alias del local y envianos el comprobante.
                                    </p>
                                    {transferenciaAlias ? (
                                        <>
                                            <button
                                                onClick={() => handleCopyAlias(transferenciaAlias)}
                                                className="w-full flex items-center justify-between px-5 py-4 bg-foreground/5 rounded-2xl hover:bg-foreground/[0.08] transition-colors text-left"
                                            >
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-0.5">Alias</p>
                                                    <p className="font-semibold">{transferenciaAlias}</p>
                                                </div>
                                                <Copy className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
                                            </button>
                                            {whatsappHref && (
                                                <a
                                                    href={whatsappHref}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block w-full text-center px-5 py-4 bg-[#25D366] text-white rounded-2xl font-semibold text-base"
                                                >
                                                    Enviar comprobante por WhatsApp
                                                </a>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Este local no indicó un alias. Contactalos para coordinar el pago.
                                        </p>
                                    )}
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
                            <p className="text-sm text-muted-foreground">Pedido #{pedidoId}</p>
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
                                    : 'Realizá el pago y no cierres esta pantalla.'}
                            </p>
                        </div>

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
                                    <p className="text-sm text-muted-foreground">Pedido #{pedidoId}</p>
                                    <h1 className="text-4xl font-bold tracking-tight text-blue-500">En camino</h1>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Tu pedido ya fue despachado y está en camino.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                                    <p className="text-sm text-muted-foreground">Pedido #{pedidoId}</p>
                                    <h1 className="text-4xl font-bold tracking-tight">Pedido confirmado</h1>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Ya estamos preparando tu pedido.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="space-y-7">
                            {/* Delivery / Takeaway */}
                            {tipoPedido === 'delivery' && direccion ? (
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                                        {isDispatched ? 'En camino' : 'Dirección de entrega'}
                                    </p>
                                    <AddressMapPreview lat={lat} lng={lng} />
                                    <div className="space-y-1 px-0.5">
                                        <p className="text-sm text-foreground font-medium flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            {direccion}
                                        </p>
                                        {isDispatched && (
                                            <p className="text-xs text-muted-foreground pl-5">El repartidor se dirige a tu dirección.</p>
                                        )}
                                    </div>
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

                            {/* Payment detail — hidden once dispatched */}
                            {!['dispatched', 'delivered', 'archived'].includes(pedidoEstado || '') && (
                                <>
                                    {isManualTransferMetodo && transferenciaAlias && (
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                                                <Copy className="w-7 h-7 text-foreground/40" />
                                            </div>
                                            <div className="space-y-2 flex-1 pt-1.5">
                                                <p className="font-semibold text-sm">Alias del local</p>
                                                <button
                                                    className="w-full flex items-center justify-between px-4 py-3 bg-foreground/5 rounded-xl hover:bg-foreground/[0.08] transition-colors text-left"
                                                    onClick={() => handleCopyAlias(transferenciaAlias)}
                                                >
                                                    <p className="text-sm font-medium">{transferenciaAlias}</p>
                                                    <Copy className="w-3.5 h-3.5 text-muted-foreground ml-3 shrink-0" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {(effectiveMetodo === 'cash' || orderInfo.metodoPago === 'efectivo') && (
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                                                <span className="text-2xl font-semibold text-emerald-500">$</span>
                                            </div>
                                            <div className="pt-1.5">
                                                <p className="font-semibold text-sm">Efectivo al recibir</p>
                                                <p className="text-sm text-muted-foreground">Abona el importe exacto al recibir tu pedido.</p>
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

                            {/* Rapiboy live tracking */}
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
                                        <p className="text-xs text-muted-foreground">Seguí el recorrido de tu pedido de Rapiboy</p>
                                    </div>
                                </button>
                            )}
                        </div>

                        <OrderItems />

                        <button
                            className="w-full px-5 py-4 border border-border rounded-2xl font-semibold text-sm hover:bg-foreground/5 transition-colors"
                            onClick={() => navigate('/')}
                        >
                            Volver al inicio
                        </button>
                    </div>
                )}
            </div>

            <MisPedidosDrawer
                open={misPedidosOpen}
                onOpenChange={setMisPedidosOpen}
                restauranteId={restauranteData?.id ?? null}
            />
        </div>
    )
}

export default PedidoStatus
