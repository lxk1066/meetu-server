const Router = require('koa-router')
const userRouter = new Router({ prefix: '/user' })
const queryDB = require('../model/db')
const jwt = require('../utils/jwt') // 生成jwt
const { jwtSecret } = require('../../project.config')
const { encryptPassword } = require('../utils/encryptPassword') // 将明文密码用sha256加密
const { verifyJwt } = require('../utils/verifyJWT') // 验证jwt_token是否合法
const sendMail = require('../utils/email.js') // 发送邮件
const randomCode = require('../utils/randomCode') // 生成随机验证码
const redisClient = require('../utils/redis/redis')
const fs = require('fs')
const path = require('path')
const mime = require('mime-types')

// 用户登录
userRouter.post('/login', async (ctx) => {
  // 1.拿到请求体中的用户名和密码并验证
  const user = ctx.request.body;

  // 2.查验数据库
  let res;
  if (/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(user.username)) {
    res = await queryDB(`select uid,username,password from meetu_users where email="${user.username}"`)
  } else {
    res = await queryDB(`select uid,username,password from meetu_users where username="${user.username}"`)
  }

  if (res.length <= 0) {
    ctx.body = { code: 403, msg: "用户名或密码错误！" }
  } else if (encryptPassword(user.password) !== res[0].password) {
    ctx.body = { code: 403, msg: "用户名或密码错误！" }
  } else {
    // 2.如果验证成功，生成token
    const token = await jwt.sign({
      uid: res[0].uid
    }, jwtSecret, { expiresIn: '24h' })
    // 将token挂载到http的authorization
    // ctx.set('Authorization', token);
    ctx.body = {
      code: 200,
      msg: "登录成功",
      token: token,
      uid: res[0].uid
    }
  }
})

