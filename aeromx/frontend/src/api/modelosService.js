import client from './client'

export const modelosService = {
  listar: (params) =>
    client.get('/modelos', { params }),

  obtener: (id) =>
    client.get(`/modelos/${id}`),

  crear: (data) =>
    client.post('/modelos', data),

  actualizar: (id, data) =>
    client.put(`/modelos/${id}`, data),

  eliminar: (id) =>
    client.delete(`/modelos/${id}`),
}
