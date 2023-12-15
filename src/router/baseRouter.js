const Router = require("koa-router");
const base = require("../server/base");
const baseRouter = new Router({ prefix: "/base" });

baseRouter
  // 服务器时间
  .get("/serverTime", base.calculateClockError)
  // 获取信息配置
  .get("/infoConfig", base.getInfoConfig);

module.exports = baseRouter;
