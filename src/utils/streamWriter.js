const fs = require('fs')
const path = require('path')
const { MaxFileSize } = require('../../project.config')
// exports.onFileBegin = (name, file) => {
//   // console.log(name, file)
//   const splits = file.originalFilename.split('.')
//   if (splits[splits.length - 1] === "jpeg") splits.splice(splits.length - 1, 1, "jpg")
//   splits.splice(1, 0, `${+new Date()}`)
//   file.newFilename = splits.join('.').replace(/[.]/, '_')
//   file.filepath = path.join(__dirname, '../../media/profile/') + file.newFilename
// }

module.exports = function streamWriter (filePath, fileResource) {
  return new Promise(async (resolve) => {
    const info = await fs.promises.stat(filePath); // 获取文件大小
    if (info.size > MaxFileSize) {
      // 单个文件大小超出上限，删除文件
      fs.unlink(path.join(__dirname, '../../media/squarePictures', fileResource), () => {});
      resolve({ status: 'Failed', error: '单个文件大小超出上限' })
    } else {
      const readStream = fs.createReadStream(path.join(filePath));
      const writeStream = fs.createWriteStream(fileResource);
      readStream.pipe(writeStream);

      readStream.on('end', async () => {
        resolve({ status: 'Done', size: info.size })
      });
      readStream.on('error', (error) => {
        resolve({ status: 'Failed', error })
      });
    }
  })
}
