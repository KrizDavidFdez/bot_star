module.exports = {
  command: ['group'],
  help: ['group open', 'group close'],
  tags: ['group'],
  group: true,
  admin: true,
  botAdmin: true,

  run: async (m, { light, args }) => {
    try {
      const action = (args[0] || '').toLowerCase()

      if (!action) {
        return await light.type(m.from).text("🚩 Usa: *group open* o *group close*", m)
      }

      if (action === 'open') {
        await light.sock.groupSettingUpdate(m.from, 'not_announcement')
        return await light.type(m.from).text("🚩 El grupo fue *abierto*", m)
      }

      if (action === 'close') {
        await light.sock.groupSettingUpdate(m.from, 'announcement')
        return await light.type(m.from).text("🚩 El grupo fue *cerrado*", m)
      }

      await light.type(m.from).text("🚩 Opción incorrecta solo *open* / *close*", m)
    } catch (e) {
    }
  }
}