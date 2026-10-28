import type { ReactNode } from 'react'
import { ArrowRight, ArrowUp, Instagram, Loader2, MapPin, Sparkles } from 'lucide-react'
import { DIAS, INSTAGRAM_URL, PIRU_URL, SEMANA, turnosDelDia, type Turno } from '@/lib/marcaChe'

// Piezas de la identidad de Che Milanesa que comparten la carta (MenuDelivery) y el pedido en grupo
// (Menu). Simple, con lo que ya usa la marca en sus redes: el amarillo #fdb700 sobre negro, la letra
// slab del logo (`font-che`), el damero amarillo y negro y el degradé amarillo→naranja de las promos.
// Lo de adentro de la carta (fichas, drawers) sigue con las variables del tema.

/** Bloque negro de arriba: el logo y, a la derecha, lo que pase la página (estado, mis pedidos). */
export function HeaderChe({ children }: { children?: ReactNode }) {
    return (
        <header className="bg-[#111] text-white">
            <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-3 px-5 lg:max-w-5xl xl:max-w-6xl">
                <img src="/logo-che.png" alt="Che Milanesa" className="h-8 w-auto shrink-0" />
                <div className="flex min-w-0 items-center gap-2">{children}</div>
            </div>
        </header>
    )
}

export function EstadoChe({ abierto, texto }: { abierto: boolean; texto: string }) {
    return (
        <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
            <span className={`size-2 shrink-0 rounded-full ${abierto ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="truncate">{texto}</span>
        </span>
    )
}

/** La franja a cuadros amarilla y negra de las historias de Che. */
export const Damero = () => (
    <div
        aria-hidden
        className="h-6 w-full bg-[conic-gradient(#fdb700_25%,#111_0_50%,#fdb700_0_75%,#111_0)] bg-[length:24px_24px]"
    />
)

/** Título de sección: letra slab y una rayita amarilla debajo. */
export function TituloSeccionChe({ titulo, detalle }: { titulo: string; detalle?: string }) {
    return (
        <div className="flex items-end justify-between gap-3 px-1">
            <h2 className="font-che min-w-0 text-[22px] uppercase leading-none text-foreground sm:text-2xl">
                {titulo}
                <span aria-hidden className="mt-2 block h-1 w-10 rounded-full bg-[#fdb700]" />
            </h2>
            {detalle && <span className="shrink-0 pb-3 text-xs font-semibold text-muted-foreground">{detalle}</span>}
        </div>
    )
}

/** Las promos de la semana, en el degradé de los posts de Che. Adentro van las fichas de siempre. */
export function PanelPromos({ titulo, cantidad, children }: { titulo: string; cantidad: number; children: ReactNode }) {
    return (
        <section aria-label={titulo} className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#fdb700] via-[#f99a1c] to-[#f2612a] p-4 shadow-[0_18px_40px_-18px_rgba(242,97,42,0.7)] sm:p-6">
            <div className="mb-4 px-1 text-[#111]">
                <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]">
                    <span className="opacity-70">Exclusivas de la web</span>
                    <span className="rounded-full bg-[#111] px-2.5 py-0.5 tracking-normal text-[#fdb700] normal-case">
                        {cantidad} {cantidad === 1 ? 'promo' : 'promos'}
                    </span>
                </p>
                <h2 className="font-che mt-2 text-[26px] uppercase leading-[0.95] sm:text-3xl">{titulo}</h2>
            </div>
            {children}
        </section>
    )
}

/** Puntos: cuántos tiene, cuánto le falta para el próximo canje y, debajo, los canjes. */
export function PanelPuntos({ puntos, cargando, ritmo, proximo, onIdentificar, children }: {
    puntos: number | null
    cargando?: boolean
    ritmo?: string | null
    proximo: { costo: number; faltan: number; porcentaje: number } | null
    onIdentificar: () => void
    children?: ReactNode
}) {
    return (
        <section aria-label="Tus puntos" className="overflow-hidden rounded-[28px] bg-[#111] text-white">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
                <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#fdb700]">
                        <Sparkles className="size-3.5" /> Tus puntos
                    </p>
                    {puntos === null ? (
                        <p className="font-che mt-1.5 text-2xl leading-tight">Sumá con cada pedido</p>
                    ) : (
                        <p className="font-che mt-1 text-4xl leading-none tabular-nums text-[#fdb700]">
                            {puntos.toLocaleString('es-AR')} <span className="text-lg text-white">pts</span>
                        </p>
                    )}
                    {ritmo && <p className="mt-1.5 text-xs text-white/60">{ritmo}</p>}
                </div>
                {puntos === null && (
                    <button
                        type="button"
                        onClick={onIdentificar}
                        className="inline-flex h-11 items-center gap-2 rounded-full bg-[#fdb700] px-5 text-sm font-bold text-[#111] transition-transform active:scale-95"
                    >
                        {cargando ? <Loader2 className="size-4 animate-spin" /> : null}
                        Ver mis puntos
                    </button>
                )}
            </div>

            {puntos !== null && (
                <div className="px-5 pb-5 sm:px-6">
                    {proximo ? (
                        <>
                            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-[#fdb700] transition-[width] duration-700" style={{ width: `${proximo.porcentaje}%` }} />
                            </div>
                            <p className="mt-2 text-xs text-white/70">
                                Te faltan <strong className="text-white tabular-nums">{proximo.faltan.toLocaleString('es-AR')} pts</strong> para tu próximo canje.
                            </p>
                        </>
                    ) : (
                        <p className="text-sm font-semibold text-[#fdb700]">¡Ya podés canjear! Elegí abajo.</p>
                    )}
                </div>
            )}

            {children && <div className="border-t border-white/10 bg-white/[0.03] p-4 sm:p-6">{children}</div>}
        </section>
    )
}

/** Botón flotante del pedido: negro (amarillo en modo oscuro) con el total en una pastilla. */
export function BotonPedidoChe({ cantidad, total, visible, onClick, pulso = false }: {
    cantidad: number
    total: string
    visible: boolean
    onClick: () => void
    pulso?: boolean
}) {
    return (
        <div className={`pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-all duration-500 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'}`}>
            <button
                type="button"
                onClick={onClick}
                tabIndex={visible ? 0 : -1}
                className={`group flex h-14 w-full max-w-sm items-center gap-2 rounded-full bg-[#111] pl-5 pr-2 text-white shadow-[0_18px_40px_-14px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-transform duration-300 active:scale-[0.97] ${visible ? 'pointer-events-auto' : ''} ${pulso ? 'scale-105' : ''}`}
            >
                <span className="text-[15px] font-bold">Ver mi pedido</span>
                <span className="text-[13px] tabular-nums text-white/60">· {cantidad} {cantidad === 1 ? 'producto' : 'productos'}</span>
                <span className="ml-auto flex h-10 items-center gap-1.5 rounded-full bg-[#fdb700] px-4 text-[15px] font-black tabular-nums text-[#111]">
                    ${total}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
            </button>
        </div>
    )
}

export function FooterChe({ horarios, direccion, onPedir }: { horarios: Turno[]; direccion?: string | null; onPedir?: () => void }) {
    const hoy = new Date().getDay()
    // La dirección guardada es la larga de Google ("Av. Gral. Paz 6767, S3000 Santa Fe…"): basta la calle.
    const calle = direccion?.split(',')[0]?.trim() || null
    const mapa = direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}` : null

    return (
        <footer className="mt-20">
            <Damero />
            <div className="bg-[#111] pb-32 text-white">
                <div className="mx-auto grid max-w-2xl gap-10 px-5 pt-10 lg:max-w-5xl lg:grid-cols-[1.2fr_1fr] xl:max-w-6xl">
                    <div>
                        <img src="/logo-che.png" alt="Che Milanesa" className="h-12 w-auto" />
                        <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
                            Promos todas las semanas y puntos con cada pedido que hacés desde la web.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            {onPedir && (
                                <button
                                    type="button"
                                    onClick={onPedir}
                                    className="inline-flex h-11 items-center gap-2 rounded-full bg-[#fdb700] px-5 text-sm font-bold text-[#111] transition-transform active:scale-95"
                                >
                                    Hacer mi pedido <ArrowUp className="size-4" />
                                </button>
                            )}
                            <a
                                href={INSTAGRAM_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-4 text-sm font-semibold transition-colors hover:border-white/50"
                            >
                                <Instagram className="size-4" /> @chemilanesa
                            </a>
                        </div>
                        {calle && mapa && (
                            <a href={mapa} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white/80 underline decoration-white/30 underline-offset-4 hover:decoration-white">
                                <MapPin className="size-4 text-[#fdb700]" /> {calle}, Santa Fe
                            </a>
                        )}
                    </div>

                    {horarios.length > 0 && (
                        <div>
                            <p className="font-che text-lg uppercase text-[#fdb700]">Horarios</p>
                            <ul className="mt-3">
                                {SEMANA.map(dia => {
                                    const esHoy = dia === hoy
                                    return (
                                        <li
                                            key={dia}
                                            className={`flex items-baseline justify-between gap-4 border-b border-white/10 py-2 text-sm ${esHoy ? 'font-bold text-[#fdb700]' : 'text-white/75'}`}
                                        >
                                            <span>{DIAS[dia]}{esHoy && <span className="ml-1.5 text-[10px] uppercase tracking-widest">· hoy</span>}</span>
                                            <span className="text-right tabular-nums">{turnosDelDia(horarios, dia) || 'Cerrado'}</span>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    )}
                </div>
                <div className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-between gap-2 px-5 text-xs text-white/40 lg:max-w-5xl xl:max-w-6xl">
                    <span>© {new Date().getFullYear()} Che Milanesa · Santa Fe</span>
                    <span>
                        Pedidos online con{' '}
                        <a
                            href={PIRU_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-white/25 underline-offset-4 transition-colors hover:text-[#fdb700] hover:decoration-[#fdb700]"
                        >
                            Piru
                        </a>
                    </span>
                </div>
            </div>
        </footer>
    )
}
