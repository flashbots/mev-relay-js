module.exports.writeError = (res, statusCode, errMsg) => {
  res.status(statusCode)
  res.json({ error: { message: errMsg } })
}
