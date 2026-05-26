import client from './client'

export const categoriasFallaService = {
  listar: (params) =>
    client.get('/categorias-falla', { params }),

  crear: (data) =>
    client.post('/categorias-falla', data),

  actualizar: (id, data) =>
    client.put(`/categorias-falla/${id}`, data),

  eliminar: (id) =>
    client.delete(`/categorias-falla/${id}`),
}
