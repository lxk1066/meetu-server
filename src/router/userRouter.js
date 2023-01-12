const Router = require('koa-router')
const userRouter = new Router({ prefix: '/user' })
const user = require('../server/user')
const notice = require('../server/notice')

// 用户登录
userRouter.post('/login', user.login)

// 用户注册
userRouter.post('/reg', user.register)

// 验证jwt_token是否正确
userRouter.get('/verifyToken', user.verifyToken)

// 发送邮件
userRouter.post('/email', user.email)

// 上传头像
userRouter.post('/uploadProfile', user.uploadProfile)

// 获取个人信息
userRouter.get('/getPersonInfo/:uid', user.getPersonInfo)

// 获取用户的邮箱地址
userRouter.post('/getMailbox', user.getMailbox)

// 获取头像
userRouter.get('/getProfile/:filename', user.getProfile)

// 修改用户名
userRouter.post('/updateUsername', user.updateUsername)

// 发送`修改用户密码`的邮件
userRouter.post('/updatePasswordEmail', user.updatePasswordEmail)

// 修改用户密码
userRouter.post('/changePassword', user.changePassword)

// 修改个性签名
userRouter.post('/updateSign', user.updateSign)

// 修改性别
userRouter.post('/updateGender', user.updateGender)

// 修改地区area
userRouter.post('/updateArea', user.updateArea)

// 修改邮箱地址
userRouter.post('/modifyMailbox', user.modifyMailbox)

// 将每个用户的id返回
userRouter.post('/getAllUserId', user.getAllUserId)

// 发送`修改邮箱`的验证码邮件
userRouter.post('/ModifyMailboxLetter', user.ModifyMailboxLetter)

// 获取用户的MUID
userRouter.get('/getUserMUID/:uid', user.getUserMUID)

// 修改用户的MUID
userRouter.post('/updateMUID', user.updateMUID)

// 搜索MUID查找用户
userRouter.post('/searchMUID', user.searchMUID)

// 查询某个MUID是否为当前用户的好友
userRouter.post('/isOwnFriend', user.isOwnFriend)

// 获取当前用户的好友列表
userRouter.post('/getAllFriends', user.getAllFriends)

// 根据MUID来查询该用户的个人信息
userRouter.get('/getMuidUserInfo/:muid', user.getMuidUserInfo)

// 发送好友申请
userRouter.post('/addFriendRequest', notice.addFriendRequest)

// 获取当前用户的所有通知数量
userRouter.post('/getAllNoticesNumber', notice.getAllNoticesNumber)

// 获取当前用户的所有通知
userRouter.post('/getAllNotices', notice.getAllNotices)

// 删除指定通知
userRouter.post('/deleteNotice', notice.deleteNotice)

// 同意好友申请
userRouter.post('/agreeFriendRequest', notice.agreeFriendRequest)

// 拒绝好友申请
userRouter.post('/disagreeFriendRequest', notice.disagreeFriendRequest)

module.exports = userRouter
