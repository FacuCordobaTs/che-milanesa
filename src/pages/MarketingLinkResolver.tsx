import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import MenuDelivery, { type CampanaPublica } from './MenuDelivery'
import { contextoParaResolverMarketing, guardarContextoTracking, limpiarContextoTracking } from '@/lib/tracking'
const API_URL = (import.meta.env.VITE_API_URL || 'https://api.piru.app/api').replace(/\/$/, ''), USERNAME = 'chemilanesa'
type Destino = { tipo: 'tienda' } | { tipo: 'producto'; productoId: number } | { tipo: 'carrito'; carritoRep: string }
type Beneficio = { codigoDescuentoId: number; codigo: string }
type Respuesta = { data?: { encontrada?: boolean; destino?: Destino; contexto?: { campaniaSlug?: string; campanaId?: number }; beneficio?: Beneficio; campana?: CampanaPublica } }
const urlDestino = (destino?: Destino) => destino?.tipo === 'producto' ? `/?producto=${destino.productoId}` : destino?.tipo === 'carrito' ? `/?rep=${encodeURIComponent(destino.carritoRep)}` : '/'
async function resolverLink(endpoint: 'campanas' | 'recetas', identificador: string, signal: AbortSignal): Promise<Respuesta | null> { try { const res = await fetch(`${API_URL}/public/marketing/${endpoint}/${USERNAME}/${encodeURIComponent(identificador)}?${new URLSearchParams(contextoParaResolverMarketing(USERNAME))}`, { signal }); return res.ok ? await res.json() : null } catch { return null } }
/** La campaña es una landing real: MenuDelivery se monta en /c/:slug y la URL no se
 * reemplaza. Esto conserva el contexto durante toda la compra en sheet. */
export function CampanaLinkResolver() {
    const { slug } = useParams()
    const [resuelta, setResuelta] = useState(false)
    const [campana, setCampana] = useState<CampanaPublica | null>(null)
    useEffect(() => {
        if (!slug) { setResuelta(true); return }
        setResuelta(false); setCampana(null)
        const abortador = new AbortController(), timeout = window.setTimeout(() => abortador.abort(), 4_000)
        let activo = true
        void resolverLink('campanas', slug, abortador.signal).then((respuesta) => {
            if (!activo) return
            window.clearTimeout(timeout)
            const datos = respuesta?.data, base = datos?.campana, destino = datos?.destino
            if (!datos?.encontrada || !datos.contexto?.campaniaSlug) { limpiarContextoTracking(USERNAME); setResuelta(true); return }
            guardarContextoTracking({ username: USERNAME, campaniaSlug: datos.contexto.campaniaSlug, campanaId: datos.contexto.campanaId, codigoPromocional: datos.beneficio?.codigo })
            setCampana({
                campanaId: base?.campanaId ?? datos.contexto.campanaId ?? 0,
                nombre: base?.nombre ?? '',
                slug: base?.slug ?? datos.contexto.campaniaSlug,
                tipo: base?.tipo,
                destinoTipo: destino?.tipo ?? base?.destinoTipo,
                productoId: destino?.tipo === 'producto' ? destino.productoId : (base?.productoId ?? null),
                carritoRep: destino?.tipo === 'carrito' ? destino.carritoRep : (base?.carritoRep ?? null),
                descuentoPorcentaje: base?.descuentoPorcentaje ?? 0,
                limiteUsos: base?.limiteUsos ?? null,
                usosActuales: base?.usosActuales ?? 0,
                usosRestantes: base?.usosRestantes ?? null,
                fechaInicio: base?.fechaInicio ?? null,
                fechaFin: base?.fechaFin ?? null,
            })
            setResuelta(true)
        })
        return () => { activo = false; window.clearTimeout(timeout); abortador.abort() }
    }, [slug])
    if (!resuelta) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Cargando promoción…</div>
    return <MenuDelivery campana={campana} />
}
function RecetaResolver() { const navigate = useNavigate(), { token } = useParams(); useEffect(() => { if (!token) return; const abort = new AbortController(), timeout = window.setTimeout(() => abort.abort(), 4_000); let activo = true; void resolverLink('recetas', token, abort.signal).then((respuesta) => { if (!activo) return; window.clearTimeout(timeout); if (respuesta?.data?.encontrada) guardarContextoTracking({ username: USERNAME, recetaToken: token, codigoPromocional: respuesta.data.beneficio?.codigo }); navigate(urlDestino(respuesta?.data?.destino), { replace: true }) }); return () => { activo = false; window.clearTimeout(timeout); abort.abort() } }, [navigate, token]); return null }
export const RecetaLinkResolver = () => <RecetaResolver />
