import { useState, useEffect } from 'react'

let isScriptLoading = false
let isScriptLoaded = false
const callbacks: Array<() => void> = []

/**
 * Hook to load the Google Maps Places API script.
 * Uses a singleton pattern to ensure the script is only loaded once.
 */
export function useGoogleMapsScript() {
    const [loaded, setLoaded] = useState(isScriptLoaded)

    useEffect(() => {
        // Already loaded
        if (isScriptLoaded || (window as any).google?.maps?.places) {
            isScriptLoaded = true
            setLoaded(true)
            return
        }

        // Already loading, register callback
        if (isScriptLoading) {
            const cb = () => setLoaded(true)
            callbacks.push(cb)
            return () => {
                const idx = callbacks.indexOf(cb)
                if (idx !== -1) callbacks.splice(idx, 1)
            }
        }

        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
        if (!apiKey) {
            console.warn('[useGoogleMapsScript] VITE_GOOGLE_MAPS_API_KEY is not set.')
            return
        }

        isScriptLoading = true

        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
        script.async = true
        script.defer = true

        script.onload = () => {
            isScriptLoaded = true
            isScriptLoading = false
            setLoaded(true)
            callbacks.forEach(cb => cb())
            callbacks.length = 0
        }

        script.onerror = () => {
            isScriptLoading = false
            console.error('[useGoogleMapsScript] Failed to load Google Maps script.')
        }

        document.head.appendChild(script)
    }, [])

    return loaded
}
