import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { useMesaStore } from '@/store/mesaStore'
import { useClienteWebSocket } from '@/hooks/useClienteWebSocket'
import { toast } from 'sonner'
import {
  CheckCircle2, ChefHat, Bell, Receipt, Plus,
  ArrowLeft, UtensilsCrossed, Loader2, Utensils
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePreventBackNavigation } from '@/hooks/usePreventBackNavigation'

const PedidoConfirmado = () => {
  const navigate = useNavigate()
  const { productos, clienteNombre, qrToken, isHydrated, sessionEnded, restaurante } = useMesaStore()
  const { state: wsState, sendMessage } = useClienteWebSocket()

  const [verPedidoAbierto, setVerPedidoAbierto] = useState(false)
  const [llamarMozoAbierto, setLlamarMozoAbierto] = useState(false)
  const [pedirCuentaAbierto, setPedirCuentaAbierto] = useState(false)

  // Hook para prevenir navegación hacia atrás (solo si no hay modales abiertos)
  const { ExitDialog } = usePreventBackNavigation(
    true,
    () => !verPedidoAbierto && !llamarMozoAbierto && !pedirCuentaAbierto
  )

  useEffect(() => {
    // Esperar a que el store se hidrate
    if (!isHydrated) return

    // Si la sesión terminó, redirigir a escanear QR para cargar datos frescos
    if (sessionEnded) {
      navigate(`/mesa/${qrToken || 'invalid'}`)
      return
    }

    // Si no hay datos del cliente, redirigir a escanear QR
    if (!clienteNombre || !qrToken) {
      navigate(`/mesa/${qrToken || 'invalid'}`)
      return
    }

    // === CRITICAL: ESPERAR A QUE RESTAURANTE ESTÉ CARGADO ===
    // Si restaurante es null, NO PODEMOS saber si es carrito o no.
    // DEBEMOS esperar a que se cargue antes de tomar cualquier decisión de redirección.
    if (!restaurante) {
      console.log('[PedidoConfirmado] Esperando a que restaurante se cargue...')
      return
    }

    // MODO CARRITO: Redirección forzada si está en preparing
    if (restaurante.esCarrito && wsState?.estado === 'preparing') {
      // Usar replace: true para que el usuario no pueda volver atrás a esta pantalla
      navigate('/pedido-cerrado', { replace: true })
      return
    }

    // Navegación estándar de estados
    if (wsState?.estado) {
      if (wsState.estado === 'closed') {
        navigate('/pedido-cerrado')
      } else if (wsState.estado === 'pending') {
        navigate('/menu')
      }
    }
  }, [clienteNombre, qrToken, wsState?.estado, navigate, isHydrated, sessionEnded, restaurante])

  const todosLosItems = wsState?.items || []
  const totalPedido = wsState?.total || '0.00'

  const handleLlamarMozo = () => {
    sendMessage({ type: 'LLAMAR_MOZO', payload: {} })
    setLlamarMozoAbierto(true)
    toast.success('¡Mozo notificado!', {
      description: 'Un mozo se acercará a tu mesa pronto',
    })
  }

  const handlePedirCuenta = () => {
    setPedirCuentaAbierto(true)
  }

  const confirmarCerrarPedido = () => {
    sendMessage({ type: 'CERRAR_PEDIDO', payload: {} })
    setPedirCuentaAbierto(false)
  }

  // Mostrar cargando mientras se hidrata el store
  if (!isHydrated || (!clienteNombre && !qrToken)) {
    return (
      <div className="min-h-screen bg-linear-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-neutral-900 dark:bg-white flex items-center justify-center animate-pulse">
            <ChefHat className="h-8 w-8 text-white dark:text-neutral-900" />
          </div>
          <div className="flex items-center gap-2 text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Cargando...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 pb-32">
      <div className="max-w-md mx-auto px-6 py-12 space-y-8">

        {/* Header con animación */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Icono de éxito */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-2">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>

          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            ¡Pedido confirmado!
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Tu pedido ha sido enviado a la cocina y comenzará a prepararse en breve
          </p>
        </div>

        {/* Card de estado */}
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-xl border border-neutral-200 dark:border-neutral-800 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <ChefHat className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {wsState?.estado === 'delivered' ? '¡Pedido Listo!' :
                  wsState?.estado === 'served' ? '¡Buen provecho!' :
                    'En preparación'}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {wsState?.estado === 'delivered' ? 'El mozo lo está trayendo a tu mesa' :
                  wsState?.estado === 'served' ? 'Disfruta de tu comida' :
                    'Los mozos te traerán tu pedido pronto'}
              </p>
            </div>
            <div className="shrink-0">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <Button
            onClick={() => setVerPedidoAbierto(true)}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-white dark:bg-neutral-900 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10 text-neutral-900 dark:text-white shadow-lg"
          >
            <Receipt className="w-5 h-5 mr-2" />
            Ver pedido completo
          </Button>

          <Button
            onClick={handleLlamarMozo}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-white dark:bg-neutral-900 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10 text-neutral-900 dark:text-white shadow-lg"
          >
            <Bell className="w-5 h-5 mr-2" />
            Llamar al mozo
          </Button>

          <Button
            onClick={handlePedirCuenta}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <Receipt className="w-5 h-5 mr-2" />
            Pedir la cuenta
          </Button>
        </div>

        {/* Info adicional */}
        <div className="text-center animate-in fade-in duration-1000 delay-500">
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Puedes agregar más productos o modificar tu pedido en cualquier momento
          </p>
        </div>
      </div>

      {/* Sheet Ver Pedido - Rediseñado */}
      <Sheet open={verPedidoAbierto} onOpenChange={setVerPedidoAbierto}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 bg-neutral-50 dark:bg-neutral-950">
          <div className="flex flex-col h-full">
            {/* Header del Sheet */}
            <div className="px-6 py-5 flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-10">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full -ml-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                onClick={() => setVerPedidoAbierto(false)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg font-bold text-neutral-900 dark:text-white">
                  Tu pedido
                </SheetTitle>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {todosLosItems.length} {todosLosItems.length === 1 ? 'producto' : 'productos'}
                </p>
              </div>
            </div>

            {/* Lista de productos */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
              {todosLosItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                  <div className="w-16 h-16 rounded-2xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                    <UtensilsCrossed className="w-8 h-8 text-neutral-400" />
                  </div>
                  <p className="font-medium text-neutral-500">El pedido está vacío</p>
                </div>
              ) : (
                todosLosItems.map((item, index) => {
                  const esMio = item.clienteNombre === clienteNombre
                  const prodOriginal = productos.find(p => p.id === (item.productoId || item.id))
                  const imagen = item.imagenUrl || prodOriginal?.imagenUrl
                  const precio = parseFloat(item.precioUnitario || '0')

                  return (
                    <div
                      key={item.id}
                      className={`relative flex gap-4 p-3 rounded-2xl border transition-all animate-in fade-in slide-in-from-right duration-300 ${esMio ? 'bg-card border-primary/20 shadow-sm' : 'bg-secondary/30 border-transparent opacity-90'
                        }`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-secondary">
                        {imagen ? (
                          <img src={imagen} alt="img" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Utensils className="w-6 h-6 text-orange-500" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{item.nombreProducto || item.nombre}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge variant="secondary" className={`h-5 text-[10px] px-1.5 font-normal rounded-md ${esMio ? 'bg-primary/10 text-primary' : ''}`}>
                                {esMio ? 'Tú' : item.clienteNombre}
                              </Badge>
                            </div>
                            {(item as any).ingredientesExcluidosNombres && (item as any).ingredientesExcluidosNombres.length > 0 && (
                              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1">
                                ⚠️ Sin: {(item as any).ingredientesExcluidosNombres.join(', ')}
                              </p>
                            )}
                          </div>
                          <p className="font-bold text-base">
                            ${(precio * item.cantidad).toFixed(2)}
                          </p>
                        </div>

                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer con total y botón */}
            <div className="p-6 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Total</span>
                <span className="text-2xl font-black text-neutral-900 dark:text-white tabular-nums">
                  ${totalPedido}
                </span>
              </div>
              <Button
                className="w-full h-12 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90"
                onClick={() => {
                  setVerPedidoAbierto(false)
                  navigate('/agregar-producto')
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar más productos
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog Llamar Mozo */}
      <Dialog open={llamarMozoAbierto} onOpenChange={setLlamarMozoAbierto}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
              <Bell className="w-7 h-7 text-primary" />
            </div>
            <DialogTitle className="text-xl">¡Mozo notificado!</DialogTitle>
            <DialogDescription className="text-base pt-2">
              Hemos enviado una notificación al mozo. Se acercará a tu mesa en breve.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => setLlamarMozoAbierto(false)}
            className="w-full h-12 mt-6 rounded-2xl bg-primary hover:bg-primary/90"
          >
            Entendido
          </Button>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Cerrar Pedido */}
      <Dialog open={pedirCuentaAbierto} onOpenChange={setPedirCuentaAbierto}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
              <Receipt className="w-7 h-7 text-primary" />
            </div>
            <DialogTitle className="text-xl">¿Pedir la cuenta?</DialogTitle>
            <DialogDescription className="text-base pt-2">
              Esto cerrará el pedido y te llevará a la pantalla de pago. ¿Estás seguro?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setPedirCuentaAbierto(false)}
              className="flex-1 h-12 rounded-2xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarCerrarPedido}
              className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90"
            >
              Sí, pedir cuenta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para prevenir navegación hacia atrás */}
      <ExitDialog />
    </div>
  )
}

export default PedidoConfirmado
