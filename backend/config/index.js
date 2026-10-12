const databaseConfig = require("./database.config");
const jwtConfig = require("./jwt.config");
const corsConfig = require("./cors.config");
const appConfig = require("./app.config");
const cloudinaryConfig = require("./cloudinary.config");
const mailConfig = require("./mail.config");

module.exports = {
  database: databaseConfig,
  jwt: jwtConfig,
  cors: corsConfig,
  app: appConfig,
  cloudinary: cloudinaryConfig,
  mail: mailConfig,
};
