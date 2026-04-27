import client from './client'

export const formatosService = {
  // Formatos
  listar: () =>
    client.get('/formatos'),

  obtener: (id) =>
    client.get(`/formatos/${id}`),

  crear: (datos) =>
    client.post('/formatos', datos),

  actualizar: (id, datos) =>
    client.put(`/formatos/${id}`, datos),

  desactivar: (id) =>
    client.delete(`/formatos/${id}`),

  // Alias usado por la página actual
  eliminar: (id) =>
    client.delete(`/formatos/${id}`),

  // Secciones
  crearSeccion: (formatoId, datos) =>
    client.post(`/formatos/${formatoId}/secciones`, datos),

  actualizarSeccion: (formatoId, seccionId, datos) =>
    client.put(`/formatos/${formatoId}/secciones/${seccionId}`, datos),

  eliminarSeccion: (formatoId, seccionId) =>
    client.delete(`/formatos/${formatoId}/secciones/${seccionId}`),

  // Puntos
  crearPunto: (formatoId, seccionId, datos) =>
    client.post(`/formatos/${formatoId}/secciones/${seccionId}/puntos`, datos),

  actualizarPunto: (formatoId, seccionId, puntoId, datos) =>
    client.put(`/formatos/${formatoId}/secciones/${seccionId}/puntos/${puntoId}`, datos),

  eliminarPunto: (formatoId, seccionId, puntoId) =>
    client.delete(`/formatos/${formatoId}/secciones/${seccionId}/puntos/${puntoId}`),
}
