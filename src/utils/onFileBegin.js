const path = require('path')
exports.onFileBegin = (name, file) => {
  // console.log(name, file)
  const splits = file.originalFilename.split('.')
  splits.splice(1, 0, `${+new Date()}`)
  file.newFilename = splits.join('.').replace(/[.]/, '_')
  file.filepath = path.join(__dirname, '../../media/profile/') + file.newFilename
}