import { useRef, useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { MapPin, X, Loader2, Search } from 'lucide-react'
import { useGoogleMapsScript } from '@/hooks/useGoogleMapsScript'

interface AddressAutocompleteProps {
    value: string
    onChange: (address: string, lat: number | null, lng: number | null) => void
    placeholder?: string
    className?: string
    /** Ciudades configuradas por el negocio. Una única ciudad también limita las sugerencias de Google. */
    allowedCities?: string[]
    /** Coordenadas de las sucursales, usadas para sesgar la búsqueda cuando hay más de una ciudad. */
    biasLocations?: Array<{ lat: number; lng: number }>
}

/**
 * Google puede devolver la misma localidad como "Santa Fe", "Santa Fe de la
 * Vera Cruz" o precedida por el CPA (por ejemplo, "S3000FRX"). El CPA identifica
 * una zona/manzana, no una ciudad, por lo que no debe formar parte del filtro.
 */
function cleanCity(value: string): string {
    return value
        .replace(/\b[A-Za-z]?\d{4}[A-Za-z0-9]{0,3}\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
}

function normalizeCity(value: string): string {
    const normalized = cleanCity(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()

    // Google usa ambas denominaciones para la ciudad según el resultado.
    return normalized === 'santa fe de la vera cruz' ? 'santa fe' : normalized
}

function extractCity(components: google.maps.GeocoderAddressComponent[] | undefined): string | null {
    if (!components) return null
    for (const type of ['locality', 'postal_town', 'administrative_area_level_2']) {
        const component = components.find((c) => c.types.includes(type))
        if (component?.long_name) return component.long_name
    }
    return null
}

function addressMatchesAllowedCity(formattedAddress: string, allowed: Set<string>): boolean {
    // En algunos resultados argentinos Google separa el CPA extendido como
    // "S3000 DHF" y etiqueta "DHF" como locality. La dirección formateada sí
    // conserva la localidad real en el segmento siguiente, por eso se revisan
    // también las partes delimitadas por coma.
    return formattedAddress
        .split(',')
        .map(normalizeCity)
        .some((part) => part !== '' && allowed.has(part))
}

export function AddressAutocomplete({
    value,
    onChange,
    placeholder = 'Busca tu dirección...',
    className,
    allowedCities = [],
    biasLocations = [],
}: AddressAutocompleteProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
    const [isFocused, setIsFocused] = useState(false)
    const [internalValue, setInternalValue] = useState(value)
    const [hasSelectedPlace, setHasSelectedPlace] = useState(!!value)
    const [cityError, setCityError] = useState<string | null>(null)

    const isLoaded = useGoogleMapsScript()

    // Sync external value
    useEffect(() => {
        setInternalValue(value)
    }, [value])

    const stableOnChange = useCallback(
        (address: string, lat: number | null, lng: number | null) => onChange(address, lat, lng),
        [onChange],
    )
    const allowedCitiesKey = allowedCities.map(normalizeCity).sort().join('|')
    const biasLocationsKey = biasLocations.map((p) => `${p.lat},${p.lng}`).join('|')

    // Initialize Google Places Autocomplete
    useEffect(() => {
        if (!isLoaded || !inputRef.current || autocompleteRef.current) return

        const options: google.maps.places.AutocompleteOptions = {
            componentRestrictions: { country: 'ar' },
            fields: ['formatted_address', 'geometry', 'address_components'],
            types: ['address']
        }

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, options)

        // Deduplicar por la forma normalizada: "Santa Fe" y "Santa Fe de la
        // Vera Cruz" son un único límite, no dos ciudades diferentes.
        const uniqueCities = Array.from(new Map(
            allowedCities
                .map((city) => [normalizeCity(city), cleanCity(city)] as const)
                .filter(([normalized]) => Boolean(normalized)),
        ).values())
        if (uniqueCities.length === 1) {
            const geocoder = new google.maps.Geocoder()
            void geocoder.geocode({ address: `${uniqueCities[0]}, Argentina` }).then(({ results }) => {
                const viewport = results[0]?.geometry?.viewport
                if (viewport) autocomplete.setOptions({ bounds: viewport, strictBounds: true })
            }).catch(() => {})
        } else if (biasLocations.length > 0) {
            const bounds = new google.maps.LatLngBounds()
            for (const point of biasLocations) bounds.extend(point)
            autocomplete.setBounds(bounds)
        }

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace()

            if (place.geometry?.location) {
                const lat = place.geometry.location.lat()
                const lng = place.geometry.location.lng()
                const formattedAddress = place.formatted_address || ''
                const city = extractCity(place.address_components)
                const allowed = new Set(allowedCities.map(normalizeCity).filter(Boolean))

                const cityMatches = city != null && allowed.has(normalizeCity(city))
                const addressMatches = addressMatchesAllowedCity(formattedAddress, allowed)

                if (allowed.size > 0 && !cityMatches && !addressMatches) {
                    setInternalValue(formattedAddress)
                    setHasSelectedPlace(false)
                    setCityError(`Elegí una dirección de ${uniqueCities.join(' o ')}`)
                    stableOnChange(formattedAddress, null, null)
                    return
                }

                setInternalValue(formattedAddress)
                setHasSelectedPlace(true)
                setCityError(null)
                stableOnChange(formattedAddress, lat, lng)
            }
        })

        autocompleteRef.current = autocomplete
        return () => {
            google.maps.event.clearInstanceListeners(autocomplete)
            if (autocompleteRef.current === autocomplete) autocompleteRef.current = null
        }
    }, [isLoaded, stableOnChange, allowedCitiesKey, biasLocationsKey])

    const handleClear = () => {
        setInternalValue('')
        setHasSelectedPlace(false)
        setCityError(null)
        stableOnChange('', null, null)
        inputRef.current?.focus()
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInternalValue(val)
        setHasSelectedPlace(false)
        setCityError(null)
        // When typing manually, clear lat/lng since it's not a selected place
        stableOnChange(val, null, null)
    }

    return (
        <div ref={containerRef} className="relative group">
            <div
                className={cn(
                    'relative flex items-center h-12 w-full rounded-xl border bg-transparent px-3 text-base transition-all duration-300',
                    'shadow-xs',
                    isFocused
                        ? 'border-primary ring-primary/25 ring-[3px] shadow-primary/10 shadow-md'
                        : 'border-input hover:border-primary/40',
                    hasSelectedPlace && !isFocused && 'border-emerald-500/50 bg-emerald-500/5',
                    className
                )}
            >
                {hasSelectedPlace ? (
                    <MapPin
                        className={cn(
                            'w-4.5 h-4.5 mr-2.5 shrink-0 transition-colors duration-300',
                            'text-emerald-500'
                        )}
                    />
                ) : (
                    <Search
                        className={cn(
                            'w-4.5 h-4.5 mr-2.5 shrink-0 transition-colors duration-300',
                            isFocused ? 'text-primary' : 'text-muted-foreground'
                        )}
                    />
                )}

                <input
                    ref={inputRef}
                    type="text"
                    value={internalValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    className={cn(
                        'flex-1 h-full bg-transparent outline-none text-foreground',
                        'placeholder:text-muted-foreground/60',
                        'text-sm'
                    )}
                    autoComplete="off"
                />

                {internalValue && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className={cn(
                            'ml-2 p-1 rounded-full shrink-0',
                            'text-muted-foreground hover:text-foreground hover:bg-secondary',
                            'transition-all duration-200',
                            'opacity-60 hover:opacity-100'
                        )}
                        tabIndex={-1}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}

                {!isLoaded && (
                    <Loader2 className="w-4 h-4 ml-2 shrink-0 animate-spin text-muted-foreground" />
                )}
            </div>

            {/* Subtle helper text */}
            {isFocused && !internalValue && (
                <p className="text-[11px] text-muted-foreground/70 mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    Escribe tu calle y número para ver sugerencias
                </p>
            )}

            {/* Confirmed address indicator */}
            {hasSelectedPlace && !isFocused && internalValue && (
                <div className="flex items-center gap-1.5 mt-1.5 ml-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Dirección confirmada
                    </span>
                </div>
            )}
            {cityError && (
                <p className="text-[11px] text-destructive mt-1.5 ml-1" role="alert">{cityError}</p>
            )}
        </div>
    )
}
