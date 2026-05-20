const { proto, generateMessageID } = require('@whiskeysockets/baileys')

module.exports = {
  command: ['liveloc'],
  help: ['liveloc'],
  tags: ['tools'],

  run: async (m, { light }) => {
    try {
      const sock = light.sock
      const degreesLatitude = 35.6591
      const degreesLongitude = 139.7004
      const now = new Date()
      const time = now.toLocaleTimeString()
      const date = now.toLocaleDateString()

      const caption =
`\n🍟 *Lat* : ${degreesLatitude}
🍟 *Lng* : ${degreesLongitude}

🍙 *Hora* : ${time}
🍙 *Fecha*: ${date}

`
      const msg = {
        messageContextInfo: {
          threadId: [],
          deviceListMetadata: {
            senderKeyIndexes: [],
            recipientKeyIndexes: []
          },
          deviceListMetadataVersion: 2,
          botMetadata: {
            pluginMetadata: {}
          }
        },

        botForwardedMessage: {
          message: {
            liveLocationMessage: {
              degreesLatitude,
              degreesLongitude,
              sequenceNumber: `${Date.now()}`,
              caption,

              jpegThumbnail: Buffer.from(
                "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCABkAGQDASIAAhEBAxEB/8QAHAAAAQQDAQAAAAAAAAAAAAAAAAMEBQYBAgcI/8QAPhAAAQMDAwIDBAcFBwUAAAAAAQIDBAAFEQYSITFBBxMiMlFhcRQjQoGRseEVFmKh8BckU3KCwdEIQ1Jjkv/EABkBAQEAAwEAAAAAAAAAAAAAAAABAgQFBv/EACkRAQABAwQAAgsAAAAAAAAAAAABAhEhAwQFMRMUBhIiMkFhcYHB0fH/2gAMAwEAAhEDEQA/AA==",
                'base64'
              )
            }
          }
        }
      }

      await sock.relayMessage(
        m.from,
        msg,
        { messageId: generateMessageID() }
      )

    } catch (e) {
      console.error(e)
    }
  }
}