/**
 * 删除指定noticeId 的通知
 */
const redisClient = require("./redis/redis");

exports.delNotice = async (noticeId) => {
  const muid = noticeId.split('_')[0];
  if (!muid) return false
  const res = await redisClient(3).LRange(muid);
  const notices = res.map(item => JSON.parse(item));
  const item = notices.find(item => item.id === noticeId);
   // 从redis中删除该通知
  const result = await redisClient(3).LRem(muid, 1, JSON.stringify(item));
  return { item, result }
}
