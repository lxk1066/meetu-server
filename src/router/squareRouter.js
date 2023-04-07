const Router = require("koa-router");
const square = require("../server/square");
const squareRouter = new Router({ prefix: "/square" });

squareRouter
  // 发布帖子
  .post("/publishPost", square.publishPost)
  // 获取帖子列表
  .get("/getPostList", square.getPostList)
  // 获取指定名称的帖子图片
  .get("/getPicture/:picName", square.getPicture)
  // 获取帖子详情
  .get("/getPost/:artId", square.getPost)
  // 获取用户的帖子列表
  .get("/getUserPostList/:uid", square.getUserPostList)
  // 点赞某篇帖子
  .post("/starPost", square.starPost)
  // 查询用户是否点赞某篇帖子
  .get("/postStarStatus", square.getStarStatus)
  // 追加一条根评论
  .post("/commentPost", square.commentPost)
  // 回复根评论
  .post("/replyRootComment", square.replyRootComment)
  // 回复子评论
  .post("/replySubComment", square.replySubComment)
  // 获取某篇帖子的几条评论（未登录）
  .get("/getPostComment/:postId", square.getPostComment)
  // 获取某篇帖子的所有评论（已登录）
  .post("/getPostCommentList", square.getPostCommentList);

module.exports = squareRouter;
