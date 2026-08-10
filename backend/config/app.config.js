require("dotenv").config();

const appConfig = {
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || "development",
};

module.exports = appConfig;
