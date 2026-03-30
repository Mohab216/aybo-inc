const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());

app.get("/api/health", (req, res) => {
  res.json({ message: "SERVER OK" });
});

app.listen(4000, () => {
  console.log("SERVER RUNNING ON 4000");
});
