export interface RestauranteThemeData {
  colorPrimario?: string | null
  colorSecundario?: string | null
  usarColorUnico?: boolean | null
}

export interface RestauranteThemeCache {
  primario?: string | null
  secundario?: string | null
  usarColorUnico?: boolean
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function colorSeguro(value: unknown): string | null {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : null
}

export function guardarTemaRestaurante(key: string, restaurante: RestauranteThemeData) {
  const primario = colorSeguro(restaurante.colorPrimario)
  const secundario = colorSeguro(restaurante.colorSecundario)
  const usarColorUnico = restaurante.usarColorUnico === true
  if (!primario || (!usarColorUnico && !secundario)) return

  sessionStorage.setItem(key, JSON.stringify({ primario, secundario, usarColorUnico }))
}

export function leerTemaRestaurante(key: string | null): RestauranteThemeCache | null {
  if (!key) return null
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || 'null')
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * El modo histórico cambia toda la paleta usando dos colores. El modo de color
 * único sólo sustituye el naranja de marca; las variables neutras quedan en sus
 * valores por defecto para conservar fondos y textos blancos/negros.
 */
export function RestauranteTheme({
  restaurante,
  cachedTheme,
}: {
  restaurante?: RestauranteThemeData | null
  cachedTheme?: RestauranteThemeCache | null
}) {
  const primario = colorSeguro(restaurante?.colorPrimario) || colorSeguro(cachedTheme?.primario)
  const secundario = colorSeguro(restaurante?.colorSecundario) || colorSeguro(cachedTheme?.secundario)
  const usarColorUnico = restaurante?.usarColorUnico ?? cachedTheme?.usarColorUnico ?? false

  if (usarColorUnico && primario) {
    return (
      <style>{`
        :root, .dark {
          --primary: ${primario};
          --primary-foreground: #ffffff;
          --accent: ${primario};
          --accent-foreground: #ffffff;
          --ring: ${primario};
          --chart-1: ${primario};
          --sidebar-primary: ${primario};
          --sidebar-primary-foreground: #ffffff;
        }
      `}</style>
    )
  }

  if (!primario || !secundario) return null
  return (
    <style>{`
      :root {
        --background: ${secundario};
        --foreground: ${primario};
        --card: ${secundario};
        --card-foreground: ${primario};
        --popover: ${secundario};
        --popover-foreground: ${primario};
        --primary: ${primario};
        --primary-foreground: ${secundario};
        --secondary: ${primario}18;
        --secondary-foreground: ${primario};
        --muted: ${primario}15;
        --muted-foreground: ${primario}99;
        --border: ${primario}30;
        --input: ${primario}30;
      }
      .dark {
        --background: ${primario};
        --foreground: ${secundario};
        --card: ${primario};
        --card-foreground: ${secundario};
        --popover: ${primario};
        --popover-foreground: ${secundario};
        --primary: ${secundario};
        --primary-foreground: ${primario};
        --secondary: ${secundario}18;
        --secondary-foreground: ${secundario};
        --muted: ${secundario}15;
        --muted-foreground: ${secundario}b3;
        --border: ${secundario}30;
        --input: ${secundario}30;
      }
    `}</style>
  )
}
