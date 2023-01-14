const Router = require('koa-router');
const square = require('../server/square')
const squareRouter = new Router({ prefix: '/square' });

squareRouter.post('/publishPost', square.publishPost)

squareRouter.get('/getPostList', square.getPostList)

squareRouter.get('/getPicture/:picName', square.getPicture)

squareRouter.get('/getPost/:artId', square.getPost)

module.exports = squareRouter
