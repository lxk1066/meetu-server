/**
 * 将所有的子路由全部合并到一个路由中，最后导出给入口文件使用
 */

const Router = require("koa-router");
const router = new Router({ prefix: "/api" });

const userRouter = require("./userRouter");
const squareRouter = require("./squareRouter");

router.use(userRouter.routes());
router.use(squareRouter.routes());

module.exports = router;
