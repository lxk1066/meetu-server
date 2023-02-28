const queryDB = require("../model/db");
const jwt = require("../utils/jwt"); // 生成jwt
const { LoginJwtExpiresIn, jwtSecret, siteUrl } = require("../../project.config");
const { encryptPassword } = require("../utils/encryptPassword"); // 将明文密码用sha256加密
const { verifyJwt } = require("../utils/verifyJWT"); // 验证jwt_token是否合法
const sendMail = require("../utils/email.js"); // 发送邮件
const randomCode = require("../utils/randomCode"); // 生成随机验证码
const randomStr = require("../utils/randomStr");
const redisClient = require("../utils/redis/redis");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const streamWriter = require("../utils/streamWriter");
const renameMuidAction = require("../utils/renameMuid");
const { myQueue } = require("../utils/mq/index");

// 用户登录
const login = async ctx => {
  // 1.拿到请求体中的用户名和密码并验证
  const user = ctx.request.body;

  // 2.查验数据库
  let res;
  if (/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(user.username)) {
    res = await queryDB(`select uid,username,password from meetu_users where email="${user.username}"`);
  } else {
    res = await queryDB(`select uid,username,password from meetu_users where username="${user.username}"`);
  }

  if (res.length <= 0) {
    ctx.body = { code: 403, msg: "用户名或密码错误！" };
  } else if (encryptPassword(user.password) !== res[0].password) {
    ctx.body = { code: 403, msg: "用户名或密码错误！" };
  } else {
    // 2.如果验证成功，生成token
    const token = await jwt.sign(
      {
        uid: res[0].uid
      },
      jwtSecret,
      { expiresIn: LoginJwtExpiresIn }
    );
    // 将token挂载到http的authorization
    // ctx.set('Authorization', token);
    ctx.body = {
      code: 200,
      msg: "登录成功",
      token: token,
      uid: res[0].uid
    };
  }
};

