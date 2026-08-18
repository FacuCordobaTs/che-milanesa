import { useSearchParams } from 'react-router'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, Download, Home, Loader2 } from 'lucide-react'
import { usePreventBackNavigation } from '@/hooks/usePreventBackNavigation'
import { useMesaStore } from '@/store/mesaStore'
import { toPng } from 'html-to-image'

const Factura = () => {
  const [searchParams] = useSearchParams()
  const { pedidoCerrado, mesa, restaurante } = useMesaStore()
  const metodoPago = searchParams.get('metodo') || 'efectivo'
  const numeroFactura = `FAC-${Date.now().toString().slice(-6)}`
  const fecha = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  // Ref para el recibo que vamos a capturar
  const reciboRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // Hook para prevenir navegación hacia atrás
  const { ExitDialog } = usePreventBackNavigation(true)

  // Usar datos del pedido cerrado del store
  const items = pedidoCerrado?.items || []
  const totalPedido = pedidoCerrado?.total || '0.00'
  const total = parseFloat(totalPedido)

  const handleDescargar = async () => {
    if (!reciboRef.current) return
    
    setIsDownloading(true)
    
    try {
      const dataUrl = await toPng(reciboRef.current, {
        quality: 1,
        pixelRatio: 2, // Mayor calidad
        backgroundColor: '#f5f5f5',
      })
      
      // Descargar imagen
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

  // Agrupar items por cliente
  const itemsPorCliente = items.reduce((acc, item) => {
    const cliente = item.clienteNombre || 'Sin nombre'
    if (!acc[cliente]) acc[cliente] = []
    acc[cliente].push(item)
    return acc
  }, {} as Record<string, typeof items>)

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

        {/* Recibo/Factura estilo ticket - con estilos inline para captura de imagen */}
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
              <p style={{ margin: 0 }}>Factura N° {numeroFactura}</p>
              <p style={{ margin: 0 }}>{fecha}</p>
            </div>
          </div>

          {/* Lista de productos agrupados por usuario */}
          <div style={{ padding: '16px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(itemsPorCliente).length > 0 ? (
                Object.entries(itemsPorCliente).map(([cliente, clienteItems], idx) => {
                  const subtotalCliente = clienteItems.reduce((sum, item) => {
                    return sum + (parseFloat(item.precioUnitario || '0') * (item.cantidad || 1))
                  }, 0)

                  return (
                    <div key={cliente} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Nombre del cliente */}
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
                      
                      {/* Productos del cliente */}
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
                              {(item as any).ingredientesExcluidosNombres && (item as any).ingredientesExcluidosNombres.length > 0 && (
                                <p style={{
                                  fontSize: '12px',
                                  color: '#ea580c',
                                  fontWeight: '500',
                                  marginTop: '2px',
                                  margin: '2px 0 0 0',
                                }}>
                                  ⚠️ Sin: {(item as any).ingredientesExcluidosNombres.join(', ')}
                                </p>
                              )}
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
                      
                      {/* Subtotal del cliente */}
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
                      
                      {/* Separador entre clientes */}
                      {idx < Object.keys(itemsPorCliente).length - 1 && (
                        <div style={{ paddingTop: '8px' }} />
                      )}
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

          {/* Separador estilo ticket */}
          <div style={{ position: 'relative', padding: '0 24px' }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              width: '16px',
              height: '16px',
              backgroundColor: '#f5f5f5',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
            }} />
            <div style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              width: '16px',
              height: '16px',
              backgroundColor: '#f5f5f5',
              borderRadius: '50%',
              transform: 'translate(50%, -50%)',
            }} />
            <div style={{ borderTop: '1px dashed #e5e5e5' }} />
          </div>

          {/* Total */}
          <div style={{ padding: '16px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#171717' }}>TOTAL</span>
              <span style={{ fontSize: '24px', fontWeight: '900', color: '#171717' }}>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Separador estilo ticket */}
          <div style={{ position: 'relative', padding: '0 24px' }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              width: '16px',
              height: '16px',
              backgroundColor: '#f5f5f5',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
            }} />
            <div style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              width: '16px',
              height: '16px',
              backgroundColor: '#f5f5f5',
              borderRadius: '50%',
              transform: 'translate(50%, -50%)',
            }} />
            <div style={{ borderTop: '1px dashed #e5e5e5' }} />
          </div>
          
          {/* Info de método de pago */}
          <div style={{
            padding: '16px 24px',
            textAlign: 'center',
            backgroundColor: metodoPago === 'mercadopago' ? '#f0f9ff' : '#fffbeb',
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              marginBottom: '8px',
              backgroundColor: metodoPago === 'mercadopago' ? '#e0f2fe' : '#fef3c7',
              fontSize: '20px',
            }}>
              {metodoPago === 'mercadopago' ? '💳' : '💵'}
            </div>
            <p style={{
              fontSize: '14px',
              fontWeight: '600',
              color: metodoPago === 'mercadopago' ? '#0c4a6e' : '#78350f',
              margin: 0,
            }}>
              {metodoPago === 'mercadopago' ? 'Pagado con MercadoPago' : 'Pago en efectivo'}
            </p>
            {metodoPago === 'efectivo' && (
              <p style={{ fontSize: '12px', color: '#b45309', marginTop: '4px', margin: '4px 0 0 0' }}>
                Acércate a la caja para abonar
              </p>
            )}
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

        {/* Acciones */}
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

      {/* Dialog para prevenir navegación hacia atrás */}
      <ExitDialog />
    </div>
  )
}

export default Factura

