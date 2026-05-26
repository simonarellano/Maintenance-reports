import client from './client'

export const fallasService = {
  listar: (params) =>
    client.get('/fallas', { params }),

  obtener: (id) =>
    client.get(`/fallas/${id}`),

  crear: (data) =>
    client.post('/fallas', data),

  asignarResponsable: (id, responsableId) =>
    client.patch(`/fallas/${id}/responsable`, { responsableId }),

  resolver: (id, data) =>
    client.post(`/fallas/${id}/resolver`, data),

  subirFoto: (id, file) => {
    const fd = new FormData()
    fd.append('foto', file)
    return client.post(`/fallas/${id}/fotos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  eliminarFoto: (id, fotoId) =>
    client.delete(`/fallas/${id}/fotos/${fotoId}`),

  descargarPDF: (id) =>
    client.get(`/fallas/${id}/pdf`, { responseType: 'blob' }),
}
