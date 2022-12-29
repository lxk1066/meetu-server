const redisClient = require('../utils/redis/redis');
const queryDB = require('../model/db');

// 发送好友申请
const addFriendRequest = async ctx => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  if (!body.muid || !body.message) {
    ctx.body = { code: 400, msg: '缺少必需参数muid和message' }
  } else {
    await queryDB(`select user_id,muid from meetu_users_muid where muid="${body.muid}" or user_id=${uid}`).then(async result => {
      if (result.length <= 1) ctx.body = { code: 400, msg: '查无此用户' }
      else {
        const from_muid = result[0].user_id === uid ? result[0].muid : result[1].muid;
        const to_muid = body.muid;
        const base64Str = Buffer.from(body.message).toString("base64"); // 将中文转换成base64
        const res = await redisClient(3).RPush(to_muid, JSON.stringify({
          type: 'addFriend', from: from_muid, to: to_muid, message: base64Str, hasRead: false, time: +new Date()
        }))
        if (res > 0) ctx.body = { code: 200, msg: '发送成功' }
        else ctx.body = { code: 400, msg: '发送失败' }
      }
    }).catch(err => {
      console.log('addFriendRequest error: ', err);
      ctx.body = { code: 500, msg: '服务器错误' }
    })
  }
}

// 获取当前用户的所有通知数量
const getAllNoticesNumber = async ctx => {
  const uid = ctx.uid;
  await queryDB(`select muid from meetu_users_muid where user_id="${uid}"`).then(async result => {
    if (!result.length) ctx.body = { code: 400, msg: '查无此用户' }
    else {
      const res = await redisClient(3).LLen(result[0].muid);
      ctx.body = { code: 200, data: { number: res } }
    }
  }).catch(err => {
    console.log("getAllNoticesNumber error: ", err);
    ctx.body = { code: 500, msg: '查询错误' }
  })
}

// 获取当前用户的所有通知
const getAllNotices = async ctx => {
  const uid = ctx.uid;
  await queryDB(`select muid from meetu_users_muid where user_id=${uid}`).then(async result => {
    if (!result.length) ctx.body = { code: 400, msg: '查无此用户' }
    else {
      const res = await redisClient(3).LRange(result[0].muid);
      const notices = res.map(item => JSON.parse(item))
      notices.forEach(item => {
        item.message = Buffer.from(item.message, "base64").toString(); // 将base64转换成中文
      })
      // 拿到所有的通知消息
      ctx.body = { code: 200, data: { notices: notices } }
    }
  }).catch(err => {
    console.log("getAllNotices error: ", err);
    ctx.body = { code: 500, msg: '查询错误' }
  })
}

module.exports = {
  addFriendRequest,
  getAllNoticesNumber,
  getAllNotices
}