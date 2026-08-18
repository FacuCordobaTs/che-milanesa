import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Mesa {
  id: number
  nombre: string
  qrToken: string
  restauranteId: number
}

interface Restaurante {
  id: number
  nombre: string
  imagenUrl: string | null
  mpConnected: boolean | null
  esCarrito: boolean | null
  splitPayment: boolean | null
  soloCartaDigital: boolean
  disenoAlternativo?: boolean | null
  direccion?: string | null
  colorPrimario?: string | null
  colorSecundario?: string | null
  username?: string | null
}

// Datos de checkout grupal (sala)
export interface CheckoutDeliveryData {
  tipoPedido: 'delivery' | 'takeaway'
  nombre: string
  telefono: string
  direccion: string
  lat: number | null
  lng: number | null
  notas: string
  deliveryFee: number
  zonaNombre: string | null
  itemsTotal: string
  total: string
  codigoDescuentoId?: number | null
  montoDescuento?: number
  metodoPago?: string | null
  horarioProgramado?: string
  sucursalId?: number | null
  tipoDomicilio?: 'casa' | 'departamento' | null
}

export interface CheckoutEditSemaphore {
  clienteId: string
  clienteNombre: string
}

interface Ingrediente {
  id: number
  nombre: string
}

interface Producto {
  id: number
  nombre: string
  descripcion: string | null
  precio: string
  imagenUrl: string | null
  categoriaId: number | null
  categoria: string | null
  ingredientes?: Ingrediente[]
}

interface Cliente {
  id: string
  nombre: string
}

interface Pedido {
  id: number
  mesaId: number
  restauranteId: number
  estado: string
  total: string
  createdAt: string
  nombrePedido?: string | null
}

interface ItemPedido {
  id: number
  productoId: number
  clienteNombre: string
  cantidad: number
  precioUnitario: string
  nombreProducto?: string
  nombre?: string
  imagenUrl?: string | null
}

// Datos del último pedido cerrado (para mostrar en la pantalla de factura)
interface PedidoCerradoData {
  items: ItemPedido[]
  total: string
  pedidoId: number
}

// Estado de pago de cada subtotal (split payment)
export interface SubtotalPagado {
  clienteNombre: string
  monto: string
  estado: 'pending' | 'pending_cash' | 'paid' | 'failed'
  metodo: 'efectivo' | 'mercadopago' | null
}

