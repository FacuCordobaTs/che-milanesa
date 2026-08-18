import { useRef, useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { MapPin, X, Loader2, Search, AlertCircle } from 'lucide-react'
import { useGoogleMapsScript } from '@/hooks/useGoogleMapsScript'

interface AddressAutocompleteProps {
    value: string
    onChange: (address: string, lat: number | null, lng: number | null) => void
    placeholder?: string
    className?: string
}

export function AddressAutocomplete({
    value,
    onChange,
    placeholder = 'Busca tu dirección...',
    className
}: AddressAutocompleteProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
    const [isFocused, setIsFocused] = useState(false)
    const [internalValue, setInternalValue] = useState(value)
    const [hasSelectedPlace, setHasSelectedPlace] = useState(!!value)
    const [error, setError] = useState<string | null>(null)

    const isLoaded = useGoogleMapsScript()

    // Sync external value
    useEffect(() => {
        setInternalValue(value)
    }, [value])

    const stableOnChange = useCallback(onChange, [])

    const SANTA_FE_BOUNDS = {
        north: -31.5400,
        south: -31.6900,
        east: -60.6400,
        west: -60.7500
    }

    // Initialize Google Places Autocomplete
    useEffect(() => {
        if (!isLoaded || !inputRef.current || autocompleteRef.current) return

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: 'ar' },
            bounds: SANTA_FE_BOUNDS,
            strictBounds: true,
            fields: ['formatted_address', 'geometry', 'address_components', 'name'],
            types: ['address']
        })

        autocomplete.addListener('place_changed', () => {
            setError(null)
            const place = autocomplete.getPlace()

            const hasStreetNumber = place.address_components?.some(
                (component) => component.types.includes('street_number')
            )

            if (!hasStreetNumber) {
                setError('Por favor, ingresá el número de la calle (ej: San Martín 2050)')
                setInternalValue(place.name || '')
                setHasSelectedPlace(false)
                stableOnChange('', null, null)
                // Focus the input to let user append street number
                if (inputRef.current) {
                    inputRef.current.focus()
                }
                return
            }

            if (place.geometry?.location) {
                const lat = place.geometry.location.lat()
                const lng = place.geometry.location.lng()
                const formattedAddress = place.formatted_address || ''

                setInternalValue(formattedAddress)
                setHasSelectedPlace(true)
                stableOnChange(formattedAddress, lat, lng)
            }
        })

        autocompleteRef.current = autocomplete
    }, [isLoaded, stableOnChange])

    const handleClear = () => {
        setInternalValue('')
        setHasSelectedPlace(false)
        setError(null)
        stableOnChange('', null, null)
        inputRef.current?.focus()
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInternalValue(val)
        setHasSelectedPlace(false)
        setError(null)
        // When typing manually, clear lat/lng since it's not a selected place
        stableOnChange(val, null, null)
    }

    return (
        <div ref={containerRef} className="relative group">
            <div
                className={cn(
                    'relative flex items-center h-12 w-full rounded-xl border bg-transparent px-3 text-base transition-all duration-300',
                    'shadow-xs',
                    error 
                        ? 'border-red-500/50 ring-red-500/20 ring-[3px]' 
                        : isFocused
                            ? 'border-primary ring-primary/25 ring-[3px] shadow-primary/10 shadow-md'
                            : 'border-input hover:border-primary/40',
                    hasSelectedPlace && !isFocused && !error && 'border-emerald-500/50 bg-emerald-500/5',
                    className
                )}
            >
                {hasSelectedPlace && !error ? (
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
                            error ? 'text-red-500' : isFocused ? 'text-primary' : 'text-muted-foreground'
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
                        'text-sm',
                        error && 'text-red-600 dark:text-red-400 font-medium'
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

            {error && (
                <div className="flex items-center gap-1.5 mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    <p className="text-[12px] font-medium text-red-500">{error}</p>
                </div>
            )}

            {/* Subtle helper text */}
            {isFocused && !internalValue && !error && (
                <p className="text-[11px] text-muted-foreground/70 mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    Escribí tu calle y número para ver sugerencias
                </p>
            )}

            {/* Confirmed address indicator */}
            {hasSelectedPlace && !isFocused && internalValue && !error && (
                <div className="flex items-center gap-1.5 mt-1.5 ml-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Dirección confirmada
                    </span>
                </div>
            )}
        </div>
    )
}
