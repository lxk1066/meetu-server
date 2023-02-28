// 引入koa、koa-body、koa-cors
const Koa = require("koa");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { koaBody } = require("koa-body");
const cors = require("koa2-cors");
const redisClient = require("./utils/redis/redis");
const { origin } = require("../project.config");

// 引入中间件
const userMiddleware = require("./middleware/user.middleware");

// 引入路由
const userRouter = require("./router/userRouter");
userRouter.prefix("/api");
const squareRouter = require("./router/squareRouter");
squareRouter.prefix("/api");

// 创建app实例对象
const app = new Koa();

// 注册中间件
app.use(
  cors({
    origin: ctx => {
      // 设置多个跨域域名
      const allowCross = origin;
      // header.referer 代表当前请求的来源地址，如果referer为空，代表是通过浏览器直接访问的或者是通过api测试工具直接调用
      // 默认不允许空referer访问
      ctx.header.referer = ctx.header.referer ? ctx.header.referer : "";
      const url = ctx.header.referer.substring(0, ctx.header.referer.length - 1);
      if (allowCross.includes(url)) return url;
      // return 'http://127.0.0.1:8000'
    }
  })
);
app.use(userMiddleware);
app.use(koaBody({ multipart: true, formidable: { keepExtensions: true } }));
app.use(userRouter.routes(), userRouter.allowedMethods());
app.use(squareRouter.routes(), squareRouter.allowedMethods());

// 错误处理
app.on("error", (err, ctx) => {
  console.log("server error: ", err, ctx);
});

// app.listen(8000, () => {
//   console.log('server is running on http://127.0.0.1:8000')
// })

// 将app挂载到httpServer
const httpServer = createServer(app.callback());
// socket.io
const io = new Server(httpServer, {
  serveClient: false,
  cors: {
    origin: origin
  }
});

io.on("connection", socket => {
  console.log("connect", socket.id);
  socket.on("set-user-id", async userId => {
    console.log("set-user-id", userId);
    socket.uid = userId;
    await redisClient(1).setString(userId, socket.id);
  });

  socket.on("online-message", async anotherUserId => {
    if (anotherUserId === socket.uid) {
      // 自己查询自己的在线状态
      await redisClient(1)
        .getString(socket.uid)
        .then(socketId => {
          if (socketId) socket.emit("online-message-reply-own", true);
          else socket.emit("online-message-reply-own", false);
        })
        .catch(() => {
          socket.emit("online-message-reply-own", false);
        });
    } else {
      // 查询其他人的在线状态
      await redisClient(1)
        .getString(anotherUserId)
        .then(anotherSocketId => {
          if (anotherSocketId) socket.emit(`online-message-reply-${socket.uid}`, true);
          else socket.emit(`online-message-reply-${socket.uid}`, false);
        })
        .catch(() => {
          socket.emit(`online-message-reply-${socket.uid}`, false);
        });
    }
  });

  socket.on("private-message", async (anotherUserId, msg, time) => {
    console.log("private-message", anotherUserId, msg);
    await redisClient(1)
      .getString(anotherUserId)
      .then(anotherSocketId => {
        if (anotherSocketId) socket.to(anotherSocketId).emit("private-message", socket.uid, anotherUserId, msg, time);
      });
  });
  socket.on("disconnect", async reason => {
    console.log("disconnect", socket.id);
    await redisClient(1)
      .delString(socket.uid)
      .catch(() => {});
  });
});

httpServer.listen(8000, () => {
  console.log("server is running on http://127.0.0.1:8000");
});
