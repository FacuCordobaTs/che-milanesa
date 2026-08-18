import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ItemCarrito {
  id: number // ID temporal del item en el carrito
  productoId: number
  nombre: string
  precio: number
  cantidad: number
  clienteNombre: string
  imagenUrl?: string | null
  precioUnitario?: string // Para compatibilidad con ItemPedido
}

interface CarritoState {
  items: ItemCarrito[]
  addItem: (item: Omit<ItemCarrito, 'id'>) => void
  updateCantidad: (id: number, cantidad: number) => void
  removeItem: (id: number) => void
  clearCarrito: () => void
  getTotal: () => number
  getMisItems: (clienteNombre: string) => ItemCarrito[]
}

export const useCarritoStore = create<CarritoState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        set((state) => {
          // Generar ID único temporal
          const newId = Date.now() + Math.random()
          return {
            items: [...state.items, { ...item, id: newId }],
          }
        })
      },

      updateCantidad: (id, cantidad) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, cantidad } : item
          ),
        }))
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }))
      },

      clearCarrito: () => set({ items: [] }),

      getTotal: () => {
        const { items } = get()
        return items.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
      },

      getMisItems: (clienteNombre) => {
        const { items } = get()
        return items.filter((item) => item.clienteNombre === clienteNombre)
      },
    }),
    {
      name: 'piru-carrito-storage',
    }
  )
)

