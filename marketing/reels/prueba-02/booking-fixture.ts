// Datos ilustrativos locales. No se conecta a servicios externos ni crea reservas.
export class BookingLoadError extends Error {}
export async function fetchBookingInfo() {
  return {
    name: 'Salón de ejemplo', slug: 'salon-de-ejemplo', open_days: [1,2,3,4,5,6],
    services: [
      {id:'corte', name:'Corte y brushing', duration_minutes:60},
      {id:'color', name:'Coloración', duration_minutes:90},
    ],
  }
}
export async function fetchSlots() { return ['09:00','10:00','11:00','14:00','15:00','16:00'] }
export async function createBooking() { throw new Error('Esta escena no crea reservas.') }
