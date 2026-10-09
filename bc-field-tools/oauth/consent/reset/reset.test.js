"use strict";
const {describe,it} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const recovery = require("./reset.js");
describe("isolated YouTube consent recovery", () => {
  it("recognizes PKCE code callback without exporting its token", () => {
    assert.equal(recovery.isRecoveryCallback(recovery.CALLBACK_URL+"?code=test"),true);
    assert.equal(recovery.isRecoveryCallback(recovery.CALLBACK_URL),false);
  });
  it("recognizes implicit recovery only with both session tokens", () => {
    assert.equal(recovery.isRecoveryCallback(recovery.CALLBACK_URL+"#type=recovery&access_token=a&refresh_token=r"),true);
    assert.equal(recovery.isRecoveryCallback(recovery.CALLBACK_URL+"#type=recovery&access_token=a"),false);
  });
  it("requires matching new passwords", () => {
    assert.match(recovery.validatePasswords("short","short"),/8文字/);
    assert.match(recovery.validatePasswords("strongpass123","otherpass123"),/一致/);
    assert.equal(recovery.validatePasswords("strongpass123","strongpass123"),"");
  });
  it("never contacts any other Supabase project", () => {
    const files=["../consent-config.js","index.html","reset.js"];
    const source=files.map(f=>fs.readFileSync(path.join(__dirname,f),"utf8")).join("\n");
    assert.doesNotMatch(source,/xvrrlwlgoxbrkhlfyznx|BC_FIELD_CASES_CONFIG/);
    assert.match(source,/ahtmiobqemzrpqxowevc/);
    assert.match(source,/resetPasswordForEmail/);
    assert.match(source,/updateUser/);
  });
  it("rejects bad recovery codes without changing passwords", async () => {
    const supabase={auth:{exchangeCodeForSession:async()=>({error:{message:"expired"},data:{}})}};
    const r=await recovery.consumeRecovery(supabase,recovery.CALLBACK_URL+"?code=expired");
    assert.equal(r.ok,false);
  });
  it("uses a successful recovery exchange to unlock the form", async () => {
    const supabase={auth:{exchangeCodeForSession:async()=>({error:null,data:{session:{access_token:"ok"}}})}};
    const r=await recovery.consumeRecovery(supabase,recovery.CALLBACK_URL+"?code=valid");
    assert.equal(r.ok,true);
  });
});
