const Router = require("koa-router");
const userRouter = new Router({ prefix: "/user" });
const user = require("../server/user");
const notice = require("../server/notice");

userRouter
  // 用户登录
  .post("/login", user.login)
  // 用户注册
  .post("/reg", user.register)
  // 验证jwt_token是否正确
  .get("/verifyToken", user.verifyToken)
  // 发送邮件
  .post("/email", user.email)
  // 上传头像
  .post("/uploadProfile", user.uploadProfile)
  // 获取个人信息
  .get("/getPersonInfo/:uid", user.getPersonInfo)
  // 获取用户的邮箱地址
  .post("/getMailbox", user.getMailbox)
  // 获取头像
  .get("/getProfile/:filename", user.getProfile)
  // 修改用户名
  .post("/updateUsername", user.updateUsername)
  // 发送`修改用户密码`的邮件
  .post("/updatePasswordEmail", user.updatePasswordEmail)
  // 修改用户密码
  .post("/changePassword", user.changePassword)
  // 修改个性签名
  .post("/updateSign", user.updateSign)
  // 修改性别
  .post("/updateGender", user.updateGender)
  // 修改地区area
  .post("/updateArea", user.updateArea)
  // 修改邮箱地址
  .post("/modifyMailbox", user.modifyMailbox)
  // 发送`修改邮箱`的验证码邮件
  .post("/ModifyMailboxLetter", user.ModifyMailboxLetter)
  // 获取用户的MUID
  .get("/getUserMUID/:uid", user.getUserMUID)
  // 修改用户的MUID
  .post("/updateMUID", user.updateMUID)
  // 搜索MUID查找用户
  .post("/searchMUID", user.searchMUID)
  // 查询某个MUID是否为当前用户的好友
  .post("/isOwnFriend", user.isOwnFriend)
  // 获取当前用户的好友列表
  .post("/getAllFriends", user.getAllFriends)
  // 根据MUID来查询该用户的个人信息
  .get("/getMuidUserInfo/:muid", user.getMuidUserInfo)
  // 发送好友申请
  .post("/addFriendRequest", notice.addFriendRequest)
  // 获取当前用户的所有通知数量
  .post("/getAllNoticesNumber", notice.getAllNoticesNumber)
  // 获取当前用户的所有通知
  .post("/getAllNotices", notice.getAllNotices)
  // 删除指定通知
  .post("/deleteNotice", notice.deleteNotice)
  // 同意好友申请
  .post("/agreeFriendRequest", notice.agreeFriendRequest)
  // 拒绝好友申请
  .post("/disagreeFriendRequest", notice.disagreeFriendRequest);

module.exports = userRouter;
