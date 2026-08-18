import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CreditCard, DollarSign, CheckCircle, ArrowLeft } from 'lucide-react'

// Datos de ejemplo del pedido completo
const pedidoCompletoEjemplo = [
  { id: 1, nombre: 'Pizza Margarita', cantidad: 2, precio: 12.50, cliente: 'Juan', subtotal: 25.00 },
  { id: 2, nombre: 'Coca Cola', cantidad: 1, precio: 2.50, cliente: 'María', subtotal: 2.50 },
  { id: 3, nombre: 'Hamburguesa Clásica', cantidad: 1, precio: 8.75, cliente: 'Pedro', subtotal: 8.75 },
  { id: 4, nombre: 'Papas Fritas', cantidad: 2, precio: 4.00, cliente: 'Juan', subtotal: 8.00 },
]

const Pago = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [metodoPago, setMetodoPago] = useState<'mercadopago' | 'efectivo' | null>(null)
  const [procesando, setProcesando] = useState(false)

  const total = pedidoCompletoEjemplo.reduce((sum, item) => sum + item.subtotal, 0)
  const subtotal = total
  const iva = total * 0.21
  const totalFinal = subtotal + iva

  const handlePagar = async () => {
    if (!metodoPago) return
    
    setProcesando(true)
    
    // Simular procesamiento de pago
    setTimeout(() => {
      setProcesando(false)
      navigate(`/factura?token=${searchParams.get('token')}&metodo=${metodoPago}`)
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Pago</h1>
              <p className="text-xs text-muted-foreground">Mesa 5</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Resumen del Pedido */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen del Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pedidoCompletoEjemplo.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div className="flex-1">
                  <p className="font-medium">{item.nombre}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-muted-foreground">
                      {item.cantidad}x ${item.precio.toFixed(2)}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {item.cliente}
                    </Badge>
                  </div>
                </div>
                <p className="font-semibold">${item.subtotal.toFixed(2)}</p>
              </div>
            ))}
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA (21%)</span>
                <span>${iva.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">${totalFinal.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métodos de Pago */}
        <Card>
          <CardHeader>
            <CardTitle>Método de Pago</CardTitle>
            <CardDescription>
              Selecciona cómo deseas pagar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant={metodoPago === 'mercadopago' ? 'default' : 'outline'}
              className="w-full justify-start h-auto p-4"
              onClick={() => setMetodoPago('mercadopago')}
            >
              <div className="flex items-center gap-4 w-full">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">MercadoPago</p>
                  <p className="text-sm text-muted-foreground">
                    Tarjeta de crédito o débito
                  </p>
                </div>
                {metodoPago === 'mercadopago' && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
            </Button>

            <Button
              variant={metodoPago === 'efectivo' ? 'default' : 'outline'}
              className="w-full justify-start h-auto p-4"
              onClick={() => setMetodoPago('efectivo')}
            >
              <div className="flex items-center gap-4 w-full">
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">Efectivo</p>
                  <p className="text-sm text-muted-foreground">
                    Pagar al mozo
                  </p>
                </div>
                {metodoPago === 'efectivo' && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* Botón de Pago */}
        <Button
          className="w-full"
          size="lg"
          disabled={!metodoPago || procesando}
          onClick={handlePagar}
        >
          {procesando ? (
            'Procesando...'
          ) : (
            <>
              <CheckCircle className="mr-2 h-5 w-5" />
              Pagar ${totalFinal.toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default Pago

