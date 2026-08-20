import { buildWhatsappOrderMessage } from './whatsappOrderMessage'

type OrderInfo = Record<string, unknown>

type RestaurantWhatsappData = {
    nombre?: string | null
    direccion?: string | null
    telefono?: string | null
    comprobantesWhatsapp?: string | null
    transferenciaAlias?: string | null
}

function waMeDigits(phone: string | null | undefined): string | null {
    if (!phone?.trim()) return null
    const digits = phone.replace(/\D/g, '')
    return digits.length >= 8 ? digits : null
}

/**
 * Completa, con datos obtenidos del backend, el mensaje que el cliente envía
 * desde su propio WhatsApp. Devuelve false si no pudo preparar un envío seguro.
 */
export async function redirectPedidoAlWhatsapp(
    orderInfo: OrderInfo,
    restaurante: RestaurantWhatsappData | null | undefined,
    whatsappDestino?: string | null,
    transferenciaAliasDestino?: string | null,
): Promise<boolean> {
    const phone = waMeDigits(whatsappDestino || restaurante?.comprobantesWhatsapp || restaurante?.telefono)
    if (!phone) return false

    const completedOrderInfo = { ...orderInfo }
    const metodo = String(orderInfo?.metodoPago || '')
    if (metodo === 'mercadopago_checkout') {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
            const response = await fetch(`${apiUrl}/mp/crear-preferencia-externo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pedidoId: orderInfo.pedidoId }),
            })
            const data = await response.json()
            if (!response.ok || !data.success || !data.url_pago) return false
            completedOrderInfo.mercadoPagoCheckoutUrl = data.url_pago
        } catch {
            return false
        }
    }

    const effectiveMetodo = metodo === 'efectivo'
        ? 'cash'
        : metodo === 'transferencia'
            ? (orderInfo.aliasDinamico || orderInfo.cvuDinamico ? 'transferencia_automatica_cucuru' : 'manual_transfer')
            : metodo === 'mercadopago'
                ? 'mercadopago_bricks'
                : metodo

    const message = buildWhatsappOrderMessage(completedOrderInfo, {
        restaurantName: restaurante?.nombre,
        restaurantDireccion: restaurante?.direccion,
        effectiveMetodo,
        transferenciaAlias: transferenciaAliasDestino?.trim() || restaurante?.transferenciaAlias,
    })
    // Evitamos el redirect intermedio de wa.me: en algunos handoffs hacia
    // WhatsApp Desktop degrada caracteres Unicode. El endpoint web recibe el
    // teléfono y el texto directamente.
    const whatsappUrl = new URL('https://api.whatsapp.com/send')
    whatsappUrl.searchParams.set('phone', phone)
    whatsappUrl.searchParams.set('text', message)
    window.location.assign(whatsappUrl.toString())
    return true
}
