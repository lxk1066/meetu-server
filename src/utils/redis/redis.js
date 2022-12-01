const { createClient } = require('redis');
const { redis } = require('../../../project.config')

/**
 * redis://[[username][:password]@][host][:port][/db-number]
 * 写密码redis://:123456@127.0.0.1:6379/0
 * 写用户redis://uername@127.0.0.1:6379/0
 * 或者不写密码 redis://127.0.0.1:6379/0
 * 或者不写db_number redis://:127.0.0.1:6379
 */

function redisClient (db) {
  const url = `redis://:${redis.pass}@${redis.host}:${redis.port}/${db}`
  const redisClient = createClient({
    url: url
  });

  redisClient.on('ready', () => console.log(`connect to ${url}, redis is ready...`)
  )
  redisClient.on('error', (err) => console.log('Redis Client Error', err));

  async function setString (key, value, expire) {
    await redisClient.connect(); // 连接

    const res = await redisClient.set(key, value, { EX: expire, NX: true }); // 设置值

    await redisClient.quit() // 关闭连接
    return res
  }

  async function getString (key) {
    await redisClient.connect(); // 连接

    const res = await redisClient.get(key); // 得到value 没有则为null

    await redisClient.quit() // 关闭连接
    return res
  }

  async function delString (key) {
    await redisClient.connect(); // 连接

    const res = await redisClient.del(key); // 0 没有key关键字 1删除成功

    await redisClient.quit() // 关闭连接
    return res
  }

  async function exists (key) {
    await redisClient.connect(); // 连接

    const res = await redisClient.sendCommand(['exists', key]); // 如果key存在返回 1，否则返回 0

    await redisClient.quit() // 关闭连接
    return res
  }

  return {
    getString,
    setString,
    delString,
    exists
  }
}

module.exports = redisClient
