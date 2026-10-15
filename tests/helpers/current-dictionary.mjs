// Current published dictionary shape, shared by behavior fixtures.
export const currentDictionary = (layers = {}) => ({
  common: {}, main: {}, ec: {}, fc: {}, ronka: {}, acl: {}, endcloset: {}, miramiru: {}, ...layers,
});
export const currentDictionaryText = (layers = {}) => JSON.stringify(currentDictionary(layers));