// 用户注册
const register = async ctx => {
  // 1.拿到请求体中的用户名和密码并验证
  const user = ctx.request.body;
  const emailPattern = /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/;

  if (!user.username) {
    ctx.body = { code: 400, msg: "用户名不得为空" };
  } else if (!user.password) {
    ctx.body = { code: 400, msg: "密码不得为空" };
  } else if (!user.email) {
    ctx.body = { code: 400, msg: "邮箱不得为空" };
  } else if (!user.emailVerifyCode) {
    ctx.body = { code: 400, msg: "验证码不得为空" };
  } else if (user.username.toString().length < 4 || user.username.toString().length > 30) {
    ctx.body = { code: 400, msg: "用户名必须为4~30个字符" };
  } else if (emailPattern.test(user.username.toString())) {
    ctx.body = { code: 400, msg: "用户名不能是邮箱格式" };
  } else if (!emailPattern.test(user.email.toString())) {
    ctx.body = { code: 400, msg: "邮箱格式错误！" };
  } else if (!/^(?=.*[a-zA-Z])(?=.*[0-9])[A-Za-z0-9,._!@#$^&*]{8,20}$/.test(user.password.toString())) {
    ctx.body = { code: 400, msg: "密码8~20位，必须包含大小写字母和数字，特殊字符可选(,._!@#$^&*)" };
  } else {
    // 2.验证邮箱
    if ((await redisClient(0).exists(user.email)) === 0) {
      return (ctx.body = { code: 400, msg: "验证码已过期或不存在！" });
    } else {
      const verifyCode = await redisClient(0).getString(user.email);
      if (String(user.emailVerifyCode) !== verifyCode) return (ctx.body = { code: 400, msg: "验证码无效！" });
    }

    // 3.查验数据库
    const res1 = await queryDB(`select username,email from meetu_users where username="${user.username}"`);
    const res2 = await queryDB(`select username,email from meetu_users where email="${user.email}"`);

    if (res1.length === 0 && res2.length === 0) {
      // 允许注册
      const createdTime = +new Date();
      await redisClient(0).delString(user.email);
      await queryDB(`INSERT INTO meetu_users 
                      (username, password, email, profile, gender, sign, area, created_time) 
                      VALUES("${user.username}", "${encryptPassword(user.password)}", "${user.email}", 
                      "default.png", "secrecy", "这个人很懒，什么都没有写。", "secrecy", "${createdTime}")`).then(
        async ({ insertId }) => {
          // 向 meetu_users_muid表中插入默认的MUID
          await queryDB(
            `INSERT INTO meetu_users_muid VALUES ("${insertId}_${randomStr(
              10 - insertId.toString().length - 1
            )}", "${insertId}", "0")`
          )
            .then(() => {
              ctx.body = { code: 200, msg: "注册成功" };
            })
            .catch(err => {
              console.log("err", err);
              ctx.body = { code: 500, msg: "数据插入失败, 请前往设置中心手动配置MUID!" };
            });
        }
      );
    } else {
      if (res1.length) {
        // 用户名已存在
        ctx.body = { code: 400, msg: "用户名已存在" };
      } else if (res2.length) {
        // 邮箱已被注册
        ctx.body = { code: 400, msg: "邮箱已被注册" };
      }
    }
  }
};

// 验证jwt_token是否正确
const verifyToken = async ctx => {
  const token = ctx.request.get("authorization");
  verifyJwt(token)
    .then(results => {
      console.log(results);
      ctx.body = { code: 200, msg: "有效Token" };
    })
    .catch(err => {
      console.log(err);
      // ctx.app.emit("error", )
      ctx.body = { code: 403, msg: "无效Token" };
    });
};

// 发送邮件
const email = async ctx => {
  const emailBox = ctx.request.body.email;
  if (await redisClient(0).exists(emailBox)) {
    ctx.body = { code: 400, msg: "验证码已存在" };
  } else {
    // 生成随机验证码
    const verifyCode = randomCode(6);
    // 将验证码存储到redis中
    let setStringResult = await redisClient(0).setString(emailBox, verifyCode, 60 * 5);
    while (setStringResult !== "OK") {
      setStringResult = await redisClient(0).setString(emailBox, verifyCode, 60 * 5);
    }
    // 发送邮件
    const emailContent = `<p>尊敬的用户你好，你正在[Meetu]申请注册账号，验证码：${verifyCode}，5分钟内有效。请确认是否为本人操作，如果不是，请忽略本邮件。</p>
                          <h1 style="font-size: 25px;text-align: left;">${verifyCode}</h1>`;

    myQueue.add("send-email", { subject: "[Meetu]注册验证码", to: emailBox, text: emailContent });
    // const res = await sendMail("[Meetu]验证码", emailBox, emailContent);

    ctx.body = { code: 200, msg: "邮件发送中，请注意查收！", data: null };

    // if (res.err) {
    //   ctx.body = { code: 403, msg: res.err };
    // } else if (res.data) {
    //   ctx.body = { code: 200, msg: "邮件发送中，请注意查收！", data: null };
    // }
  }
};

// 上传头像
const uploadProfile = async ctx => {
  const uid = ctx.uid;
  const files = ctx.request.files;

  if (!Reflect.get(files, "profile")) {
    return (ctx.body = { code: 400, msg: "请上传图片" });
  }

  const profile = files.profile instanceof Array ? files.profile[0] : files.profile;
  const splits = profile.originalFilename.split(".");
  splits.splice(1, 0, `${+new Date()}`);
  const filename = `${uid}_${splits.join(".").replace(/[.]/, "_")}`;
  const result = await streamWriter(profile.filepath, path.join(__dirname, "../../media/profile", filename));

  if (result.status === "Done") {
    try {
      // 如果用户之前上传过图片，需要将旧的删掉
      const res = await queryDB(`select profile from meetu_users where uid="${uid}"`);

      await queryDB(`UPDATE meetu_users SET profile="${filename}" WHERE uid=${parseInt(uid)}`);

      if (res[0].profile !== "default.png") {
        fs.unlink(path.join(__dirname, "../../media/profile/", res[0].profile), () => {});
      }

      ctx.body = { code: 200, msg: "上传成功" };
    } catch (e) {
      fs.unlink(path.join(__dirname, "../../media/profile", filename), () => {});
      ctx.body = { code: 500, msg: "上传失败" };
    }
  } else {
    ctx.body = { code: 500, msg: "图片保存失败, " + result.error };
  }
};

// 获取个人信息
const getPersonInfo = async ctx => {
  const uid = ctx.params.uid;
  const res = await queryDB(`select
                      users.username,users.profile,users.gender,users.sign,users.area,users_muid.muid
                      from meetu_users as users left join meetu_users_muid as users_muid on users_muid.user_id=${uid}
                      where users.uid=${uid};`);
  // console.log(res);

  ctx.body = {
    code: 200,
    data: {
      profile: res[0].profile,
      username: res[0].username,
      gender: res[0].gender,
      sign: res[0].sign,
      area: res[0].area,
      muid: res[0].muid
    }
  };
};

// 获取用户的邮箱地址
const getMailbox = async ctx => {
  const uid = ctx.uid;
  const res = await queryDB(`select email from meetu_users where uid=${uid}`);
  const email = res[0].email;
  const number = email.slice(0, email.indexOf("@"));
  const suffix = email.slice(email.indexOf("@"), email.length);

  ctx.body = {
    code: 200,
    data: {
      email: `${number.slice(0, 3)}****${number.slice(number.length - 3, number.length)}${suffix}`
    }
  };
};

// 获取头像
const getProfile = async ctx => {
  const filename = ctx.params.filename;
  let filePath = path.join(__dirname, "../../media/profile/", filename);
  let file;
  try {
    file = fs.readFileSync(filePath); //读取文件
  } catch (error) {
    //如果服务器不存在请求的图片，返回默认图片
    filePath = path.join(__dirname, "../../media/profile/default.png"); //默认图片地址
    file = fs.readFileSync(filePath); //读取文件
  }
  const mimeType = mime.lookup(filePath); // 文件类型
  ctx.set("Content-Type", mimeType); //设置返回类型
  ctx.body = file; //返回图片
};

// 修改用户名
const updateUsername = async ctx => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  if (!body.username || body.username.toString().length < 4 || body.username.toString().length > 30) {
    ctx.body = { code: 400, msg: "用户名必须为4~30个字符" };
  } else if (/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(body.username.toString())) {
    ctx.body = { code: 400, msg: "用户名不能是邮箱格式" };
  } else {
    await queryDB(`select uid from meetu_users where username="${body.username}"`)
      .then(async result => {
        if (result.length > 0) {
          ctx.body = { code: 400, msg: "用户名已存在" };
        } else {
          await queryDB(`UPDATE meetu_users SET username="${body.username}" WHERE uid=${parseInt(uid)}`)
            .then(() => {
              ctx.body = { code: 200, msg: "修改成功" };
            })
            .catch(() => {
              ctx.body = { code: 500, msg: "修改失败" };
            });
        }
      })
      .catch(() => {
        ctx.body = { code: 500, msg: "查询数据库错误" };
      });
  }
};