// 用户注册
userRouter.post('/reg', async (ctx) => {
  // 1.拿到请求体中的用户名和密码并验证
  const user = ctx.request.body;

  if (!user.username) {
    ctx.body = { code: 400, msg: '用户名不得为空' }
  } else if (!user.password) {
    ctx.body = { code: 400, msg: '密码不得为空' }
  } else if (!user.email) {
    ctx.body = { code: 400, msg: '邮箱不得为空' }
  } else if (!user.emailVerifyCode) {
    ctx.body = { code: 400, msg: '验证码不得为空' }
  } else if (user.username.toString().length < 4 || user.username.toString().length > 30) {
    ctx.body = { code: 400, msg: '用户名不得少于4个字符' }
  } else if (!/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(user.email.toString())) {
    ctx.body = { code: 400, msg: '邮箱格式错误！' }
  } else if (!/^(?=.*[a-zA-Z])(?=.*[0-9])[A-Za-z0-9,._!@#$^&*]{8,20}$/.test(user.password.toString())) {
    ctx.body = { code: 400, msg: '密码8~20位，必须包含大小写字母和数字，特殊字符可选(,._!@#$^&*)' }
  } else {

    // 2.验证邮箱
    if (await redisClient(0).exists(user.email) === 0) {
      return ctx.body = { code: 400, msg: '验证码已过期或不存在！' }
    } else {
      const verifyCode = await redisClient(0).getString(user.email)
      if (String(user.emailVerifyCode) !== verifyCode) return ctx.body = { code: 400, msg: '验证码无效！' }
    }

    // 3.查验数据库
    const res1 = await queryDB(`select username,email from meetu_users where username="${user.username}"`)
    const res2 = await queryDB(`select username,email from meetu_users where email="${user.email}"`)

    if (res1.length === 0 && res2.length === 0) {
      // 允许注册
      await redisClient(0).delString(user.email)
      await queryDB(`INSERT INTO meetu_users 
                      (username, password, email, profile, gender, sign, area) 
                      VALUES("${user.username}", "${encryptPassword(user.password)}", "${user.email}", 
                      "default.png", "secrecy", "这个人很懒，什么都没有写。", "secrecy")`)

      ctx.body = { code: 200, msg: '注册成功' }
    } else {
      if (res1.length) {
        // 用户名已存在
        ctx.body = { code: 400,  msg: '用户名已存在' }
      } else if (res2.length) {
        // 邮箱已被注册
        ctx.body = { code: 400, msg: '邮箱已被注册' }
      }
    }
  }

})

// 验证jwt_token是否正确
userRouter.get('/verifyToken', async (ctx) => {
  const token = ctx.request.get('authorization')
  verifyJwt(token).then((results) => {
    console.log(results)
    ctx.body = { code: 200, msg: "有效Token" }
  }).catch((err) => {
    console.log(err)
    // ctx.app.emit("error", )
    ctx.body = { code: 403, msg: "无效Token" }
  })
})

// 发送邮件
userRouter.post('/email', async (ctx) => {
  const emailBox = ctx.request.body.email
  if (await redisClient(0).exists(emailBox)) {
    ctx.body = { code: 400, msg: "验证码已存在" }
  } else {
    // 生成随机验证码
    const verifyCode = randomCode(6)
    // 将验证码存储到redis中
    let setStringResult = await redisClient(0).setString(emailBox, verifyCode, 60 * 5)
    while (setStringResult !== 'OK') {
      setStringResult = await redisClient(0).setString(emailBox, verifyCode, 60 * 5)
    }
    // 发送邮件
    const emailContent = `<p>尊敬的用户你好，你正在[Meetu]申请注册账号，验证码：${verifyCode}，5分钟内有效。请确认是否为本人操作，如果不是，请忽略本邮件。</p>
                          <h1 style="font-size: 25px;text-align: left;">${verifyCode}</h1>`
    const res = await sendMail('[Meetu]验证码', emailBox, emailContent)

    if (res.err) {
      ctx.body = { code: 403, msg: res.err }
    } else if (res.data) {
      ctx.body = { code: 200, msg: '邮件发送中，请注意查收！', data: res.data }
    }
  }
})

// 上传头像
userRouter.post('/upload', async (ctx) => {
  const uid = ctx.uid;
  const files = ctx.request.files;
  const key = Object.keys(files)[0];

  if (files[key].length) {
    files[key].forEach((item, index) => {
      if (index !== 0) { fs.unlink(item.filepath, (err) => {}) }
    })
  }

  let newProfile;
  try {
    files[key][0].length
    newProfile = files[key][0].newFilename
  } catch(e) {
    newProfile = files[key].newFilename
  }

  try {
    // 如果用户之前上传过图片，需要将旧的删掉
    const res = await queryDB(`select profile from meetu_users where uid="${uid}"`)

    await queryDB(`UPDATE meetu_users SET profile="${newProfile}" WHERE uid=${parseInt(uid)}`)

    if (res[0].profile !== 'default.png') {
      fs.unlink(path.join(__dirname, '../../media/profile/', res[0].profile), (err) => {})
    }

    ctx.body = { code: 200, msg: '上传成功' }
  } catch (e) {
    ctx.body = { code: 500, msg: '上传失败' }
  }
})

// 获取个人信息
userRouter.get('/getPersonInfo/:uid', async (ctx) => {
  const uid = ctx.params.uid;
  const res = await queryDB(`select username,profile,gender,sign,area from meetu_users where uid=${uid}`);
  // console.log(res);

  ctx.body = {
    code: 200,
    data: {
      profile: res[0].profile,
      username: res[0].username,
      gender: res[0].gender,
      sign: res[0].sign,
      area: res[0].area
    }
  }
})

// 获取用户的邮箱地址
userRouter.post('/getMailbox', async (ctx) => {
  const uid = ctx.uid;
  const res = await queryDB(`select email from meetu_users where uid=${uid}`);
  const email = res[0].email
  const number = email.slice(0, email.indexOf('@'))
  const suffix = email.slice(email.indexOf('@'), email.length)

  ctx.body = {
    code: 200,
    data: {
      email: `${number.slice(0, 3)}****${number.slice(number.length - 3, number.length)}${suffix}`
    }
  }
})

// 获取头像
userRouter.get('/getProfile/:filename', async (ctx) => {
  const filename = ctx.params.filename;
  let filePath = path.join(__dirname, '../../media/profile/', filename)
  let file;
  try {
    file = fs.readFileSync(filePath); //读取文件
  } catch (error) {
    //如果服务器不存在请求的图片，返回默认图片
      filePath = path.join(__dirname, '../../media/profile/default.png'); //默认图片地址
      file = fs.readFileSync(filePath); //读取文件
  }
  const mimeType = mime.lookup(filePath); // 文件类型
  ctx.set('Content-Type', mimeType); //设置返回类型
	ctx.body = file; //返回图片
})

// 修改用户名
userRouter.post('/updateUsername', async (ctx) => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  if (!body.username || body.username.toString().length < 4 || body.username.toString().length > 30) {
    ctx.body = { code: 400, msg: '用户名必须为4~30个字符' }
  } else {
    await queryDB(`select uid from meetu_users where username="${body.username}"`).then(async result => {
      if (result.length > 0) {
        ctx.body = { code: 400, msg: '用户名已存在' }
      } else {
        await queryDB(`UPDATE meetu_users SET username="${body.username}" WHERE uid=${parseInt(uid)}`).then(result => {
          ctx.body = { code: 200, msg: '修改成功' }
        }).catch(err => {
          ctx.body = { code: 500, msg: '修改失败' }
        })
      }
    }).catch(err => {
      ctx.body = { code: 500, msg: '查询数据库错误' }
    })

  }
})

