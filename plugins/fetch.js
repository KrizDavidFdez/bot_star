const fetch = require('node-fetch');

module.exports = {
  command: ['get'],
  help: ['get <url>'],
  tags: ['tools'],

  run: async (m, { light, text }) => {
    try {
      if (!text) return await light.type(m.from).text('🚩 Ingresa la *Url*', m);

      const url = text.trim();
      if (!/^https?:\/\/\S+/i.test(url)) {
        return await light.type(m.from).text('🚩 Ingresa una *Url válida*', m);
      }

      await light.react(m, '🕛');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); 

      let res;
      try {
        res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: controller.signal
        });
      } catch (e) {
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        return await light.type(m.from).text(`🚩 Error HTTP: ${res.status}`, m);
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const contentDisposition = res.headers.get('content-disposition') || '';

      let fileName = 'file';

      const match = contentDisposition.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) fileName = match[1];
      else {
        try {
          const pathname = new URL(url).pathname;
          const last = pathname.split('/').pop();
          if (last) fileName = decodeURIComponent(last);
        } catch {}
      }

      let sizeBytes = parseInt(res.headers.get('content-length'));
      if (isNaN(sizeBytes)) sizeBytes = 0;

      const toMB = (b) => b / 1024 / 1024;
      if (
        contentType.includes('application/json') ||
        contentType.includes('text/')
      ) {
        let data;

        try {
          data = contentType.includes('application/json')
            ? JSON.stringify(await res.json(), null, 2)
            : await res.text();
        } catch {
          data = await res.text();
        }

        if (data.length > 80000) {
          data = data.slice(0, 80000) + '\n\n🍟 Respuesta muy larga';
        }

        await light.type(m.from).text(data, m);
        return await light.react(m, '✅');
      }

      if (contentType.startsWith('audio/')) {
        if (sizeBytes && toMB(sizeBytes) > 60) {
          return await light.type(m.from).text(
            `🚩 El audio supera 60 MB (${toMB(sizeBytes).toFixed(2)} MB)`,
            m
          );
        }

        await light.sendMessage(
          m.from,
          {
            audio: { url },
            mimetype: contentType || 'audio/mpeg',
            fileName
          },
          { quoted: m }
        );

        return await light.react(m, '✅');
      }

      if (contentType.startsWith('video/')) {
        if (sizeBytes && toMB(sizeBytes) > 250) {
          return await light.type(m.from).text(
            `🚩 El video supera 150 MB (${toMB(sizeBytes).toFixed(2)} MB)`,
            m
          );
        }

        await light.sendMessage(
          m.from,
          {
            video: { url },
            mimetype: contentType || 'video/mp4',
            fileName,
            caption: `🎬 ${fileName}`
          },
          { quoted: m }
        );

        return await light.react(m, '✅');
      }

      if (sizeBytes && toMB(sizeBytes) > 200) {
        return await light.type(m.from).text(
          `🚩 El archivo supera 100 MB (${toMB(sizeBytes).toFixed(2)} MB)`,
          m
        );
      }

      await light.sendMessage(
        m.from,
        {
          document: { url },
          mimetype: contentType || 'application/octet-stream',
          fileName
        },
        { quoted: m }
      );

      await light.react(m, '✅');

    } catch (err) {
      console.error(err)
      await light.react(m, '🍮');
    }
  }
};