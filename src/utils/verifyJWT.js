/***
 * 验证jwt是否合法
 */

const jwt = require('./jwt')
const { jwtSecret } = require('../../project.config')

exports.verifyJwt = async (token) => {
  return await jwt.verify(token, jwtSecret, {algorithms: "HS256"})
}
