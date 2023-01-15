const redisClient = require("./redis/redis");

// 用户修改muid后，通知列表的key值和value值也需要修改
module.exports = async function renameMuidAction (oldMUID, newMUID) {
  const res = await redisClient(3).LRange(oldMUID);
  if (!res) return false;
  const notices = res.map(item => JSON.parse(item));
  for (const notice of notices) {
    const index = notices.indexOf(notice);
    const newNotice = notice;
    const splits = newNotice['id'].split('-');
    splits[0] = newMUID.toString();
    newNotice['to'] = newMUID.toString();
    newNotice['id'] = splits.join('-');
    // 将修改好的newNotice赋值回去
    await redisClient(3).Lset(oldMUID, index, JSON.stringify(newNotice)).catch((err) => {
      console.log('renameMuid error: ', err);
      return false;
    });
  }
  // 最后将通知列表的key重命名
  await redisClient(3).Rename(oldMUID, newMUID).then(result => {
    return true
  }).catch(err => {
    console.log('renameMuid error: ', err);
    return false
  })
}