// 修改个性签名
userRouter.post('/updateSign', async (ctx) => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  if (!body.sign || body.sign.toString().trim().length > 80) {
    ctx.body = { code: 400, msg: '个性签名必须为1~80个字符' }
  } else {
    await queryDB(`UPDATE meetu_users SET sign="${body.sign}" WHERE uid=${parseInt(uid)}`).then(result => {
      ctx.body = { code: 200, msg: '修改成功' }
    }).catch(err => {
      ctx.body = { code: 500, msg: '修改失败' }
    })
  }
})

// 修改性别
userRouter.post('/updateGender', async (ctx) => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  if (!body.gender || (body.gender !== 'male' && body.gender !== 'female')) {
    ctx.body = { code: 400, msg: '性别必须为 male、female 其中之一' }
  } else {
    await queryDB(`select gender from meetu_users WHERE uid=${parseInt(uid)}`).then(async result => {
      if (result[0].gender === 'male' || result[0].gender === 'female') {
        ctx.body = { code: 400, msg: '性别只能修改一次哦' }
      } else {
        await queryDB(`UPDATE meetu_users SET gender="${body.gender}" WHERE uid=${parseInt(uid)}`).then(result => {
          ctx.body = { code: 200, msg: '修改成功' }
        }).catch(err => {
          ctx.body = { code: 500, msg: '修改失败' }
        })
      }
    })
  }
})


// 修改地区area
userRouter.post('/updateArea', async (ctx) => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  const area = body.area.toString().trim()
  if (!body.area || area.length > 30 || area.split('/').length !== 3) {
    ctx.body = { code: 400, msg: '地区格式不合法，正确格式为: 省份/城市/区县。' }
  } else {
    await queryDB(`UPDATE meetu_users SET area="${area}" WHERE uid=${parseInt(uid)}`).then(result => {
      ctx.body = { code: 200, msg: '修改成功' }
    }).catch(err => {
      ctx.body = { code: 500, msg: '修改失败' }
    })
  }
})

// 修改邮箱地址
userRouter.post('/modifyMailbox', async (ctx) => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  const res = await queryDB(`select email from meetu_users where uid=${uid}`);
  const emailPattern = /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/;
  if (!body.newEmail || !emailPattern.test(body.newEmail)) {
    ctx.body = { code: 400, msg: '邮箱格式不合法' }
  } else {
    await queryDB(`UPDATE meetu_users SET email="${body.newEmail}" WHERE uid=${parseInt(uid)}`).then(async result => {
      if (res[0].email) await redisClient(2).delString(res[0].email)
      ctx.body = { code: 200, msg: '修改成功' }
    }).catch(err => {
      ctx.body = { code: 500, msg: '修改失败' }
    })
  }
})

// 将每个用户的id返回
userRouter.post('/getAllUserId', async (ctx) => {
  const res = await queryDB('select uid from meetu_users');
  ctx.body = { code: 200, data: res }
})

// 发送`修改邮箱`的验证码邮件
userRouter.post('/ModifyMailboxLetter', async (ctx) => {
  const uid = ctx.uid;
  const res = await queryDB(`select email from meetu_users where uid=${uid}`);
  const email = res[0].email;
  if (await redisClient(2).exists(email)) {
    ctx.body = { code: 400, msg: "验证码已存在" }
  } else {
    // 生成随机验证码
    const verifyCode = randomCode(6)
    // 将验证码存储到redis中
    let setStringResult = await redisClient(2).setString(email, verifyCode, 60 * 5)

    while (setStringResult !== 'OK') {
      setStringResult = await redisClient(2).setString(email, verifyCode, 60 * 5)
    }
    // 发送邮件
    const emailContent = `<p>尊敬的用户你好，你正在[Meetu]申请修改邮箱地址，验证码：${verifyCode}，5分钟内有效。请确认是否为本人操作，如果不是，请忽略本邮件。</p>
                          <h1 style="font-size: 25px;text-align: left;">${verifyCode}</h1>`
    const sendMailResult = await sendMail('[Meetu]验证码', email, emailContent)
    if (sendMailResult.err) {
      ctx.body = { code: 403, msg: sendMailResult.err }
    } else if (sendMailResult.data) {
      ctx.body = { code: 200, msg: '邮件发送中，请注意查收！', data: sendMailResult.data }
    }
  }
})

module.exports = userRouter
