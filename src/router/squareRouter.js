const Router = require('koa-router');
const squareRouter = new Router({ prefix: '/square' });
const square = require('../server/square')

squareRouter.post('/publishPost', square.publishPost)

module.exports = squareRouter
