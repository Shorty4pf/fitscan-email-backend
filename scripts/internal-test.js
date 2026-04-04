const http = require("http");

const PORT = Number(process.env.PORT) || 3000;
const body = JSON.stringify({ email: "test@fitscanai.app" });

const req = http.request(
  {
    hostname: "127.0.0.1",
    port: PORT,
    path: "/auth/email-link/send",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  },
  (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => {
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      if (ok) {
        console.log("INTERNAL_TEST: SUCCESS");
        try {
          console.log("Response:", JSON.stringify(JSON.parse(data), null, 2));
        } catch {
          console.log("Response:", data);
        }
      } else {
        console.log("INTERNAL_TEST: ERROR");
        console.log("Status:", res.statusCode, data);
      }
      process.exit(ok ? 0 : 1);
    });
  }
);

req.on("error", (e) => {
  console.log("INTERNAL_TEST: ERROR");
  console.log(e.message);
  process.exit(1);
});

req.write(body);
req.end();