interface MesaState {
  mesa: Mesa | null
  restaurante: Restaurante | null
  productos: Producto[]
  clientes: Cliente[]
  pedidoId: number | null
  pedido: Pedido | null
  clienteId: string | null
  clienteNombre: string | null
  qrToken: string | null
  isLoading: boolean
  error: string | null
  // Datos del pedido cerrado para mostrar en factura
  pedidoCerrado: PedidoCerradoData | null
  // Estado de subtotales pagados (split payment)
  subtotalesPagados: SubtotalPagado[]
  // Indica si la sesión ha terminado (pagado) - no debe reconectar ni navegar
  sessionEnded: boolean
  // Flag para saber si el store ya se hidrató desde localStorage
  isHydrated: boolean
  // Modo carrito: indica si el pedido está listo para retirar
  pedidoListo: boolean
  // Checkout grupal (sala)
  checkoutDeliveryData: CheckoutDeliveryData | null
  checkoutEditSemaphore: CheckoutEditSemaphore | null
  setCheckoutDeliveryData: (data: CheckoutDeliveryData | null) => void
  setCheckoutEditSemaphore: (sem: CheckoutEditSemaphore | null) => void
  setMesa: (mesa: Mesa) => void
  setRestaurante: (restaurante: Restaurante | null) => void
  setProductos: (productos: Producto[]) => void
  setClientes: (clientes: Cliente[]) => void
  setPedidoId: (pedidoId: number) => void
  setPedido: (pedido: Pedido) => void
  setClienteInfo: (id: string, nombre: string) => void
  setQrToken: (token: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setPedidoCerrado: (data: PedidoCerradoData) => void
  clearPedidoCerrado: () => void
  setSubtotalesPagados: (subtotales: SubtotalPagado[]) => void
  endSession: () => void
  setHydrated: () => void
  setPedidoListo: (listo: boolean) => void
  reset: () => void
}

export const useMesaStore = create<MesaState>()(
  persist(
    (set) => ({
      mesa: null,
      restaurante: null,
      productos: [],
      clientes: [],
      pedidoId: null,
      pedido: null,
      clienteId: null,
      clienteNombre: null,
      qrToken: null,
      isLoading: false,
      error: null,
      pedidoCerrado: null,
      subtotalesPagados: [],
      sessionEnded: false,
      isHydrated: false,
      pedidoListo: false,
      checkoutDeliveryData: null,
      checkoutEditSemaphore: null,

      setCheckoutDeliveryData: (data) => set({ checkoutDeliveryData: data }),
      setCheckoutEditSemaphore: (sem) => set({ checkoutEditSemaphore: sem }),
      setMesa: (mesa) => set({ mesa }),
      setRestaurante: (restaurante) => set({ restaurante }),
      setProductos: (productos) => set({ productos }),
      setClientes: (clientes) => set({ clientes }),

      // CORRECCIÓN CRÍTICA: Al cambiar el ID del pedido, limpiar datos viejos
      setPedidoId: (pedidoId) => set((state) => {
        if (state.pedidoId !== pedidoId) {
          return {
            pedidoId,
            subtotalesPagados: [], // Limpiar pagos anteriores
            pedidoCerrado: null,   // Limpiar recibo anterior
            sessionEnded: false,
            pedidoListo: false
          }
        }
        return { pedidoId }
      }),

      setPedido: (pedido) => set({ pedido }),
      setClienteInfo: (id, nombre) => set({ clienteId: id, clienteNombre: nombre }),

      // CORRECCIÓN CRÍTICA: Al cambiar de mesa (QR), limpiar todo
      setQrToken: (token) => set((state) => {
        if (state.qrToken !== token) {
          return {
            qrToken: token,
            subtotalesPagados: [],
            pedidoCerrado: null,
            sessionEnded: false,
            pedidoListo: false
          }
        }
        return { qrToken: token }
      }),

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setPedidoCerrado: (data) => set({ pedidoCerrado: data }),
      clearPedidoCerrado: () => set({ pedidoCerrado: null }),
      setSubtotalesPagados: (subtotales) => set({ subtotalesPagados: subtotales }),
      endSession: () => set({ sessionEnded: true }),
      setHydrated: () => set({ isHydrated: true }),
      setPedidoListo: (listo) => set({ pedidoListo: listo }),
      reset: () => set({
        mesa: null,
        restaurante: null,
        productos: [],
        clientes: [],
        pedidoId: null,
        pedido: null,
        clienteId: null,
        clienteNombre: null,
        qrToken: null,
        isLoading: false,
        error: null,
        pedidoCerrado: null,
        subtotalesPagados: [],
        sessionEnded: false,
        pedidoListo: false,
        checkoutDeliveryData: null,
        checkoutEditSemaphore: null,
      }),
    }),
    {
      name: 'piru-mesa-storage',
      // Solo persistir los datos críticos que necesitamos después de recargas
      // NO persistir estados de pago (subtotalesPagados, sessionEnded) porque son específicos del pedido actual
      partialize: (state) => ({
        clienteId: state.clienteId,
        clienteNombre: state.clienteNombre,
        qrToken: state.qrToken,
        pedidoId: state.pedidoId,
        mesa: state.mesa,
        restaurante: state.restaurante,
        pedido: state.pedido,
        productos: state.productos,
        pedidoCerrado: state.pedidoCerrado,
      }),
      onRehydrateStorage: () => (state) => {
        // Marcar como hidratado cuando termine de cargar desde localStorage
        if (state) {
          // Limpiar estados de pago al rehidratar - siempre empezar limpio
          state.subtotalesPagados = []
          state.sessionEnded = false
          state.pedidoListo = false
          state.setHydrated()
        }
      },
    }
  )
)

// Marcar como hidratado después de un breve delay si onRehydrateStorage no lo hizo
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (!useMesaStore.getState().isHydrated) {
      useMesaStore.getState().setHydrated()
    }
  }, 100)
}