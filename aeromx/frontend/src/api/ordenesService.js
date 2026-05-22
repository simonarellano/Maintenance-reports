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

  // Hito 2 — recepción validando el identificador del producto (matrícula/placas/serie).
  recepcionar: (id, identificadorConfirmado) =>
    client.post(`/ordenes/${id}/recepcion`, { identificadorConfirmado }),

  // Hito 3 — inicia el mantenimiento. `lecturas` lleva el medidor según el tipo:
  // aeronave → { horasTotales, horasMotorDer?, horasMotorIzq? }, camion → { odometro },
  // planta → { horimetro }, sensor → {}.
  iniciarMantenimiento: (id, lecturas = {}) =>
    client.post(`/ordenes/${id}/iniciar-mantenimiento`, lecturas),

  // Reasigna cualquiera de los 4-5 responsables (solo gerente).
  asignar: (id, asignaciones) =>
    client.patch(`/ordenes/${id}/asignacion`, asignaciones),

  // Reabre una O/T cerrada — vuelve a pendiente_firma (solo gerente).
  reabrir: (id, motivo) =>
    client.post(`/ordenes/${id}/reabrir`, { motivo }),

  archivar: (id, archivada = true) =>
    client.patch(`/ordenes/${id}/archivar`, { archivada }),

  eliminar: (id) =>
    client.delete(`/ordenes/${id}`),

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

  // El backend infiere el slot a firmar del rol del usuario autenticado — no requiere body.
  firmarCierre: (id) =>
    client.post(`/ordenes/${id}/cierre/firmar`),

  descargarPDF: (id) =>
    client.get(`/ordenes/${id}/pdf`, { responseType: 'blob' })
}
