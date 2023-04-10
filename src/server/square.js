const queryDB = require("../model/db");
const { transaction } = require("../model/transaction");
const streamWriter = require("../utils/streamWriter");
const path = require("path");
const fs = require("fs");
const { MaxPictures } = require("../../project.config");
const mime = require("mime-types");
const { starPost: starPostNotice } = require("../server/notice");

class Square {
  // 发布帖子
  async publishPost(ctx) {
    const uid = ctx.uid;
    const body = ctx.request.body;
    const files = ctx.request.files;
    if (!body) {
      ctx.body = { code: 4001, msg: "请求体不能为空" };
    } else if (!body.title || body.title.length < 5 || body.title.length > 30) {
      ctx.body = { code: 4002, msg: "帖子标题必须在5~30个字以内" };
    } else if (!body.content || body.content.length < 5 || body.content.length > 500) {
      ctx.body = { code: 4003, msg: "帖子内容必须在5~500个字以内" };
    } else {
      const successPictures = []; // 成功保存的图片
      let errResult = null; // 保存错误信息
      if (Reflect.get(files, "pictures")) {
        // 如果上传了图片就检查图片，然后将图片转换成文件保存到本地，最后向数据库插入数据
        const pictures = files.pictures instanceof Array ? files.pictures : [files.pictures];
        if (pictures.length > MaxPictures) {
          errResult = { code: 400, msg: "图片不能超过6张，请重新上传" };
        } else {
          // const successPictures = [];
          for (const picture of pictures) {
            const splits = picture.originalFilename.split(".");
            splits.splice(1, 0, `${+new Date()}`);
            const filename = `${uid}_${splits.join(".").replace(/[.]/, "_")}`;
            const result = await streamWriter(
              picture.filepath,
              path.join(__dirname, "../../media/squarePictures", filename)
            );
            if (result.status === "Done") successPictures.push({ filename, size: result.size });
            else {
              errResult = { code: 400, msg: result.error };
              break;
            }
          }
        }
        // 上传的图片中有部分没有保存成功
        if (pictures.length !== successPictures.length) {
          // 回滚操作:删除successPictures中的图片
          for (let item of successPictures) {
            fs.unlink(path.join(__dirname, "../../media/squarePictures", item.filename), () => {});
          }
          return (ctx.body = errResult);
        }
      }

      await queryDB(`insert into meetu_square_articles(title, content, muid, updated_time) values(
        "${body.title}",
        "${body.content}",
        (select muid from meetu_users_muid where user_id=${uid}),
        ${+new Date()})
      `)
        .then(async result => {
          if (successPictures.length) {
            const insertId = result.insertId;
            const sqls = [];
            successPictures.forEach(picture => {
              sqls.push(`insert into meetu_square_pictures(pic_name, size, art_id, updated_time) 
                     values("${picture.filename}",${picture.size},${insertId},"${+new Date()}");`);
            });
            await transaction(sqls)
              .then(arrResult => {
                ctx.body = { code: 200, msg: "发布成功" };
              })
              .catch(err => {
                // 回滚操作，将保存的图片删除
                for (let item of successPictures) {
                  fs.unlink(path.join(__dirname, "../../media/squarePictures", item.filename), () => {});
                }
                ctx.body = { code: 500, msg: "图片数据保存失败，请重新上传" };
              });
          } else {
            ctx.body = { code: 200, msg: "发布成功" };
          }
        })
        .catch(err => {
          // 回滚操作，将保存的图片删除
          for (let item of successPictures) {
            fs.unlink(path.join(__dirname, "../../media/squarePictures", item.filename), () => {});
          }
          ctx.body = { code: 500, msg: "帖子数据保存失败" };
        });
    }
  }

  // 获取帖子列表
  async getPostList(ctx) {
    /**
     * /api/square/getPostList?order=time&offset=跳过多少条记录&limit=取多少条记录
     * order 代表排序方式，可选值：time | hot
     * offset 代表跳过前面的多少条记录
     * limit 代表从offset后一位开始取多少条记录
     */
    let { order = "time", offset = "0", limit = "10" } = ctx.request.query;
    offset = parseInt(offset);
    limit = parseInt(limit);
    if (!["time", "hot"].includes(order)) {
      return (ctx.body = { code: 400, msg: "order查询参数错误" });
    } else if (!Number.isInteger(offset) || !Number.isInteger(limit)) {
      return (ctx.body = { code: 400, msg: "offset或limit查询参数错误" });
    } else {
      const sql1 = `select * from meetu_square_articles order by updated_time desc limit ${offset}, ${limit};`;
      const sql2 = `select * from meetu_square_articles where updated_time <= (select updated_time from meetu_square_articles order by updated_time desc limit ${offset}, 1) order by updated_time desc limit ${limit};`;
      await queryDB(offset <= 10 ? sql1 : sql2)
        .then(async result => {
          for (const item of result) {
            const index = result.indexOf(item);
            const res = await queryDB(
              `select pic_id,pic_name,updated_time as pic_updated_time from meetu_square_pictures where art_id=${item.art_id}`
            );
            result[index].pictures = [...res];
          }
          return (ctx.body = { code: 200, msg: "查询成功", data: { result } });
        })
        .catch(err => {
          console.log("getPostList error: ", err);
        });
    }
  }

