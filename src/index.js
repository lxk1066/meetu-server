// 引入koa、koa-body、koa-cors
const Koa = require('koa')
const { koaBody } = require('koa-body')
const cors = require('koa2-cors')
const path = require('path')
const { onFileBegin } = require('./utils/onFileBegin')

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

app.listen(8000, () => {
  console.log('server is running on http://127.0.0.1:8000')
})