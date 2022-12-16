const { verifyJwt } = require('../utils/verifyJWT')
userMiddleware = async (ctx, next) => {
  // 该数组中的请求路由不需要验证 jwt_token
  const arr = ['/api/user/login', '/api/user/reg', '/api/user/email', '/api/user/changePassword']
  if ( ctx.request.method === 'GET' || arr.find(item => item === ctx.request.url) ) {
    await next()
  } else {
    // 访问其他路由都需要验证jwt_token
    const token = await ctx.request.get('authorization');

    if (token) {
      await verifyJwt(token).then(async res => {
        ctx.uid = res.uid
        await next()
      }).catch(() => {
        ctx.body = { code: 403, msg: 'token错误' }
      })

    } else {
      ctx.body = { code: 403, msg: '无权限' }
    }
  }
}

module.exports = userMiddleware
