const mongoose = require("mongoose");

const salesAgentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Sales Agent name is required"],
    },
    email: {
      type: String,
      required: [true, "Sales Agent email is required"],
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SalesAgent", salesAgentSchema);
