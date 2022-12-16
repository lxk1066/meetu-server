// 数据库的配置信息
const DB = {
  host: "xxxxxxxx",
  user: "xxxxxxxx",
  password: "xxxxxxxx",
  database: "xxxxxxxx",
}

// redis的配置信息
const redis = {
  user: 'xxxxxxxx',
  pass: 'xxxxxxxx',
  host: '127.0.0.1',
  port: 6379,
  db: 0
}

// 邮箱的配置信息
const EmailAccount = {
  service: "QQ",
  user: 'xxxxxxxx', //  发件人邮箱
  pass: 'xxxxxxxx' //  授权码
}

// jwt secret
const jwtSecret = "xxxxxxxx"

// 前端的URL
const siteUrl = "xxxxxxxx"

module.exports = { DB, redis, EmailAccount, jwtSecret, siteUrl }
