import { useEffect, useRef } from 'react'
import { useGoogleMapsScript } from '@/hooks/useGoogleMapsScript'
import { cn } from '@/lib/utils'

interface AddressMapPreviewProps {
    lat: number
    lng: number
    className?: string
}

export function AddressMapPreview({ lat, lng, className }: AddressMapPreviewProps) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<google.maps.Map | null>(null)
    const markerRef = useRef<google.maps.Marker | null>(null)
    const isLoaded = useGoogleMapsScript()

    useEffect(() => {
        if (!isLoaded || !mapRef.current) return

        const position = { lat, lng }

        if (!mapInstanceRef.current) {
            mapInstanceRef.current = new google.maps.Map(mapRef.current, {
                center: position,
                zoom: 16,
                disableDefaultUI: true,
                gestureHandling: 'none',
                keyboardShortcuts: false,
                clickableIcons: false,
            })

            markerRef.current = new google.maps.Marker({
                position,
                map: mapInstanceRef.current,
                animation: google.maps.Animation.DROP,
            })
        } else {
            mapInstanceRef.current.panTo(position)
            markerRef.current?.setPosition(position)
        }
    }, [isLoaded, lat, lng])

    return (
        <div
            className={cn(
                'overflow-hidden rounded-xl border border-border shadow-sm',
                'animate-in fade-in slide-in-from-bottom-2 duration-300',
                className
            )}
        >
            <div ref={mapRef} className="w-full h-40" />
        </div>
    )
}
