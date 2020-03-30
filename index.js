const express = require("express");
const bodyParser = require("body-parser");
const pino = require("express-pino-logger")();
const axiosLib = require("axios");
const fs = require("fs");
const https = require("https");
const to = require("await-to-js").to;
const cors = require("cors");

const app = express();

const configs = {
  prod: {
    mobileBankIdPolicy: "1.2.752.78.1.5",
    bankdIdUrl: "https://appapi2.bankid.com/rp/v5",
    pfx: "YOUR PRODUCTION CERT INFO GOES HERE",
    passphrase: "YOUR PRODUCTION CERT INFO GOES HERE",
    ca: fs.readFileSync(`./cert/prod.ca`)
  },
  test: {
    mobileBankIdPolicy: "1.2.3.4.25",
    bankdIdUrl: "https://appapi2.test.bankid.com/rp/v5",
    pfx: fs.readFileSync("./cert/FPTestcert2_20150818_102329.pfx"),
    passphrase: "qwerty123",
    ca: fs.readFileSync(`./cert/test.ca`)
  }
};

const config = configs.test;

const axios = axiosLib.create({
  httpsAgent: new https.Agent({
    pfx: config.pfx,
    passphrase: config.passphrase,
    ca: config.ca
  }),
  headers: {
    "Content-Type": "application/json"
  }
});

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(pino);

app.get("/api/auth", async (req, res) => {
  const id = req.query.id;
  res.json(await auth(id, "185.198.6.16"));
});

app.post("/api/collect", async (req, res) => {
  const orderRef = req.query.orderRef;
  const status = await collect(orderRef);
  res.send(status);
});

app.listen(3001, () =>
  console.log("Express server is running on localhost:3001")
);

async function call(method, params) {
  const [error, result] = await to(
    axios.post(`${config.bankdIdUrl}/${method}`, params)
  );
  if (error) {
    // You will want to implement your own error handling here
    console.error("Error in call");
    if (error.response && error.response.data) {
      console.error(error.response.data);
      if (error.response.data.errorCode === "alreadyInProgress") {
        console.error(
          "You would have had to call cancel on this orderRef before retrying"
        );
        console.error(
          "The order should now have been automatically cancelled by this premature retry"
        );
      }
    }
    return { error };
  }
  return result.data;
}

const auth = async (personalNumber, endUserIp, otherDevice) =>
  await call("auth", {
    endUserIp,
    personalNumber,
    requirement: {
      allowFingerprint: true,
      ...(otherDevice ? { certificatePolicies: [mobileBankIdPolicy] } : {})
    }
  });

const collect = async orderRef => await call("collect", { orderRef });
