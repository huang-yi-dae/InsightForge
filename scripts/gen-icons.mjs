// 一次性图标/OG 派生脚本：从 public/icon-source.png 与 public/og.png 生成多尺寸品牌资产。
// 用法：node scripts/gen-icons.mjs
import sharp from "sharp";
import { rm, readFile } from "node:fs/promises";

const P = "public";

async function main() {
  const iconSrc = await readFile(`${P}/icon-source.png`);
  await sharp(iconSrc).resize(512, 512).png().toFile(`${P}/icon.png`);
  await sharp(iconSrc).resize(180, 180).png().toFile(`${P}/apple-icon.png`);
  await sharp(iconSrc).resize(32, 32).png().toFile(`${P}/favicon-32.png`);

  // OG：读入 buffer 后等比覆盖裁剪到 1200x630，再写回同名 og.png
  const ogSrc = await readFile(`${P}/og.png`);
  const og = await sharp(ogSrc)
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();
  await sharp(og).toFile(`${P}/og.png`);

  await rm(`${P}/icon-source.png`, { force: true });
  console.log("icons + og generated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