// 发送`修改用户密码`的邮件
const updatePasswordEmail = async ctx => {
  const uid = ctx.uid;
  const res = await queryDB(`select email from meetu_users where uid=${uid}`);
  const email = res[0].email;
  // 生成唯一的链接：前端路由 + 唯一加密标识。加密标识由jwt生成，将小数点替换为短横线
  const token = await jwt.sign({ uid }, jwtSecret, { expiresIn: "72h" });
  await redisClient(2).setString(uid.toString(), token, 60 * 60 * 72);
  const { href: url } = new URL(`/#/changePassword/${token.replace(/[.]/g, "*")}`, siteUrl);
  // 发送邮件
  const emailContent = `<p>尊敬的用户请注意，你正在[Meetu]申请修改账号的密码，请点击下方链接 前往修改密码，该链接72小时内有效，修改成功后立即失效。请妥善保管本邮件，切勿将修改链接告知他人。</p>
                        <a href="${url}" style="font-size: 15px;text-align: left;">${url}</a>`;

  myQueue.add("send-email", { subject: "[Meetu]修改密码", to: email, text: emailContent });
  // const sendMailResult = await sendMail("[Meetu]修改密码", email, emailContent);

  ctx.body = { code: 200, msg: "邮件发送中，请注意查收！", data: null };

  // if (sendMailResult.err) {
  //   ctx.body = { code: 403, msg: sendMailResult.err };
  // } else if (sendMailResult.data) {
  //   ctx.body = { code: 200, msg: "邮件发送中，请注意查收！", data: sendMailResult.data };
  // }
};

