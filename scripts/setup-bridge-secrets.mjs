import fs from "node:fs/promises";
import crypto from "node:crypto";

await fs.mkdir(".secrets", { recursive: true, mode: 0o700 });
for (const provider of ["codex", "agy"]) {
  const file = `.secrets/${provider}-bridge-token`;
  try {
    await fs.writeFile(
      file,
      crypto.randomBytes(32).toString("base64url") + "\n",
      {
        flag: "wx",
        mode: 0o600,
      },
    );
    console.log(`Created private ${provider} bridge token file.`);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log(`Kept existing ${provider} bridge token file.`);
  }
}
