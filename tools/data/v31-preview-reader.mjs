// V3.1 试读与 V3 安全回退证明：不导入现有脚本数据层，不会改变七站生产读路径。
import { createHash } from 'node:crypto';
import { validV3Manifest } from '../../src/core/v3-contract.js';
import { validV31Manifest } from './v31-contract.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// 试读端对每条响应重新校验 UTF-8 字节长度与 SHA；不能仅信任 manifest。
async function readVerified(loader, meta) {
  if (typeof loader !== 'function' || !meta) return null;
  try {
    const text = await loader(meta.url);
    if (typeof text !== 'string') return null;
    const bytes = Buffer.from(text, 'utf8');
    // 旧 V3 离线缓存可能没有 bytes 字段，仍必须强制 SHA 校验。
    const correctBytes = meta.bytes === undefined || bytes.length === meta.bytes;
    return correctBytes && digest(bytes) === meta.sha256 ? text : null;
  } catch (error) {
    // 网络失败触发受校验的旧 V3 回退，而不是接受损坏的新对象。
    return null;
  }
}

export async function readV31WithV3Fallback(options) {
  const { previewManifest, legacyManifest, siteId, name, fetchPreview, fetchLegacy } = options;
  // 双协议并存时，只使用与当前 V3 快照同版本的预览，避免跨代混读。
  const legacyValid = validV3Manifest(legacyManifest);
  if (legacyValid && validV31Manifest(previewManifest)
    && previewManifest.source.version === legacyManifest.version) {
    const meta = name === 'dict'
      ? previewManifest.shared.dict : previewManifest.sites[siteId]?.files?.[name];
    const data = await readVerified(fetchPreview, meta);
    if (data !== null) return { source: 'v31', text: data };
  }
  if (!legacyValid) return null;
  const oldMeta = name === 'dict'
    ? legacyManifest.shared?.dict : legacyManifest.sites[siteId]?.files?.[name];
  const oldText = await readVerified(fetchLegacy, oldMeta);
  return oldText === null ? null : { source: 'v3', text: oldText };
}