  // 获取指定名称的帖子图片
  async getPicture(ctx) {
    const picName = Reflect.get(ctx.params, "picName");
    let picPath = path.join(__dirname, "../../media/squarePictures/", picName);
    let picData = null;
    if (!picName) {
      ctx.body = { code: 400, msg: "缺少必需的图片名称" };
    } else {
      try {
        picData = fs.readFileSync(picPath); //读取文件
      } catch (error) {
        //如果服务器不存在请求的图片，返回默认图片
        picPath = path.join(__dirname, "../../media/squarePictures/default.png"); //默认图片地址
        picData = fs.readFileSync(picPath); //读取文件
      } finally {
        const mimeType = mime.lookup(picPath); // 文件类型
        ctx.set("Content-Type", mimeType);
        ctx.body = picData; //返回图片
      }
    }
  }

  // 获取帖子详情
  async getPost(ctx) {
    const artId = ctx.params.artId;
    let resultObj = {};
    await queryDB(`select * from meetu_square_articles where art_id=${artId}`)
      .then(async result => {
        if (result.length > 0) {
          const res = await queryDB(
            `select pic_id,pic_name,updated_time as pic_updated_time from meetu_square_pictures where art_id=${result[0].art_id}`
          );
          result[0].pictures = [...res];
          resultObj = { code: 200, msg: "获取帖子数据成功", data: { result: result[0] } };
        } else {
          resultObj = { code: 400, msg: "该帖子未找到" };
        }
      })
      .catch(err => {
        console.log("getPost error: ", err);
        resultObj = { code: 500, msg: "获取文章数据失败" };
      });
    ctx.body = resultObj;
  }

  // 获取用户的帖子列表
  async getUserPostList(ctx) {
    /**
     * 获取当前用户的id，查询所有的post
     * select art_id,title,content,updated_time from meetu_square_articles
     *      where muid=(select muid from meetu_users_muid where user_id=1);
     */
    const uid = ctx.params.uid;

    const userCount = await queryDB(`SELECT COUNT(uid) as userCount FROM meetu_users WHERE uid="${uid}"`);
    if (userCount[0].userCount <= 0) return (ctx.body = { code: 400, msg: "用户不存在" });

    const sql = `
      select art_id,title,content,updated_time from meetu_square_articles
      where muid=(select muid from meetu_users_muid where user_id=${uid})
      order by updated_time desc;
    `;

    const res = await queryDB(sql);
    ctx.body = { code: 200, data: res };
  }

  // 点赞某篇帖子
  async starPost(ctx) {
    const uid = ctx.uid;
    const { postId } = ctx.request.body;

    if (!postId) return (ctx.body = { code: 400, msg: "缺少必需参数postId" });

    // 判断用户是否点赞，如果已点赞则取消点赞，否则就点赞
    const sql1 = `SELECT art_id from meetu_square_stars where user_id=${uid} and art_id=${postId}`;
    const res = await queryDB(sql1).catch(err => {
      console.log("starPost Error: " + err);
    });

    if (res.length > 0) {
      // 取消点赞
      const sql2 = `DELETE from meetu_square_stars WHERE user_id=${uid} and art_id=${postId}`;
      const sql3 = `UPDATE meetu_square_articles SET star=star-1 WHERE art_id=${postId}`;
      const res = await transaction([sql2, sql3]).catch(err => {
        console.log("starPost -> 取消点赞:", err);
      });
    } else {
      // 点赞
      const sql4 = `UPDATE meetu_square_articles SET star=star+1 WHERE art_id=${postId}`;
      const sql5 = `INSERT INTO meetu_square_stars(art_id, user_id) VALUES(${postId}, ${uid})`;
      const res = await transaction([sql4, sql5]).catch(err => {
        console.log("starPost -> 点赞:", err);
      });

      // 发送点赞帖子的通知
      if (Array.isArray(res) && res.length > 0) {
        const result = await starPostNotice(ctx);
        if (result.code !== 200) return (ctx.body = result.msg);
      }
    }

    return (ctx.body = { code: 200, msg: "ok" });
  }

