const config = require('../config.json')

module.exports = {
  command: ['owner', 'creador'],
  help: ['owner'],
  tags: ['main'],
  run: async (m, { light }) => {
    try {
    const vcard1 = 'BEGIN:VCARD\n'
        + 'VERSION:3.0\n'
        + 'FN:ig:@Atemvdd\n'
        + 'ORG:🐾你同我一齊，世界會更加美好;\n'
        + 'TEL;type=CELL;type=VOICE;waid=51910108980:+51 910 108 980\n'
        + 'END:VCARD'

    const vcard2 = 'BEGIN:VCARD\n'
        + 'VERSION:3.0\n'
        + 'FN:🍟 Irokz Dal ダーク\n'
        + 'TEL;type=CELL;type=VOICE;waid=5218261275256:+52 826 127 5256\n'
        + 'END:VCARD'
    await light.sendMessage(m.from, {
        contacts: {
          displayName: '星光業主 🌸',
          contacts: [
            { vcard: vcard1 },
            { vcard: vcard2 }
          ]
        }
      }, { quoted: m })
      await light.react(m, '✅')
    } catch (err) {
    }
  }
}




