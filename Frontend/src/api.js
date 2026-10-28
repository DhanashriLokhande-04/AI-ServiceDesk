const API_BASE_URL = 'http://localhost:8080/api'

export async function getTickets() {
    const response = await fetch(`${API_BASE_URL}/tickets`)

    if (!response.ok) {
        throw new Error('Tickets fetch करण्यात अडचण आली.')
    }

    return response.json()
}