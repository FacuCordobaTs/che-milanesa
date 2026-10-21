// Datos de la identidad de Che Milanesa que usa components/marca/MarcaChe.tsx (separados para Fast Refresh).

export type Turno = { diaSemana: number; horaApertura: string; horaCierre: string }

export const INSTAGRAM_URL = 'https://www.instagram.com/chemilanesa/'
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const SEMANA = [1, 2, 3, 4, 5, 6, 0]

export const minutos = (hora: string) => {
    const [h, m] = hora.split(':').map(Number)
    return h * 60 + m
}
export const hhmm = (hora: string) => hora.slice(0, 5)

/** Hora de cierre del turno que está corriendo ahora (contempla los que pasan la medianoche). */
function cierreTurnoActual(horarios: Turno[]): string | null {
    const ahora = new Date()
    const hoy = ahora.getDay()
    const ayer = (hoy + 6) % 7
    const m = ahora.getHours() * 60 + ahora.getMinutes()
    for (const h of horarios) {
        const a = minutos(h.horaApertura)
        const c = minutos(h.horaCierre)
        const enCurso = c > a
            ? h.diaSemana === hoy && m >= a && m < c
            : (h.diaSemana === hoy && m >= a) || (h.diaSemana === ayer && m < c)
        if (enCurso) return hhmm(h.horaCierre)
    }
    return null
}

/** El estado del local en una frase: "Abierto hasta las 23:00" o "Cerrado · abrimos hoy a las 19:30". */
export function textoEstado(horarios: Turno[], estado: { abierto: boolean; proximaApertura: string | null }) {
    if (!estado.abierto) return estado.proximaApertura ? `Cerrado · abrimos ${estado.proximaApertura}` : 'Cerrado por ahora'
    const cierre = cierreTurnoActual(horarios)
    return cierre ? `Abierto hasta las ${cierre}` : 'Abierto ahora'
}

/** Los turnos de un día, en orden: "11:00–14:00 · 19:30–23:00". Vacío si ese día no abre. */
export function turnosDelDia(horarios: Turno[], dia: number): string {
    return horarios
        .filter(h => h.diaSemana === dia)
        .sort((a, b) => minutos(a.horaApertura) - minutos(b.horaApertura))
        .map(h => `${hhmm(h.horaApertura)}–${hhmm(h.horaCierre)}`)
        .join(' · ')
}

/** El canje más barato que todavía no alcanza y cuánto falta para él (null si ya alcanza a todos). */
export function proximoCanje(puntos: number, costos: number[]): { costo: number; faltan: number; porcentaje: number } | null {
    const pendientes = costos.filter(c => c > puntos).sort((a, b) => a - b)
    if (pendientes.length === 0) return null
    const costo = pendientes[0]
    return { costo, faltan: costo - puntos, porcentaje: Math.max(4, Math.min(100, Math.round((puntos / costo) * 100))) }
}
