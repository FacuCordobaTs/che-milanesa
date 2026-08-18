import { useState, useEffect, useRef } from 'react'
import {  useLocation } from 'react-router'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

/**
 * Hook que previene la navegación hacia atrás en páginas críticas.
 * Muestra un modal de confirmación cuando el usuario intenta ir hacia atrás.
 * Si confirma, limpia el historial y cierra la ventana.
 * 
 * @param enabled - Si está habilitado el bloqueo de navegación hacia atrás
 * @param shouldPrevent - Función opcional que determina si debe prevenir la navegación.
 *                        Si retorna false, permite la navegación normal (útil para drawers).
 */
export const usePreventBackNavigation = (
  enabled: boolean = true,
  shouldPrevent: () => boolean = () => true
) => {
  const location = useLocation()
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [shouldClose, setShouldClose] = useState(false)
  const isInitialMount = useRef(true)
  const shouldPreventRef = useRef(shouldPrevent)

  // Mantener la referencia actualizada de shouldPrevent
  useEffect(() => {
    shouldPreventRef.current = shouldPrevent
  }, [shouldPrevent])

  useEffect(() => {
    if (!enabled) return

    // Resetear el flag cuando cambia la ruta para que cada página tenga su propia protección
    isInitialMount.current = true

    // Solo agregar la entrada al historial en el primer mount o cuando cambia la ruta
    if (isInitialMount.current) {
      // Reemplazar la entrada actual del historial para evitar que puedan volver atrás
      window.history.pushState(null, '', window.location.href)
      isInitialMount.current = false
    }

    const handlePopState = (event: PopStateEvent) => {
      // Si hay algún drawer o modal abierto, permitir la navegación normal
      if (!shouldPreventRef.current()) {
        return
      }

      // Prevenir la navegación por defecto
      event.preventDefault()
      
      // Mostrar el modal de confirmación
      setShowExitDialog(true)
    }

    // Agregar el listener para detectar cuando intentan ir hacia atrás
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [enabled, location.pathname])

  // Efecto para cerrar la ventana cuando el usuario confirma
  useEffect(() => {
    if (shouldClose) {
      // Limpiar el historial reemplazando la entrada actual
      window.history.replaceState(null, '', window.location.href)
      
      // Intentar cerrar la ventana
      // En algunos navegadores esto puede no funcionar si la ventana no fue abierta por script
      // En ese caso, redirigimos a una página en blanco
      try {
        window.close()
        // Si window.close() no funciona (ventana no abierta por script), redirigir
        setTimeout(() => {
          if (!document.hidden) {
            window.location.href = 'about:blank'
          }
        }, 100)
      } catch (error) {
        // Fallback: redirigir a una página en blanco
        window.location.href = 'about:blank'
      }
    }
  }, [shouldClose])

  const handleConfirmExit = () => {
    setShowExitDialog(false)
    setShouldClose(true)
  }

  const handleCancelExit = () => {
    setShowExitDialog(false)
    // Volver a agregar la entrada al historial para que el botón atrás funcione de nuevo
    // Solo si está habilitado
    if (enabled) {
      window.history.pushState(null, '', window.location.href)
    }
  }

  const ExitDialog = () => (
    <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
      <DialogContent className="max-w-sm rounded-3xl p-6">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
            <LogOut className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          <DialogTitle className="text-xl">¿Cerrar la aplicación?</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Si cierras la aplicación, perderás tu sesión actual. ¿Estás seguro de que quieres salir?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:gap-2 mt-4">
          <Button 
            size="lg" 
            onClick={handleConfirmExit}
            className="w-full rounded-2xl font-semibold bg-orange-600 hover:bg-orange-700 text-white"
          >
            Sí, cerrar aplicación
          </Button>
          <Button 
            variant="ghost" 
            size="lg"
            onClick={handleCancelExit}
            className="w-full rounded-2xl"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { ExitDialog }
}

