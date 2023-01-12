const queryDB = require('../model/db');
const { transaction } = require('../model/transaction')
const streamWriter = require('../utils/streamWriter');
const path = require('path');
const fs = require('fs');
const { MaxPictures } = require('../../project.config')

const publishPost = async ctx => {
  const uid = ctx.uid;
  const body = ctx.request.body;
  const files = ctx.request.files;
  if (!body) {
    ctx.body = { code: 4001, msg: '请求体不能为空' }
  } else if (!body.title || (body.title.length < 5 || body.title.length > 30)) {
    ctx.body = { code: 4002, msg: '帖子标题必须在5~30个字以内' }
  } else if (!body.content || (body.content.length < 5 || body.content.length > 500)) {
    ctx.body = { code: 4003, msg: '帖子内容必须在5~500个字以内' }
  } else {
    const successPictures = []; // 成功保存的图片
    let errResult = null; // 保存错误信息
    if (Reflect.get(files, 'pictures')) {
      // 如果上传了图片就检查图片，然后将图片转换成文件保存到本地，最后向数据库插入数据
      const pictures = (files.pictures instanceof Array) ? files.pictures : [files.pictures];
      if (pictures.length > MaxPictures) {
        errResult = { code: 400, msg: '图片不能超过6张，请重新上传' }
      } else {
        // const successPictures = [];
        for (const picture of pictures) {
          const splits = picture.originalFilename.split('.');
          splits.splice(1, 0, `${+new Date()}`);
          const filename = `${uid}_${splits.join('.').replace(/[.]/, '_')}`;
          const result = await streamWriter(picture.filepath, path.join(__dirname, '../../media/squarePictures', filename));
          if (result.status === 'Done') successPictures.push({ filename, size: result.size });
          else {
            errResult = { code: 400, msg: result.error };
            break;
          }
        }
      }
      // 上传的图片中有部分没有保存成功
      if (pictures.length !== successPictures.length) {
        // 回滚操作:删除successPictures中的图片
        for (let item of successPictures) {
          fs.unlink(path.join(__dirname, '../../media/squarePictures', item.filename), () => {})
        }
        return ctx.body = errResult;
      }
    }

    await queryDB(`insert into meetu_square_articles(title, content, muid, updated_time) values(
      "${body.title}",
      "${body.content}",
      (select muid from meetu_users_muid where user_id=${uid}),
      ${+new Date()})
    `).then(async result => {
      if (successPictures.length) {
        const insertId = result.insertId;
        const sqls = [];
        successPictures.forEach(picture => {
          sqls.push(`insert into meetu_square_pictures(pic_name, size, art_id, updated_time) 
                   values("${picture.filename}",${picture.size},${insertId},"${+new Date()}");`)
        });
        await transaction(sqls).then(arrResult => {
          ctx.body = { code: 200, msg: '发布成功' }
        }).catch(err => {
          // 回滚操作，将保存的图片删除
          for (let item of successPictures) {
            fs.unlink(path.join(__dirname, '../../media/squarePictures', item.filename), () => {})
          }
          ctx.body = { code: 500, msg: '图片数据保存失败，请重新上传' }
        });
      } else {
        ctx.body = { code: 200, msg: '发布成功' }
      }
    }).catch(err => {
      // 回滚操作，将保存的图片删除
      for (let item of successPictures) {
        fs.unlink(path.join(__dirname, '../../media/squarePictures', item.filename), () => {})
      }
      ctx.body = { code: 500, msg: '帖子数据保存失败' }
    });
  }
}

module.exports = {
  publishPost
}
