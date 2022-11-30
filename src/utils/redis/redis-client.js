// redis-client.js

const redisClient = require('./redis')

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

// async function fun() {
//   const res = await exists('123')
//   console.log(res);
// }
// fun()

module.exports = {
  setString,
  getString,
  delString,
  exists
}
