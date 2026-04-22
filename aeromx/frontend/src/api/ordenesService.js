import client from './client'

export const ordenesService = {
  listar: (params) =>
    client.get('/ordenes', { params }),

  obtener: (id) =>
    client.get(`/ordenes/${id}`),

  crear: (data) =>
    client.post('/ordenes', data),

  cambiarEstado: (id, estado) =>
    client.patch(`/ordenes/${id}/estado`, { estado }),

  recepcionarAeronave: (id, matriculaConfirmada) =>
    client.post(`/ordenes/${id}/recepcion`, { matriculaConfirmada }),

  iniciarMantenimiento: (id) =>
    client.post(`/ordenes/${id}/iniciar-mantenimiento`),

  asignar: (id, { tecnicoId, supervisorId }) =>
    client.patch(`/ordenes/${id}/asignacion`, { tecnicoId, supervisorId }),

  actualizarResultado: (id, resultadoId, data) =>
    client.patch(`/ordenes/${id}/puntos/${resultadoId}`, data),

  firmarPunto: (id, resultadoId, firma) =>
    client.post(`/ordenes/${id}/puntos/${resultadoId}/firmar`, { firma }),

  subirFoto: (id, resultadoId, file) => {
    const formData = new FormData()
    formData.append('foto', file)
    return client.post(`/ordenes/${id}/puntos/${resultadoId}/fotos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  eliminarFoto: (id, resultadoId, fotoId) =>
    client.delete(`/ordenes/${id}/puntos/${resultadoId}/fotos/${fotoId}`),

  crearCierre: (id, data) =>
    client.post(`/ordenes/${id}/cierre`, data),

  firmarCierre: (id, data) =>
    client.post(`/ordenes/${id}/cierre/firmar`, data),

  descargarPDF: (id) =>
    client.get(`/ordenes/${id}/pdf`, { responseType: 'blob' })
}
