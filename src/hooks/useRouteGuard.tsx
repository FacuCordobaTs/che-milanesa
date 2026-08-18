import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useMesaStore } from '@/store/mesaStore'
import { useClienteWebSocket } from '@/hooks/useClienteWebSocket'

/**
 * Hook que protege las rutas redirigiendo al usuario a la pantalla correcta
 * según el estado del pedido. Esto previene que el usuario esté en una
 * pantalla incorrecta si navega hacia atrás o accede directamente a una URL.
 * 
 * @param allowedStates - Estados del pedido permitidos para esta ruta
 * @param options - Opciones adicionales:
 *   - redirectTo: Ruta a la que redirigir si el estado no es permitido (opcional)
 *   - disabled: Si es true, el guard no se ejecuta (útil para pantallas finales)
 */
export const useRouteGuard = (
  allowedStates: Array<'pending' | 'preparing' | 'closed' | 'delivered' | null>,
  options?: {
    redirectTo?: string
    disabled?: boolean
  }
) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { clienteNombre, qrToken, isHydrated, sessionEnded, restaurante } = useMesaStore()
  const { state: wsState } = useClienteWebSocket()
  const lastRedirectedState = useRef<string | null>(null)
  const redirectTo = options?.redirectTo
  const disabled = options?.disabled

  // Resetear el flag cuando cambia la ruta
  useEffect(() => {
    lastRedirectedState.current = null
  }, [location.pathname])

  useEffect(() => {
    if (disabled) return
    if (!isHydrated) return
    if (sessionEnded) return

    // Validación de datos del cliente
    if (!clienteNombre || !qrToken) {
      const redirectKey = `no-cliente-${location.pathname}`
      if (lastRedirectedState.current !== redirectKey) {
        lastRedirectedState.current = redirectKey
        navigate(`/mesa/${qrToken || 'invalid'}`, { replace: true })
      }
      return
    }

    const currentState = wsState?.estado || null
    const esCarrito = restaurante?.esCarrito === true

    // === LÓGICA MAESTRA DE REDIRECCIÓN ===
    let targetPath = ''
    let shouldRedirect = false

    // DETECCIÓN ROBUSTA DE MODO CARRITO
    // Aseguramos que si existe la bandera, se respete por encima de todo
    // (esCarrito ya fue declarado arriba: const esCarrito = restaurante?.esCarrito === true)

    // 1. PRIORIDAD ABSOLUTA: Modo Carrito
    if (esCarrito) {
      if (currentState === 'preparing' || currentState === 'delivered') {
        // En modo carrito, 'preparing' y 'delivered' SIEMPRE van a la pantalla de pago (pedido-cerrado)
        // o a esperando-pedido si ya pagó (esto lo maneja el componente PedidoCerrado)
        const validPaths = ['/pedido-cerrado', '/esperando-pedido']

        if (!validPaths.includes(location.pathname)) {
          targetPath = '/pedido-cerrado'
          shouldRedirect = true
        }
      }
      // Si no es preparing/delivered, dejamos que fluya o (opcionalmente) aplicamos reglas de pending
    }

    // 2. PRIORIDAD ESTÁNDAR: Si NO se activó una redirección de carrito, verificamos estados permitidos
    // Nota: El `else` aquí es implícito porque si `shouldRedirect` ya es true, no sobreescribimos
    if (!shouldRedirect) {
      // Si allowedStates no incluye el estado actual, DEBEMOS redirigir
      if (!allowedStates.includes(currentState as any)) {
        shouldRedirect = true

        if (redirectTo) {
          targetPath = redirectTo
        } else {
          // Lógica por defecto para RESTAURANTE (No Carrito)
          if (currentState === 'preparing' || currentState === 'delivered') {
            // CRÍTICO: Si por alguna razón estamos aquí y esCarrito es true (falso positivo anterior), 
            // NO mandarlo a pedido-confirmado.
            if (esCarrito) {
              targetPath = '/pedido-cerrado'
            } else {
              targetPath = '/pedido-confirmado'
            }
          } else if (currentState === 'closed') {
            targetPath = '/pedido-cerrado'
          } else {
            targetPath = '/menu'
          }
        }
      }
    }

    // Ejecutar redirección si es necesaria
    if (shouldRedirect && targetPath) {
      // Protección anti-bucle: Si ya estamos en el target, no hacer nada
      if (location.pathname === targetPath) return

      const redirectKey = `${location.pathname}-${currentState}-${targetPath}`
      if (lastRedirectedState.current === redirectKey) return

      console.log(`[RouteGuard] Redirecting from ${location.pathname} to ${targetPath} (State: ${currentState}, Carrito: ${esCarrito})`)
      lastRedirectedState.current = redirectKey
      navigate(targetPath, { replace: true })
    }
  }, [
    isHydrated,
    sessionEnded,
    clienteNombre,
    qrToken,
    wsState?.estado,
    allowedStates,
    redirectTo,
    disabled,
    navigate,
    location.pathname,
    restaurante?.esCarrito
  ])
}

