
const fs = require('fs')
const path = require('path')

const dbFile = path.join(__dirname, '../database.json') 
let db = { data: {} }

function loadDatabase() {
  try {
    db.data = JSON.parse(fs.readFileSync(dbFile))
  } catch {
    db.data = { users: {}, plugins: {}, chats: {}, game: {}, settings: {} }
    fs.writeFileSync(dbFile, JSON.stringify(db.data, null, 2))
  }

  db.data = new Proxy(db.data, {
    set(target, prop, val) {
      target[prop] = val
      fs.writeFileSync(dbFile, JSON.stringify(db.data, null, 2))
      return true
    }
  })

  db.data.users = new Proxy(db.data.users, {
    set(target, prop, val) {
      target[prop] = val
      fs.writeFileSync(dbFile, JSON.stringify(db.data, null, 2))
      return true
    }
  })
}

function saveDB() {
  fs.writeFileSync(dbFile, JSON.stringify(db.data, null, 2))
}

function getUser(jid) {
  if (!db.data.users[jid]) {
    db.data.users[jid] = { exp: 0, limit: 10, coins: 0, bank: 0, name: '', premium: false }
  }
  return db.data.users[jid]
}

loadDatabase()

// Permitir usar global.db.data.users[m.sender] directamente
global.db = db

module.exports = { getUser, loadDatabase, dbFile, db, saveDB }


  