// 修改用户密码
const changePassword = async ctx => {
  const { token, password } = ctx.request.body;
  const restoreToken = token.replace(/[*]/g, "."); // 还原token
  if (restoreToken) {
    console.log(restoreToken);
    await verifyJwt(restoreToken)
      .then(async results => {
        const uid = results.uid;
        await redisClient(2)
          .getString(uid.toString())
          .then(async token => {
            if (token === restoreToken) {
              if (/^(?=.*[a-zA-Z])(?=.*[0-9])[A-Za-z0-9,._!@#$^&*]{8,20}$/.test(password.trim())) {
                // 允许修改密码
                await queryDB(`UPDATE meetu_users SET password="${encryptPassword(password)}" WHERE uid=${uid}`)
                  .then(async () => {
                    ctx.body = { code: 200, msg: "修改成功" };
                    // 立即删除redis中的记录
                    await redisClient(2)
                      .delString(uid.toString())
                      .catch(() => {});
                  })
                  .catch(() => {
                    ctx.body = { code: 500, msg: "修改失败" };
                  });
              } else {
                ctx.body = { code: 403, msg: "密码格式错误" };
              }
            } else {
              ctx.body = { code: 4031, msg: "token已过期" };
            }
          })
          .catch(() => {
            ctx.body = { code: 4032, msg: "token已过期" };
          });
      })
      .catch(err => {
        console.log(err);
        ctx.body = { code: 403, msg: "无效Token" };
      });
  }
};

// 修改个性签名
const updateSign = async ctx => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  if (!body.sign || body.sign.toString().trim().length > 80) {
    ctx.body = { code: 400, msg: "个性签名必须为1~80个字符" };
  } else {
    await queryDB(`UPDATE meetu_users SET sign="${body.sign}" WHERE uid=${parseInt(uid)}`)
      .then(() => {
        ctx.body = { code: 200, msg: "修改成功" };
      })
      .catch(() => {
        ctx.body = { code: 500, msg: "修改失败" };
      });
  }
};

// 修改性别
const updateGender = async ctx => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  if (!body.gender || (body.gender !== "male" && body.gender !== "female")) {
    ctx.body = { code: 400, msg: "性别必须为 male、female 其中之一" };
  } else {
    await queryDB(`select gender from meetu_users WHERE uid=${parseInt(uid)}`).then(async result => {
      if (result[0].gender === "male" || result[0].gender === "female") {
        ctx.body = { code: 400, msg: "性别只能修改一次哦" };
      } else {
        await queryDB(`UPDATE meetu_users SET gender="${body.gender}" WHERE uid=${parseInt(uid)}`)
          .then(() => {
            ctx.body = { code: 200, msg: "修改成功" };
          })
          .catch(() => {
            ctx.body = { code: 500, msg: "修改失败" };
          });
      }
    });
  }
};

// 修改地区area
const updateArea = async ctx => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  const area = body.area.toString().trim();
  if (!body.area || area.length > 30 || area.split("/").length !== 3) {
    ctx.body = { code: 400, msg: "地区格式不合法，正确格式为: 省份/城市/区县。" };
  } else {
    await queryDB(`UPDATE meetu_users SET area="${area}" WHERE uid=${parseInt(uid)}`)
      .then(() => {
        ctx.body = { code: 200, msg: "修改成功" };
      })
      .catch(() => {
        ctx.body = { code: 500, msg: "修改失败" };
      });
  }
};

// 修改邮箱地址
const modifyMailbox = async ctx => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  const res = await queryDB(`select email from meetu_users where uid=${uid}`);
  const emailPattern = /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/;
  if (!body.newEmail || !emailPattern.test(body.newEmail)) {
    ctx.body = { code: 400, msg: "邮箱格式不合法" };
  } else if (!body.verifyCode) {
    ctx.body = { code: 400, msg: "缺少验证码" };
  } else {
    await redisClient(2)
      .getString(body.newEmail.toString())
      .then(async result => {
        if (result === body.verifyCode) {
          await queryDB(`UPDATE meetu_users SET email="${body.newEmail}" WHERE uid=${parseInt(uid)}`)
            .then(async () => {
              if (res[0].email) await redisClient(2).delString(res[0].email);
              ctx.body = { code: 200, msg: "修改成功" };
            })
            .catch(() => {
              ctx.body = { code: 500, msg: "修改失败" };
            });
        } else {
          ctx.body = { code: 400, msg: "验证码无效" };
        }
      })
      .catch(() => {
        ctx.body = { code: 400, msg: "验证码无效" };
      });
  }
};

