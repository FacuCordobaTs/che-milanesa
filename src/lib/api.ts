const API_URL = import.meta.env.VITE_API_URL || 'https://api.piru.app/api'

export class ApiError extends Error {
  status: number
  response?: any

  constructor(message: string, status: number, response?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.response = response
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        data.error || data.message || 'Error en la solicitud',
        response.status,
        data
      )
    }
    console.log('data', data)
    return data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      'Error de conexión con el servidor',
      0,
      error
    )
  }
}

// Mesa API
export const mesaApi = {
  join: async (qrToken: string) => {
    return fetchApi(`/mesa/join/${qrToken}`, {
      method: 'GET',
    })
  },
}

