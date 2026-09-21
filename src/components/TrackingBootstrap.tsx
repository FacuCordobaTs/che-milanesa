import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { enviarEventosPendientes, obtenerSesionTracking } from '@/lib/tracking'
const USERNAME = 'chemilanesa', RUTAS = new Set(['mesa', 'sala', 'menu', 'pedido-confirmado', 'agregar-producto', 'pedido-cerrado', 'pago', 'factura', 'esperando-pedido', 'pedido', 'pago-exitoso', 'pago-fallido', 'pago-pendiente', 'c', 'r'])
// El clon es mono-local: toda ruta de tienda pertenece a este username y sólo se saltean
// las rutas de mesa/sala/pago y los resolvedores de campaña, que atribuyen por su cuenta.
// Antes se tomaba el primer segmento del path como username: en la tienda raíz (`/`) no
// había segmento, así que no se abría sesión de tracking.
export function TrackingBootstrap() { const location = useLocation(); useEffect(() => { const primero = location.pathname.split('/').filter(Boolean)[0]; if (!primero || !RUTAS.has(primero)) obtenerSesionTracking(USERNAME); void enviarEventosPendientes() }, [location.pathname]); useEffect(() => { const flush = () => void enviarEventosPendientes(); window.addEventListener('online', flush); const timer = window.setInterval(flush, 30000); return () => { window.removeEventListener('online', flush); window.clearInterval(timer) } }, []); return <Outlet /> }
