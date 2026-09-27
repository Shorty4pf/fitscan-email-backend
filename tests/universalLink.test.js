const { test } = require("node:test");
const assert = require("node:assert/strict");
const { toUniversalLinkLanding, describeLinkForLog } = require("../lib/universalLink");

const LANDING = "https://www.noraxai.app/universallink";

test("keeps every Firebase auth query parameter on the universal link", () => {
  const firebase =
    "https://fit-scan-ai.firebaseapp.com/__/auth/action?apiKey=TEST_KEY&mode=signIn&oobCode=TEST_CODE&continueUrl=https%3A%2F%2Fwww.noraxai.app%2Funiversallink&lang=fr";
  const out = new URL(toUniversalLinkLanding(firebase, LANDING));

  assert.equal(out.origin + out.pathname, LANDING);
  assert.equal(out.searchParams.get("mode"), "signIn");
  assert.equal(out.searchParams.get("oobCode"), "TEST_CODE");
  assert.equal(out.searchParams.get("apiKey"), "TEST_KEY");
  assert.equal(out.searchParams.get("continueUrl"), "https://www.noraxai.app/universallink");
  assert.equal(out.searchParams.get("lang"), "fr");

  const embedded = new URL(out.searchParams.get("link"));
  assert.equal(embedded.searchParams.get("oobCode"), "TEST_CODE");
  assert.equal(embedded.searchParams.get("mode"), "signIn");
  assert.equal(embedded.searchParams.get("apiKey"), "TEST_KEY");
});

test("a truncation at the first raw ampersand still carries the full Firebase link", () => {
  const firebase =
    "https://fit-scan-ai.firebaseapp.com/__/auth/action?mode=signIn&oobCode=TEST_CODE&apiKey=TEST_KEY";
  const full = toUniversalLinkLanding(firebase, LANDING);
  const truncated = full.split("&")[0];
  const recovered = new URL(new URL(truncated).searchParams.get("link"));

  assert.equal(recovered.searchParams.get("oobCode"), "TEST_CODE");
  assert.equal(recovered.searchParams.get("mode"), "signIn");
  assert.equal(recovered.searchParams.get("apiKey"), "TEST_KEY");
});

test("describeLinkForLog never includes query values", () => {
  const raw =
    "https://www.noraxai.app/universallink?mode=signIn&oobCode=SECRET&apiKey=SECRET";
  const line = describeLinkForLog(raw);
  assert.match(line, /www\.noraxai\.app\/universallink/);
  assert.match(line, /mode/);
  assert.match(line, /oobCode/);
  assert.equal(line.includes("SECRET"), false);
});
