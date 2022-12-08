// 引入koa、koa-body、koa-cors
const Koa = require('koa')
const { createServer } = require("http")
const { Server } = require("socket.io")
const { koaBody } = require('koa-body')
const cors = require('koa2-cors')
require('path');
const { onFileBegin } = require('./utils/onFileBegin')
const redisClient = require("./utils/redis/redis")

// 引入中间件
const userMiddleware = require('./middleware/user.middleware')

// 引入路由
const userRouter = require('./router/userRouter')
userRouter.prefix('/api')

// 创建app实例对象
const app = new Koa()

// 注册中间件
app.use(cors({ origin: "*" }))
app.use(userMiddleware)
app.use(koaBody({
  multipart:true,
  formidable:{
    maxFieldsSize:10*1024*1024,
    keepExtensions: true,
    onFileBegin: onFileBegin
  }
}))
app.use(userRouter.routes(), userRouter.allowedMethods())

// 错误处理
app.on("error", (err, ctx) => {
  console.log("server error: ", err, ctx)
})

// app.listen(8000, () => {
//   console.log('server is running on http://127.0.0.1:8000')
// })

// 将app挂载到httpServer
const httpServer = createServer(app.callback());
// socket.io
const io = new Server(httpServer, { serveClient: false, cors: {
  origin: ["http://127.0.0.1:8000", "http://127.0.0.1:8080", "http://nightkitty.space3v.work"]
} });

io.on("connection", (socket) => {
  console.log("connect", socket.id);
  socket.on("set-user-id", async userId => {
    console.log("set-user-id", userId)
    socket.uid = userId
    await redisClient(1).setString(userId, socket.id)
  })

  socket.on("online-message", async anotherUserId => {
    await redisClient(1).getString(anotherUserId).then(anotherSocketId => {
      if (anotherSocketId) socket.emit(`online-message-reply-${socket.uid}`, true)
      else socket.emit(`online-message-reply-${socket.uid}`, false)
    }).catch(err => {
      socket.emit(`online-message-reply-${socket.uid}`, false)
    })
  })

  socket.on("private-message", async (anotherUserId, msg, time) => {
    console.log("private-message", anotherUserId, msg);
    await redisClient(1).getString(anotherUserId).then(anotherSocketId => {
      if (anotherSocketId) socket.to(anotherSocketId).emit("private-message", socket.uid, anotherUserId, msg, time);
    })
  });
  socket.on("disconnect", async reason => {
    console.log("disconnect", socket.id);
    await redisClient(1).delString(socket.uid).catch(() => {})
  })
});

httpServer.listen(8000, () => {
  console.log('server is running on http://127.0.0.1:8000')
});
