const crypto = require('crypto')

//对密码进行加密
exports.encryptPassword =  function (str) {
  const sha256 = crypto.createHash('sha256')
  return sha256.update(str, 'utf8').digest('hex')
}