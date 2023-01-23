// socket.io、CORS origin host
const origin = [
  "xxxxxxxx"
]

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

// 登录成功后生成的json web token有效期时长
const LoginJwtExpiresIn = '7days';

// 广场发布帖子时图片的上限
const MaxPictures = 6;

// 上传的单个文件大小上限, 单位比特(bit)
const MaxFileSize = 5 * 1024 * 1024;

module.exports = {
  origin,
  DB,
  redis,
  EmailAccount,
  LoginJwtExpiresIn,
  jwtSecret,
  siteUrl,
  MaxPictures,
  MaxFileSize
}
