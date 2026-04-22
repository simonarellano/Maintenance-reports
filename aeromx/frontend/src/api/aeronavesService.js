import client from './client'

export const aeronavesService = {
  listar: (params) =>
    client.get('/aeronaves', { params }),

  obtener: (id) =>
    client.get(`/aeronaves/${id}`),

  crear: (data) =>
    client.post('/aeronaves', data),

  actualizar: (id, data) =>
    client.put(`/aeronaves/${id}`, data),

  desactivar: (id) =>
    client.delete(`/aeronaves/${id}`),
}
