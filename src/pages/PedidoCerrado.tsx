import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useMesaStore } from '@/store/mesaStore'
import type { SubtotalPagado } from '@/store/mesaStore'
import { useClienteWebSocket } from '@/hooks/useClienteWebSocket'
import { toast } from 'sonner'
import {
  Receipt, DollarSign, CreditCard, Loader2, CheckCircle2,
  Users, Wallet, Split, Check, UserCheck, CheckCircle, Download, Home
} from 'lucide-react'
import { usePreventBackNavigation } from '@/hooks/usePreventBackNavigation'
import { toPng } from 'html-to-image'


const API_URL = import.meta.env.VITE_API_URL || 'https://api.piru.app/api'

// Interface para el estado de subtotales del cliente
interface SubtotalCliente {
  clienteNombre: string
  subtotal: number
  items: typeof todosLosItems
  pagado: boolean
  metodo?: string
  estado?: 'pending' | 'pending_cash' | 'paid' | 'failed' // Estado para control granular
}

// Interface para items individuales de Mozo
interface MozoItem {
  itemId: number
  subtotal: number
  pagado: boolean
  metodo?: string
  estado: 'pending' | 'pending_cash' | 'paid' | 'failed'
  nombreProducto: string
  cantidad: number
}

// Variable para tipar los items (se usará más adelante)
let todosLosItems: Array<{
  id: number
  productoId: number
  clienteNombre: string
  cantidad: number
  precioUnitario: string
  nombreProducto?: string
  nombre?: string
}>

