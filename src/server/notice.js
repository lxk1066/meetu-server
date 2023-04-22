const redisClient = require("../utils/redis/redis");
const queryDB = require("../model/db");
const { delNotice } = require("../utils/deleteNotice");

class Notice {
  // 发送好友申请
  async addFriendRequest(ctx) {
    const uid = ctx.uid;
    const body = ctx.request.body;
    if (!body.muid || !body.message) {
      ctx.body = { code: 400, msg: "缺少必需参数muid和message" };
    } else {
      await queryDB(`select user_id,muid from meetu_users_muid where muid="${body.muid}" or user_id=${uid}`)
        .then(async result => {
          if (result.length <= 1) ctx.body = { code: 400, msg: "查无此用户" };
          else {
            const from_muid = result[0].user_id === uid ? result[0].muid : result[1].muid;
            const to_muid = body.muid;
            const base64Str = Buffer.from(body.message).toString("base64"); // 将中文转换成base64
            const time = +new Date();
            const res = await redisClient(3).RPush(
              to_muid,
              JSON.stringify({
                id: `${to_muid}-${time}`,
                type: "addFriend",
                from: from_muid,
                to: to_muid,
                message: base64Str,
                time: time
              })
            );
            if (res > 0) ctx.body = { code: 200, msg: "发送成功" };
            else ctx.body = { code: 400, msg: "发送失败" };
          }
        })
        .catch(err => {
          console.log("addFriendRequest error: ", err);
          ctx.body = { code: 500, msg: "服务器错误" };
        });
    }
  }

  // 同意好友请求
  async agreeFriendRequest(ctx) {
    const uid = ctx.uid;
    const body = ctx.request.body;
    if (!body || !body.noticeId) {
      ctx.body = { code: 400, msg: "缺少必需参数noticeId" };
    } else {
      const { item } = await delNotice(body.noticeId);
      if (item.type === "addFriend") {
        // 追加好友记录,但需要先查询好友关系是否已经存在
        await queryDB(`select user_muid,friend_muid from meetu_users_relation where 
                (user_muid=(select muid from meetu_users_muid where user_id='${uid}') and friend_muid="${item.to}")
                or (friend_muid=(select muid from meetu_users_muid where user_id='${uid}') and user_muid="${item.to}");`)
          .then(async result => {
            if (result.length) {
              ctx.body = { code: 404, msg: "好友关系已经存在" };
            } else {
              await queryDB(
                `INSERT INTO meetu_users_relation (user_muid, friend_muid) VALUES ('${item.from}', '${item.to}');`
              )
                .then(() => {
                  ctx.body = { code: 200, msg: "好友添加成功" };
                })
                .catch(err => {
                  console.log("agreeFriendRequest error: ", err);
                  if (err.errno === 1062) {
                    // mysql 1062错误代码表示插入重复主键记录
                    ctx.body = { code: 404, msg: "好友关系已经存在" };
                  } else {
                    ctx.body = { code: 500, msg: "好友添加失败" };
                  }
                });
            }
          })
          .catch(err => {
            console.log("agreeFriendRequest error: ", err);
            ctx.body = { code: 500, msg: "查询好友关系失败" };
          });
      } else {
        ctx.body = { code: 400, msg: "通知类型不正确" };
      }
    }
  }

  // 拒绝好友请求
  async disagreeFriendRequest(ctx) {
    const uid = ctx.uid;
    const body = ctx.request.body;
    if (!body || !body.noticeId) {
      ctx.body = { code: 400, msg: "缺少必需参数noticeId" };
    } else {
      const { item } = await delNotice(body.noticeId);
      const time = +new Date();
      // 向申请加好友的用户返回拒绝好友申请的通知
      const res2 = await redisClient(3).RPush(
        item.from,
        JSON.stringify({
          id: `${item.from}-${time}`,
          type: "disagreeFriend",
          from: item.to,
          to: item.from,
          message: Buffer.from("对方拒绝了你的好友申请").toString("base64"),
          time: time
        })
      );
      if (res2 > 0) ctx.body = { code: 200, msg: "返回拒绝好友通知成功" };
      else ctx.body = { code: 500, msg: "返回拒绝好友通知失败" };
    }
  }

  // 获取当前用户的所有通知数量
  async getAllNoticesNumber(ctx) {
    const uid = ctx.uid;
    await queryDB(`select muid from meetu_users_muid where user_id="${uid}"`)
      .then(async result => {
        if (!result.length) ctx.body = { code: 400, msg: "查无此用户" };
        else {
          const res = await redisClient(3).LLen(result[0].muid);
          ctx.body = { code: 200, data: { number: res } };
        }
      })
      .catch(err => {
        console.log("getAllNoticesNumber error: ", err);
        ctx.body = { code: 500, msg: "查询错误" };
      });
  }

  // 获取当前用户的所有通知
  async getAllNotices(ctx) {
    const uid = ctx.uid;
    await queryDB(`select muid from meetu_users_muid where user_id=${uid}`)
      .then(async result => {
        if (!result.length) ctx.body = { code: 400, msg: "查无此用户" };
        else {
          const res = await redisClient(3).LRange(result[0].muid);
          const notices = res.map(item => JSON.parse(item));
          notices.forEach(item => {
            item.message = Buffer.from(item.message, "base64").toString(); // 将base64转换成中文
          });
          // 拿到所有的通知消息
          ctx.body = { code: 200, data: { notices: notices } };
        }
      })
      .catch(err => {
        console.log("getAllNotices error: ", err);
        ctx.body = { code: 500, msg: "查询错误" };
      });
  }

  // 删除指定通知
  async deleteNotice(ctx) {
    // const uid = ctx.uid;
    const body = ctx.request.body;
    if (!body || !body.noticeId) {
      ctx.body = { code: 400, msg: "缺少必需参数noticeId" };
    } else {
      const { result } = await delNotice(body.noticeId);
      if (result > 0) {
        ctx.body = { code: 200, msg: "删除成功" };
      } else {
        ctx.body = { code: 400, msg: "删除失败" };
      }
    }
  }

  // 发送点赞帖子的通知
  async starPost(ctx) {
    const uid = ctx.uid;
    const { postId } = ctx.request.body;
    if (!postId) return { code: 400, msg: "缺少必需参数postId" };

    // 取得帖子所属的用户ID
    const sql1 = `select muid from meetu_square_articles where art_id=${postId}`;
    const sql2 = `select muid from meetu_users_muid where user_id=${uid}`;

    const [res1, res2] = await Promise.all([queryDB(sql1), queryDB(sql2)]).catch(err => {});
    if (res1.length > 0) {
      const from_muid = res2[0].muid;
      const to_muid = res1[0].muid;
      const message = Buffer.from(`点赞了你的帖子`).toString("base64");
      const time = +new Date();

      // 自己点赞自己 不需要发通知
      if (from_muid === to_muid) return { code: 200, msg: "ok" };

      // 向redis中push通知
      const res = await redisClient(3).RPush(
        to_muid,
        JSON.stringify({
          id: `${to_muid}-${time}`,
          type: "starPost",
          data: { postId: postId },
          from: from_muid,
          to: to_muid,
          message: message,
          time: time
        })
      );

      if (res > 0) return { code: 200, msg: "通知发送成功" };
      else return { code: 404, msg: "通知发送失败" };
    } else {
      return { code: 400, msg: "文章不存在" };
    }
  }
}

module.exports = new Notice();
