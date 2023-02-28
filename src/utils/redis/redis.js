const { createClient } = require("redis");
const { redis } = require("../../../project.config");

/**
 * redis://[[username][:password]@][host][:port][/db-number]
 * 写密码redis://:123456@127.0.0.1:6379/0
 * 写用户redis://uername@127.0.0.1:6379/0
 * 或者不写密码 redis://127.0.0.1:6379/0
 * 或者不写db_number redis://:127.0.0.1:6379
 */

function redisClient(db) {
  const url = `redis://${redis.host}:${redis.port}/${db}`;
  const redisClient = createClient({
    url: url
  });

  redisClient.on("ready", () =>
    console.log(`connect to redis://:xxxxxxxx@${redis.host}:${redis.port}/${db}, redis is ready...`)
  );
  redisClient.on("error", err => console.log("Redis Client Error", err));

  async function setString(key, value, expire) {
    await redisClient.connect(); // 连接

    const res = await redisClient.set(key, value, { EX: expire, NX: true }); // 设置值

    await redisClient.quit(); // 关闭连接
    return res;
  }

  async function getString(key) {
    await redisClient.connect(); // 连接

    const res = await redisClient.get(key); // 得到value 没有则为null

    await redisClient.quit(); // 关闭连接
    return res;
  }

  async function delString(key) {
    await redisClient.connect(); // 连接

    const res = await redisClient.del(key); // 0 没有key关键字 1删除成功

    await redisClient.quit(); // 关闭连接
    return res;
  }

  async function exists(key) {
    await redisClient.connect(); // 连接

    const res = await redisClient.sendCommand(["exists", key]); // 如果key存在返回 1，否则返回 0

    const a = await redisClient.quit(); // 关闭连接

    return res;
  }

  async function RPush(key, value) {
    await redisClient.connect(); // 连接

    const res = await redisClient.sendCommand(["RPUSH", key, value]);

    await redisClient.quit(); // 关闭连接
    return res;
  }

  async function LPop(key) {
    await redisClient.connect(); // 连接

    const res = await redisClient.sendCommand(["LPOP", key]);

    await redisClient.quit(); // 关闭连接
    return res;
  }

  async function LRem(key, count, value) {
    await redisClient.connect(); // 连接

    const res = await redisClient.sendCommand(["LREM", key, count.toString(), value]);

    await redisClient.quit(); // 关闭连接
    return res;
  }

  async function LRange(key) {
    await redisClient.connect(); // 连接

    const res = await redisClient.sendCommand(["LRANGE", key, "0", "-1"]);

    await redisClient.quit(); // 关闭连接
    return res;
  }

  async function LLen(key) {
    await redisClient.connect(); // 连接

    const res = await redisClient.sendCommand(["LLEN", key]);

    await redisClient.quit(); // 关闭连接
    return res;
  }

  async function Rename(oldKey, newKey) {
    await redisClient.connect(); // 连接
    // 如果旧key存在，就重命名
    if (await redisClient.sendCommand(["exists", oldKey])) {
      const res = await redisClient.sendCommand(["RENAME", oldKey, newKey]);

      await redisClient.quit(); // 关闭连接
      return res;
    } else {
      await redisClient.quit(); // 关闭连接
      return false;
    }
  }

  async function Lset(key, index, value) {
    await redisClient.connect(); // 连接

    const res = await redisClient.sendCommand(["LSET", key.toString(), index.toString(), value.toString()]);

    await redisClient.quit(); // 关闭连接
    return res;
  }

  return {
    getString,
    setString,
    delString,
    exists,
    RPush,
    LPop,
    LRem,
    LRange,
    LLen,
    Rename,
    Lset
  };
}

module.exports = redisClient;