// 将每个用户的id返回
const getAllUserId = async ctx => {
  const res = await queryDB("select uid from meetu_users");
  ctx.body = { code: 200, data: res };
};

// 发送`修改邮箱`的验证码邮件
const ModifyMailboxLetter = async ctx => {
  const uid = ctx.uid;
  const res = await queryDB(`select email from meetu_users where uid=${uid}`);
  const email = res[0].email;
  if (await redisClient(2).exists(email)) {
    ctx.body = { code: 400, msg: "验证码已存在" };
  } else {
    // 生成随机验证码
    const verifyCode = randomCode(6);
    // 将验证码存储到redis中
    let setStringResult = await redisClient(2).setString(email, verifyCode, 60 * 5);

    while (setStringResult !== "OK") {
      setStringResult = await redisClient(2).setString(email, verifyCode, 60 * 5);
    }
    // 发送邮件
    const emailContent = `<p>尊敬的用户你好，你正在[Meetu]申请修改邮箱地址，验证码：${verifyCode}，5分钟内有效。请确认是否为本人操作，如果不是，请忽略本邮件。</p>
                          <h1 style="font-size: 25px;text-align: left;">${verifyCode}</h1>`;

    myQueue.add("send-email", { subject: "[Meetu]修改邮箱地址", to: email, text: emailContent });
    // const sendMailResult = await sendMail("[Meetu]修改邮箱地址", email, emailContent);

    ctx.body = { code: 200, msg: "邮件发送中，请注意查收！", data: null };

    // if (sendMailResult.err) {
    //   ctx.body = { code: 403, msg: sendMailResult.err };
    // } else if (sendMailResult.data) {
    //   ctx.body = { code: 200, msg: "邮件发送中，请注意查收！", data: sendMailResult.data };
    // }
  }
};

// 获取用户的MUID
const getUserMUID = async ctx => {
  const uid = ctx.request.params.uid;
  await queryDB(`select muid from meetu_users_muid where user_id="${uid}"`)
    .then(res => {
      if (res.length > 0) {
        ctx.body = { code: 200, data: { muid: res[0].muid } };
      } else {
        ctx.body = { code: 404, msg: "未找到该用户的MUID" };
      }
    })
    .catch(err => {
      console.log("getUserMUID error:", err);
      ctx.body = { code: 400, msg: "查询有误" };
    });
};

// 修改用户的MUID
const updateMUID = async ctx => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  const muidPattern = /^[a-z0-9]{6,10}$/;
  if (!body.newMUID || !muidPattern.test(body.newMUID)) {
    ctx.body = { code: 400, msg: "MUID仅支持6~10位的纯数字 或 小写英文字母+数字。" };
  } else {
    // 判断MUID是否已经被占用
    await queryDB(`select user_id from meetu_users_muid where muid="${body.newMUID}" limit 1`).then(async res => {
      if (res.length > 0) {
        // MUID已被占用
        if (res[0].user_id === uid) ctx.body = { code: 400, msg: "新MUID不能与旧MUID相同" };
        else ctx.body = { code: 500, msg: "MUID已被占用" };
      } else {
        // 允许修改MUID
        await queryDB(`select muid,updated_time from meetu_users_muid where user_id="${uid}"`).then(async result => {
          const oldMUID = result[0].muid;
          if (result.length > 0) {
            // 距离上次修改时间间隔大于365天，允许修改
            if (+new Date() - parseInt(result[0].updated_time) > 86400000 * 365) {
              await queryDB(
                `UPDATE meetu_users_muid SET muid="${
                  body.newMUID
                }",updated_time="${+new Date()}" WHERE user_id="${uid}"`
              )
                .then(async () => {
                  // 用户修改MUID，通知列表的key也要跟着换
                  await renameMuidAction(oldMUID, body.newMUID).catch(err => {
                    console.log("updateMUID renameMuidAction error: ", err);
                  });
                  ctx.body = { code: 200, msg: "修改成功" };
                })
                .catch(err => {
                  console.log("updateMUID error:", err);
                  ctx.body = { code: 500, msg: "修改失败" };
                });
            } else {
              ctx.body = { code: 404, msg: "距离上次修改间隔小于365天，不可修改" };
            }
          } else {
            await queryDB(`INSERT INTO meetu_users_muid VALUES ("${body.newMUID}", "${uid}", "${+new Date()}")`)
              .then(() => {
                ctx.body = { code: 200, msg: "修改成功" };
              })
              .catch(err => {
                console.log("updateMUID error:", err);
                ctx.body = { code: 500, msg: "修改失败" };
              });
          }
        });
      }
    });
  }
};

