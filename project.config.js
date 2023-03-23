// socket.io、CORS origin host
const originHosts = ["xxxxxxxx"];

// 数据库的配置信息
const DB = {
  host: "xxxxxxxx",
  user: "xxxxxxxx",
  password: "xxxxxxxx",
  database: "xxxxxxxx"
};

// redis的配置信息
const redis = {
  user: "xxxxxxxx",
  pass: "xxxxxxxx",
  host: "127.0.0.1",
  port: 6379,
  db: 0
};

// MQ队列的redis连接配置
const MQConnection = {
  user: "xxxxxxxx",
  pass: "xxxxxxxx,.",
  host: "127.0.0.1",
  port: 6379,
  db: 5
};

// MQ worker 默认作业选项
const MQDefaultJobOptions = {
  // 默认作业选项
  removeOnComplete: true, // 所有已完成的作业都将自动删除
  removeOnFail: 500, // 将最后500个失败的作业保留在队列中
  attempts: 3, // 重试失败作业的最多尝试次数
  backoff: {
    // 使用内置退避策略，用于重试失败作业
    // type: "fixed", // 每隔一段时间就重试失败作业，间隔时间为`delay`
    type: "exponential", // 指数退避，即在 2 ^ (第几次重试 - 1) * delay 毫秒后重试
    delay: 3000 // 重试失败作业的间隔时间
  }
};

// jwt secret
const jwtSecret = "xxxxxxxx";

// 前端的URL
const siteUrl = "xxxxxxxx";

// 登录成功后生成的json web token有效期时长
const LoginJwtExpiresIn = "7days";

// 广场发布帖子时图片的上限
const MaxPictures = 6;

// 上传的单个文件大小上限, 单位比特(bit)
const MaxFileSize = 5 * 1024 * 1024;

module.exports = {
  originHosts,
  DB,
  redis,
  MQConnection,
  MQDefaultJobOptions,
  EmailAccount,
  LoginJwtExpiresIn,
  jwtSecret,
  siteUrl,
  MaxPictures,
  MaxFileSize
};
