function randomGuid() {
  let guid = "";
  for (let i = 1; i <= 32; i++) {
    const n = Math.floor(Math.random() * 16.0).toString(16);
    guid += n;
  }

  return guid;
}

module.exports = randomGuid;
