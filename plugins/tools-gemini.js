const fetch = require('node-fetch')    
    
let sessions = {}    
    
const gemini = {    
  getNewCookie: async () => {    
    let r = await fetch("https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c", {    
      headers: {    
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8"    
      },    
      body: "f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&",    
      method: "POST"    
    })    
    
    let ck = r.headers.get("set-cookie")    
    return ck.split(";")[0]    
  },    
    
  ask: async (prompt, prev = null) => {    
    let resume = null    
    let cookie = null    
    
    if (prev) {    
      let j = JSON.parse(Buffer.from(prev, 'base64').toString())    
      resume = j.newResumeArray    
      cookie = j.cookie    
    }    
    
    let headers = {    
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",    
      "x-goog-ext-525001261-jspb": "[1,null,null,null,\"9ec249fc9ad08861\",null,null,null,[4]]",    
      cookie: cookie || await gemini.getNewCookie()    
    }    
    
    let bodyData = [[prompt], ["en-US"], resume]    
    let payload = [null, JSON.stringify(bodyData)]    
    let body = new URLSearchParams({    
      "f.req": JSON.stringify(payload)    
    })    
    
    let x = await fetch("https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=en-US&_reqid=2813378&rt=c", {    
      headers,    
      body,    
      method: "POST"    
    })    
    
    if (!x.ok) {    
      throw Error(`${x.status} ${x.statusText} ${await x.text() || "(body vacío)"}`)    
    }    
    
    let data = await x.text()    
    let match = Array.from(data.matchAll(/^\d+\n(.+?)\n/gm)).reverse()[3]?.[1]    
    let parsed = JSON.parse(JSON.parse(match)[0][2])    
    
    return {    
      text: parsed[4][0][1][0].replace(/\*\*(.+?)\*\*/g, "*$1*"),    
      id: Buffer.from(JSON.stringify({    
        newResumeArray: [...parsed[1], parsed[4][0][0]],    
        cookie: headers.cookie    
      })).toString('base64')    
    }    
  }    
}    
    
module.exports = {    
  command: ['gemini'],    
  help: ['gemini'],    
  tags: ['ai'],    
  limit: 1,    
  run: async (m, { light, text }) => {    
    if (!text) {    
      await light.type(m.from).text("🚩 Ingresa su *pregunta*", m)    
      return false    
    }    
    await light.react(m, '🕛')    
    try {    
      const sender = m.sender || m.key?.participant || m.key?.remoteJid || m.from    
      let s = sessions[sender]    
      let prev = s && s.expire > Date.now() ? s.id : null    
    
      let r = await gemini.ask(text, prev)    
    
      sessions[sender] = {    
        id: r.id,    
        expire: Date.now() + 86400000    
      }    
      await light.type(m.from).text(r.text, m)    
      await light.react(m, '✅')    
      return true    
    } catch (err) {    
      await light.react(m, '🍮')    
      return false    
    }    
  }    
}