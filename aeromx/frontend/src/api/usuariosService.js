import client from './client'

export const usuariosService = {
  listar: (params) =>
    client.get('/usuarios', { params }),

  obtener: (id) =>
    client.get(`/usuarios/${id}`),

  crear: (data) =>
    client.post('/usuarios', data),

  actualizar: (id, data) =>
    client.put(`/usuarios/${id}`, data),

  desactivar: (id) =>
    client.delete(`/usuarios/${id}`),
}
