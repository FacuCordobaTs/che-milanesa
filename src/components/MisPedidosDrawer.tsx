import { useState, useEffect, useCallback, useRef } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Package, Loader2, Truck, Store, Clock, CheckCircle2 } from 'lucide-react'

type Pedido = {
    id: number
    tipo: 'delivery' | 'takeaway'
    estado: string
    total: string
    nombreCliente: string | null
    direccion?: string
    notas: string | null
    metodoPago: string | null
    pagado: boolean
    createdAt: string
    deliveredAt: string | null
    totalItems: number
    rapiboyTrackingUrl?: string | null
    items: {
        id: number
        productoId: number
        cantidad: number | null
        precioUnitario: string
        productoNombre: string | null
        ingredientesExcluidos: any
        agregados: any
        esCanjePuntos: boolean | null
    }[]
}

const ACTIVE_STATES = ['pending', 'preparing', 'ready', 'dispatched', 'archived', 'delivered']

const ESTADO_LABELS: Record<string, string> = {
    pending: 'Recibido',
    preparing: 'En preparación',
    ready: 'Listo',
    dispatched: 'En camino',
    delivered: 'En camino', // Para el cliente: delivered = despachado (se muestra como "En camino")
    cancelled: 'Cancelado',
    archived: 'En camino', // Para el cliente: archived = despachado (se muestra como "En camino")
}

const DELIVERY_STEPS = ['pending', 'dispatched'] as const
const TAKEAWAY_STEPS = ['pending', 'dispatched'] as const

const STEP_LABELS_DELIVERY: Record<string, string> = {
    pending: 'Recibido',
    dispatched: 'En camino',
}

const STEP_LABELS_TAKEAWAY: Record<string, string> = {
    pending: 'Recibido',
    dispatched: 'En camino',
}

