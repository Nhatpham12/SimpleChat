const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./common/connect");
const seedAdmin = require("./sedders/adminSeeder");
const routes = require("./routes/users.routes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", routes);

app.get("/api/test-db", (req, res) => {
  pool.query("SELECT 1 AS result", (err, results) => {
    if (err) {
      console.error("DB connection failed:", err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    res.json({ status: "ok", message: "Database connected successfully", result: results[0] });
  });
});

const PORT = process.env.PORT || 5001;

seedAdmin()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to seed admin:", err.message);
    process.exit(1);
  });
