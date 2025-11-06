const mongoose = require("mongoose");
require("dotenv").config();

const mongoUri = process.env.MONGODB;

const initialDatabase = async () => {
  await mongoose
    .connect(mongoUri)
    .then(() => {
      console.log("Connected with MongoDB");
    })
    .catch((error) => console.log("Error in connecting DB", error));
};

module.exports = { initialDatabase };
