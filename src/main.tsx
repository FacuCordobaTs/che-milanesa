import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Toaster } from 'sonner'
import { ThemeProvider } from './components/ThemeProvider'
import Nombre from './pages/Nombre'
import Menu from './pages/Menu'
import PedidoConfirmado from './pages/PedidoConfirmado'
import AgregarProducto from './pages/AgregarProducto'
import PedidoCerrado from './pages/PedidoCerrado'
import Pago from './pages/Pago'
import Factura from './pages/Factura'
import { PagoExitoso, PagoFallido, PagoPendiente } from './pages/PagoResultado'
import EsperandoPedido from './pages/EsperandoPedido'
import MenuDelivery from './pages/MenuDelivery'
import CheckoutDelivery from './pages/CheckoutDelivery'
import SuccessDelivery from './pages/SuccessDelivery'
import SuccessGrupal from './pages/SuccessGrupal'
import PedidoStatus from './pages/PedidoStatus'

const router = createBrowserRouter([
  {
    path: "/",
    element: <MenuDelivery />,
  },
  {
    path: "/mesa/:qrToken",
    element: <Nombre />,
  },
  {
    path: "/sala/:qrToken/nombre",
    element: <Nombre />,
  },
  {
    path: "/sala/:qrToken",
    element: <Menu />,
  },
  {
    path: "/sala/:qrToken/success",
    element: <SuccessGrupal />,
  },
  {
    path: "/menu",
    element: <Menu />,
  },
  {
    path: "/pedido-confirmado",
    element: <PedidoConfirmado />,
  },
  {
    path: "/agregar-producto",
    element: <AgregarProducto />,
  },
  {
    path: "/pedido-cerrado",
    element: <PedidoCerrado />,
  },
  {
    path: "/pago",
    element: <Pago />,
  },
  {
    path: "/factura",
    element: <Factura />,
  },
  {
    path: "/esperando-pedido",
    element: <EsperandoPedido />,
  },
  // Rutas de resultado de pago de MercadoPago
  {
    path: "/pago-exitoso",
    element: <PagoExitoso />,
  },
  {
    path: "/pago-fallido",
    element: <PagoFallido />,
  },
  {
    path: "/pago-pendiente",
    element: <PagoPendiente />,
  },
  // También soportar las rutas con el qrToken en el path (legacy)
  {
    path: "/mesa/:qrToken/pago-exitoso",
    element: <PagoExitoso />,
  },
  {
    path: "/mesa/:qrToken/pago-fallido",
    element: <PagoFallido />,
  },
  {
    path: "/mesa/:qrToken/pago-pendiente",
    element: <PagoPendiente />,
  },
  {
    path: "/checkout",
    element: <CheckoutDelivery />,
  },
  {
    path: "/pedido/:id",
    element: <PedidoStatus />,
  },
  {
    path: "/success",
    element: <SuccessDelivery />,
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="piru-ui-theme">
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        richColors
        closeButton
      />
    </ThemeProvider>
  </StrictMode>,
)
