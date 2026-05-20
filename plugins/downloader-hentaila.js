const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const TEMP_DIR = path.join(process.cwd(), "tmp");

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const cleanFileName = (name = "video.mp4") =>
  name.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").trim();

const runFFmpeg = (input, output) =>
  new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${input}" -c copy -movflags +faststart "${output}"`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(output);
    });
  });

const downloadFile = async (url, output) => {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(output);
    res.body.pipe(stream);
    res.body.on("error", reject);
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return output;
};

module.exports = {
  command: ["hentailadl", "hentaila", "hentdl"],
  help: ["hentailadl <url>"],
  tags: ["downloader"],
  limit: 1,

  run: async (m, { light, text }) => {
    let inputPath = null;
    let outputPath = null;

    try {
      if (!text) {
        return light.type(m.from).text(
          "🚩 Ingrese la *URL* de *HentaiLa*",
          m
        );
      }

      const url = text.trim();

      if (!/^https?:\/\/(www\.)?hentaila\.com\/.+/i.test(url)) {
        return light.type(m.from).text(
          "🚩 URL inválida de *HentaiLa*",
          m
        );
      }

      await light.react(m, "🕛");

      const api = `https://apis-starlights-team.koyeb.app/starlight/hentaidl?url=${encodeURIComponent(url)}`;
      const res = await fetch(api);
      const data = await res.json();

      if (!data?.success || !data?.video?.url) {
        await light.react(m, "🍮");
        return light.type(m.from).text(
          "🚩 No se pudo obtener el video.",
          m
        );
      }

      const dl = data.video.url;
      const rawName = cleanFileName(data.video.fileName || `${Date.now()}.mp4`);

      inputPath = path.join(TEMP_DIR, `raw_${Date.now()}_${rawName}`);
      outputPath = path.join(TEMP_DIR, `fixed_${Date.now()}_${rawName}`);

      await downloadFile(dl, inputPath);
      await runFFmpeg(inputPath, outputPath);

      await light.sendMessage(
        m.from,
        {
          video: fs.readFileSync(outputPath),
          mimetype: "video/mp4",
          fileName: rawName,
          caption: [
            `*Título:* ${data.title || "Desconocido"}`,
            `*Episodio:* ${data.episode || "?"}`,
            `*Publicado:* ${data.published || "Desconocido"}`,
            `*Peso:* ${data.video.size || "Desconocido"}`
          ].join("\n"),
          ptv: false
        },
        { quoted: m }
      );

      await light.react(m, "✅");
    } catch (e) {
      console.error("HENTAILADL ERROR:", e);
      await light.react(m, "🍮");
      await light.type(m.from).text(
        "🚩 Ocurrió un error al procesar el video.",
        m
      );
    } finally {
      try {
        if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      } catch {}
      try {
        if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch {}
    }
  }
};