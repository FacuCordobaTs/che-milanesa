import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useMesaStore } from '@/store/mesaStore'
import { CheckCircle2, XCircle, Clock, Home, Sparkles, Download, Loader2 } from 'lucide-react'
import { toPng } from 'html-to-image'

type ResultadoTipo = 'success' | 'failure' | 'pending'

interface Props {
  tipo: ResultadoTipo
}

const PagoResultado = ({ tipo }: Props) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { restaurante, mesa, endSession, reset, clearPedidoCerrado, pedidoCerrado } = useMesaStore()
  
  const pedidoId = searchParams.get('pedido_id')
  
  // Ref para el recibo que vamos a capturar
  const reciboRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  
  // Datos del pedido para el ticket
  const items = pedidoCerrado?.items || []
  const totalPedido = pedidoCerrado?.total || '0.00'
  const total = parseFloat(totalPedido)
  const numeroFactura = `FAC-${Date.now().toString().slice(-6)}`
  const fecha = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  // Agrupar items por cliente
  const itemsPorCliente = items.reduce((acc, item) => {
    const cliente = item.clienteNombre || 'Sin nombre'
    if (!acc[cliente]) acc[cliente] = []
    acc[cliente].push(item)
    return acc
  }, {} as Record<string, typeof items>)
  
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

  // Si el pago fue exitoso, terminar la sesión
  useEffect(() => {
    if (tipo === 'success') {
      endSession()
    }
  }, [tipo, endSession])

  const handleNuevoEscaneo = () => {
    reset()
    clearPedidoCerrado()
    navigate('/')
  }

  const config = {
    success: {
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: '¡Pago exitoso!',
      subtitle: 'Tu pago ha sido procesado correctamente',
      description: 'Gracias por tu compra. El restaurante ha recibido la confirmación del pago.',
    },
    failure: {
      icon: XCircle,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      title: 'Pago rechazado',
      subtitle: 'No se pudo procesar tu pago',
      description: 'Por favor, intenta con otro método de pago o contacta a tu banco.',
    },
    pending: {
      icon: Clock,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: 'Pago pendiente',
      subtitle: 'Tu pago está siendo procesado',
      description: 'Recibirás una confirmación cuando el pago sea aprobado.',
    },
  }

  const current = config[tipo]
  const Icon = current.icon

  return (
    <div className="min-h-screen bg-linear-to-b from-neutral-100 to-neutral-200 dark:from-neutral-950 dark:to-neutral-900 flex flex-col">
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Success animation for approved payments */}
        {tipo === 'success' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-emerald-300 rounded-full animate-ping delay-100" />
            <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-emerald-500 rounded-full animate-ping delay-200" />
          </div>
        )}

        {/* Icon */}
        <div className={`p-6 rounded-full ${current.iconBg} mb-6 animate-in zoom-in duration-500`}>
          <Icon className={`w-16 h-16 ${current.iconColor}`} />
        </div>

        {/* Restaurant info */}
        {restaurante && (
          <div className="flex items-center gap-3 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            {restaurante.imagenUrl ? (
              <img 
                src={restaurante.imagenUrl} 
                alt={restaurante.nombre || 'Restaurante'}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-neutral-400" />
              </div>
            )}
            <div className="text-left">
              <p className="font-semibold text-neutral-900 dark:text-white">
                {restaurante.nombre || 'Restaurante'}
              </p>
              {mesa && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Mesa {mesa.nombre}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white text-center mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          {current.title}
        </h1>
        
        <p className="text-neutral-600 dark:text-neutral-400 text-center mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          {current.subtitle}
        </p>
        
        <p className="text-sm text-neutral-500 dark:text-neutral-500 text-center max-w-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
          {current.description}
        </p>

        {pedidoId && (
          <p className="text-xs text-neutral-400 dark:text-neutral-600 mb-8 animate-in fade-in duration-500 delay-500">
            Pedido #{pedidoId}
          </p>
        )}

        {/* Ticket/Recibo - Solo para pagos exitosos con items */}
        {tipo === 'success' && items.length > 0 && (
          <div className="w-full max-w-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
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
                backgroundColor: '#f0f9ff',
              }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  marginBottom: '8px',
                  backgroundColor: '#e0f2fe',
                  fontSize: '20px',
                }}>
                  💳
                </div>
                <p style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#0c4a6e',
                  margin: 0,
                }}>
                  Pagado con MercadoPago
                </p>
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
            
            {/* Botón de descarga */}
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 mt-4"
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
          </div>
        )}

        {/* Actions */}
        <div className="w-full max-w-xs space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
          {tipo === 'success' && (
            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              Puedes cerrar esta pestaña
            </p>
          )}
          
          {tipo === 'failure' && (
            <Button
              onClick={() => navigate('/pedido-cerrado')}
              className="w-full h-12 rounded-xl"
            >
              Intentar de nuevo
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={handleNuevoEscaneo}
            className="w-full h-12 rounded-xl"
          >
            <Home className="w-4 h-4 mr-2" />
            Nuevo escaneo
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="pb-6 pt-4 text-center">
        <p className="text-[10px] text-neutral-300 dark:text-neutral-700 font-medium tracking-wider uppercase">
          Powered by Piru
        </p>
      </div>
    </div>
  )
}

// Export wrapper components for each result type
export const PagoExitoso = () => <PagoResultado tipo="success" />
export const PagoFallido = () => <PagoResultado tipo="failure" />
export const PagoPendiente = () => <PagoResultado tipo="pending" />

export default PagoResultado

