// 引入koa、koa-body、koa-cors
const fs = require("fs");
const path = require("path");

const Koa = require("koa");
const { createServer } = require("http");
const https = require("https");
const sslify = require("koa-sslify").default;
const { Server: SocketServer } = require("socket.io");
const { koaBody } = require("koa-body");
const cors = require("koa2-cors");
const redisClient = require("./utils/redis/redis");
const { originConf } = require("./utils/corsOriginConf");
const { originHosts } = require("../project.config");

// 引入中间件
const middleware = require("./middleware/middleware");

// 引入路由
const router = require("./router/routers");

// 创建app实例对象
const app = new Koa();

// 注册中间件
app.use(cors({ origin: originConf }));
app.use(middleware);
app.use(koaBody({ multipart: true, formidable: { keepExtensions: true } }));
// 注册路由
app.use(router.routes(), router.allowedMethods());

// 错误处理
app.on("error", (err, ctx) => {
  console.log("server error: ", err, ctx);
});

// 将app挂载到httpServer
const httpServer = createServer(app.callback());

// socket.io
const io = new SocketServer(httpServer, {
  serveClient: false,
  cors: { originHosts }
});

io.on("connection", socket => {
  console.log("connect", socket.id);
  socket.on("set-user-id", async userId => {
    console.log("set-user-id", userId);
    socket.uid = userId;

    // 先把原来的删掉, 再存
    await redisClient(1)
      .delString(userId)
      .catch(() => {});
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

// 配置ssl证书
app.use(sslify);
const options = {
  key: fs.readFileSync(path.join(__dirname, "./ssl/custom.key")),
  cert: fs.readFileSync(path.join(__dirname, "./ssl/custom.pem"))
};

// 启动https服务
https.createServer(options, app.callback()).listen(8080, () => {
  console.log("https server is running at port 443");
});