  // 查询用户是否点赞某篇帖子
  async getStarStatus(ctx) {
    // const uid = ctx.uid;
    const { userId: uid, postId } = ctx.request.query;

    if (!postId || !uid) return (ctx.body = { code: 400, msg: "缺少查询参数postId或uid" });
    else if (Number.isInteger(postId) || Number.isInteger(uid))
      return (ctx.body = { code: 400, msg: "请传入正确的postId或uid" });

    // 判断用户是否点赞
    const sql1 = `SELECT art_id from meetu_square_stars where user_id=${Number(uid)} and art_id=${Number(postId)}`;
    const res = await queryDB(sql1).catch(err => {
      console.log("getStarStatus Error: " + err);
      return (ctx.body = { code: 500, msg: "" });
    });

    if (res.length > 0) {
      return (ctx.body = { code: 200, msg: "已点赞" });
    } else {
      return (ctx.body = { code: 404, msg: "未点赞" });
    }
  }

  // 追加一条根评论
  async commentPost(ctx) {
    const uid = ctx.uid;
    const { postId, content } = ctx.request.body;
    if (!postId) return (ctx.body = { code: 400, msg: "评论ID不能为空" });
    if (!content) return (ctx.body = { code: 400, msg: "评论内容不能为空" });

    // 获取用户名
    const sql1 = `select username from meetu_users where uid=${uid}`;
    // 判断postId是否存在
    const sql2 = `SELECT art_id FROM meetu_square_articles WHERE art_id = ${postId}`;

    const resultArr = await Promise.all([queryDB(sql1), queryDB(sql2)]).catch(err => {
      console.log("commentPost error: " + err);
      return (ctx.body = { code: 500, msg: "服务端错误" });
    });

    const username = resultArr[0][0].username;
    const createdTime = Date.now();

    if (!resultArr[1]?.[0] || resultArr[1][0].length == 0) return (ctx.body = { code: 400, msg: "帖子不存在" });

    // 插入评论
    const commentSql = `
      INSERT INTO meetu_square_comments(content,art_id,user_id,username,created_time)
       VALUES("${content}",${postId},${uid},"${username}","${createdTime}")
    `;

    const result = await queryDB(commentSql).catch(err => {
      console.log("commentPost error: " + err);
      return (ctx.body = ctx.body = { code: 500, msg: "服务端错误" });
    });

    ctx.body = {
      code: 200,
      msg: "ok",
      data: {
        id: result.insertId,
        content: content,
        rootCommentId: null,
        toCommentId: null,
        art_id: postId,
        user_id: uid,
        username: username,
        created_time: createdTime
      }
    };
  }

  // 回复根评论
  async replyRootComment(ctx) {
    const uid = ctx.uid;
    const { postId, content, rootCommentId } = ctx.request.body;
    if (!postId) return (ctx.body = { code: 400, msg: "评论ID不能为空" });
    if (!content) return (ctx.body = { code: 400, msg: "评论内容不能为空" });
    if (!rootCommentId) return (ctx.body = { code: 400, msg: "根评论ID不能为空" });

    // 获取用户名
    const sql1 = `select username from meetu_users where uid=${uid}`;
    // 判断postId是否存在
    const sql2 = `SELECT art_id FROM meetu_square_articles WHERE art_id = ${postId}`;
    // 判断根评论ID是否存在
    const sql3 = `SELECT id FROM meetu_square_comments WHERE id = ${rootCommentId}`;

    const resultArr = await Promise.all([queryDB(sql1), queryDB(sql2), queryDB(sql3)]).catch(err => {
      console.log("replyRootComment error: " + err);
      return (ctx.body = { code: 500, msg: "服务端错误" });
    });

    const username = resultArr[0][0].username;
    const createdTime = Date.now();

    if (!resultArr[1]?.[0] || resultArr[1][0].length == 0) return (ctx.body = { code: 400, msg: "帖子不存在" });
    if (!resultArr[2]?.[0] || resultArr[2][0].length == 0) return (ctx.body = { code: 400, msg: "根评论不存在" });

    // 插入评论
    const commentSql = `
      INSERT INTO meetu_square_comments(content,rootCommentId,art_id,user_id,username,created_time)
       VALUES("${content}",${rootCommentId},${postId},${uid},"${username}","${createdTime}")
    `;

    const result = await queryDB(commentSql).catch(err => {
      console.log("commentPost error: " + err);
      return (ctx.body = ctx.body = { code: 500, msg: "服务端错误" });
    });

    ctx.body = {
      code: 200,
      msg: "ok",
      data: {
        id: result.insertId,
        content: content,
        rootCommentId: rootCommentId,
        toCommentId: null,
        art_id: postId,
        user_id: uid,
        username: username,
        created_time: createdTime
      }
    };
  }

