const { verifyJwt } = require('../utils/verifyJWT')
userMiddleware = async (ctx, next) => {
  if (ctx.request.url === '/api/user/login' || ctx.request.url === '/api/user/reg' || ctx.request.url === '/api/user/email' || ctx.request.method === 'GET') {
    await next()
  } else {
    // 访问其他路由都需要验证jwt_token
    const token = await ctx.request.get('authorization');

    if (token) {
      let res;
      try {
        res = await verifyJwt(token)
      } catch (e) {
        ctx.body = { code: 403, msg: 'token错误' }
        return
      } finally {
        ctx.uid = res.uid
        await next()
      }

    } else {
      ctx.body = { code: 403, msg: '无权限' }
    }
  }
}

module.exports = userMiddleware