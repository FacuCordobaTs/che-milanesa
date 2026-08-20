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

// Símbolos del BMP (máximo tres bytes en UTF-8). El handoff web/escritorio de
// WhatsApp de algunos equipos reemplaza los emojis astrales de cuatro bytes
// por `�`, aunque la URL original esté bien codificada. Estos símbolos son
// visuales, legibles y sobreviven ese recorrido completo.
const EMOJI = {
    saludo: '\u263A',
    pedido: '\u2116',
    cliente: '\u2022',
    productos: '\u25A3',
    resumen: '$',
    pago: '\u25A4',
    enlace: '\u279C',
    delivery: '\u279C',
    ubicacion: '\u2316',
    retiro: '\u2302',
    horario: '\u25F7',
    notas: '\u270E',
} as const

/** Categoría del ítem (varios nombres posibles según el origen). 'Otros' si no la trae. */
function itemCategoria(it: any): string {
    const c = (it?.categoria ?? it?.categoriaNombre ?? '').toString().trim()
    return c || 'Otros'
}

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
    L.push(`¡Hola${restaurantName ? ` ${restaurantName}` : ''}! ${EMOJI.saludo} Te paso mi pedido:`)
    L.push('')
    if (orderInfo?.pedidoId) L.push(`${EMOJI.pedido} *Pedido #${orderInfo.pedidoId}*`)
    if (orderInfo?.nombreCliente) L.push(`${EMOJI.cliente} ${orderInfo.nombreCliente}`)
    L.push('')

    const pushItem = (it: any) => {
        const cantidad = it.cantidad ?? 1
        const linea = orderItemLineSubtotalSession(it)
        L.push(`• ${cantidad}x ${orderItemDisplayName(it)} — ${money(linea)}`)
        const sin: string[] = Array.isArray(it.ingredientesExcluidosNombres)
            ? it.ingredientesExcluidosNombres.filter(Boolean)
            : []
        if (sin.length > 0) L.push(`   ↳ Sin: ${sin.join(', ')}`)
        for (const ag of parseAgregadosList(it.agregados)) {
            const precio = parseFloat(String(ag.precio ?? 0)) || 0
            L.push(`   ↳ Extra: ${ag.nombre}${precio > 0 ? ` (+${money(precio)})` : ''}`)
        }
    }

    // Agrupar por categoría, preservando el orden de aparición de cada categoría.
    const grupos: { categoria: string; items: any[] }[] = []
    for (const it of items) {
        const cat = itemCategoria(it)
        let g = grupos.find((x) => x.categoria === cat)
        if (!g) { g = { categoria: cat, items: [] }; grupos.push(g) }
        g.items.push(it)
    }

    L.push(`*${EMOJI.productos} Productos*`)
    // Siempre agrupamos por categoría, aunque sea una sola: el encabezado de la
    // categoría ayuda a leer el pedido en WhatsApp.
    grupos.forEach((g, idx) => {
        if (idx > 0) L.push('')
        L.push(`_${g.categoria}_`)
        for (const it of g.items) pushItem(it)
    })
    L.push('')

    L.push(`*${EMOJI.resumen} Resumen*`)
    L.push(`Subtotal: ${money(subtotal)}`)
    if (esDelivery) L.push(`Envío${orderInfo?.zonaNombre ? ` (${orderInfo.zonaNombre})` : ''}: ${deliveryFee === 0 ? 'Gratis' : money(deliveryFee)}`)
    if (descuento > 0) L.push(`Descuento: -${money(descuento)}`)
    L.push(`*Total: ${money(total)}*`)
    L.push('')

    L.push(`*${EMOJI.pago} Pago:* ${paymentLine(orderInfo, effectiveMetodo, transferenciaAlias)}`)
    if (effectiveMetodo === 'mercadopago_checkout' && orderInfo?.mercadoPagoCheckoutUrl) {
        L.push(`${EMOJI.enlace} *Para el cliente:* pagá tu pedido desde este link:`)
        L.push(String(orderInfo.mercadoPagoCheckoutUrl))
    }
    L.push('')

    if (esDelivery) {
        L.push(`*${EMOJI.delivery} Entrega:* Delivery`)
        if (orderInfo?.direccion) L.push(`${EMOJI.ubicacion} ${orderInfo.direccion}`)
    } else {
        L.push(`*${EMOJI.retiro} Retiro en el local*`)
        if (restaurantDireccion) L.push(`${EMOJI.ubicacion} ${restaurantDireccion}`)
    }
    if (orderInfo?.horarioProgramado) L.push(`${EMOJI.horario} Programado: ${orderInfo.horarioProgramado}`)

    if (orderInfo?.notas) {
        L.push('')
        L.push(`${EMOJI.notas} ${orderInfo.notas}`)
    }

    return L.join('\n')
}
