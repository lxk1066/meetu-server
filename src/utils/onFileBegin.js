const path = require('path')
exports.onFileBegin = (name, file) => {
  // console.log(name, file)
  const splits = file.originalFilename.split('.')
  if (splits[splits.length - 1] === "jpeg") splits.splice(splits.length - 1, 1, "jpg")
  splits.splice(1, 0, `${+new Date()}`)
  file.newFilename = splits.join('.').replace(/[.]/, '_')
  file.filepath = path.join(__dirname, '../../media/profile/') + file.newFilename
}