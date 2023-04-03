const Router = require("koa-router");
const noticeRouter = new Router({ prefix: "/notice" });
const notice = require("../server/notice");

module.exports = noticeRouter;
