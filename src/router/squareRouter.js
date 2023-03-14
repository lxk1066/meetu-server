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
  .get("/getUserPostList/:uid", square.getUserPostList);

module.exports = squareRouter;
