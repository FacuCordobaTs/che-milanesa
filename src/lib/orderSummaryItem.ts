export type AgregadoLine = { id?: number; nombre: string; precio?: string | number }

export function parseAgregadosList(raw: unknown): AgregadoLine[] {
    if (!raw) return []
    if (Array.isArray(raw)) {
        return raw.filter((a): a is AgregadoLine => a != null && typeof a === 'object' && 'nombre' in a)
    }
    if (typeof raw === 'string') {
        try {
            const p = JSON.parse(raw)
            return Array.isArray(p) ? parseAgregadosList(p) : []
        } catch {
            return []
        }
    }
    return []
}

export function orderItemDisplayName(item: {
    nombre?: string
    nombreProducto?: string
    varianteNombre?: string | null
}): string {
    const n = item.nombre?.trim()
    if (n) return n
    const base = item.nombreProducto?.trim() || 'Producto'
    const v = item.varianteNombre?.trim()
    return v ? `${base} - ${v}` : base
}

/** Ítems del carrito / session: `precio` ya incluye agregados. */
export function orderItemLineSubtotalSession(item: { precio?: string | number; cantidad?: number }): number {
    const qty = item.cantidad ?? 1
    return parseFloat(String(item.precio ?? 0)) * qty
}

function extraUnitFromAgregados(item: any): number {
    return parseAgregadosList(item.agregados).reduce(
        (s, ag) => s + (parseFloat(String(ag.precio ?? 0)) || 0),
        0,
    )
}

/** Costo de envío inferido cuando el backend aún no envía `deliveryFeeCobrado` (clientes viejos). */
export function inferDeliveryFeeCobrado(
    items: any[],
    opts: { orderTotal: number; montoDescuento?: number | string | null; tipoPedido?: string },
): number {
    if (opts.tipoPedido !== 'delivery') return 0
    const T = opts.orderTotal
    const D = parseFloat(String(opts.montoDescuento ?? 0)) || 0
    const adjusted = T + D
    const qty = (i: any) => i.cantidad ?? 1
    const unit = (i: any) => parseFloat(String(i.precio ?? i.precioUnitario ?? 0)) || 0
    const sumPlain = items.reduce((s, i) => s + unit(i) * qty(i), 0)
    const sumWithExtras = items.reduce((s, i) => s + (unit(i) + extraUnitFromAgregados(i)) * qty(i), 0)
    const F1 = adjusted - sumPlain
    const F2 = adjusted - sumWithExtras
    const tol = 0.05
    let F = F1
    if (F2 >= -tol && F2 < F1 - tol) F = F2
    return Math.max(0, F)
}

/**
 * Ítems desde API: en pedidos antiguos `precioUnitario` no incluía agregados.
 * `deliveryFeeCobrado` debe ser el envío real del pedido (p. ej. zona), no el fee global del restaurante.
 */
export function orderItemLineSubtotalsFromApi(
    items: any[],
    opts: {
        orderTotal: number
        montoDescuento?: number | string | null
        deliveryFeeCobrado?: number | string | null
        tipoPedido?: string
    },
): number[] {
    const disc = parseFloat(String(opts.montoDescuento ?? 0)) || 0
    const fee =
        opts.tipoPedido === 'delivery'
            ? parseFloat(String(opts.deliveryFeeCobrado ?? 0)) || 0
            : 0
    const itemsOnlyTarget = opts.orderTotal - fee + disc

    const qty = (i: any) => i.cantidad ?? 1
    const unit = (i: any) => parseFloat(String(i.precio ?? i.precioUnitario ?? 0)) || 0

    const sumPlain = items.reduce((s, i) => s + unit(i) * qty(i), 0)
    const sumWithExtras = items.reduce((s, i) => s + (unit(i) + extraUnitFromAgregados(i)) * qty(i), 0)

    const tol = 0.05
    const plainOk = Math.abs(itemsOnlyTarget - sumPlain) < tol
    const extrasOk = Math.abs(itemsOnlyTarget - sumWithExtras) < tol
    const legacyAddExtras = extrasOk && !plainOk

    return items.map((i) => {
        const q = qty(i)
        const u = unit(i)
        const ex = extraUnitFromAgregados(i)
        const effectiveUnit = legacyAddExtras && ex > 0 ? u + ex : u
        return effectiveUnit * q
    })
}