function OrderTracker({ estado, tipo }: { estado: string; tipo: 'delivery' | 'takeaway' }) {
    const steps = tipo === 'delivery' ? DELIVERY_STEPS : TAKEAWAY_STEPS
    const labels = tipo === 'delivery' ? STEP_LABELS_DELIVERY : STEP_LABELS_TAKEAWAY

    const normalizedEstado = (['preparing', 'ready'].includes(estado)) ? 'pending' : (['archived', 'delivered'].includes(estado) ? 'dispatched' : estado)
    const currentIdx = steps.indexOf(normalizedEstado as any)
    const isDispatched = estado === 'dispatched' || estado === 'archived' || estado === 'delivered'

    return (
        <div className="flex items-center w-full gap-0 py-2">
            {steps.map((step, i) => {
                const allDone = isDispatched
                const isCompleted = allDone || (currentIdx >= 0 && i < currentIdx)
                const isCurrent = !allDone && step === normalizedEstado

                return (
                    <div key={step} className="flex items-center flex-1 min-w-0">
                        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-500
                                ${isCompleted
                                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                    : isCurrent
                                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30 ring-4 ring-primary/20 animate-pulse'
                                        : 'bg-muted text-muted-foreground'}
                            `}>
                                {isCompleted
                                    ? <CheckCircle2 className="w-4 h-4" />
                                    : (i + 1)}
                            </div>
                            <span className={`text-[10px] font-medium text-center leading-tight truncate w-full px-0.5
                                ${isCurrent ? 'text-primary font-bold' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}
                            `}>
                                {labels[step]}
                            </span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`h-0.5 flex-1 mx-1 rounded-full -mt-5 transition-all duration-500
                                ${isCompleted ? 'bg-emerald-500' : 'bg-border'}
                            `} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (mins < 1) return 'Ahora'
    if (mins < 60) return `Hace ${mins} min`
    if (hours < 24) return `Hace ${hours}h`

    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function MisPedidosDrawer({
    open,
    onOpenChange,
    restauranteId
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    restauranteId: number | null
}) {
    const [telefono, setTelefono] = useState('')
    const [pedidos, setPedidos] = useState<Pedido[]>([])
    const [loading, setLoading] = useState(false)
    const [fetched, setFetched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (open && !telefono) {
            const saved = localStorage.getItem('cliente_telefono') || ''
            setTelefono(saved)
        }
    }, [open])

    const fetchPedidos = useCallback(async (tel: string) => {
        if (!tel.trim() || !restauranteId) return
        setLoading(true)
        setError(null)
        try {
            const url = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
            const res = await fetch(`${url}/public/restaurante/${restauranteId}/mis-pedidos/${encodeURIComponent(tel.trim())}`)
            const data = await res.json()
            if (data.success) {
                setPedidos(data.data ?? [])
            } else {
                setPedidos([])
                setError(data.message || 'Error al buscar pedidos')
            }
        } catch (err) {
            console.error('Error fetching pedidos:', err)
            setPedidos([])
            setError('No se pudo conectar con el servidor')
        } finally {
            setLoading(false)
            setFetched(true)
        }
    }, [restauranteId])

    useEffect(() => {
        if (open && telefono && restauranteId) {
            fetchPedidos(telefono)
        }
        if (!open) {
            setFetched(false)
            setError(null)
        }
    }, [open, telefono, restauranteId])

    useEffect(() => {
        if (!open || !telefono?.trim() || !restauranteId) {
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current)
                pingIntervalRef.current = null
            }
            return
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
        const wsBase = apiUrl.replace(/^http/, 'ws').replace(/\/api\/?$/, '')
        const wsUrl = `${wsBase}/ws/tracking/${restauranteId}/${encodeURIComponent(telefono.trim())}`

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            pingIntervalRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'PING' }))
                }
            }, 30000)
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.type === 'PEDIDO_ESTADO_ACTUALIZADO') {
                    const { pedidoId, tipo, estado, trackingUrl } = data.payload
                    setPedidos(prev => prev.map(p =>
                        p.id === pedidoId && p.tipo === tipo ? { ...p, estado, rapiboyTrackingUrl: trackingUrl || p.rapiboyTrackingUrl } : p
                    ))
                }
            } catch {}
        }

        ws.onclose = () => {
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current)
                pingIntervalRef.current = null
            }
        }

        return () => {
            ws.close()
            wsRef.current = null
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current)
                pingIntervalRef.current = null
            }
        }
    }, [open, telefono, restauranteId])

    const handleSubmitTelefono = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const tel = (fd.get('telefono') as string)?.trim()
        if (tel) {
            localStorage.setItem('cliente_telefono', tel)
            setTelefono(tel)
            fetchPedidos(tel)
        }
    }

    const handleChangeTelefono = () => {
        setTelefono('')
        setPedidos([])
        setFetched(false)
        setError(null)
    }

    const activos = pedidos.filter(p => ACTIVE_STATES.includes(p.estado))
    const historial = pedidos.filter(p => !ACTIVE_STATES.includes(p.estado))

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 border-l-0 sm:border-l bg-background">
                <div className="flex flex-col h-full">
                    <div className="px-5 py-4 flex items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                        <Button variant="ghost" size="icon" className="rounded-full -ml-2 hover:bg-secondary" onClick={() => onOpenChange(false)}>
                            <ArrowLeft className="w-6 h-6" />
                        </Button>
                        <div>
                            <SheetTitle className="text-xl">Mis Pedidos</SheetTitle>
                            {telefono && (
                                <button onClick={handleChangeTelefono} className="text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5">
                                    {telefono} &middot; Cambiar
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {!telefono ? (
                            <form onSubmit={handleSubmitTelefono} className="p-6 py-12 space-y-6">
                                <div className="text-center space-y-2">
                                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary mb-4">
                                        <Package className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold">Rastrear mis pedidos</h3>
                                    <p className="text-sm text-muted-foreground">Ingresa tu celular de WhatsApp para ver el estado de tus pedidos.</p>
                                </div>
                                <div className="space-y-2">
                                    <input
                                        type="tel"
                                        name="telefono"
                                        required
                                        className="w-full text-center py-4 rounded-xl border border-input bg-transparent text-lg placeholder:text-muted-foreground focus:ring-2 focus:ring-primary transition-all outline-none"
                                        placeholder="Tu número de celular"
                                    />
                                </div>
                                <Button type="submit" className="w-full h-12 rounded-xl text-base bg-primary hover:bg-primary/90 text-primary-foreground font-bold" disabled={loading}>
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ver mis pedidos'}
                                </Button>
                            </form>
                        ) : loading && !fetched ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Buscando pedidos...</p>
                            </div>
                        ) : fetched && (pedidos.length === 0 || error) ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 px-6">
                                <div className="bg-secondary p-5 rounded-full">
                                    <Package className="w-10 h-10 text-muted-foreground" />
                                </div>
                                <p className="font-medium text-muted-foreground">
                                    {error || 'No encontramos pedidos pagados para este número.'}
                                </p>
                                <Button variant="link" onClick={handleChangeTelefono} className="text-primary">
                                    Probar con otro número
                                </Button>
                            </div>
                        ) : (
                            <div className="px-5 py-5 space-y-6">
                                {activos.length > 0 && (
                                    <section className="space-y-3">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                            Pedido activo
                                        </h3>
                                        {activos.map(pedido => (
                                            <ActiveOrderCard key={`${pedido.tipo}-${pedido.id}`} pedido={pedido} />
                                        ))}
                                    </section>
                                )}

                                {historial.length > 0 && (
                                    <section className="space-y-3">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Historial
                                        </h3>
                                        {historial.map(pedido => (
                                            <HistoryOrderCard key={`${pedido.tipo}-${pedido.id}`} pedido={pedido} />
                                        ))}
                                    </section>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function ActiveOrderCard({ pedido }: { pedido: Pedido }) {
    return (
        <div className="bg-card border-2 border-primary/30 rounded-2xl overflow-hidden shadow-md animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {pedido.tipo === 'delivery'
                        ? <Truck className="w-4 h-4 text-primary" />
                        : <Store className="w-4 h-4 text-primary" />}
                    <span className="text-sm font-bold text-foreground">
                        {pedido.tipo === 'delivery' ? 'Delivery' : 'Take Away'} #{pedido.id}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDate(pedido.createdAt)}
                </div>
            </div>

            <div className="px-4 py-2">
                <OrderTracker estado={pedido.estado} tipo={pedido.tipo} />
            </div>

            <div className="px-4 pb-4 space-y-2">
                <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
                    {pedido.items.slice(0, 3).map(item => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground truncate">
                                {item.cantidad ?? 1}x {item.productoNombre || 'Producto'}
                            </span>
                            <span className="font-medium text-foreground shrink-0 ml-2">
                                ${(parseFloat(item.precioUnitario) * (item.cantidad ?? 1)).toFixed(2)}
                            </span>
                        </div>
                    ))}
                    {pedido.items.length > 3 && (
                        <p className="text-xs text-muted-foreground">+{pedido.items.length - 3} items más</p>
                    )}
                </div>
                {pedido.tipo === 'delivery' && pedido.rapiboyTrackingUrl && (
                    <Button
                        className="w-full h-10 mt-2 rounded-xl border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 font-bold shadow-sm text-sm"
                        onClick={() => window.open(pedido.rapiboyTrackingUrl!, '_blank')}
                    >
                        <Truck className="mr-2 h-4 w-4" />
                        Rastrear pedido en vivo
                    </Button>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                    <span className="text-sm font-bold">{pedido.totalItems} items</span>
                    <span className="text-lg font-black">${parseFloat(pedido.total).toFixed(2)}</span>
                </div>
            </div>
        </div>
    )
}

function HistoryOrderCard({ pedido }: { pedido: Pedido }) {
    const isCancelled = pedido.estado === 'cancelled'

    return (
        <div className={`bg-card border rounded-2xl p-4 space-y-2 ${isCancelled ? 'border-destructive/30 opacity-60' : 'border-border'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {pedido.tipo === 'delivery'
                        ? <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                        : <Store className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className="text-sm font-semibold">
                        {pedido.tipo === 'delivery' ? 'Delivery' : 'Take Away'} #{pedido.id}
                    </span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isCancelled
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    }`}>
                    {ESTADO_LABELS[pedido.estado] || pedido.estado}
                </span>
            </div>

            <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{pedido.totalItems} items</span>
                <span className="font-bold">${parseFloat(pedido.total).toFixed(2)}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDate(pedido.createdAt)}
            </div>
        </div>
    )
}
