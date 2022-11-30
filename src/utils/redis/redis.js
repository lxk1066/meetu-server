const { createClient } = require('redis');
const { redis } = require('../../../project.config')

/**
 * redis://[[username][:password]@][host][:port][/db-number]
 * 写密码redis://:123456@127.0.0.1:6379/0
 * 写用户redis://uername@127.0.0.1:6379/0
 * 或者不写密码 redis://127.0.0.1:6379/0
 * 或者不写db_number redis://:127.0.0.1:6379
 */
const url = `redis://:${redis.pass}@${redis.host}:${redis.port}/${redis.db}`
const redisClient = createClient({
  url: url
});

redisClient.on('ready', () => console.log(`connect to ${url}, redis is ready...`)
)
redisClient.on('error', (err) => console.log('Redis Client Error', err));

module.exports = redisClient
