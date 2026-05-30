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

  obtenerMe: () =>
    client.get('/usuarios/me'),

  actualizarMe: (data) =>
    client.patch('/usuarios/me', data),

  subirFoto: (id, file) => {
    const fd = new FormData()
    fd.append('foto', file)
    return client.post(`/usuarios/${id}/foto`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  eliminarFoto: (id) =>
    client.delete(`/usuarios/${id}/foto`),
}