const PedidoCerrado = () => {
  const navigate = useNavigate()
  const {
    mesa, clienteNombre, qrToken, pedidoCerrado, restaurante, pedidoId,
    sessionEnded, isHydrated, subtotalesPagados
  } = useMesaStore()
  const { state: wsState } = useClienteWebSocket()
  const [isLoadingMP, setIsLoadingMP] = useState(false)
  const [isLoadingEfectivo, setIsLoadingEfectivo] = useState(false)
  const [selectedClientes, setSelectedClientes] = useState<string[]>([])
  const [selectedMozoItems, setSelectedMozoItems] = useState<number[]>([]) // NEW: Track selected Mozo item IDs
  const [subtotalesEstado, setSubtotalesEstado] = useState<SubtotalPagado[]>([])
  const [mozoItemsEstado, setMozoItemsEstado] = useState<MozoItem[]>([]) // NEW: Track Mozo items from API
  const [loadingSubtotales, setLoadingSubtotales] = useState(true) // Empezar en true para evitar redirects prematuros
  const [serverTodoPagado, setServerTodoPagado] = useState<boolean | null>(null) // Server-authoritative payment status
  const lastPedidoIdRef = useRef<number | null>(null)

  // Verificar si MercadoPago está disponible
  const mpDisponible = restaurante?.mpConnected === true

  // Usar datos del pedido cerrado del store (persistido) o del wsState como fallback
  // PRIORIZAR wsState si estamos en estado preparing (carrito) para evitar datos viejos de pedidoCerrado
  const isPreparing = wsState?.estado === 'preparing';
  todosLosItems = (isPreparing && wsState?.items?.length) ? wsState.items : (pedidoCerrado?.items || wsState?.items || [])
  const totalPedido = (isPreparing && wsState?.total) ? wsState.total : (pedidoCerrado?.total || wsState?.total || '0.00')

  // Agrupar items por cliente y calcular subtotales
  // IMPORTANTE: Excluir items de "Mozo" - esos se manejan individualmente
  const subtotalesPorCliente = useCallback((): SubtotalCliente[] => {
    const itemsPorCliente = todosLosItems.reduce((acc, item) => {
      const cliente = item.clienteNombre || 'Sin nombre'
      // Skip Mozo items - they are handled individually
      if (cliente === 'Mozo') return acc
      if (!acc[cliente]) acc[cliente] = []
      acc[cliente].push(item)
      return acc
    }, {} as Record<string, typeof todosLosItems>)

    return Object.entries(itemsPorCliente).map(([cliente, items]) => {
      const subtotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.precioUnitario || '0') * item.cantidad)
      }, 0)

      // Verificar si este cliente ya pagó (desde WebSocket o desde estado local)
      const estadoSubtotal = subtotalesEstado.find(s => s.clienteNombre === cliente)
      const subtotalWS = subtotalesPagados.find(s => s.clienteNombre === cliente)
      const estado = estadoSubtotal?.estado || subtotalWS?.estado || 'pending'
      const pagado = estado === 'paid'
      const metodo = estadoSubtotal?.metodo || subtotalWS?.metodo

      return {
        clienteNombre: cliente,
        subtotal,
        items,
        pagado,
        metodo: metodo || undefined,
        estado
      }
    })
  }, [todosLosItems, subtotalesEstado, subtotalesPagados])

  // Calcular totales para clientes regulares
  const subtotales = subtotalesPorCliente()

  // Calcular totales para items de Mozo
  const mozoItemsPendientes = mozoItemsEstado.filter(m => !m.pagado && m.estado !== 'pending_cash')
  const mozoItemsPagados = mozoItemsEstado.filter(m => m.pagado)
  const mozoItemsEsperando = mozoItemsEstado.filter(m => m.estado === 'pending_cash')

  // Contar como pagado: Clientes + Items Mozo pagados
  const totalPagadoClientes = subtotales.filter(s => s.pagado).reduce((sum, s) => sum + s.subtotal, 0)
  const totalPagadoMozo = mozoItemsPagados.reduce((sum, m) => sum + m.subtotal, 0)
  const totalPagado = totalPagadoClientes + totalPagadoMozo

  const totalPedidoNum = parseFloat(totalPedido)
  const totalPendiente = totalPedidoNum - totalPagado
  // todoPagado es true SOLO si:
  // 1. Server says it's paid (authoritative source) OR
  // 2. Client-side calculation confirms it (fallback)
  const hayItems = todosLosItems.length > 0
  const hayPagosProcesados = subtotales.some(s => s.pagado) || mozoItemsPagados.length > 0
  const clientCalculatedPagado = hayItems && totalPedidoNum > 0.01 && totalPendiente <= 0.01 && hayPagosProcesados
  // PRIORITY: Use server's value if available (more reliable for mozo items)
  const todoPagado = serverTodoPagado !== null ? serverTodoPagado : clientCalculatedPagado

  // Debug logging
  useEffect(() => {
    console.log('🧾 Estado pago PedidoCerrado:', {
      hayItems,
      totalPedidoNum,
      totalPagado,
      totalPendiente,
      hayPagosProcesados,
      todoPagado,
      loadingSubtotales,
      mozoItemsCount: mozoItemsEstado.length
    })
  }, [hayItems, totalPedidoNum, totalPagado, totalPendiente, hayPagosProcesados, todoPagado, loadingSubtotales, mozoItemsEstado.length])

  // Pendientes: los que no han seleccionado ningún método de pago (estado = pending o undefined)
  const clientesPendientes = subtotales.filter(s => !s.pagado && s.estado !== 'pending_cash')
  // Pagados: los que ya tienen confirmación de pago (estado = paid, cualquier método)
  const clientesPagados = subtotales.filter(s => s.pagado)
  // Esperando confirmación: clientes que seleccionaron efectivo pero el cajero aún no confirmó
  const clientesEsperandoConfirmacion = subtotales.filter(s => s.estado === 'pending_cash')

  // Hook para prevenir navegación hacia atrás (solo si no está todo pagado)
  const { ExitDialog } = usePreventBackNavigation(!todoPagado && !sessionEnded)

  // Cargar estado de subtotales desde el servidor
  const fetchSubtotales = useCallback(async () => {
    const idPedido = pedidoCerrado?.pedidoId || pedidoId
    if (!idPedido) {
      setLoadingSubtotales(false)
      return
    }

    setLoadingSubtotales(true)
    try {
      const response = await fetch(`${API_URL}/mp/subtotales/${idPedido}`)
      const data = await response.json()

      if (data.success) {
        // Update client subtotales
        if (data.subtotales) {
          setSubtotalesEstado(data.subtotales.map((s: any) => ({
            clienteNombre: s.clienteNombre,
            monto: s.subtotal,
            estado: s.estado || (s.pagado ? 'paid' : 'pending'),
            metodo: s.metodo
          })))
        }

        // Update Mozo items
        if (data.mozoItems) {
          setMozoItemsEstado(data.mozoItems.map((m: any) => ({
            itemId: m.itemId,
            subtotal: parseFloat(m.subtotal),
            pagado: m.pagado || false,
            metodo: m.metodo,
            estado: m.estado || 'pending',
            nombreProducto: m.nombreProducto || `Producto #${m.itemId}`,
            cantidad: m.cantidad || 1
          })))
        } else {
          // If no mozoItems in response, try to build from todosLosItems
          const mozoItems = todosLosItems.filter(i => i.clienteNombre === 'Mozo')
          if (mozoItems.length > 0) {
            setMozoItemsEstado(mozoItems.map(item => ({
              itemId: item.id,
              subtotal: parseFloat(item.precioUnitario || '0') * item.cantidad,
              pagado: false,
              estado: 'pending' as const,
              nombreProducto: item.nombreProducto || item.nombre || `Producto #${item.id}`,
              cantidad: item.cantidad
            })))
          }
        }

        // Use server's authoritative todoPagado value
        if (data.resumen && data.resumen.todoPagado !== undefined) {
          setServerTodoPagado(data.resumen.todoPagado)
        }
      }
    } catch (error) {
      console.error('Error al cargar subtotales:', error)
    } finally {
      setLoadingSubtotales(false)
    }
  }, [pedidoCerrado?.pedidoId, pedidoId, todosLosItems])

  // Limpiar subtotalesEstado cuando cambia el pedidoId (nuevo pedido cerrado)
  useEffect(() => {
    const currentPedidoId = pedidoCerrado?.pedidoId || pedidoId
    if (currentPedidoId && currentPedidoId !== lastPedidoIdRef.current) {
      // Es un nuevo pedido, limpiar subtotalesEstado
      setSubtotalesEstado([])
      lastPedidoIdRef.current = currentPedidoId
      // Forzar recarga de subtotales
      fetchSubtotales()
    }
  }, [pedidoCerrado?.pedidoId, pedidoId, fetchSubtotales])

  // Cargar subtotales al montar
  useEffect(() => {
    fetchSubtotales()
  }, []) // Solo al montar

  // Actualizar estado cuando lleguen actualizaciones por WebSocket
  // Solo actualizar si hay subtotales pagados Y corresponden al pedido actual
  useEffect(() => {
    const idPedido = pedidoCerrado?.pedidoId || pedidoId
    if (subtotalesPagados.length > 0 && idPedido) {
      // Separar clientes regulares de items de Mozo
      const clientesRegulares = subtotalesPagados.filter(
        (s: any) => !s.clienteNombre?.startsWith('Mozo:item:') && !s.isMozoItem
      )
      const mozoItems = subtotalesPagados.filter(
        (s: any) => s.clienteNombre?.startsWith('Mozo:item:') || s.isMozoItem
      )

      // Actualizar subtotales de clientes regulares
      setSubtotalesEstado(clientesRegulares)

      // Actualizar items de Mozo si hay datos
      if (mozoItems.length > 0) {
        setMozoItemsEstado(prev => {
          // Merge: actualizar items existentes con los nuevos estados
          const updated = prev.map(mozoItem => {
            // Buscar si hay una actualización para este item
            const mozoKey = `Mozo:item:${mozoItem.itemId}`
            const updatedData = mozoItems.find(
              (s: any) => s.clienteNombre === mozoKey || s.itemId === mozoItem.itemId
            )

            if (updatedData) {
              return {
                ...mozoItem,
                estado: updatedData.estado || mozoItem.estado,
                metodo: updatedData.metodo || mozoItem.metodo,
                pagado: updatedData.estado === 'paid'
              }
            }
            return mozoItem
          })
          return updated
        })
      }
    } else if (subtotalesPagados.length === 0) {
      // Si no hay subtotales pagados, limpiar el estado local también
      setSubtotalesEstado([])
    }
  }, [subtotalesPagados, pedidoCerrado?.pedidoId, pedidoId])

  useEffect(() => {
    // Esperar a que el store se hidrate
    if (!isHydrated) return

    // Si no hay datos del cliente, redirigir a escanear QR
    if (!clienteNombre || !qrToken) {
      navigate(`/mesa/${qrToken || 'invalid'}`)
      return
    }

    // === CRITICAL: ESPERAR A QUE RESTAURANTE ESTÉ CARGADO ===
    // Si restaurante es null, NO PODEMOS saber si es carrito o no.
    // DEBEMOS esperar a que se cargue antes de tomar cualquier decisión de redirección.
    if (!restaurante) {
      console.log('[PedidoCerrado] Esperando a que restaurante se cargue...')
      return
    }

    // Si ya se pagó todo, no redirigir (excepto lógica de carrito abajo)
    if (todoPagado && !restaurante.esCarrito) return

    // CRÍTICO: Si el estado del pedido es 'closed', SIEMPRE quedarse
    if (wsState?.estado === 'closed') return

    // === LÓGICA CARRITO ===
    if (restaurante?.esCarrito) {
      // Si es carrito y está preparando/entregado, ESTE ES EL LUGAR CORRECTO (para pagar).
      // NO HACER NADA (return explícito para evitar que siga ejecutando código)
      if (wsState?.estado === 'preparing' || wsState?.estado === 'delivered') {
        // Opcional: Solo si ya pagó todo, mover a esperando-pedido
        if (todoPagado && totalPagado > 0) {
          navigate('/esperando-pedido')
        }
        return
      }
    }

    // === LÓGICA RESTAURANTE CLÁSICO ===
    // Solo redirigir si estamos SEGUROS de que NO es carrito
    // (restaurante && !restaurante.esCarrito) es la clave para evitar race conditions
    if (restaurante && !restaurante.esCarrito) {
      if (wsState?.estado === 'preparing' || wsState?.estado === 'delivered') {
        navigate('/pedido-confirmado')
        return
      }
    }

    // Fallback: Solo redirigir si el estado es EXPLÍCITAMENTE 'pending' 
    // (no undefined, que significa que el WebSocket aún no envió el estado)
    if (wsState?.estado === 'pending' && !pedidoCerrado) {
      navigate(`/mesa/${qrToken}`)
      return
    }

    // NOTA: Removida la condición `if (!wsState?.estado && !pedidoCerrado)` 
    // porque causaba redirecciones prematuras antes de que el WebSocket 
    // estableciera el estado real del pedido.

  }, [
    clienteNombre,
    qrToken,
    wsState?.estado,
    pedidoCerrado,
    navigate,
    todoPagado,
    totalPagado,
    sessionEnded,
    isHydrated,
    hayItems,
    restaurante, // Asegurar que restaurante esté en dependencias
    loadingSubtotales
  ])

  // Manejar selección de cliente
  const handleToggleCliente = (cliente: string) => {
    setSelectedClientes(prev =>
      prev.includes(cliente)
        ? prev.filter(c => c !== cliente)
        : [...prev, cliente]
    )
  }

  // Manejar selección de item de Mozo individual
  const handleToggleMozoItem = (itemId: number) => {
    setSelectedMozoItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  // Seleccionar todos los pendientes (clientes + items de Mozo)
  const handleSelectAllPendientes = () => {
    const pendientesClientes = subtotales.filter(s => !s.pagado && s.estado !== 'pending_cash').map(s => s.clienteNombre)
    const pendientesMozo = mozoItemsPendientes.map(m => m.itemId)
    setSelectedClientes(pendientesClientes)
    setSelectedMozoItems(pendientesMozo)
  }

  // Seleccionar solo al cliente actual
  const handleSelectMiParte = () => {
    if (clienteNombre && !subtotales.find(s => s.clienteNombre === clienteNombre)?.pagado) {
      setSelectedClientes([clienteNombre])
      setSelectedMozoItems([])
    }
  }

  // Calcular total seleccionado (clientes + items Mozo)
  const totalSeleccionadoClientes = subtotales
    .filter(s => selectedClientes.includes(s.clienteNombre))
    .reduce((sum, s) => sum + s.subtotal, 0)
  const totalSeleccionadoMozo = mozoItemsEstado
    .filter(m => selectedMozoItems.includes(m.itemId))
    .reduce((sum, m) => sum + m.subtotal, 0)
  const totalSeleccionado = totalSeleccionadoClientes + totalSeleccionadoMozo

  // Check if something is selected
  const haySeleccion = selectedClientes.length > 0 || selectedMozoItems.length > 0

  const handlePagarEfectivo = async () => {
    if (!haySeleccion) {
      toast.error('Selecciona al menos una persona o producto para pagar')
      return
    }

    const idPedido = pedidoCerrado?.pedidoId || pedidoId
    if (!idPedido) {
      toast.error('Error', { description: 'No se pudo obtener la información del pedido' })
      return
    }

    setIsLoadingEfectivo(true)

    try {
      const response = await fetch(`${API_URL}/mp/pagar-efectivo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: idPedido,
          clientesAPagar: selectedClientes.length > 0 ? selectedClientes : undefined,
          mozoItemIds: selectedMozoItems.length > 0 ? selectedMozoItems : undefined,
          qrToken
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.info('Debe pagar en efectivo', {
          description: `Acércate a la caja para abonar $${totalSeleccionado.toFixed(2)}`
        })
        setSelectedClientes([])
        setSelectedMozoItems([])
        await fetchSubtotales()
      } else {
        toast.error('Error al registrar pago', { description: data.error })
      }
    } catch (error) {
      console.error('Error al registrar pago en efectivo:', error)
      toast.error('Error de conexión')
    } finally {
      setIsLoadingEfectivo(false)
    }
  }

  const handlePagarMercadoPago = async () => {
    if (!haySeleccion) {
      toast.error('Selecciona al menos una persona o producto para pagar')
      return
    }

    const idPedido = pedidoCerrado?.pedidoId || pedidoId

    if (!idPedido) {
      toast.error('Error', { description: 'No se pudo obtener la información del pedido' })
      return
    }

    setIsLoadingMP(true)

    try {
      const response = await fetch(`${API_URL}/mp/crear-preferencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: idPedido,
          qrToken: qrToken,
          clientesAPagar: selectedClientes.length > 0 ? selectedClientes : undefined,
          mozoItemIds: selectedMozoItems.length > 0 ? selectedMozoItems : undefined
        })
      })

      const data = await response.json()

      if (data.success && data.url_pago) {
        window.location.href = data.url_pago
      } else {
        toast.error('Error al procesar pago', {
          description: data.error || 'No se pudo crear el link de pago'
        })
      }
    } catch (error) {
      console.error('Error al crear preferencia de pago:', error)
      toast.error('Error de conexión', {
        description: 'No se pudo conectar con el servidor de pagos'
      })
    } finally {
      setIsLoadingMP(false)
    }
  }

  // Verificar si el cliente actual ya pagó
  const miPartePagada = subtotales.find(s => s.clienteNombre === clienteNombre)?.pagado || false
  const miParte = subtotales.find(s => s.clienteNombre === clienteNombre)

  const ReceiptCard = ({ showPaymentSelection = false }: { showPaymentSelection?: boolean }) => (
    <div className="bg-white text-neutral-900 rounded-2xl shadow-xl overflow-hidden mx-4">
      {/* Header del recibo */}
      <div className="bg-neutral-50 px-6 py-5 text-center border-b border-dashed border-neutral-200">
        {restaurante?.imagenUrl ? (
          <img
            src={restaurante.imagenUrl}
            alt={restaurante.nombre || 'Restaurante'}
            className="w-14 h-14 rounded-xl object-cover mx-auto mb-3"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-neutral-900 flex items-center justify-center mx-auto mb-3">
            <Receipt className="w-7 h-7 text-white" />
          </div>
        )}
        <h2 className="font-bold text-lg text-neutral-900">
          {restaurante?.nombre || 'Restaurante'}
        </h2>
        <p className="text-sm text-neutral-500 mt-1">Mesa {mesa?.nombre}</p>
      </div>

      {/* Lista de productos agrupados por usuario con checkboxes */}
      <div className="px-6 py-4">
        {showPaymentSelection && subtotales.filter(s => !s.pagado).length > 1 && (
          <button
            onClick={handleSelectAllPendientes}
            className="text-xs text-sky-600 hover:text-sky-700 font-medium mb-3 flex items-center gap-1"
          >
            <Users className="w-3 h-3" />
            Seleccionar todos los pendientes
          </button>
        )}

        <div className="space-y-4">
          {subtotales.map((clienteData, idx) => (
            <div key={clienteData.clienteNombre} className="space-y-2">
              {/* Header del cliente con checkbox */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={`cliente-${clienteData.clienteNombre}`}
                    className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-2 ${clienteData.pagado && clienteData.metodo === 'mercadopago'
                      ? 'text-emerald-600'
                      : clienteData.pagado && clienteData.metodo === 'efectivo'
                        ? 'text-emerald-600'
                        : clienteData.estado === 'pending_cash'
                          ? 'text-amber-600'
                          : 'text-neutral-500'
                      } ${showPaymentSelection && !clienteData.pagado && clienteData.estado !== 'pending_cash' ? 'cursor-pointer' : ''}`}
                  >
                    {clienteData.clienteNombre}
                    {/* Pagado con MercadoPago */}
                    {clienteData.pagado && clienteData.metodo === 'mercadopago' && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium normal-case bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" />
                        Pagado (MP)
                      </span>
                    )}
                    {/* Pagado en efectivo (confirmado por cajero) */}
                    {clienteData.pagado && clienteData.metodo === 'efectivo' && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium normal-case bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" />
                        Pagado (Efectivo)
                      </span>
                    )}
                    {/* Esperando confirmación del cajero (pending_cash) */}
                    {clienteData.estado === 'pending_cash' && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium normal-case bg-amber-100 text-amber-700">
                        <Wallet className="w-3 h-3" />
                        Esperando confirmación del cajero
                      </span>
                    )}
                  </label>
                </div>
              </div>

              {/* Productos del cliente */}
              <div className={clienteData.pagado && clienteData.metodo === 'mercadopago' ? 'opacity-50' : ''}>
                {clienteData.items.map((item) => {
                  const precio = parseFloat(item.precioUnitario || '0')
                  const subtotalItem = precio * item.cantidad

                  return (
                    <div key={item.id} className="flex justify-between items-start gap-4 ml-6">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-neutral-900 leading-tight">
                          {item.nombreProducto || item.nombre}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {item.cantidad} × ${precio.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-semibold text-sm text-neutral-900 tabular-nums">
                        ${subtotalItem.toFixed(2)}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Subtotal del cliente */}
              <div className={`flex justify-between items-center pt-1 border-t border-neutral-100 ml-6 ${clienteData.pagado && clienteData.metodo === 'mercadopago' ? 'opacity-50' : ''
                }`}>
                <span className="text-xs text-neutral-500">Subtotal {clienteData.clienteNombre}</span>
                <span className={`text-sm font-semibold tabular-nums ${clienteData.pagado && clienteData.metodo === 'mercadopago'
                  ? 'text-emerald-600 line-through'
                  : clienteData.pagado && clienteData.metodo !== 'mercadopago'
                    ? 'text-amber-600'
                    : 'text-neutral-700'
                  }`}>
                  ${clienteData.subtotal.toFixed(2)}
                </span>
              </div>

              {/* Separador entre clientes */}
              {idx < subtotales.length - 1 && <div className="pt-2" />}
            </div>
          ))}
        </div>

        {/* ========== PRODUCTOS AGREGADOS POR EL MOZO ========== */}
        {mozoItemsEstado.length > 0 && (
          <div className="mt-6 pt-4 border-t border-neutral-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 flex items-center gap-2">
                🍽️ Productos agregados por el Mozo
              </span>
            </div>

            <div className="space-y-3">
              {mozoItemsEstado.map((mozoItem) => {
                const isSelected = selectedMozoItems.includes(mozoItem.itemId)
                const isPaid = mozoItem.pagado
                const isPendingCash = mozoItem.estado === 'pending_cash'

                return (
                  <div
                    key={mozoItem.itemId}
                    className={`flex items-start gap-3 ${isPaid ? 'opacity-50' : ''}`}
                  >
                    {/* Checkbox for selection (only show if not paid and not pending_cash) */}
                    {showPaymentSelection && !isPaid && !isPendingCash && (
                      <button
                        onClick={() => handleToggleMozoItem(mozoItem.itemId)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all mt-0.5
                          ${isSelected
                            ? 'bg-sky-500 border-sky-500 text-white'
                            : 'border-neutral-300 hover:border-sky-400'
                          }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    )}

                    {/* Item info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-neutral-900 leading-tight flex items-center gap-2">
                            {mozoItem.nombreProducto}
                            {/* Pagado */}
                            {isPaid && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" />
                                Pagado
                              </span>
                            )}
                            {/* Esperando confirmación */}
                            {isPendingCash && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                                <Wallet className="w-3 h-3" />
                                Esperando cajero
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {mozoItem.cantidad} × ${(mozoItem.subtotal / mozoItem.cantidad).toFixed(2)}
                          </p>
                        </div>
                        <p className={`font-semibold text-sm tabular-nums ${isPaid ? 'text-emerald-600 line-through' : 'text-neutral-900'
                          }`}>
                          ${mozoItem.subtotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Subtotal de items Mozo */}
            {mozoItemsEstado.length > 0 && (
              <div className="flex justify-between items-center pt-2 mt-2 border-t border-neutral-100">
                <span className="text-xs text-neutral-500">
                  Subtotal Mozo ({mozoItemsPagados.length}/{mozoItemsEstado.length} pagados)
                </span>
                <span className="text-sm font-semibold tabular-nums text-neutral-700">
                  ${mozoItemsEstado.reduce((sum, m) => sum + m.subtotal, 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Separador estilo ticket */}
      <div className="relative px-6">
        <div className="absolute left-0 w-4 h-4 bg-neutral-100 dark:bg-neutral-950 rounded-full -translate-x-1/2" />
        <div className="absolute right-0 w-4 h-4 bg-neutral-100 dark:bg-neutral-950 rounded-full translate-x-1/2" />
        <Separator className="border-dashed" />
      </div>

      {/* Resumen de totales */}
      <div className="px-6 py-4 space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-neutral-500">Total del pedido</span>
          <span className="font-semibold text-neutral-900">${totalPedido}</span>
        </div>
        {totalPagado > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-emerald-600">Ya pagado</span>
            <span className="font-semibold text-emerald-600">-${totalPagado.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
          <span className="text-base font-bold text-neutral-900">
            {todoPagado ? 'PAGADO' : 'PENDIENTE'}
          </span>
          <span className={`text-2xl font-black ${todoPagado ? 'text-emerald-600' : 'text-neutral-900'}`}>
            ${todoPagado ? '0.00' : totalPendiente.toFixed(2)}
          </span>
        </div>
        {showPaymentSelection && selectedClientes.length > 0 && (
          <div className="flex justify-between items-center pt-2 border-t border-sky-100 bg-sky-50 -mx-6 px-6 py-3 mt-2">
            <span className="text-sm font-medium text-sky-700">
              Seleccionado ({selectedClientes.length})
            </span>
            <span className="text-lg font-bold text-sky-700">
              ${totalSeleccionado.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Footer del recibo */}
      <div className="bg-neutral-50 px-6 py-4 text-center border-t border-dashed border-neutral-200">
        <p className="text-[10px] text-neutral-400 uppercase tracking-wider">
          Powered by Piru
        </p>
      </div>
    </div>
  )

  // Pantalla cuando todo está pagado
  // AGREGADO: Verificación extra totalPedidoNum > 0.01 y totalPagado > 0
  const searchParams = useSearchParams()[0]
  const metodoPago = searchParams.get('metodo') || 'efectivo'
  const numeroFactura = `FAC-${Date.now().toString().slice(-6)}`
  const fecha = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const reciboRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const items = pedidoCerrado?.items || []
  const total = parseFloat(totalPedido)

  const handleDescargar = async () => {
    if (!reciboRef.current) return
    setIsDownloading(true)
    try {
      const dataUrl = await toPng(reciboRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#f5f5f5',
      })
      const link = document.createElement('a')
      link.download = `factura-${numeroFactura}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Error al generar imagen:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  const itemsPorCliente = items.reduce((acc, item) => {
    const cliente = item.clienteNombre || 'Sin nombre'
    if (!acc[cliente]) acc[cliente] = []
    acc[cliente].push(item)
    return acc
  }, {} as Record<string, typeof items>)

  // Lógica de renderizado de "Todo Pagado"
  // Solo si es carrito Y realmente está todo pagado (con verificaciones de seguridad)
  if (restaurante?.esCarrito && (todoPagado && totalPagado > 0)) {
    navigate('/esperando-pedido')
    return null
  }

  // Renderizado normal para no-carrito o sessionEnded legacy

  // === MODIFICACIÓN: VISTA UNIFICADA (NO SPLIT) ===
  // Si el restaurante tiene splitPayment = false, mostramos la vista estilo "Factura"
  // pero con funcionalidad de pago del TOTAL.
  if (restaurante?.splitPayment === false) {
    // Calcular totales globales pendientes
    const totalPendienteClientes = subtotales.filter(s => !s.pagado).reduce((sum, s) => sum + s.subtotal, 0)
    const totalPendienteMozo = mozoItemsPendientes.reduce((sum, m) => sum + m.subtotal, 0)
    const totalAPagar = totalPendienteClientes + totalPendienteMozo

    // Función para pagar todo
    const handlePagarTodo = async (metodo: 'efectivo' | 'mercadopago') => {
      // Recopilar TODOS los items pendientes
      const todosClientesPendientes = subtotales.filter(s => !s.pagado).map(s => s.clienteNombre)
      const todosMozoItemsPendientes = mozoItemsPendientes.map(m => m.itemId)

      if (todosClientesPendientes.length === 0 && todosMozoItemsPendientes.length === 0) {
        toast.error('No hay nada pendiente de pago')
        return
      }

      // Establecer selección temporalmente (aunque no se use en la UI, los handlers lo usan)
      setSelectedClientes(todosClientesPendientes)
      setSelectedMozoItems(todosMozoItemsPendientes)

      // Llamar al handler correspondiente pasando los datos explícitamente si fuera posible,
      // pero como usan el estado, seteamos el estado arriba.
      // Sin embargo, como setState es asíncrono, necesitamos una versión modificada de los handlers
      // O hack: llamar a la API directamente aquí.

      const idPedido = pedidoCerrado?.pedidoId || pedidoId
      if (!idPedido) return

      if (metodo === 'efectivo') {
        setIsLoadingEfectivo(true)
        try {
          const response = await fetch(`${API_URL}/mp/pagar-efectivo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pedidoId: idPedido,
              clientesAPagar: todosClientesPendientes.length > 0 ? todosClientesPendientes : undefined,
              mozoItemIds: todosMozoItemsPendientes.length > 0 ? todosMozoItemsPendientes : undefined,
              qrToken
            })
          })
          const data = await response.json()
          if (data.success) {
            toast.info('Debe pagar en efectivo', { description: `Acércate a la caja para abonar $${totalAPagar.toFixed(2)}` })
            await fetchSubtotales()
          } else {
            toast.error('Error', { description: data.error })
          }
        } catch (e) {
          console.error(e);
          toast.error('Error de conexión')
        } finally { setIsLoadingEfectivo(false) }
      } else {
        // MercadoPago
        setIsLoadingMP(true)
        try {
          const response = await fetch(`${API_URL}/mp/crear-preferencia`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pedidoId: idPedido,
              qrToken: qrToken,
              clientesAPagar: todosClientesPendientes.length > 0 ? todosClientesPendientes : undefined,
              mozoItemIds: todosMozoItemsPendientes.length > 0 ? todosMozoItemsPendientes : undefined
            })
          })
          const data = await response.json()
          if (data.success && data.url_pago) {
            window.location.href = data.url_pago
          } else {
            toast.error('Error', { description: data.error })
          }
        } catch (e) { console.error(e); toast.error('Error de conexión') } finally { setIsLoadingMP(false) }
      }
    }

    return (
      <div className="min-h-screen bg-linear-to-b from-neutral-100 to-neutral-200 dark:from-neutral-950 dark:to-neutral-900 py-8 pb-32">
        <div className="max-w-md mx-auto space-y-6 px-4">

          {/* Header similar a Factura.tsx */}
          <div className="text-center px-6 space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 mb-2">
              <Receipt className="w-8 h-8 text-neutral-600 dark:text-neutral-400" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Ticket de la Mesa
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Detalle del consumo total
            </p>
          </div>

          {/* Ticket Visual (Copiado de Factura.tsx y adaptado) */}
          <div
            ref={reciboRef}
            style={{
              backgroundColor: '#ffffff',
              color: '#171717',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {/* Header del recibo */}
            <div style={{
              backgroundColor: '#fafafa',
              padding: '20px 24px',
              textAlign: 'center',
              borderBottom: '1px dashed #e5e5e5',
            }}>
              <h2 style={{ fontWeight: '700', fontSize: '18px', color: '#171717', margin: 0 }}>
                {restaurante?.nombre || 'Restaurante'}
              </h2>
              <p style={{ fontSize: '14px', color: '#737373', marginTop: '4px' }}>Mesa {mesa?.nombre}</p>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#a3a3a3' }}>
                <p style={{ margin: 0 }}>Ticket de Pedido</p>
                <p style={{ margin: 0 }}>{fecha}</p>
              </div>
            </div>

            {/* Lista de productos agrupados (Reusando lógica de subtotales) */}
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Clientes Regulares */}
                {subtotales.map((clienteData) => (
                  <div key={clienteData.clienteNombre} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#737373',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      margin: 0,
                    }}>
                      {clienteData.clienteNombre} {clienteData.pagado ? '(PAGADO)' : ''}
                    </p>

                    {clienteData.items.map((item) => {
                      const precio = parseFloat(item.precioUnitario || '0')
                      const subtotal = precio * item.cantidad
                      return (
                        <div key={item.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '16px',
                          opacity: clienteData.pagado ? 0.5 : 1
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: '500', fontSize: '14px', color: '#171717', margin: 0 }}>
                              {item.nombreProducto || item.nombre}
                            </p>
                            <p style={{ fontSize: '12px', color: '#737373', margin: '2px 0 0 0' }}>
                              {item.cantidad} × ${precio.toFixed(2)}
                            </p>
                          </div>
                          <p style={{ fontWeight: '600', fontSize: '14px', color: '#171717', margin: 0 }}>
                            ${subtotal.toFixed(2)}
                          </p>
                        </div>
                      )
                    })}

                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      paddingTop: '4px', borderTop: '1px solid #f5f5f5',
                      opacity: clienteData.pagado ? 0.5 : 1
                    }}>
                      <span style={{ fontSize: '12px', color: '#737373' }}>Subtotal</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#404040' }}>${clienteData.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                ))}

                {/* Items Mozo */}
                {mozoItemsEstado.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed #e5e5e5', paddingTop: '16px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#ea580c', textTransform: 'uppercase', margin: 0 }}>
                      Agregados por Mozo
                    </p>
                    {mozoItemsEstado.map((m) => (
                      <div key={m.itemId} style={{ display: 'flex', justifyContent: 'space-between', opacity: m.pagado ? 0.5 : 1 }}>
                        <div>
                          <p style={{ fontWeight: '500', fontSize: '14px', color: '#171717', margin: 0 }}>{m.nombreProducto}</p>
                          <p style={{ fontSize: '12px', color: '#737373', margin: 0 }}>{m.cantidad} × ${(m.subtotal / m.cantidad).toFixed(2)}</p>
                        </div>
                        <p style={{ fontWeight: '600', fontSize: '14px', color: '#171717', margin: 0 }}>${m.subtotal.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Separador */}
            <div style={{ position: 'relative', padding: '0 24px' }}>
              <div style={{ position: 'absolute', left: 0, top: '50%', width: '16px', height: '16px', backgroundColor: '#f5f5f5', borderRadius: '50%', transform: 'translate(-50%, -50%)' }} />
              <div style={{ position: 'absolute', right: 0, top: '50%', width: '16px', height: '16px', backgroundColor: '#f5f5f5', borderRadius: '50%', transform: 'translate(50%, -50%)' }} />
              <div style={{ borderTop: '1px dashed #e5e5e5' }} />
            </div>

            {/* Totales */}
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#737373' }}>Total Consumido</span>
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#171717' }}>${totalPedido}</span>
              </div>
              {totalPagado > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '14px', color: '#059669' }}>Ya pagado</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#059669' }}>-${totalPagado.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f5f5f5' }}>
                <span style={{ fontSize: '16px', fontWeight: '900', color: '#171717' }}>A PAGAR</span>
                <span style={{ fontSize: '24px', fontWeight: '900', color: '#171717' }}>${totalPendiente.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer del recibo */}
            <div style={{
              backgroundColor: '#fafafa',
              padding: '16px 24px',
              textAlign: 'center',
              borderTop: '1px dashed #e5e5e5',
            }}>
              <p style={{
                fontSize: '10px',
                color: '#a3a3a3',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                margin: 0,
              }}>
                Powered by Piru
              </p>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="space-y-3 pb-8">
            {/* Botón Descargar (como pidió el usuario) */}
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
              onClick={handleDescargar}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando imagen...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Ticket
                </>
              )}
            </Button>

            {/* Botones de Pago (Solo si hay pendiente) */}
            {totalPendiente > 0.01 && (
              <>
                {mpDisponible && (
                  <Button
                    className="w-full h-14 text-lg rounded-xl bg-[#009EE3] hover:bg-[#008ED0] text-white shadow-lg shadow-[#009EE3]/20"
                    onClick={() => handlePagarTodo('mercadopago')}
                    disabled={isLoadingMP}
                  >
                    {isLoadingMP ? <Loader2 className="animate-spin" /> : 'Pagar con MercadoPago'}
                  </Button>
                )}

                <Button
                  className="w-full h-14 text-lg rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                  onClick={() => handlePagarTodo('efectivo')}
                  disabled={isLoadingEfectivo}
                >
                  {isLoadingEfectivo ? <Loader2 className="animate-spin" /> : 'Pagar en Efectivo'}
                </Button>
              </>
            )}

            {totalPendiente <= 0.01 && (
              <div className="p-4 bg-emerald-100 text-emerald-800 rounded-xl text-center font-bold">
                ¡Cuenta saldada!
              </div>
            )}
          </div>

          <ExitDialog />
        </div>
      </div>
    )
  }

  // Renderizado normal para no-carrito o sessionEnded legacy

  if (!restaurante?.esCarrito && (todoPagado || (sessionEnded && hayItems && totalPedidoNum > 0.01 && totalPendiente <= 0.01))) {
    return (
      <div className="min-h-screen bg-linear-to-b from-neutral-100 to-neutral-200 dark:from-neutral-950 dark:to-neutral-900 py-8 pb-32">
        <div className="max-w-md mx-auto space-y-6 px-4">

          {/* Header de Éxito */}
          <div className="text-center px-6 space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-2">
              <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              ¡Pago Realizado!
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Tu pago se ha procesado correctamente
            </p>
          </div>

          {/* ... El resto del código de la factura (Receipt) ... */}
          {/* Copia el bloque "Recibo/Factura estilo ticket" que ya tienes en tu archivo original hasta el final del return */}
          {/* Por brevedad, asumo que mantienes el código visual de la factura igual */}

          <div
            ref={reciboRef}
            style={{
              backgroundColor: '#ffffff',
              color: '#171717',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {/* ... Contenido de la factura ... */}
            <div style={{
              backgroundColor: '#fafafa',
              padding: '20px 24px',
              textAlign: 'center',
              borderBottom: '1px dashed #e5e5e5',
            }}>
              <h2 style={{ fontWeight: '700', fontSize: '18px', color: '#171717', margin: 0 }}>
                {restaurante?.nombre || 'Restaurante'}
              </h2>
              <p style={{ fontSize: '14px', color: '#737373', marginTop: '4px' }}>Mesa {mesa?.nombre}</p>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#a3a3a3' }}>
                <p style={{ margin: 0 }}>Factura N° {numeroFactura}</p>
                <p style={{ margin: 0 }}>{fecha}</p>
              </div>
            </div>

            {/* Lista de productos agrupados por usuario */}
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.entries(itemsPorCliente).length > 0 ? (
                  Object.entries(itemsPorCliente).map(([cliente, clienteItems]) => {
                    const subtotalCliente = clienteItems.reduce((sum, item) => {
                      return sum + (parseFloat(item.precioUnitario || '0') * (item.cantidad || 1))
                    }, 0)

                    return (
                      <div key={cliente} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#737373',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          margin: 0,
                        }}>
                          {cliente}
                        </p>

                        {clienteItems.map((item) => {
                          const precio = parseFloat(item.precioUnitario || '0')
                          const subtotal = precio * (item.cantidad || 1)

                          return (
                            <div key={item.id} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: '16px',
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                  fontWeight: '500',
                                  fontSize: '14px',
                                  color: '#171717',
                                  lineHeight: '1.25',
                                  margin: 0,
                                }}>
                                  {item.nombreProducto || item.nombre}
                                </p>
                                <p style={{
                                  fontSize: '12px',
                                  color: '#737373',
                                  marginTop: '2px',
                                  margin: '2px 0 0 0',
                                }}>
                                  {item.cantidad || 1} × ${precio.toFixed(2)}
                                </p>
                              </div>
                              <p style={{
                                fontWeight: '600',
                                fontSize: '14px',
                                color: '#171717',
                                fontVariantNumeric: 'tabular-nums',
                                margin: 0,
                              }}>
                                ${subtotal.toFixed(2)}
                              </p>
                            </div>
                          )
                        })}

                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: '4px',
                          borderTop: '1px solid #f5f5f5',
                        }}>
                          <span style={{ fontSize: '12px', color: '#737373' }}>Subtotal {cliente}</span>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#404040',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            ${subtotalCliente.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p style={{ fontSize: '14px', color: '#737373', textAlign: 'center', padding: '16px 0' }}>
                    No hay items en el pedido
                  </p>
                )}
              </div>
            </div>

            {/* Total */}
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#171717' }}>TOTAL</span>
                <span style={{ fontSize: '24px', fontWeight: '900', color: '#171717' }}>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Info de método de pago */}
            <div style={{
              padding: '16px 24px',
              textAlign: 'center',
              backgroundColor: metodoPago === 'mercadopago' ? '#f0f9ff' : '#fffbeb',
            }}>
              <p style={{
                fontSize: '14px',
                fontWeight: '600',
                color: metodoPago === 'mercadopago' ? '#0c4a6e' : '#78350f',
                margin: 0,
              }}>
                {metodoPago === 'mercadopago' ? 'Pagado con MercadoPago' : 'Debe pagar en efectivo'}
              </p>
            </div>
          </div>

          <div className="px-4 space-y-3">
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
              onClick={handleDescargar}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando imagen...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Factura
                </>
              )}
            </Button>
            <Button
              className="w-full h-12 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900"
              onClick={() => window.location.href = '/'}
            >
              <Home className="mr-2 h-4 w-4" />
              Volver al Inicio
            </Button>
          </div>
        </div>
        <ExitDialog />
      </div>
    )
  }

  // Renderizado principal (selección de pagos)
  // ... Copia todo el return original que empieza con <div className="min-h-screen bg-background pb-32"> ...
  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header sticky */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {restaurante?.imagenUrl ? (
                <img
                  src={restaurante.imagenUrl}
                  alt={restaurante.nombre || 'Restaurante'}
                  className="w-10 h-10 rounded-xl object-cover border border-border shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <h2 className="font-semibold text-sm text-foreground">{restaurante?.nombre || 'Restaurante'}</h2>
                <p className="text-xs text-muted-foreground">Mesa {mesa?.nombre}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50">
              <Split className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Dividir cuenta</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de bienvenida */}
      <div className="max-w-md mx-auto px-5 pt-6 space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">Tu cuenta,</p>
          <h1 className="text-3xl font-extrabold tracking-tight bg-linear-to-r from-orange-800 to-orange-400 bg-clip-text text-transparent dark:from-orange-400 dark:to-orange-200">
            {clienteNombre}
          </h1>
        </div>

        {/* Barra de progreso de pagos */}
        {subtotales.length > 1 && (
          <div className="bg-secondary/50 rounded-2xl p-4 border border-border/50">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progreso de pagos</span>
              <span className="font-semibold text-foreground">
                {clientesPagados.length}/{subtotales.length} pagados
              </span>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${(totalPagado / parseFloat(totalPedido)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {loadingSubtotales && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      <div className="max-w-md mx-auto px-5 py-6 space-y-6 pb-48">
        {/* Acciones rápidas */}
        {clientesPendientes.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {/* Botón "Pagar mi parte" */}
            {miParte && !miPartePagada && (
              <button
                onClick={handleSelectMiParte}
                className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all active:scale-95 ${selectedClientes.length === 1 && selectedClientes[0] === clienteNombre
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'bg-card   border-primary/20 hover:border-primary/50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedClientes.length === 1 && selectedClientes[0] === clienteNombre
                    ? 'bg-white/20'
                    : 'bg-primary/10'
                    }`}>
                    <UserCheck className={`w-5 h-5 ${selectedClientes.length === 1 && selectedClientes[0] === clienteNombre
                      ? 'text-primary-foreground'
                      : 'text-primary'
                      }`} />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${selectedClientes.length === 1 && selectedClientes[0] === clienteNombre
                      ? 'text-primary-foreground'
                      : 'text-foreground'
                      }`}>
                      Pagar mi parte
                    </p>
                    <p className={`text-lg font-bold ${selectedClientes.length === 1 && selectedClientes[0] === clienteNombre
                      ? 'text-primary-foreground'
                      : 'text-primary'
                      }`}>
                      ${miParte.subtotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              </button>
            )}

            {/* Botón "Pagar todo" */}
            {clientesPendientes.length > 1 && (
              <button
                onClick={handleSelectAllPendientes}
                className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all active:scale-95 ${selectedClientes.length === clientesPendientes.length && selectedClientes.length > 0
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 scale-[1.02]'
                  : 'bg-card border-orange-200 dark:border-orange-800/50 hover:border-orange-400'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedClientes.length === clientesPendientes.length && selectedClientes.length > 0
                    ? 'bg-white/20'
                    : 'bg-orange-100 dark:bg-orange-900/30'
                    }`}>
                    <Users className={`w-5 h-5 ${selectedClientes.length === clientesPendientes.length && selectedClientes.length > 0
                      ? 'text-white'
                      : 'text-orange-600 dark:text-orange-400'
                      }`} />
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${selectedClientes.length === clientesPendientes.length && selectedClientes.length > 0
                      ? 'text-white'
                      : 'text-foreground'
                      }`}>
                      Pagar todo
                    </p>
                    <p className={`text-lg font-bold ${selectedClientes.length === clientesPendientes.length && selectedClientes.length > 0
                      ? 'text-white'
                      : 'text-orange-600 dark:text-orange-400'
                      }`}>
                      ${totalPendiente.toFixed(2)}
                    </p>
                  </div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Sección de selección de personas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Seleccionar personas
            </h3>
            {selectedClientes.length > 0 && (
              <button
                onClick={() => setSelectedClientes([])}
                className="text-sm text-primary hover:underline"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="space-y-3">
            {clientesPendientes.map((cliente) => {
              const isSelected = selectedClientes.includes(cliente.clienteNombre)
              const isCurrentUser = cliente.clienteNombre === clienteNombre

              return (
                <button
                  key={cliente.clienteNombre}
                  onClick={() => handleToggleCliente(cliente.clienteNombre)}
                  className={`w-full rounded-2xl p-4 text-left transition-all active:scale-[0.98] ${isSelected
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'bg-card border border-border hover:border-primary/50'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Checkbox visual */}
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected
                      ? 'bg-white border-white'
                      : 'border-border'
                      }`}>
                      {isSelected && <Check className="w-4 h-4 text-primary" />}
                    </div>

                    {/* Info del cliente */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                          {cliente.clienteNombre}
                        </span>
                        {isCurrentUser && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSelected
                            ? 'bg-white/20 text-primary-foreground'
                            : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                            }`}>
                            Tú
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {cliente.items.length} producto{cliente.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {/* Monto */}
                    <span className={`text-xl font-bold tabular-nums ${isSelected ? 'text-primary-foreground' : 'text-foreground'
                      }`}>
                      ${cliente.subtotal.toFixed(2)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Lista de items de Mozo pendientes */}
          {mozoItemsPendientes.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                <span className="text-amber-600 dark:text-amber-500 text-lg">🍽️</span>
                Productos adicionales
              </h3>
              <div className="space-y-3">
                {mozoItemsPendientes.map((item) => {
                  const isSelected = selectedMozoItems.includes(item.itemId)

                  return (
                    <button
                      key={item.itemId}
                      onClick={() => handleToggleMozoItem(item.itemId)}
                      className={`w-full rounded-2xl p-4 text-left transition-all active:scale-[0.98] ${isSelected
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                        : 'bg-card border border-border hover:border-amber-500/50'
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Checkbox visual */}
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected
                          ? 'bg-white border-white'
                          : 'border-border'
                          }`}>
                          {isSelected && <Check className="w-4 h-4 text-amber-500" />}
                        </div>

                        {/* Info del item */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${isSelected ? 'text-white' : 'text-foreground'}`}>
                              {item.nombreProducto}
                            </span>
                          </div>
                          <p className={`text-sm ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                            {item.cantidad} unidad{item.cantidad !== 1 ? 'es' : ''}
                          </p>
                        </div>

                        {/* Monto */}
                        <span className={`text-xl font-bold tabular-nums ${isSelected ? 'text-white' : 'text-foreground'
                          }`}>
                          ${item.subtotal.toFixed(2)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Clientes que ya pagaron (solo MercadoPago) */}
          {clientesPagados.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Ya pagaron
              </p>
              {clientesPagados.map((cliente) => (
                <div
                  key={cliente.clienteNombre}
                  className="bg-green-50 dark:bg-green-950/30 rounded-2xl p-4 border border-green-200 dark:border-green-800"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold text-green-700 dark:text-green-300">
                        {cliente.clienteNombre}
                      </span>
                      <p className="text-xs text-green-600/70 dark:text-green-400/70">
                        MercadoPago
                      </p>
                    </div>
                    <span className="font-bold text-green-600 dark:text-green-400 line-through opacity-60">
                      ${cliente.subtotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Clientes que deben pagar en efectivo */}
          {clientesEsperandoConfirmacion.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Personas esperando confirmación
              </p>
              {clientesEsperandoConfirmacion.map((cliente: any) => (
                <div
                  key={cliente.clienteNombre}
                  className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-4 border border-amber-200 dark:border-amber-800"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        {cliente.clienteNombre}
                      </span>
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                        Acércate a la caja para pagar
                      </p>
                    </div>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      ${cliente.subtotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Items de Mozo esperando confirmación */}
          {mozoItemsEsperando.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Productos esperando confirmación
              </p>
              {mozoItemsEsperando.map((item) => (
                <div
                  key={item.itemId}
                  className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-4 border border-amber-200 dark:border-amber-800"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        {item.nombreProducto}
                      </span>
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                        Acércate a la caja para pagar
                      </p>
                    </div>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      ${item.subtotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        <ReceiptCard />
      </div>

      {/* Panel de pago fijo en la parte inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-md mx-auto px-5 py-4 space-y-3">
          {/* Resumen de selección */}
          {haySeleccion ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedClientes.length > 0
                    ? `${selectedClientes.length} persona${selectedClientes.length !== 1 ? 's' : ''}`
                    : ''}
                  {selectedClientes.length > 0 && selectedMozoItems.length > 0 ? ' + ' : ''}
                  {selectedMozoItems.length > 0
                    ? `${selectedMozoItems.length} producto${selectedMozoItems.length !== 1 ? 's' : ''}`
                    : ''}
                </p>
                <p className="text-2xl font-black tracking-tight text-foreground">
                  ${totalSeleccionado.toFixed(2)}
                </p>
              </div>
              <div className="flex items-center">
                {selectedClientes.slice(0, 4).map((nombre, i) => (
                  <div
                    key={nombre}
                    className="w-9 h-9 rounded-xl border-2 border-background shadow-sm bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold"
                    style={{ marginLeft: i > 0 ? '-8px' : '0' }}
                  >
                    {nombre.slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {selectedClientes.length > 4 && (
                  <div
                    className="w-9 h-9 rounded-xl border-2 border-background shadow-sm bg-secondary text-foreground flex items-center justify-center text-xs font-bold"
                    style={{ marginLeft: '-8px' }}
                  >
                    +{selectedClientes.length - 4}
                  </div>
                )}
                {/* Visual indicator for Mozo items */}
                {selectedMozoItems.length > 0 && (
                  <div
                    className="w-9 h-9 rounded-xl border-2 border-background shadow-sm bg-amber-500 text-white flex items-center justify-center text-xs font-bold"
                    style={{ marginLeft: selectedClientes.length > 0 ? '-8px' : '0' }}
                  >
                    +{selectedMozoItems.length}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-2">
              Selecciona quién va a pagar
            </p>
          )}

          {/* Botones de pago */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handlePagarEfectivo}
              disabled={!haySeleccion || isLoadingEfectivo}
              className="h-14 text-base font-bold rounded-2xl shadow-lg shadow-primary/20"
              size="lg"
            >
              {isLoadingEfectivo ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <DollarSign className="w-5 h-5 mr-2" />
                  Efectivo
                </>
              )}
            </Button>

            <Button
              onClick={handlePagarMercadoPago}
              disabled={!mpDisponible || isLoadingMP || !haySeleccion}
              className={`h-14 text-base font-bold rounded-2xl border-2 ${mpDisponible && haySeleccion
                ? 'bg-sky-500 text-white'
                : ''
                }`}
              size="lg"
            >
              {isLoadingMP ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  {mpDisponible ? 'MercadoPago' : 'No disponible'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog para prevenir navegación hacia atrás */}
      <ExitDialog />
    </div>
  )
}

export default PedidoCerrado