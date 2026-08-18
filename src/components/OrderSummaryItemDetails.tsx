import { parseAgregadosList, orderItemDisplayName } from '@/lib/orderSummaryItem'

export function OrderSummaryItemDetails({ item }: { item: any }) {
    const agregados = parseAgregadosList(item.agregados)
    const sin: string[] = Array.isArray(item.ingredientesExcluidosNombres)
        ? item.ingredientesExcluidosNombres.filter(Boolean)
        : []

    return (
        <div className="min-w-0">
            <p className="font-medium text-sm leading-tight">{orderItemDisplayName(item)}</p>
            {sin.length > 0 ? (
                <p className="text-xs text-muted-foreground mt-0.5">Sin: {sin.join(', ')}</p>
            ) : null}
            {agregados.map((ag, idx) => (
                <p key={ag.id ?? `ag-${idx}`} className="text-xs text-primary/85 font-medium mt-0.5">
                    Con: {ag.nombre}
                    {ag.precio != null && parseFloat(String(ag.precio)) > 0
                        ? ` (+$${parseFloat(String(ag.precio)).toFixed(2)})`
                        : ''}
                </p>
            ))}
        </div>
    )
}
