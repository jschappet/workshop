// Set at build time; no device token is included in the frontend.
module.exports = {
  apiBase: process.env.IOT_API_BASE || '/api/iot',
};
