import { getOpenApiDocument } from '../../utils/openapiDoc'

/** `?lang=en` returns English text; default is the Chinese source. */
export default defineEventHandler((event) => {
  const origin = getRequestURL(event).origin
  const lang = getQuery(event).lang === 'en' ? 'en' : 'zh'
  return getOpenApiDocument(origin, lang)
})