  // 回复子评论
  async replySubComment(ctx) {
    const uid = ctx.uid;
    const { postId, content, rootCommentId, toCommentId } = ctx.request.body;
    if (!postId) return (ctx.body = { code: 400, msg: "评论ID不能为空" });
    if (!content) return (ctx.body = { code: 400, msg: "评论内容不能为空" });
    if (!rootCommentId) return (ctx.body = { code: 400, msg: "根评论ID不能为空" });
    if (!toCommentId) return (ctx.body = { code: 400, msg: "子评论ID不能为空" });

    // 获取用户名
    const sql1 = `select username from meetu_users where uid=${uid}`;
    // 判断postId是否存在
    const sql2 = `SELECT art_id FROM meetu_square_articles WHERE art_id = ${postId}`;
    // 判断根评论ID或子评论ID是否存在
    const sql3 = `SELECT COUNT(id) as count FROM meetu_square_comments WHERE id = ${rootCommentId} OR id = ${toCommentId}`;

    const resultArr = await Promise.all([queryDB(sql1), queryDB(sql2), queryDB(sql3)]).catch(err => {
      console.log("replyRootComment error: " + err);
      return (ctx.body = { code: 500, msg: "服务端错误" });
    });

    const username = resultArr[0][0].username;
    const createdTime = Date.now();

    if (!resultArr[1]?.[0] || resultArr[1][0].length == 0) return (ctx.body = { code: 400, msg: "帖子不存在" });
    if (!resultArr[2]?.[0] || resultArr[2][0].count !== 2)
      return (ctx.body = { code: 400, msg: "根评论或子评论不存在" });

    // 插入评论
    const commentSql = `
      INSERT INTO meetu_square_comments(content,rootCommentId,toCommentId,art_id,user_id,username,created_time)
       VALUES("${content}",${rootCommentId},${toCommentId},${postId},${uid},"${username}","${createdTime}")
    `;

    const result = await queryDB(commentSql).catch(err => {
      console.log("commentPost error: " + err);
      return (ctx.body = ctx.body = { code: 500, msg: "服务端错误" });
    });

    ctx.body = {
      code: 200,
      msg: "ok",
      data: {
        id: result.insertId,
        content: content,
        rootCommentId: rootCommentId,
        toCommentId: toCommentId,
        art_id: postId,
        user_id: uid,
        username: username,
        created_time: createdTime
      }
    };
  }

  // 获取某篇帖子的几条评论（未登录）
  async getPostComment(ctx) {
    const { postId } = ctx.request.params;
    if (!postId) return (ctx.body = { code: 400, msg: "帖子ID不能为空" });

    const sql = `SELECT * FROM meetu_square_comments WHERE art_id=${postId} AND rootCommentId is NULL ORDER BY created_time LIMIT 3`;
    const sql2 = `SELECT COUNT(*) as count FROM meetu_square_comments WHERE art_id=${postId}`;
    const result = await Promise.all([queryDB(sql), queryDB(sql2)]).catch(err => {
      console.log("getPostComment Error: " + err);
      return (ctx.body = { code: 500, msg: "查询数据库失败" });
    });

    return (ctx.body = { code: 200, msg: "ok", data: { comments: result[0], total: result[1][0].count } });
  }

  // 获取某篇帖子的所有评论（已登录）
  async getPostCommentList(ctx) {
    // const uid = ctx.uid;
    const { postId } = ctx.request.body;
    if (!postId) return (ctx.body = { code: 400, msg: "帖子ID不能为空" });

    const sql = `SELECT * FROM meetu_square_comments WHERE art_id=${postId} ORDER BY created_time DESC`;
    const result = await queryDB(sql).catch(err => {
      console.log("getPostCommentList Error: " + err);
      return (ctx.body = { code: 500, msg: "查询数据库失败" });
    });

    return (ctx.body = { code: 200, msg: "ok", data: { comments: result, total: result.length } });
  }
}

module.exports = new Square();