// 搜索MUID查找用户
const searchMUID = async ctx => {
  const body = ctx.request.body;
  if (!body.muid) {
    ctx.body = { code: 400, msg: "缺少必需参数muid" };
  } else {
    await queryDB(`select user_id from meetu_users_muid where muid like "%${body.muid}%"`)
      .then(res => {
        const result = res.map(item => item.user_id);
        ctx.body = { code: 200, data: { users: result } };
      })
      .catch(err => {
        console.log("searchMUID error:", err);
        ctx.body = { code: 500, msg: "搜索错误" };
      });
  }
};

// 查询某个MUID是否为当前用户的好友
const isOwnFriend = async ctx => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  if (!body.muid) {
    ctx.body = { code: 400, msg: "缺少必需参数muid" };
  } else {
    await queryDB(`select user_muid,friend_muid from meetu_users_relation where 
            (user_muid=(select muid from meetu_users_muid where user_id='${uid}') and friend_muid="${body.muid}")
            or (friend_muid=(select muid from meetu_users_muid where user_id='${uid}') and user_muid="${body.muid}");`)
      .then(result => {
        if (result.length) {
          ctx.body = { code: 200, msg: "好友关系存在" };
        } else {
          ctx.body = { code: 404, msg: "好友关系不存在" };
        }
      })
      .catch(err => {
        console.log("isOwnFriend error: ", err);
        ctx.body = { code: 500, msg: "数据库查询失败" };
      });
  }
};

// 获取当前用户的好友列表
const getAllFriends = async ctx => {
  const uid = ctx.uid;
  await queryDB(`select friend_muid from meetu_users_relation where user_muid=(select muid from meetu_users_muid where user_id='${uid}') UNION
              select user_muid from meetu_users_relation where friend_muid=(select muid from meetu_users_muid where user_id='${uid}');`)
    .then(result => {
      const friendsArr = result.map(item => item.friend_muid);
      ctx.body = { code: 200, data: { friends: friendsArr } };
    })
    .catch(err => {
      console.log("getAllFriends error: ", err);
      ctx.body = { code: 500, msg: "查询错误" };
    });
};

// 根据MUID来查询该用户的个人信息
const getMuidUserInfo = async ctx => {
  const muid = ctx.params.muid;
  if (!muid) {
    ctx.body = { code: 400, msg: "缺少必需参数muid" };
  } else {
    await queryDB(`select user_id from meetu_users_muid where muid="${muid}"`)
      .then(async res => {
        if (!res.length) ctx.body = { code: 400, msg: "查无此用户" };
        else {
          const uid = res[0].user_id;
          await queryDB(`select users.username,users.profile,users.gender,users.sign,users.area,users_muid.muid
                      from meetu_users as users left join meetu_users_muid as users_muid on users_muid.user_id=${uid}
                      where users.uid=${uid};`)
            .then(result => {
              ctx.body = {
                code: 200,
                data: {
                  uid: uid,
                  profile: result[0].profile,
                  username: result[0].username,
                  gender: result[0].gender,
                  sign: result[0].sign,
                  area: result[0].area
                }
              };
            })
            .catch(err => {
              console.log("getMuidUserInfo error: ", err);
              ctx.body = { code: 500, msg: "读取数据错误" };
            });
        }
      })
      .catch(err => {
        console.log("searchMUID error:", err);
        ctx.body = { code: 500, msg: "搜索错误" };
      });
  }
};

module.exports = {
  login,
  register,
  verifyToken,
  email,
  uploadProfile,
  getPersonInfo,
  getMailbox,
  getProfile,
  updateUsername,
  updatePasswordEmail,
  changePassword,
  updateSign,
  updateGender,
  updateArea,
  modifyMailbox,
  getAllUserId,
  ModifyMailboxLetter,
  getUserMUID,
  updateMUID,
  searchMUID,
  isOwnFriend,
  getAllFriends,
  getMuidUserInfo
};
