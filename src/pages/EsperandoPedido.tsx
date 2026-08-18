import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useMesaStore } from '@/store/mesaStore'
import { useClienteWebSocket } from '@/hooks/useClienteWebSocket'
import {
    ShoppingCart, CheckCircle2, Loader2, Download, Home, PartyPopper
} from 'lucide-react'
import { usePreventBackNavigation } from '@/hooks/usePreventBackNavigation'

const EsperandoPedido = () => {
    const navigate = useNavigate()
    const {
        pedido, clienteNombre, qrToken, isHydrated,
        pedidoListo, restaurante
    } = useMesaStore()
    useClienteWebSocket() // Mantiene conexión para recibir PEDIDO_LISTO_PARA_RETIRAR

    // Hook para prevenir navegación hacia atrás
    const { ExitDialog } = usePreventBackNavigation(true)

    // Verificar que estamos en un carrito
    useEffect(() => {
        if (!isHydrated) return

        if (!clienteNombre || !qrToken) {
            navigate(`/mesa/${qrToken || 'invalid'}`)
            return
        }

        // Si no es carrito, ir a factura normal
        if (!restaurante?.esCarrito) {
            navigate('/factura')
        }
    }, [clienteNombre, qrToken, isHydrated, navigate, restaurante?.esCarrito])

    // Mostrar cargando mientras se hidrata
    if (!isHydrated) {
        return (
            <div className="min-h-screen bg-linear-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center animate-pulse">
                        <ShoppingCart className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex items-center gap-2 text-neutral-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">Cargando...</span>
                    </div>
                </div>
            </div>
        )
    }

    const nombrePedido = pedido?.nombrePedido || clienteNombre || 'Tu pedido'

    return (
        <div className="min-h-screen bg-linear-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 pb-32">
            <div className="max-w-md mx-auto px-6 py-12 space-y-8">

                {/* Header */}
                <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {pedidoListo ? (
                        <>
                            {/* Estado: LISTO PARA RETIRAR */}
                            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-2">
                                <PartyPopper className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                            </div>

                            <h1 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                                ¡Pedido Listo!
                            </h1>

                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-6 border-2 border-emerald-200 dark:border-emerald-800">
                                <p className="text-lg font-medium text-emerald-800 dark:text-emerald-300">
                                    Retiren el
                                </p>
                                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                                    Pedido de {nombrePedido}
                                </p>
                            </div>

                            <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                Dirígete al mostrador para retirar tu pedido
                            </p>
                        </>
                    ) : (
                        <>
                            {/* Estado: EN PREPARACIÓN */}
                            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-orange-100 dark:bg-orange-900/30 mb-2 relative">
                                <ShoppingCart className="w-12 h-12 text-orange-600 dark:text-orange-400" />
                                {/* Animación de pulso */}
                                <div className="absolute inset-0 rounded-full border-4 border-orange-400/50 animate-ping" />
                            </div>

                            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                                Preparando tu pedido
                            </h1>

                            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-6 border border-orange-200 dark:border-orange-800">
                                <p className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                                    Serán llamados como
                                </p>
                                <p className="text-xl font-bold text-orange-900 dark:text-orange-100">
                                    "Pedido de {nombrePedido}"
                                </p>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-neutral-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Esperando que esté listo...</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Card informativa */}
                <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-xl border border-neutral-200 dark:border-neutral-800 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${pedidoListo
                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                            : 'bg-orange-100 dark:bg-orange-900/30'
                            }`}>
                            <CheckCircle2 className={`w-6 h-6 ${pedidoListo
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-orange-600 dark:text-orange-400'
                                }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                                Pago confirmado
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                {pedidoListo
                                    ? '¡Ya puedes retirar tu pedido!'
                                    : 'Te avisaremos cuando esté listo'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Acciones */}
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                    <Button
                        onClick={() => navigate('/factura')}
                        className="w-full h-14 text-base font-semibold rounded-2xl bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white shadow-lg"
                    >
                        <Download className="w-5 h-5 mr-2" />
                        Ver comprobante
                    </Button>

                    <Button
                        onClick={() => window.location.href = '/'}
                        className="w-full h-14 text-base font-semibold rounded-2xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 text-white shadow-lg"
                    >
                        <Home className="w-5 h-5 mr-2" />
                        Volver al inicio
                    </Button>
                </div>
            </div>

            {/* Dialog para prevenir navegación hacia atrás */}
            <ExitDialog />
        </div>
    )
}

export default EsperandoPedido
