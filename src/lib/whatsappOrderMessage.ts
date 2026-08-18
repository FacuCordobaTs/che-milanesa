import { orderItemDisplayName, parseAgregadosList, orderItemLineSubtotalSession } from './orderSummaryItem'

/**
 * Arma el mensaje de WhatsApp con el detalle completo del pedido para que el
 * cliente se lo envíe al restaurante (flujo estilo "link in bio"). Es el canal
 * que reemplaza los avisos automáticos en el plan Básico: nada de esto le cuesta
 * a Piru porque lo manda el propio cliente desde su WhatsApp.
 *
 * Incluye: productos (con ingredientes quitados y extras), subtotal, envío,
 * descuento, total, método de pago (alias si se eligió transferencia), y la
 * dirección de delivery o el retiro en el local. Nunca incluye el teléfono.
 */
type BuildArgs = {
    restaurantName?: string | null
    restaurantDireccion?: string | null
    /** Método normalizado (getEffectiveMetodo): cash | manual_transfer | transferencia_automatica_* | mercadopago_* */
    effectiveMetodo: string
    /** Alias fijo del local (para transferencia manual). */
    transferenciaAlias?: string | null
}

const money = (n: number): string => `$${Math.round(n).toLocaleString('es-AR')}`

function paymentLine(orderInfo: any, effectiveMetodo: string, transferenciaAlias?: string | null): string {
    const aliasDinamico = orderInfo.aliasDinamico || orderInfo.cvuDinamico || null
    switch (effectiveMetodo) {
        case 'cash':
            return 'Efectivo'
        case 'manual_transfer':
            return transferenciaAlias ? `Transferencia · Alias: ${transferenciaAlias}` : 'Transferencia'
        case 'transferencia_automatica_cucuru':
        case 'transferencia_automatica_talo':
            return aliasDinamico ? `Transferencia · Alias: ${aliasDinamico}` : 'Transferencia'
        case 'mercadopago_checkout':
            return 'Mercado Pago'
        case 'mercadopago_bricks':
        case 'mercadopago':
            return 'Tarjeta (Mercado Pago)'
        default:
            return 'A coordinar'
    }
}

export function buildWhatsappOrderMessage(orderInfo: any, args: BuildArgs): string {
    const { restaurantName, restaurantDireccion, effectiveMetodo, transferenciaAlias } = args
    const items: any[] = Array.isArray(orderInfo?.items) ? orderInfo.items : []
    const esDelivery = orderInfo?.tipoPedido === 'delivery'

    const subtotal = items.reduce((s, it) => s + orderItemLineSubtotalSession(it), 0)
    const deliveryFee = esDelivery ? parseFloat(String(orderInfo?.deliveryFee ?? 0)) || 0 : 0
    const descuento = parseFloat(String(orderInfo?.montoDescuento ?? 0)) || 0
    const total = parseFloat(String(orderInfo?.total ?? 0)) || 0

    const L: string[] = []
    L.push(`¡Hola${restaurantName ? ` ${restaurantName}` : ''}! 👋 Te paso mi pedido:`)
    L.push('')
    if (orderInfo?.pedidoId) L.push(`🧾 *Pedido #${orderInfo.pedidoId}*`)
    if (orderInfo?.nombreCliente) L.push(`👤 ${orderInfo.nombreCliente}`)
    L.push('')

    L.push('*🛒 Productos*')
    for (const it of items) {
        const cantidad = it.cantidad ?? 1
        const linea = orderItemLineSubtotalSession(it)
        L.push(`• ${cantidad}x ${orderItemDisplayName(it)} — ${money(linea)}`)
        const sin: string[] = Array.isArray(it.ingredientesExcluidosNombres)
            ? it.ingredientesExcluidosNombres.filter(Boolean)
            : []
        if (sin.length > 0) L.push(`   ↳ Sin: ${sin.join(', ')}`)
        for (const ag of parseAgregadosList(it.agregados)) {
            const precio = parseFloat(String(ag.precio ?? 0)) || 0
            L.push(`   ↳ Con: ${ag.nombre}${precio > 0 ? ` (+${money(precio)})` : ''}`)
        }
    }
    L.push('')

    L.push('*💰 Resumen*')
    L.push(`Subtotal: ${money(subtotal)}`)
    if (esDelivery) L.push(`Envío${orderInfo?.zonaNombre ? ` (${orderInfo.zonaNombre})` : ''}: ${deliveryFee === 0 ? 'Gratis' : money(deliveryFee)}`)
    if (descuento > 0) L.push(`Descuento: -${money(descuento)}`)
    L.push(`*Total: ${money(total)}*`)
    L.push('')

    L.push(`*💳 Pago:* ${paymentLine(orderInfo, effectiveMetodo, transferenciaAlias)}`)
    L.push('')

    if (esDelivery) {
        L.push('*🛵 Entrega:* Delivery')
        if (orderInfo?.direccion) L.push(`📍 ${orderInfo.direccion}`)
    } else {
        L.push('*🏪 Retiro en el local*')
        if (restaurantDireccion) L.push(`📍 ${restaurantDireccion}`)
    }
    if (orderInfo?.horarioProgramado) L.push(`⏰ Programado: ${orderInfo.horarioProgramado}`)

    if (orderInfo?.notas) {
        L.push('')
        L.push(`📝 ${orderInfo.notas}`)
    }

    return L.join('\n')
}
